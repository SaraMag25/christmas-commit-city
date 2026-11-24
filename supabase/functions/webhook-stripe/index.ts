import {
  computeHmacSha256Hex,
  createServiceAdminClient,
  jsonResponse,
  timingSafeEqualHex,
  type PaymentOrderRow,
} from '../_shared/paymentHelpers.ts'

const MAX_STRIPE_TIMESTAMP_DRIFT_SEC = 300

function parseStripeSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  let timestamp = ''
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    const key = part.slice(0, eqIndex).trim()
    const val = part.slice(eqIndex + 1).trim()
    if (key === 't') timestamp = val
    else if (key === 'v1' && val) signatures.push(val)
  }
  if (!timestamp || signatures.length === 0) return null
  return { timestamp, signatures }
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
    const parsedSig = parseStripeSignatureHeader(sigHeader)
    if (!parsedSig) {
      return jsonResponse({ error: 'Missing or malformed stripe-signature header.' }, 400)
    }

    const timestampSec = Number(parsedSig.timestamp)
    const nowSec = Math.floor(Date.now() / 1000)
    if (
      !Number.isFinite(timestampSec) ||
      Math.abs(nowSec - timestampSec) > MAX_STRIPE_TIMESTAMP_DRIFT_SEC
    ) {
      return jsonResponse({ error: 'Expired Stripe webhook timestamp.' }, 400)
    }

    const rawBody = await req.text()
    const expectedHex = await computeHmacSha256Hex(
      stripeWebhookSecret,
      `${parsedSig.timestamp}.${rawBody}`,
    )

    const validSignature = parsedSig.signatures.some((sig) =>
      timingSafeEqualHex(expectedHex, sig),
    )
    if (!validSignature) {
      console.error('[webhook-stripe] Signature verification failed.')
      return jsonResponse({ error: 'Invalid Stripe webhook signature.' }, 401)
    }

    const event = JSON.parse(rawBody) as {
      type?: string
      data?: {
        object?: {
          id?: string
          client_reference_id?: string | null
          payment_status?: string
          metadata?: Record<string, string>
        }
      }
    }

    const eventType = event.type ?? ''
    const sessionObj = event.data?.object
    const sessionId = sessionObj?.id?.trim() ?? ''

    if (!sessionId) {
      return jsonResponse({ received: true, ignored: 'missing_session_id' }, 200)
    }

    if (
      eventType === 'checkout.session.expired' ||
      eventType === 'checkout.session.async_payment_failed'
    ) {
      const ref =
        sessionObj?.client_reference_id?.trim() ||
        sessionObj?.metadata?.external_reference?.trim() ||
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
      eventType !== 'checkout.session.completed' &&
      eventType !== 'checkout.session.async_payment_succeeded'
    ) {
      return jsonResponse({ received: true, ignoredEvent: eventType }, 200)
    }

    // Re-fetch session from Stripe API (defense in depth alongside HMAC verification)
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      },
    )

    if (!stripeRes.ok) {
      const errText = await stripeRes.text().catch(() => '')
      console.error('[webhook-stripe] Failed retrieving session:', stripeRes.status, errText.slice(0, 200))
      return jsonResponse({ error: 'Failed verifying Checkout Session with Stripe.' }, 502)
    }

    const verifiedSession = (await stripeRes.json()) as {
      id: string
      payment_status?: string
      currency?: string | null
      amount_total?: number | null
      client_reference_id?: string | null
      metadata?: Record<string, string> | null
    }

    if (verifiedSession.payment_status !== 'paid') {
      return jsonResponse(
        { received: true, pendingPaymentStatus: verifiedSession.payment_status ?? 'unpaid' },
        200,
      )
    }

    const externalReference =
      verifiedSession.client_reference_id?.trim() ||
      verifiedSession.metadata?.external_reference?.trim() ||
      ''

    if (!externalReference) {
      return jsonResponse({ received: true, ignored: 'missing_external_reference' }, 200)
    }

    const { data: order, error: orderErr } = await service.adminClient
      .from('payment_orders')
      .select('id, buyer_user_id, target_tree_id, item_id, provider, currency, amount_cents, status, external_reference, provider_payment_id, metadata')
      .eq('external_reference', externalReference)
      .maybeSingle<PaymentOrderRow>()

    if (orderErr) {
      console.error('[webhook-stripe] Order lookup failed:', orderErr.code, orderErr.message)
      return jsonResponse({ error: 'Database lookup failed.' }, 500)
    }

    if (!order || !order.item_id) {
      return jsonResponse({ error: 'Matching payment order not found.' }, 404)
    }

    if (order.provider !== 'stripe') {
      return jsonResponse({ error: 'Payment provider mismatch.' }, 400)
    }

    if (order.provider_payment_id && order.provider_payment_id !== verifiedSession.id) {
      console.error('[webhook-stripe] Session ID mismatch for order:', order.id)
      return jsonResponse({ error: 'Session ID mismatch.' }, 400)
    }

    if (order.status === 'paid') {
      return jsonResponse({ received: true, alreadyProcessed: true }, 200)
    }

    const amountTotal = Number(verifiedSession.amount_total ?? 0)
    const sessionCurrency = verifiedSession.currency?.trim().toLowerCase() ?? ''

    if (
      !Number.isFinite(amountTotal) ||
      amountTotal <= 0 ||
      order.amount_cents <= 0 ||
      order.currency !== 'USD' ||
      sessionCurrency !== 'usd' ||
      amountTotal < order.amount_cents
    ) {
      console.error('[webhook-stripe] Amount or currency mismatch:', {
        orderId: order.id,
        amountTotal,
        expectedCents: order.amount_cents,
        sessionCurrency,
      })
      return jsonResponse({ error: 'Paid amount does not match catalog order.' }, 400)
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
      console.error('[webhook-stripe] Fulfillment RPC failed:', rpcErr.message)
      return jsonResponse({ error: 'Failed to fulfill verified Stripe payment.' }, 500)
    }

    return jsonResponse({ received: true, fulfillment: rpcResult }, 200)
  } catch (err) {
    console.error('[webhook-stripe] Unexpected error:', err)
    return jsonResponse({ error: 'Unexpected server error.' }, 500)
  }
})
