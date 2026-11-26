import Stripe from 'npm:stripe@^17.7.0'
import {
  authenticateCaller,
  authenticateOptionalCaller,
  buildCorsHeaders,
  jsonResponse,
  resolveSafeReturnOrigin,
  resolveSenderUsername,
  validateOrderCreationInput,
} from '../_shared/paymentHelpers.ts'

const MIN_DONATION_CENTS = 100 // $1.00 USD
const MAX_DONATION_CENTS = 50000 // $500.00 USD

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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
    if (!stripeSecretKey) {
      return jsonResponse(
        {
          error: 'Stripe checkout is not configured on the server yet.',
          code: 'STRIPE_NOT_CONFIGURED',
        },
        503,
        corsHeaders,
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      type?: unknown
      itemId?: unknown
      targetTreeId?: unknown
      amountUsd?: unknown
      returnUrl?: unknown
    }

    const requestedReturnOrigin = typeof body.returnUrl === 'string' ? body.returnUrl : undefined
    const safeOrigin = resolveSafeReturnOrigin(req, requestedReturnOrigin)
    const operationType =
      body.type === 'support_donation' ? 'support_donation' : 'store_item'

    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    })

    if (operationType === 'support_donation') {
      const auth = await authenticateOptionalCaller(req, corsHeaders)
      if (auth instanceof Response) return auth

      const rawAmountUsd = Number(body.amountUsd)
      const amountCents = Number.isFinite(rawAmountUsd) ? Math.round(rawAmountUsd * 100) : NaN
      if (
        !Number.isInteger(amountCents) ||
        amountCents < MIN_DONATION_CENTS ||
        amountCents > MAX_DONATION_CENTS
      ) {
        return jsonResponse(
          {
            error: 'Support amount must be between $1.00 and $500.00 USD.',
            code: 'INVALID_DONATION_AMOUNT',
          },
          400,
          corsHeaders,
        )
      }

      if (auth.user) {
        const rateWindowIso = new Date(Date.now() - 10 * 60_000).toISOString()
        const { count: recentCount, error: rateErr } = await auth.adminClient
          .from('payment_orders')
          .select('id', { count: 'exact', head: true })
          .eq('buyer_user_id', auth.user.id)
          .gte('created_at', rateWindowIso)
        if (!rateErr && (recentCount ?? 0) >= 15) {
          return jsonResponse(
            {
              error: 'Too many checkout attempts. Please wait a few minutes before trying again.',
              code: 'RATE_LIMIT_CHECKOUT',
            },
            429,
            corsHeaders,
          )
        }
      }

      const externalReference = crypto.randomUUID()
      const senderUsername = await resolveSenderUsername(
        auth.adminClient,
        auth.user,
        'Apoiador Internacional',
      )

      const { data: orderRow, error: orderInsertErr } = await auth.adminClient
        .from('payment_orders')
        .insert({
          buyer_user_id: auth.user?.id ?? null,
          target_tree_id: null,
          item_id: null,
          provider: 'stripe',
          currency: 'USD',
          amount_cents: amountCents,
          status: 'pending',
          external_reference: externalReference,
          metadata: {
            type: 'support_donation',
            sender_username: senderUsername,
          },
        })
        .select('id')
        .single<{ id: string }>()

      if (orderInsertErr || !orderRow) {
        console.error(
          '[create-stripe-checkout] Failed creating donation order row:',
          orderInsertErr?.code,
        )
        return jsonResponse(
          { error: 'Failed to register support checkout order.', code: 'ORDER_CREATE_ERROR' },
          500,
          corsHeaders,
        )
      }

      try {
        const session = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            payment_method_types: ['card'],
            client_reference_id: externalReference,
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  unit_amount: amountCents,
                  product_data: {
                    name: 'Christmas Commit City — Creator Study Support (USD)',
                    description: 'Voluntary contribution supporting Computer Engineering studies at UFC.',
                  },
                },
                quantity: 1,
              },
            ],
            success_url: `${safeOrigin}/?payment=success&payment_type=support_donation&order_id=${encodeURIComponent(orderRow.id)}`,
            cancel_url: `${safeOrigin}/?payment=cancelled&payment_type=support_donation&order_id=${encodeURIComponent(orderRow.id)}`,
            customer_email: auth.user?.email?.trim() || undefined,
            metadata: {
              type: 'support_donation',
              order_id: orderRow.id,
              external_reference: externalReference,
              ...(auth.user ? { buyer_user_id: auth.user.id } : {}),
            },
          },
          { idempotencyKey: externalReference },
        )

        if (!session.id || !session.url) {
          await auth.adminClient
            .from('payment_orders')
            .update({ status: 'failed' })
            .eq('id', orderRow.id)
          return jsonResponse(
            {
              error: 'Unable to start Stripe Checkout right now. Please try again shortly.',
              code: 'STRIPE_API_ERROR',
            },
            502,
            corsHeaders,
          )
        }

        await auth.adminClient
          .from('payment_orders')
          .update({ provider_payment_id: session.id })
          .eq('id', orderRow.id)

        return jsonResponse(
          {
            orderId: orderRow.id,
            externalReference,
            sessionId: session.id,
            checkoutUrl: session.url,
            amountCents,
            currency: 'USD',
            type: 'support_donation',
          },
          200,
          corsHeaders,
        )
      } catch (stripeErr) {
        const errCode =
          stripeErr && typeof stripeErr === 'object' && 'code' in stripeErr
            ? String((stripeErr as { code?: unknown }).code ?? 'unknown')
            : 'stripe_error'
        console.error('[create-stripe-checkout] Stripe donation session failed:', errCode)
        await auth.adminClient
          .from('payment_orders')
          .update({ status: 'failed' })
          .eq('id', orderRow.id)
        return jsonResponse(
          {
            error: 'Unable to start Stripe Checkout right now. Please try again shortly.',
            code: 'STRIPE_API_ERROR',
          },
          502,
          corsHeaders,
        )
      }
    }

    // Store Item checkout: authenticated user required, authoritative USD price strictly from shop_catalog
    const auth = await authenticateCaller(req, corsHeaders)
    if (auth instanceof Response) return auth

    const itemId = typeof body.itemId === 'string' ? body.itemId : ''
    const targetTreeId = typeof body.targetTreeId === 'string' ? body.targetTreeId : undefined

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
          type: 'store_item',
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
      )
      return jsonResponse(
        { error: 'Failed to register Stripe order.', code: 'ORDER_CREATE_ERROR' },
        500,
        corsHeaders,
      )
    }

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          client_reference_id: externalReference,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: validated.amountCents,
                product_data: {
                  name: `Christmas Commit City — ${validated.shopItem.id}`,
                },
              },
              quantity: 1,
            },
          ],
          success_url: `${safeOrigin}/?payment=success&payment_type=store_item&order_id=${encodeURIComponent(orderRow.id)}`,
          cancel_url: `${safeOrigin}/?payment=cancelled&payment_type=store_item&order_id=${encodeURIComponent(orderRow.id)}`,
          customer_email: auth.user.email?.trim() || undefined,
          metadata: {
            type: 'store_item',
            order_id: orderRow.id,
            external_reference: externalReference,
            item_id: validated.shopItem.id,
            buyer_user_id: auth.user.id,
            ...(validated.resolvedTargetTreeId
              ? { target_tree_id: validated.resolvedTargetTreeId }
              : {}),
          },
        },
        { idempotencyKey: externalReference },
      )

      if (!session.id || !session.url) {
        await auth.adminClient
          .from('payment_orders')
          .update({ status: 'failed' })
          .eq('id', orderRow.id)
        return jsonResponse(
          {
            error: 'Unable to start Stripe Checkout right now. Please try again shortly.',
            code: 'STRIPE_API_ERROR',
          },
          502,
          corsHeaders,
        )
      }

      await auth.adminClient
        .from('payment_orders')
        .update({ provider_payment_id: session.id })
        .eq('id', orderRow.id)

      return jsonResponse(
        {
          orderId: orderRow.id,
          externalReference,
          sessionId: session.id,
          checkoutUrl: session.url,
          amountCents: validated.amountCents,
          currency: 'USD',
          type: 'store_item',
        },
        200,
        corsHeaders,
      )
    } catch (stripeErr) {
      const errCode =
        stripeErr && typeof stripeErr === 'object' && 'code' in stripeErr
          ? String((stripeErr as { code?: unknown }).code ?? 'unknown')
          : 'stripe_error'
      console.error('[create-stripe-checkout] Stripe store session failed:', errCode)
      await auth.adminClient
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('id', orderRow.id)
      return jsonResponse(
        {
          error: 'Unable to start Stripe Checkout right now. Please try again shortly.',
          code: 'STRIPE_API_ERROR',
        },
        502,
        corsHeaders,
      )
    }
  } catch (err) {
    console.error('[create-stripe-checkout] Unexpected error:', err instanceof Error ? err.message : 'unknown')
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
