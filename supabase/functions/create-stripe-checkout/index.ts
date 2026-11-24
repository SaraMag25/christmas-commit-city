import {
  authenticateCaller,
  buildCorsHeaders,
  jsonResponse,
  resolveSafeReturnOrigin,
  validateOrderCreationInput,
} from '../_shared/paymentHelpers.ts'

Deno.serve(async (req: Request) => {
  const { headers: corsHeaders, allowed } = buildCorsHeaders(req)

  if (!allowed) {
    return jsonResponse(
      { error: 'Origin not allowed by CORS policy.', code: 'CORS_FORBIDDEN' },
      403,
      corsHeaders,
    )
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, 405, corsHeaders)
  }

  try {
    const auth = await authenticateCaller(req, corsHeaders)
    if (auth instanceof Response) return auth

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
    if (!stripeSecretKey) {
      return jsonResponse(
        {
          error: 'Stripe credentials are not configured on the server.',
          code: 'STRIPE_NOT_CONFIGURED',
        },
        503,
        corsHeaders,
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      itemId?: unknown
      targetTreeId?: unknown
      returnUrl?: unknown
    }

    const itemId = typeof body.itemId === 'string' ? body.itemId : ''
    const targetTreeId = typeof body.targetTreeId === 'string' ? body.targetTreeId : undefined
    const requestedReturnOrigin = typeof body.returnUrl === 'string' ? body.returnUrl : undefined
    const safeOrigin = resolveSafeReturnOrigin(req, requestedReturnOrigin)

    const validated = await validateOrderCreationInput({
      adminClient: auth.adminClient,
      user: auth.user,
      itemId,
      targetTreeId,
      currency: 'USD',
      corsHeaders,
    })
    if (validated instanceof Response) return validated

    const externalReference = crypto.randomUUID()

    const { data: orderRow, error: orderInsertErr } = await auth.adminClient
      .from('payment_orders')
      .insert({
        buyer_user_id: auth.user.id,
        target_tree_id: validated.resolvedTargetTreeId,
        item_id: validated.shopItem.id,
        provider: 'stripe',
        currency: 'USD',
        amount_cents: validated.amountCents,
        status: 'pending',
        external_reference: externalReference,
        metadata: {
          sender_username: validated.senderUsername,
          item_type: validated.shopItem.item_type,
        },
      })
      .select('id')
      .single<{ id: string }>()

    if (orderInsertErr || !orderRow) {
      console.error(
        '[create-stripe-checkout] Failed creating payment_orders row:',
        orderInsertErr?.code,
        orderInsertErr?.message,
      )
      return jsonResponse(
        { error: 'Failed to register Stripe order.', code: 'ORDER_CREATE_ERROR' },
        500,
        corsHeaders,
      )
    }

    const params = new URLSearchParams({
      mode: 'payment',
      client_reference_id: externalReference,
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(validated.amountCents),
      'line_items[0][price_data][product_data][name]': `Christmas Commit City — ${validated.shopItem.id}`,
      'line_items[0][quantity]': '1',
      success_url: `${safeOrigin}/?payment=success&order_id=${encodeURIComponent(orderRow.id)}`,
      cancel_url: `${safeOrigin}/?payment=cancelled&order_id=${encodeURIComponent(orderRow.id)}`,
      'metadata[order_id]': orderRow.id,
      'metadata[external_reference]': externalReference,
      'metadata[item_id]': validated.shopItem.id,
      'metadata[buyer_user_id]': auth.user.id,
    })

    if (validated.resolvedTargetTreeId) {
      params.set('metadata[target_tree_id]', validated.resolvedTargetTreeId)
    }
    if (auth.user.email?.trim()) {
      params.set('customer_email', auth.user.email.trim())
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': externalReference,
      },
      body: params.toString(),
    })

    const stripePayload = (await stripeRes.json().catch(() => null)) as {
      id?: string
      url?: string
      error?: { message?: string }
    } | null

    if (!stripeRes.ok || !stripePayload?.id || !stripePayload?.url) {
      console.error(
        '[create-stripe-checkout] Stripe API error:',
        stripeRes.status,
        stripePayload?.error?.message,
      )
      await auth.adminClient
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('id', orderRow.id)

      return jsonResponse(
        {
          error:
            stripePayload?.error?.message ||
            'Stripe failed to create Checkout Session.',
          code: 'STRIPE_API_ERROR',
        },
        502,
        corsHeaders,
      )
    }

    await auth.adminClient
      .from('payment_orders')
      .update({ provider_payment_id: stripePayload.id })
      .eq('id', orderRow.id)

    return jsonResponse(
      {
        orderId: orderRow.id,
        externalReference,
        sessionId: stripePayload.id,
        checkoutUrl: stripePayload.url,
        amountCents: validated.amountCents,
        currency: 'USD',
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('[create-stripe-checkout] Unexpected error:', err)
    return jsonResponse(
      {
        error: 'Unexpected server error.',
        code: 'INTERNAL_ERROR',
      },
      500,
      corsHeaders,
    )
  }
})
