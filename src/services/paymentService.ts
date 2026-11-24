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

/**
 * Requests a server-priced Stripe Checkout Session for international USD card payments.
 */
export async function createStripeCheckout(params: {
  itemId: string
  targetTreeId?: string
}): Promise<StripeCheckoutOrder> {
  const accessToken = await getActiveAccessToken()
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')

  const { data, error } = await supabase.functions.invoke<StripeCheckoutOrder>(
    'create-stripe-checkout',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        itemId: params.itemId,
        targetTreeId: params.targetTreeId,
        returnUrl: window.location.origin,
      },
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
    .select('id, item_id, target_tree_id, currency, amount_cents, status, paid_at')
    .eq('id', orderId.trim())
    .maybeSingle<PaymentOrderStatusRecord>()

  if (error) {
    return null
  }
  return data ?? null
}
