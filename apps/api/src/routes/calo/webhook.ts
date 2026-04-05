import type { FastifyInstance } from 'fastify'
import { stripe } from '../../lib/stripe.js'
import { supabaseCalo } from '../../lib/supabase.js'

type SB = ReturnType<typeof supabaseCalo>

export async function caloWebhookRoutes(app: FastifyInstance) {

  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  app.post('/', async (request, reply) => {
    const sig = request.headers['stripe-signature']
    if (!sig) return reply.code(400).send({ error: 'Missing stripe-signature' })

    let event: import('stripe').Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch {
      return reply.code(400).send({ error: 'Webhook signature verification failed' })
    }

    const sb = supabaseCalo()

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as import('stripe').Stripe.Checkout.Session
      const { order_id, type } = session.metadata ?? {}
      if (!order_id) return reply.send({ received: true })

      if (type === 'completion') {
        await sb.from('orders')
          .update({ status: 'paid', stripe_payment_id: session.payment_intent as string })
          .eq('id', order_id)
        await sb.from('reservations').update({ remaining_cents: 0 }).eq('order_id', order_id)
        await markChicksSold(sb, order_id)
      } else {
        const isFullPayment = type === 'full'
        await sb.from('orders')
          .update({ status: isFullPayment ? 'paid' : 'reserved', stripe_payment_id: session.payment_intent as string })
          .eq('id', order_id)
        if (isFullPayment) await markChicksSold(sb, order_id)
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as import('stripe').Stripe.Checkout.Session
      const { order_id } = session.metadata ?? {}
      if (!order_id) return reply.send({ received: true })

      await sb.from('orders').update({ status: 'cancelled' }).eq('id', order_id)
      await releaseChicks(sb, order_id)
    }

    return reply.send({ received: true })
  })
}

async function getChickIds(sb: SB, order_id: string) {
  const { data } = await sb.from('order_items').select('chick_id').eq('order_id', order_id)
  return (data ?? []).map(i => i.chick_id)
}

async function markChicksSold(sb: SB, order_id: string) {
  const ids = await getChickIds(sb, order_id)
  if (ids.length > 0) await sb.from('chicks').update({ status: 'sold' }).in('id', ids)
}

async function releaseChicks(sb: SB, order_id: string) {
  const ids = await getChickIds(sb, order_id)
  if (ids.length > 0) await sb.from('chicks').update({ status: 'available' }).in('id', ids)
}
