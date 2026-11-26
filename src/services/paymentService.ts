import { toSafeHttpUrl } from '../utils/urlSafety'
import { parseEdgeFunctionError } from './edgeFunctionError'
import { isSupabaseConfigured, supabase } from './supabaseClient'

export interface PixPaymentOrder {
  orderId: string
  externalReference: string
  paymentId: string
  qrCode: string
  qrCodeBase64: string | null
  ticketUrl: string | null
  amountCents: number
  currency: 'BRL'
  expiresAt: string
}

export interface StripeCheckoutOrder {
  orderId: string
  externalReference: string
  sessionId: string
  checkoutUrl: string
  amountCents: number
  currency: 'USD'
  type?: 'store_item' | 'support_donation'
}

export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface PaymentOrderStatusRecord {
  id: string
  item_id: string | null
  target_tree_id: string | null
  currency: 'BRL' | 'USD'
  amount_cents: number
  status: PaymentOrderStatus
  paid_at: string | null
  metadata?: Record<string, unknown> | null
}

async function formatPaymentInvokeError(
  error: unknown,
  fnName: 'create-pix-payment' | 'create-stripe-checkout',
): Promise<string> {
  const detail = await parseEdgeFunctionError(error, fnName)

  if (detail.isFetchError) {
    return `Não foi possível conectar à função ${fnName} (rede ou CORS bloqueado para ${window.location.origin}).`
  }

  if (detail.isRelayError) {
    return `Erro de gateway ao chamar ${fnName}${detail.status ? ` (HTTP ${detail.status})` : ''}.`
  }

  if (typeof detail.status === 'number') {
    const { status, code = '', serverMessage = '' } = detail

    if (status === 404 && !code) {
      return `Função "${fnName}" ainda não foi publicada no Supabase (HTTP 404).`
    }
    if (status === 401) {
      return 'Sessão expirada. Saia e reconecte sua conta GitHub para continuar.'
    }
    if (status === 409 || code === 'ITEM_ALREADY_OWNED') {
      return 'Este item já está desbloqueado na sua conta.'
    }
    if (status === 503 || code.endsWith('_NOT_CONFIGURED')) {
      return fnName === 'create-pix-payment'
        ? 'Pix automático ainda não configurado no servidor.'
        : 'Checkout internacional ainda não configurado no servidor.'
    }
    return serverMessage || `Falha no checkout (${code || `HTTP ${status}`}).`
  }

  return detail.serverMessage || 'Não foi possível iniciar o pagamento.'
}

async function getActiveAccessToken(): Promise<string> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token?.trim()
  if (!token) {
    throw new Error('Conecte sua conta GitHub primeiro para iniciar o pagamento.')
  }
  return token
}

/**
 * Requests a server-priced Mercado Pago Pix QR Code.
 * Prices are NEVER sent from the browser; the Edge Function reads `shop_catalog`.
 */
export async function createPixPayment(params: {
  itemId: string
  targetTreeId?: string
}): Promise<PixPaymentOrder> {
  const accessToken = await getActiveAccessToken()
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')

  const { data, error } = await supabase.functions.invoke<PixPaymentOrder>(
    'create-pix-payment',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        itemId: params.itemId,
        targetTreeId: params.targetTreeId,
      },
    },
  )

  if (error) {
    throw new Error(await formatPaymentInvokeError(error, 'create-pix-payment'))
  }
  if (!data?.orderId || !data?.qrCode) {
    throw new Error('Resposta inválida ao gerar o QR Code Pix.')
  }
  return data
}

async function getOptionalAccessToken(): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token?.trim() || null
}

/**
 * Requests a server-priced Stripe Checkout Session for store items (`store_item`)
 * or voluntary creator USD support (`support_donation`, validated $1-$500 server-side).
 */
export async function createStripeCheckout(
  params:
    | {
        type?: 'store_item'
        itemId: string
        targetTreeId?: string
      }
    | {
        type: 'support_donation'
        amountUsd: number
      },
): Promise<StripeCheckoutOrder> {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')

  const isDonation = params.type === 'support_donation'
  const accessToken = isDonation
    ? await getOptionalAccessToken()
    : await getActiveAccessToken()

  if (isDonation) {
    const amountCents = Math.round(params.amountUsd * 100)
    if (!Number.isFinite(params.amountUsd) || amountCents < 100 || amountCents > 50000) {
      throw new Error('Informe um valor válido entre $1.00 e $500.00 USD.')
    }
  }

  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  const body = isDonation
    ? {
        type: 'support_donation' as const,
        amountUsd: Number(params.amountUsd.toFixed(2)),
        returnUrl: window.location.origin,
      }
    : {
        type: 'store_item' as const,
        itemId: params.itemId,
        targetTreeId: params.targetTreeId,
        returnUrl: window.location.origin,
      }

  const { data, error } = await supabase.functions.invoke<StripeCheckoutOrder>(
    'create-stripe-checkout',
    {
      headers,
      body,
    },
  )

  if (error) {
    throw new Error(await formatPaymentInvokeError(error, 'create-stripe-checkout'))
  }
  const safeCheckoutUrl = toSafeHttpUrl(data?.checkoutUrl)
  if (!data?.orderId || !safeCheckoutUrl) {
    throw new Error('Resposta inválida ao iniciar o Checkout Stripe.')
  }
  return {
    ...data,
    checkoutUrl: safeCheckoutUrl,
  }
}

export function createStripeSupportCheckout(amountUsd: number): Promise<StripeCheckoutOrder> {
  return createStripeCheckout({
    type: 'support_donation',
    amountUsd,
  })
}

/**
 * Reads the authenticated buyer's own payment order status via RLS-enforced SELECT.
 * Unlocks/gifts are NEVER granted on client call — only webhooks via `service_role` mark `paid`.
 */
export async function fetchMyPaymentOrderStatus(
  orderId: string,
): Promise<PaymentOrderStatusRecord | null> {
  if (!supabase || !isSupabaseConfigured || !orderId.trim()) return null

  const { data, error } = await supabase
    .from('payment_orders')
    .select('id, item_id, target_tree_id, currency, amount_cents, status, paid_at, metadata')
    .eq('id', orderId.trim())
    .maybeSingle<PaymentOrderStatusRecord>()

  if (error) {
    return null
  }
  return data ?? null
}
