import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseCalo } from '../../lib/supabase.js'

const parentBody = z.object({
  breeder_id: z.string().uuid(),
  name: z.string().min(1),
  gender: z.enum(['male', 'female']),
  mutation: z.string().optional(),
  photos: z.array(z.string().url()).default([]),
})

export async function parentsRoutes(app: FastifyInstance) {

  app.get('/', async (request, reply) => {
    const { breeder_id } = request.query as { breeder_id?: string }
    const sb = supabaseCalo()

    let q = sb.from('parents').select('*, breeder:breeders(id, name)').order('name')
    if (breeder_id) q = q.eq('breeder_id', breeder_id)

    const { data, error } = await q
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send({ data })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { data, error } = await supabaseCalo()
      .from('parents')
      .select('*, breeder:breeders(id, name, address)')
      .eq('id', id)
      .single()
    if (error) return reply.code(404).send({ error: 'Pai/mãe não encontrado' })
    return reply.send(data)
  })

  app.post('/', async (request, reply) => {
    const body = parentBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await supabaseCalo().from('parents').insert(body.data).select().single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = parentBody.partial().omit({ breeder_id: true }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await supabaseCalo().from('parents').update(body.data).eq('id', id).select().single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send(data)
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { error } = await supabaseCalo().from('parents').delete().eq('id', id)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
