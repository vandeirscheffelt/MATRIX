import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseCalo } from '../../lib/supabase.js'
import { stripe } from '../../lib/stripe.js'

// Sinal fixo de R$50 para reservas via WhatsApp
const DEPOSIT_CENTS = 5000

const reservaBody = z.object({
  whatsapp: z.string().min(10),       // ex: "5511999999999"
  nome: z.string().min(1),
  email: z.string().email().optional(),
  endereco: z.string().min(5),
  chick_id: z.string().uuid(),
})

export async function whatsappReservaRoutes(app: FastifyInstance) {

  // GET /calo/public/filhotes — lista filhotes disponíveis para a IA consultar
  app.get('/filhotes', async (_request, reply) => {
    const { data, error } = await supabaseCalo()
      .from('chicks')
      .select('id, name, mutation, gender, price_cents, birth_date, description, photos, status')
      .eq('status', 'available')
      .order('created_at', { ascending: false })

    if (error) return reply.code(500).send({ error: error.message })
    return reply.send({ data })
  })

  // GET /calo/public/pedido/:whatsapp — consulta último pedido/reserva pelo número
  app.get('/pedido/:whatsapp', async (request, reply) => {
    const { whatsapp } = request.params as { whatsapp: string }
    const sb = supabaseCalo()

    const { data: buyer } = await sb
      .from('buyers')
      .select('id, contact_name')
      .eq('whatsapp', whatsapp)
      .single()

    if (!buyer) return reply.code(404).send({ error: 'Nenhum pedido encontrado para este número.' })

    const { data: order } = await sb
      .from('orders')
      .select(`
        id, status, total_cents, shipping_cents, created_at,
        items:order_items(price_cents, chick:chicks(id, name, mutation, photos)),
        reservation:reservations(deposit_cents, remaining_cents, expires_at)
      `)
      .eq('buyer_id', buyer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!order) return reply.code(404).send({ error: 'Nenhum pedido encontrado.' })

    const reservation = Array.isArray(order.reservation) ? order.reservation[0] : order.reservation

    return reply.send({
      order_id: order.id,
      status: order.status,
      total_cents: order.total_cents,
      deposit_cents: reservation?.deposit_cents ?? null,
      remaining_cents: reservation?.remaining_cents ?? null,
      expires_at: reservation?.expires_at ?? null,
      items: order.items,
    })
  })

  // POST /calo/public/reserva — cria buyer (ou reutiliza) + pedido + link Stripe
  app.post('/reserva', async (request, reply) => {
    const parsed = reservaBody.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { whatsapp, nome, email, endereco, chick_id } = parsed.data
    const sb = supabaseCalo()

    // 1. Verificar filhote
    const { data: chick, error: chickError } = await sb
      .from('chicks')
      .select('id, name, mutation, price_cents, status, breeder_id, breeder:breeders(address)')
      .eq('id', chick_id)
      .single()

    if (chickError || !chick) return reply.code(404).send({ error: 'Filhote não encontrado' })
    if ((chick as any).status !== 'available') {
      return reply.code(409).send({ error: 'Este filhote não está mais disponível 😔' })
    }

    // 2. Buscar ou criar buyer pelo whatsapp
    let buyer: any
    const { data: existing } = await sb
      .from('buyers')
      .select('*')
      .eq('whatsapp', whatsapp)
      .single()

    if (existing) {
      // Atualiza nome/endereço se veio novo
      const { data: updated } = await sb
        .from('buyers')
        .update({ contact_name: nome, address: endereco, ...(email && { email }) })
        .eq('id', existing.id)
        .select()
        .single()
      buyer = updated ?? existing
    } else {
      const { data: created, error: createError } = await sb
        .from('buyers')
        .insert({
          whatsapp,
          contact_name: nome,
          company_name: nome,
          email: email ?? null,
          address: endereco,
          phone: whatsapp,
        })
        .select()
        .single()
      if (createError) return reply.code(500).send({ error: createError.message })
      buyer = created
    }

    // 3. Criar pedido como reserva
    const subtotal_cents = (chick as any).price_cents
    const total_cents = subtotal_cents // frete calculado depois, sinal é fixo
    const remaining_cents = total_cents - DEPOSIT_CENTS

    const { data: order, error: orderError } = await sb
      .from('orders')
      .insert({
        buyer_id: buyer.id,
        status: 'reserved',
        subtotal_cents,
        shipping_cents: 0,
        total_cents,
        notes: `Reserva via WhatsApp — ${whatsapp}`,
      })
      .select()
      .single()

    if (orderError) return reply.code(500).send({ error: orderError.message })

    // 4. Itens do pedido
    await sb.from('order_items').insert({ order_id: order.id, chick_id, price_cents: subtotal_cents })

    // 5. Reserva com sinal fixo R$50
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await sb.from('reservations').insert({
      order_id: order.id,
      deposit_cents: DEPOSIT_CENTS,
      remaining_cents: remaining_cents > 0 ? remaining_cents : 0,
      expires_at: expiresAt,
    })

    // 6. Marcar filhote como reservado
    await sb.from('chicks').update({ status: 'reserved' }).eq('id', chick_id)

    // 7. Criar sessão Stripe
    const birdLabel = (chick as any).name
      ? `${(chick as any).name} — ${(chick as any).mutation}`
      : (chick as any).mutation

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: `Sinal de reserva — ${birdLabel}` },
          unit_amount: DEPOSIT_CENTS,
        },
        quantity: 1,
      }],
      ...(buyer.email && { customer_email: buyer.email }),
      metadata: { order_id: order.id, type: 'reservation', whatsapp },
      success_url: `${process.env.WEB_URL ?? 'http://localhost:3000'}/catalog/${chick_id}?reserva=ok`,
      cancel_url: `${process.env.WEB_URL ?? 'http://localhost:3000'}/catalog/${chick_id}?reserva=cancelada`,
    })

    await sb.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)

    return reply.code(201).send({
      order_id: order.id,
      checkout_url: session.url,
      bird: birdLabel,
      deposit_cents: DEPOSIT_CENTS,
      remaining_cents: remaining_cents > 0 ? remaining_cents : 0,
      expires_at: expiresAt,
    })
  })
}
