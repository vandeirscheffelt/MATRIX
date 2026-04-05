import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseCalo } from '../../lib/supabase.js'

const breederBody = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
})

const listQuery = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function breedersRoutes(app: FastifyInstance) {

  app.get('/', async (request, reply) => {
    const query = listQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { search, limit, offset } = query.data
    const sb = supabaseCalo()

    let q = sb.from('breeders').select('*').order('name').range(offset, offset + limit - 1)
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`)

    const { data, error } = await q
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send({ data, limit, offset })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { data, error } = await supabaseCalo()
      .from('breeders')
      .select('*, parents(*), chicks(*)')
      .eq('id', id)
      .single()
    if (error) return reply.code(404).send({ error: 'Criador não encontrado' })
    return reply.send(data)
  })

  app.post('/', async (request, reply) => {
    const body = breederBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await supabaseCalo().from('breeders').insert(body.data).select().single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = breederBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await supabaseCalo().from('breeders').update(body.data).eq('id', id).select().single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send(data)
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Bloqueia se tiver filhotes ativos
    const { count } = await supabaseCalo()
      .from('chicks')
      .select('*', { count: 'exact', head: true })
      .eq('breeder_id', id)
      .in('status', ['available', 'reserved'])

    if (count && count > 0) {
      return reply.code(409).send({ error: 'Criador possui filhotes ativos. Remova-os antes de excluir.' })
    }

    const { error } = await supabaseCalo().from('breeders').delete().eq('id', id)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
