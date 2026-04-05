import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseCalo } from '../../lib/supabase.js'
import { stripe } from '../../lib/stripe.js'
import { calculateShipping } from '../../lib/shipping/index.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

const createOrderBody = z.object({
  buyer_id: z.string().uuid(),
  chick_ids: z.array(z.string().uuid()).min(1),
  type: z.enum(['full', 'reservation']).default('full'),
  deposit_percent: z.number().int().min(10).max(90).optional(),
  notes: z.string().optional(),
})

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchChicks(ids: string[]) {
  const sb = supabaseCalo()
  const { data, error } = await sb
    .from('chicks')
    .select('id, name, mutation, price_cents, status, breeder_id, breeder:breeders(address)')
    .in('id', ids)

  if (error) throw new Error(error.message)
  return (data as unknown) as Array<{
    id: string
    name: string | null
    mutation: string
    price_cents: number
    status: string
    breeder_id: string
    breeder: { address: string } | null
  }>
}

async function fetchBuyer(id: string) {
  const sb = supabaseCalo()
  const { data, error } = await sb
    .from('buyers')
    .select('id, company_name, email, address')
    .eq('id', id)
    .single()

  if (error) throw new Error('Comprador não encontrado')
  return data as { id: string; company_name: string; email: string; address: string }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function ordersRoutes(app: FastifyInstance) {

  app.post('/', async (request, reply) => {
    const body = createOrderBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { buyer_id, chick_ids, type, deposit_percent, notes } = body.data

    if (type === 'reservation' && !deposit_percent) {
      return reply.code(400).send({ error: 'deposit_percent é obrigatório para reservas' })
    }

    const chicks = await fetchChicks(chick_ids).catch(e => { throw e })
    const unavailable = chicks.filter(c => c.status !== 'available')
    if (unavailable.length > 0) {
      return reply.code(409).send({ error: 'Um ou mais filhotes não estão disponíveis', ids: unavailable.map(c => c.id) })
    }
    if (chicks.length !== chick_ids.length) {
      return reply.code(404).send({ error: 'Um ou mais filhotes não foram encontrados' })
    }

    const buyer = await fetchBuyer(buyer_id)
    const subtotal_cents = chicks.reduce((sum, c) => sum + c.price_cents, 0)

    const sellerAddress = chicks[0].breeder?.address ?? process.env.SELLER_ADDRESS!
    const shippingResult = await calculateShipping(sellerAddress, buyer.address, subtotal_cents / 100)
    const shipping_cents = Math.round(shippingResult.price * 100)
    const total_cents = subtotal_cents + shipping_cents

    const sb = supabaseCalo()

    const { data: order, error: orderError } = await sb
      .from('orders')
      .insert({ buyer_id, status: type === 'reservation' ? 'reserved' : 'pending', subtotal_cents, shipping_cents, total_cents, shipping_distance_km: shippingResult.distanceKm, notes })
      .select()
      .single()

    if (orderError) return reply.code(500).send({ error: orderError.message })

    const { error: itemsError } = await sb.from('order_items').insert(
      chicks.map(c => ({ order_id: order.id, chick_id: c.id, price_cents: c.price_cents }))
    )
    if (itemsError) return reply.code(500).send({ error: itemsError.message })

    let deposit_cents = total_cents
    if (type === 'reservation') {
      deposit_cents = Math.round(total_cents * (deposit_percent! / 100))
      const { error: resError } = await sb.from('reservations').insert({
        order_id: order.id,
        deposit_cents,
        remaining_cents: total_cents - deposit_cents,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (resError) return reply.code(500).send({ error: resError.message })
    }

    await sb.from('chicks').update({ status: 'reserved' }).in('id', chick_ids)

    const checkoutLineItems =
      type === 'reservation'
        ? [{ price_data: { currency: 'brl', product_data: { name: `Sinal de reserva (${deposit_percent}%) — ${chicks.map(c => c.mutation).join(', ')}` }, unit_amount: deposit_cents }, quantity: 1 }]
        : [
            ...chicks.map(c => ({ price_data: { currency: 'brl', product_data: { name: c.name ? `${c.name} — ${c.mutation}` : c.mutation }, unit_amount: c.price_cents }, quantity: 1 })),
            { price_data: { currency: 'brl', product_data: { name: 'Frete' }, unit_amount: shipping_cents }, quantity: 1 },
          ]

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: checkoutLineItems,
      customer_email: buyer.email,
      metadata: { order_id: order.id, type },
      success_url: `${process.env.WEB_URL ?? 'http://localhost:3000'}/pedidos/${order.id}?status=success`,
      cancel_url: `${process.env.WEB_URL ?? 'http://localhost:3000'}/pedidos/${order.id}?status=cancelled`,
    })

    await sb.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)

    return reply.code(201).send({
      order_id: order.id,
      checkout_url: session.url,
      total_cents,
      shipping_cents,
      distance_km: shippingResult.distanceKm,
      ...(type === 'reservation' && { deposit_cents, remaining_cents: total_cents - deposit_cents }),
    })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const sb = supabaseCalo()

    const { data, error } = await sb
      .from('orders')
      .select(`*, buyer:buyers(company_name, email, address), items:order_items(price_cents, chick:chicks(id, name, mutation, photos)), reservation:reservations(deposit_cents, remaining_cents, expires_at)`)
      .eq('id', id)
      .single()

    if (error) return reply.code(404).send({ error: 'Pedido não encontrado' })
    return reply.send(data)
  })

  app.post('/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string }
    const sb = supabaseCalo()

    const { data: order, error: orderError } = await sb
      .from('orders')
      .select('id, status, buyer_id, buyer:buyers(email), reservation:reservations(remaining_cents)')
      .eq('id', id)
      .single()

    if (orderError) return reply.code(404).send({ error: 'Pedido não encontrado' })
    if (order.status !== 'reserved') return reply.code(409).send({ error: 'Pedido não está em status de reserva' })

    const reservation = Array.isArray(order.reservation) ? order.reservation[0] : order.reservation
    const buyer = Array.isArray(order.buyer) ? order.buyer[0] : order.buyer

    if (!reservation || reservation.remaining_cents <= 0) {
      return reply.code(409).send({ error: 'Saldo restante já foi pago' })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'brl', product_data: { name: 'Saldo restante do pedido' }, unit_amount: reservation.remaining_cents }, quantity: 1 }],
      customer_email: buyer.email,
      metadata: { order_id: id, type: 'completion' },
      success_url: `${process.env.WEB_URL ?? 'http://localhost:3000'}/pedidos/${id}?status=paid`,
      cancel_url: `${process.env.WEB_URL ?? 'http://localhost:3000'}/pedidos/${id}?status=cancelled`,
    })

    return reply.send({ checkout_url: session.url, remaining_cents: reservation.remaining_cents })
  })
}
