import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseCalo } from '../../lib/supabase.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

const chickBody = z.object({
  breeder_id: z.string().uuid(),
  father_id: z.string().uuid().optional(),
  mother_id: z.string().uuid().optional(),
  name: z.string().optional(),
  mutation: z.string().min(1),
  birth_date: z.string().optional(),
  gender: z.enum(['male', 'female', 'unknown']).default('unknown'),
  price_cents: z.number().int().positive(),
  description: z.string().optional(),
  photos: z.array(z.string().url()).default([]),
})

const chickPatch = chickBody.partial().omit({ breeder_id: true })

const listQuery = z.object({
  status: z.enum(['available', 'reserved', 'sold']).optional(),
  mutation: z.string().optional(),
  gender: z.enum(['male', 'female', 'unknown']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function birdsRoutes(app: FastifyInstance) {

  app.get('/', async (request, reply) => {
    const query = listQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { status, mutation, gender, limit, offset } = query.data
    const sb = supabaseCalo()

    let q = sb
      .from('chicks')
      .select(`*, father:parents!father_id(id, name, mutation, photos), mother:parents!mother_id(id, name, mutation, photos)`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status)   q = q.eq('status', status)
    if (mutation) q = q.ilike('mutation', `%${mutation}%`)
    if (gender)   q = q.eq('gender', gender)

    const { data, error, count } = await q
    if (error) return reply.code(500).send({ error: error.message })

    return reply.send({ data, total: count, limit, offset })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const sb = supabaseCalo()

    const { data, error } = await sb
      .from('chicks')
      .select(`*, breeder:breeders(id, name, phone), father:parents!father_id(id, name, mutation, gender, photos), mother:parents!mother_id(id, name, mutation, gender, photos)`)
      .eq('id', id)
      .single()

    if (error) return reply.code(404).send({ error: 'Filhote não encontrado' })
    return reply.send(data)
  })

  app.post('/', async (request, reply) => {
    const body = chickBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const sb = supabaseCalo()
    const { data, error } = await sb.from('chicks').insert(body.data).select().single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = chickPatch.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const sb = supabaseCalo()
    const { data, error } = await sb.from('chicks').update(body.data).eq('id', id).select().single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.send(data)
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const sb = supabaseCalo()

    const { data: chick, error: fetchError } = await sb.from('chicks').select('status').eq('id', id).single()

    if (fetchError) return reply.code(404).send({ error: 'Filhote não encontrado' })
    if (chick.status !== 'available') {
      return reply.code(409).send({ error: 'Não é possível remover filhote reservado ou vendido' })
    }

    const { error } = await sb.from('chicks').delete().eq('id', id)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
