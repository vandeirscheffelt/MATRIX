import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseCalo } from '../../lib/supabase.js'

const buyerBody = z.object({
  company_name: z.string().min(1),
  cnpj: z.string().optional(),
  contact_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().min(1),
})

const listQuery = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function buyersRoutes(app: FastifyInstance) {

  app.get('/', async (request, reply) => {
    const query = listQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { search, limit, offset } = query.data
    const sb = supabaseCalo()

    let q = sb.from('buyers').select('*').order('company_name').range(offset, offset + limit - 1)
    if (search) q = q.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`)

    const { data, error } = await q
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send({ data, limit, offset })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { data, error } = await supabaseCalo().from('buyers').select('*').eq('id', id).single()
    if (error) return reply.code(404).send({ error: 'Comprador não encontrado' })
    return reply.send(data)
  })

  app.post('/', async (request, reply) => {
    const body = buyerBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await supabaseCalo().from('buyers').insert(body.data).select().single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = buyerBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await supabaseCalo().from('buyers').update(body.data).eq('id', id).select().single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send(data)
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { error } = await supabaseCalo().from('buyers').delete().eq('id', id)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
