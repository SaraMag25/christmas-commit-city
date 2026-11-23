import {
  authenticateCaller,
  buildCorsHeaders,
  jsonResponse,
  validateOrderCreationInput,
} from '../_shared/paymentHelpers.ts'

const PIX_EXPIRATION_MINUTES = 30

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

    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')?.trim() ?? ''
    if (!mpAccessToken) {
      return jsonResponse(
        {
          error: 'Mercado Pago credentials are not configured on the server.',
          code: 'MERCADOPAGO_NOT_CONFIGURED',
        },
        503,
        corsHeaders,
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      itemId?: unknown
      targetTreeId?: unknown
    }

    const itemId = typeof body.itemId === 'string' ? body.itemId : ''
    const targetTreeId = typeof body.targetTreeId === 'string' ? body.targetTreeId : undefined

    const validated = await validateOrderCreationInput({
      adminClient: auth.adminClient,
      user: auth.user,
      itemId,
      targetTreeId,
      currency: 'BRL',
      corsHeaders,
    })
    if (validated instanceof Response) return validated

    const externalReference = crypto.randomUUID()
    const expiresAtDate = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60_000)
    const expiresAtIso = expiresAtDate.toISOString()

    // Insert pending order cleanly BEFORE contacting Mercado Pago so `amount_cents` is anchored in DB
    const { data: orderRow, error: orderInsertErr } = await auth.adminClient
      .from('payment_orders')
      .insert({
        buyer_user_id: auth.user.id,
        target_tree_id: validated.resolvedTargetTreeId,
        item_id: validated.shopItem.id,
        provider: 'pix',
        currency: 'BRL',
        amount_cents: validated.amountCents,
        status: 'pending',
        external_reference: externalReference,
        expires_at: expiresAtIso,
        metadata: {
          sender_username: validated.senderUsername,
          item_type: validated.shopItem.item_type,
        },
      })
      .select('id')
      .single<{ id: string }>()

    if (orderInsertErr || !orderRow) {
      console.error(
        '[create-pix-payment] Failed creating payment_orders row:',
        orderInsertErr?.code,
        orderInsertErr?.message,
      )
      return jsonResponse(
        { error: 'Failed to register payment order.', code: 'ORDER_CREATE_ERROR' },
        500,
        corsHeaders,
      )
    }

    const notificationUrl = `${auth.supabaseUrl.replace(/\/+$/, '')}/functions/v1/webhook-mercadopago?source_news=webhooks`
    const transactionAmount = Number((validated.amountCents / 100).toFixed(2))
    const payerEmail =
      auth.user.email?.trim() || `dev-${auth.user.id.slice(0, 8)}@users.christmascommit.city`

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': externalReference,
      },
      body: JSON.stringify({
        transaction_amount: transactionAmount,
        description: `Christmas Commit City — ${validated.shopItem.id}`,
        payment_method_id: 'pix',
        external_reference: externalReference,
        notification_url: notificationUrl,
        date_of_expiration: expiresAtIso,
        payer: {
          email: payerEmail,
        },
        metadata: {
          order_id: orderRow.id,
          external_reference: externalReference,
          item_id: validated.shopItem.id,
          buyer_user_id: auth.user.id,
          target_tree_id: validated.resolvedTargetTreeId,
        },
      }),
    })

    const mpPayload = (await mpRes.json().catch(() => null)) as {
      id?: number | string
      message?: string
      error?: string
      date_of_expiration?: string
      point_of_interaction?: {
        transaction_data?: {
          qr_code?: string
          qr_code_base64?: string
          ticket_url?: string
        }
      }
    } | null

    const txData = mpPayload?.point_of_interaction?.transaction_data

    if (!mpRes.ok || !mpPayload?.id || !txData?.qr_code) {
      console.error(
        '[create-pix-payment] Mercado Pago API error:',
        mpRes.status,
        mpPayload?.message || mpPayload?.error,
      )
      await auth.adminClient
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('id', orderRow.id)

      return jsonResponse(
        {
          error:
            mpPayload?.message ||
            'Mercado Pago failed to generate Pix QR Code.',
          code: 'MERCADOPAGO_API_ERROR',
        },
        502,
        corsHeaders,
      )
    }

    const providerPaymentId = String(mpPayload.id)
    await auth.adminClient
      .from('payment_orders')
      .update({
        provider_payment_id: providerPaymentId,
        expires_at: mpPayload.date_of_expiration || expiresAtIso,
      })
      .eq('id', orderRow.id)

    return jsonResponse(
      {
        orderId: orderRow.id,
        externalReference,
        paymentId: providerPaymentId,
        qrCode: txData.qr_code,
        qrCodeBase64: txData.qr_code_base64 ?? null,
        ticketUrl: txData.ticket_url ?? null,
        amountCents: validated.amountCents,
        currency: 'BRL',
        expiresAt: mpPayload.date_of_expiration || expiresAtIso,
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('[create-pix-payment] Unexpected error:', err)
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Unexpected server error.',
        code: 'INTERNAL_ERROR',
      },
      500,
      corsHeaders,
    )
  }
})
