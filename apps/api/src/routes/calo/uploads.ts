import type { FastifyInstance } from 'fastify'
import { supabaseAdmin, supabaseCalo } from '../../lib/supabase.js'

const BUCKET = 'calo'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

// target: 'chick' | 'parent'
// id: UUID do filhote ou do pai

export async function uploadsRoutes(app: FastifyInstance) {

  // POST /calo/uploads/:target/:id
  // multipart/form-data com campo "photo" (arquivo)
  app.post('/:target/:id', async (request, reply) => {
    const { target, id } = request.params as { target: string; id: string }

    if (!['chick', 'parent'].includes(target)) {
      return reply.code(400).send({ error: 'target deve ser "chick" ou "parent"' })
    }

    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Nenhum arquivo enviado' })

    if (!ALLOWED_MIME.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.' })
    }

    const buffer = await data.toBuffer()
    if (buffer.byteLength > MAX_SIZE) {
      return reply.code(400).send({ error: 'Arquivo muito grande. Máximo 5MB.' })
    }

    const ext = data.mimetype.split('/')[1].replace('jpeg', 'jpg')
    const path = `${target}s/${id}/${Date.now()}.${ext}`

    const sb = supabaseAdmin()
    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: data.mimetype, upsert: false })

    if (uploadError) return reply.code(500).send({ error: uploadError.message })

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    // Adiciona URL ao array de fotos do registro correspondente
    const calo = supabaseCalo()
    const table = target === 'chick' ? 'chicks' : 'parents'

    const { data: record, error: fetchError } = await calo
      .from(table)
      .select('photos')
      .eq('id', id)
      .single()

    if (fetchError) return reply.code(404).send({ error: `${target} não encontrado` })

    const photos = [...((record.photos as string[]) ?? []), publicUrl]

    const { error: updateError } = await calo.from(table).update({ photos }).eq('id', id)
    if (updateError) return reply.code(500).send({ error: updateError.message })

    return reply.code(201).send({ url: publicUrl, photos })
  })

  // DELETE /calo/uploads/:target/:id
  // body: { url: string }
  app.delete('/:target/:id', async (request, reply) => {
    const { target, id } = request.params as { target: string; id: string }
    const { url } = request.body as { url: string }

    if (!['chick', 'parent'].includes(target)) {
      return reply.code(400).send({ error: 'target deve ser "chick" ou "parent"' })
    }
    if (!url) return reply.code(400).send({ error: 'url é obrigatória' })

    // Extrai o path relativo do bucket a partir da URL pública
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return reply.code(400).send({ error: 'URL inválida' })
    const storagePath = url.slice(idx + marker.length)

    const sb = supabaseAdmin()
    const { error: deleteError } = await sb.storage.from(BUCKET).remove([storagePath])
    if (deleteError) return reply.code(500).send({ error: deleteError.message })

    // Remove URL do array de fotos
    const calo = supabaseCalo()
    const table = target === 'chick' ? 'chicks' : 'parents'

    const { data: record, error: fetchError } = await calo
      .from(table)
      .select('photos')
      .eq('id', id)
      .single()

    if (fetchError) return reply.code(404).send({ error: `${target} não encontrado` })

    const photos = ((record.photos as string[]) ?? []).filter(p => p !== url)
    await calo.from(table).update({ photos }).eq('id', id)

    return reply.send({ photos })
  })
}
