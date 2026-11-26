import Stripe from 'npm:stripe@^17.7.0'
import {
  createServiceAdminClient,
  jsonResponse,
  type PaymentOrderRow,
} from '../_shared/paymentHelpers.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

function extractPaymentIntentId(rawIntent: unknown): string | null {
  if (typeof rawIntent === 'string' && rawIntent.trim()) {
    return rawIntent.trim()
  }
  if (
    rawIntent &&
    typeof rawIntent === 'object' &&
    'id' in rawIntent &&
    typeof (rawIntent as { id?: unknown }).id === 'string'
  ) {
    const id = (rawIntent as { id: string }).id.trim()
    return id || null
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim() ?? ''
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
    const service = createServiceAdminClient()

    if (!stripeWebhookSecret || !stripeSecretKey || !service) {
      return jsonResponse({ error: 'Stripe webhook secrets not configured.' }, 500)
    }

    const sigHeader = req.headers.get('stripe-signature')?.trim() ?? ''
    if (!sigHeader) {
      return jsonResponse({ error: 'Missing stripe-signature header.' }, 400)
    }

    const rawBody = await req.text()
    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    })

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        sigHeader,
        stripeWebhookSecret,
        undefined,
        cryptoProvider,
      )
    } catch {
      console.error('[webhook-stripe] Signature verification failed.')
      return jsonResponse({ error: 'Invalid Stripe webhook signature.' }, 400)
    }

    if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const sessionObj = event.data.object as Stripe.Checkout.Session
      const ref =
        sessionObj.client_reference_id?.trim() ||
        sessionObj.metadata?.external_reference?.trim() ||
        ''
      if (ref) {
        await service.adminClient
          .from('payment_orders')
          .update({ status: 'failed' })
          .eq('external_reference', ref)
          .eq('status', 'pending')
      }
      return jsonResponse({ received: true }, 200)
    }

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.async_payment_succeeded'
    ) {
      return jsonResponse({ received: true, ignoredEvent: event.type }, 200)
    }

    const eventSession = event.data.object as Stripe.Checkout.Session
    const sessionId = eventSession.id?.trim() ?? ''
    if (!sessionId) {
      return jsonResponse({ received: true, ignored: 'missing_session_id' }, 200)
    }

    // Re-fetch session from Stripe API (defense in depth alongside signature verification)
    let verifiedSession: Stripe.Checkout.Session
    try {
      verifiedSession = await stripe.checkout.sessions.retrieve(sessionId)
    } catch {
      console.error('[webhook-stripe] Failed retrieving session from Stripe API.')
      return jsonResponse({ error: 'Failed verifying Checkout Session with Stripe.' }, 502)
    }

    if (verifiedSession.payment_status !== 'paid') {
      return jsonResponse(
        { received: true, pendingPaymentStatus: verifiedSession.payment_status ?? 'unpaid' },
        200,
      )
    }

    const paymentIntentId = extractPaymentIntentId(verifiedSession.payment_intent)
    const externalReference =
      verifiedSession.client_reference_id?.trim() ||
      verifiedSession.metadata?.external_reference?.trim() ||
      ''

    if (!externalReference) {
      return jsonResponse({ received: true, ignored: 'missing_external_reference' }, 200)
    }

    const selectCols =
      'id, buyer_user_id, target_tree_id, item_id, provider, currency, amount_cents, status, external_reference, provider_payment_id, payment_intent_id, metadata'

    // Strict idempotency pre-check by session.id, payment_intent, or external_reference
    const idempotencyFilters = [
      `external_reference.eq.${externalReference}`,
      `provider_payment_id.eq.${verifiedSession.id}`,
      ...(paymentIntentId ? [`payment_intent_id.eq.${paymentIntentId}`] : []),
    ]

    const { data: matchingOrders, error: orderErr } = await service.adminClient
      .from('payment_orders')
      .select(selectCols)
      .or(idempotencyFilters.join(','))
      .limit(5)
      .returns<PaymentOrderRow[]>()

    if (orderErr) {
      console.error('[webhook-stripe] Order lookup failed:', orderErr.code)
      return jsonResponse({ error: 'Database lookup failed.' }, 500)
    }

    const orders = matchingOrders ?? []
    if (orders.some((row) => row.status === 'paid')) {
      return jsonResponse({ received: true, alreadyProcessed: true }, 200)
    }

    const order =
      orders.find((row) => row.external_reference === externalReference) ?? orders[0] ?? null

    const amountTotal = Number(verifiedSession.amount_total ?? 0)
    const sessionCurrency = verifiedSession.currency?.trim().toLowerCase() ?? ''

    if (!Number.isFinite(amountTotal) || amountTotal <= 0 || sessionCurrency !== 'usd') {
      console.error('[webhook-stripe] Invalid amount or non-USD currency on session.')
      return jsonResponse({ error: 'Invalid session currency or amount.' }, 400)
    }

    const operationType =
      verifiedSession.metadata?.type === 'support_donation' ||
      order?.metadata?.type === 'support_donation' ||
      (order && !order.item_id)
        ? 'support_donation'
        : 'store_item'

    if (operationType === 'support_donation') {
      if (order && (order.provider !== 'stripe' || order.currency !== 'USD' || amountTotal < order.amount_cents)) {
        console.error('[webhook-stripe] Donation order mismatch:', order.id)
        return jsonResponse({ error: 'Donation order verification mismatch.' }, 400)
      }

      const senderUsername =
        typeof order?.metadata?.sender_username === 'string' && order.metadata.sender_username.trim()
          ? order.metadata.sender_username.trim()
          : 'Apoiador Internacional'

      const { data: rpcResult, error: rpcErr } = await service.adminClient.rpc(
        'fulfill_stripe_support_donation_internal',
        {
          p_buyer_user_id:
            order?.buyer_user_id ?? verifiedSession.metadata?.buyer_user_id ?? null,
          p_currency: 'USD',
          p_amount_cents: amountTotal,
          p_external_reference: externalReference,
          p_session_id: verifiedSession.id,
          p_payment_intent_id: paymentIntentId,
          p_sender_username: senderUsername,
        },
      )

      if (rpcErr) {
        console.error('[webhook-stripe] Support donation RPC failed:', rpcErr.code)
        return jsonResponse({ error: 'Failed to record support contribution.' }, 500)
      }

      return jsonResponse({ received: true, fulfillment: rpcResult }, 200)
    }

    // Store item purchase: order & item_id must exist with authoritative catalog amount
    if (!order || !order.item_id) {
      return jsonResponse({ error: 'Matching store order not found.' }, 404)
    }

    if (order.provider !== 'stripe') {
      return jsonResponse({ error: 'Payment provider mismatch.' }, 400)
    }

    if (order.provider_payment_id && order.provider_payment_id !== verifiedSession.id) {
      console.error('[webhook-stripe] Session ID mismatch for order:', order.id)
      return jsonResponse({ error: 'Session ID mismatch.' }, 400)
    }

    if (order.amount_cents <= 0 || order.currency !== 'USD' || amountTotal < order.amount_cents) {
      console.error('[webhook-stripe] Paid amount below catalog order:', order.id)
      return jsonResponse({ error: 'Paid amount does not match catalog order.' }, 400)
    }

    // Persist verified Stripe IDs on order before fulfillment (protected by unique DB indexes)
    const { error: idUpdateErr } = await service.adminClient
      .from('payment_orders')
      .update({
        provider_payment_id: verifiedSession.id,
        ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
      })
      .eq('id', order.id)
      .eq('status', 'pending')

    if (idUpdateErr) {
      console.error('[webhook-stripe] Failed storing Stripe identifiers:', idUpdateErr.code)
      return jsonResponse({ error: 'Failed updating order tracking IDs.' }, 500)
    }

    const senderUsername =
      typeof order.metadata?.sender_username === 'string' && order.metadata.sender_username.trim()
        ? order.metadata.sender_username.trim()
        : 'Apoiador da Comunidade'

    const { data: rpcResult, error: rpcErr } = await service.adminClient.rpc(
      'grant_paid_unlock_internal',
      {
        p_buyer_user_id: order.buyer_user_id,
        p_target_tree_id: order.target_tree_id,
        p_item_id: order.item_id,
        p_provider: 'international',
        p_currency: 'USD',
        p_amount_cents: amountTotal,
        p_external_reference: externalReference,
        p_sender_username: senderUsername,
      },
    )

    if (rpcErr) {
      console.error('[webhook-stripe] Fulfillment RPC failed:', rpcErr.code)
      return jsonResponse({ error: 'Failed to fulfill verified Stripe payment.' }, 500)
    }

    return jsonResponse({ received: true, fulfillment: rpcResult }, 200)
  } catch (err) {
    console.error('[webhook-stripe] Unexpected error:', err instanceof Error ? err.message : 'unknown')
    return jsonResponse({ error: 'Unexpected server error.' }, 500)
  }
})
