import {
  computeHmacSha256Hex,
  createServiceAdminClient,
  jsonResponse,
  timingSafeEqualHex,
  type PaymentOrderRow,
} from '../_shared/paymentHelpers.ts'

const MAX_SIGNATURE_AGE_MS = 15 * 60 * 1000

function parseMercadoPagoSignature(headerValue: string): { ts: string; v1: string } | null {
  let ts = ''
  let v1 = ''
  for (const part of headerValue.split(',')) {
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    const key = part.slice(0, eqIndex).trim()
    const val = part.slice(eqIndex + 1).trim()
    if (key === 'ts') ts = val
    else if (key === 'v1') v1 = val
  }
  if (!ts || !v1) return null
  return { ts, v1 }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const mpWebhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')?.trim() ?? ''
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')?.trim() ?? ''
    const service = createServiceAdminClient()

    if (!mpWebhookSecret || !mpAccessToken || !service) {
      return jsonResponse({ error: 'Webhook server secrets not configured.' }, 500)
    }

    const signatureHeader = req.headers.get('x-signature')?.trim() ?? ''
    const requestIdHeader = req.headers.get('x-request-id')?.trim() ?? ''
    const parsedSig = parseMercadoPagoSignature(signatureHeader)

    if (!parsedSig) {
      return jsonResponse({ error: 'Missing or malformed x-signature header.' }, 401)
    }

    const tsNum = Number(parsedSig.ts)
    if (!Number.isFinite(tsNum) || tsNum <= 0) {
      return jsonResponse({ error: 'Invalid webhook timestamp.' }, 401)
    }
    const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000
    if (Math.abs(Date.now() - tsMs) > MAX_SIGNATURE_AGE_MS) {
      return jsonResponse({ error: 'Expired webhook signature timestamp.' }, 401)
    }

    const reqUrl = new URL(req.url)
    const rawBody = await req.text()
    const bodyJson = (() => {
      try {
        return JSON.parse(rawBody) as {
          type?: string
          topic?: string
          action?: string
          data?: { id?: string | number }
          id?: string | number
        }
      } catch {
        return null
      }
    })()

    const queryDataId = reqUrl.searchParams.get('data.id')?.trim() ?? reqUrl.searchParams.get('id')?.trim() ?? ''
    const bodyDataId = bodyJson?.data?.id != null ? String(bodyJson.data.id).trim() : ''
    const manifestDataId = queryDataId || bodyDataId

    // Mercado Pago v2 signature manifest format: `id:<lower>;request-id:<id>;ts:<ts>;`
    const manifestParts: string[] = []
    if (manifestDataId) manifestParts.push(`id:${manifestDataId.toLowerCase()};`)
    if (requestIdHeader) manifestParts.push(`request-id:${requestIdHeader};`)
    manifestParts.push(`ts:${parsedSig.ts};`)

    const expectedHex = await computeHmacSha256Hex(mpWebhookSecret, manifestParts.join(''))
    if (!timingSafeEqualHex(expectedHex, parsedSig.v1)) {
      console.error('[webhook-mercadopago] Signature verification failed.')
      return jsonResponse({ error: 'Invalid webhook signature.' }, 401)
    }

    const topic = (
      reqUrl.searchParams.get('type') ??
      reqUrl.searchParams.get('topic') ??
      bodyJson?.type ??
      bodyJson?.topic ??
      ''
    )
      .trim()
      .toLowerCase()

    if (topic && topic !== 'payment') {
      return jsonResponse({ ok: true, ignoredTopic: topic }, 200)
    }

    const paymentId = manifestDataId || (bodyJson?.id != null ? String(bodyJson.id).trim() : '')
    if (!paymentId || !/^[a-zA-Z0-9_-]+$/.test(paymentId)) {
      return jsonResponse({ ok: true, ignored: 'missing_payment_id' }, 200)
    }

    // Never trust webhook payload state/amount; query Mercado Pago Payments API directly
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      },
    )

    if (!mpRes.ok) {
      const errText = await mpRes.text().catch(() => '')
      console.error('[webhook-mercadopago] Failed fetching MP payment:', mpRes.status, errText.slice(0, 200))
      return jsonResponse({ error: 'Failed verifying payment with Mercado Pago.' }, 502)
    }

    const mpPayment = (await mpRes.json()) as {
      id: number | string
      status?: string
      currency_id?: string
      transaction_amount?: number
      external_reference?: string
    }

    const externalReference = mpPayment.external_reference?.trim() ?? ''
    if (!externalReference) {
      return jsonResponse({ ok: true, ignored: 'no_external_reference' }, 200)
    }

    const { data: order, error: orderErr } = await service.adminClient
      .from('payment_orders')
      .select('id, buyer_user_id, target_tree_id, item_id, provider, currency, amount_cents, status, external_reference, provider_payment_id, metadata')
      .eq('external_reference', externalReference)
      .maybeSingle<PaymentOrderRow>()

    if (orderErr) {
      console.error('[webhook-mercadopago] Order lookup failed:', orderErr.code, orderErr.message)
      return jsonResponse({ error: 'Database lookup failed.' }, 500)
    }

    if (!order || !order.item_id) {
      return jsonResponse({ error: 'Matching order not found.' }, 404)
    }

    if (!order.provider_payment_id) {
      await service.adminClient
        .from('payment_orders')
        .update({ provider_payment_id: String(mpPayment.id) })
        .eq('id', order.id)
    }

    if (mpPayment.status === 'cancelled' || mpPayment.status === 'rejected') {
      if (order.status === 'pending') {
        await service.adminClient
          .from('payment_orders')
          .update({ status: 'failed' })
          .eq('id', order.id)
      }
      return jsonResponse({ ok: true, status: mpPayment.status }, 200)
    }

    if (mpPayment.status !== 'approved') {
      return jsonResponse({ ok: true, pendingStatus: mpPayment.status ?? 'unknown' }, 200)
    }

    if (order.status === 'paid') {
      return jsonResponse({ ok: true, alreadyProcessed: true }, 200)
    }

    const paidCents = Math.round(Number(mpPayment.transaction_amount ?? 0) * 100)
    const currencyUpper = mpPayment.currency_id?.trim().toUpperCase() ?? 'BRL'

    if (order.currency !== 'BRL' || currencyUpper !== 'BRL' || paidCents < order.amount_cents) {
      console.error('[webhook-mercadopago] Amount or currency mismatch:', {
        orderId: order.id,
        paidCents,
        expectedCents: order.amount_cents,
        currencyUpper,
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
        p_provider: 'pix',
        p_currency: 'BRL',
        p_amount_cents: paidCents,
        p_external_reference: externalReference,
        p_sender_username: senderUsername,
      },
    )

    if (rpcErr) {
      console.error('[webhook-mercadopago] Fulfillment RPC failed:', rpcErr.message)
      return jsonResponse({ error: 'Failed to fulfill verified payment.' }, 500)
    }

    return jsonResponse({ ok: true, fulfillment: rpcResult }, 200)
  } catch (err) {
    console.error('[webhook-mercadopago] Unexpected error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Unexpected server error.' },
      500,
    )
  }
})
