import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseCalo } from '../../lib/supabase.js'

const listQuery = z.object({
  status: z.enum(['pending', 'reserved', 'paid', 'shipped', 'cancelled']).optional(),
  buyer_id: z.string().uuid().optional(),
  from: z.string().optional(),   // ISO date
  to: z.string().optional(),     // ISO date
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function ordersListRoutes(app: FastifyInstance) {

  app.get('/', async (request, reply) => {
    const query = listQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { status, buyer_id, from, to, limit, offset } = query.data
    const sb = supabaseCalo()

    let q = sb
      .from('orders')
      .select(`
        id, status, subtotal_cents, shipping_cents, total_cents,
        shipping_distance_km, created_at,
        buyer:buyers(id, company_name, email),
        items:order_items(chick:chicks(id, name, mutation))
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status)   q = q.eq('status', status)
    if (buyer_id) q = q.eq('buyer_id', buyer_id)
    if (from)     q = q.gte('created_at', from)
    if (to)       q = q.lte('created_at', to)

    const { data, error } = await q
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send({ data, limit, offset })
  })

  // PATCH /calo/orders-admin/:id/status — atualiza status manualmente (ex: shipped)
  app.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }

    const allowed = ['pending', 'reserved', 'paid', 'shipped', 'cancelled']
    if (!allowed.includes(status)) {
      return reply.code(400).send({ error: `Status inválido. Permitidos: ${allowed.join(', ')}` })
    }

    const { data, error } = await supabaseCalo()
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.send(data)
  })
}
