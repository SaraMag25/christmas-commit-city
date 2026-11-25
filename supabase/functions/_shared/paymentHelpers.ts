import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')?.trim()
  if (!raw) return DEFAULT_ALLOWED_ORIGINS
  const parsed = raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0)
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS
}

export function resolveSafeReturnOrigin(req: Request, requestedOrigin?: string): string {
  const allowed = getAllowedOrigins()
  const normalizedRequested = requestedOrigin?.trim().replace(/\/+$/, '') ?? ''
  if (normalizedRequested && allowed.includes(normalizedRequested)) {
    return normalizedRequested
  }
  const reqOrigin = req.headers.get('Origin')?.trim().replace(/\/+$/, '') ?? ''
  if (reqOrigin && allowed.includes(reqOrigin)) {
    return reqOrigin
  }
  return allowed[0]
}

export function buildCorsHeaders(req: Request): { headers: Record<string, string>; allowed: boolean } {
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = req.headers.get('Origin')?.trim().replace(/\/+$/, '') ?? ''

  if (!requestOrigin) {
    return {
      allowed: true,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins[0],
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
      },
    }
  }

  const isAllowed = allowedOrigins.includes(requestOrigin)
  return {
    allowed: isAllowed,
    headers: {
      'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  }
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

export function createServiceAdminClient(): {
  supabaseUrl: string
  adminClient: SupabaseClient
} | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
  if (!supabaseUrl || !serviceRoleKey) return null
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { supabaseUrl, adminClient }
}

export interface AuthenticatedCallerContext {
  supabaseUrl: string
  user: User
  adminClient: SupabaseClient
}

export async function authenticateCaller(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthenticatedCallerContext | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Server configuration error.', code: 'SERVER_CONFIG_ERROR' },
      500,
      corsHeaders,
    )
  }

  const authHeader = req.headers.get('Authorization')?.trim() ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse(
      { error: 'Missing bearer authorization token.', code: 'MISSING_AUTH' },
      401,
      corsHeaders,
    )
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    return jsonResponse(
      { error: 'Invalid bearer authorization token.', code: 'INVALID_AUTH' },
      401,
      corsHeaders,
    )
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token)

  if (userError || !user) {
    console.error('[payments] auth.getUser failed:', userError?.message ?? 'missing user')
    return jsonResponse(
      { error: 'Invalid or expired Supabase session.', code: 'INVALID_SESSION' },
      401,
      corsHeaders,
    )
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return { supabaseUrl, user, adminClient }
}

export interface ShopCatalogRow {
  id: string
  item_type: 'companion' | 'accessory' | 'gift' | 'bundle'
  price_commits: number | null
  price_brl_cents: number
  price_usd_cents: number
  is_free: boolean
  active: boolean
}

export interface ValidatedOrderInput {
  shopItem: ShopCatalogRow
  amountCents: number
  resolvedTargetTreeId: string | null
  senderUsername: string
}

export async function validateOrderCreationInput(params: {
  adminClient: SupabaseClient
  user: User
  itemId: string
  targetTreeId?: string
  currency: 'BRL' | 'USD'
  corsHeaders: Record<string, string>
}): Promise<ValidatedOrderInput | Response> {
  const { adminClient, user, itemId, targetTreeId, currency, corsHeaders } = params
  const cleanItemId = itemId.trim()
  if (!cleanItemId) {
    return jsonResponse({ error: 'Missing itemId.', code: 'INVALID_ITEM' }, 400, corsHeaders)
  }

  const { data: shopItem, error: catalogErr } = await adminClient
    .from('shop_catalog')
    .select('id, item_type, price_commits, price_brl_cents, price_usd_cents, is_free, active')
    .eq('id', cleanItemId)
    .eq('active', true)
    .maybeSingle<ShopCatalogRow>()

  if (catalogErr) {
    console.error('[payments] Failed reading shop_catalog:', catalogErr.code, catalogErr.message)
    return jsonResponse(
      { error: 'Failed to load item pricing.', code: 'CATALOG_READ_ERROR' },
      500,
      corsHeaders,
    )
  }

  if (!shopItem) {
    return jsonResponse(
      { error: 'Catalog item not found or inactive.', code: 'ITEM_NOT_FOUND' },
      400,
      corsHeaders,
    )
  }

  const amountCents = currency === 'BRL' ? shopItem.price_brl_cents : shopItem.price_usd_cents
  if (shopItem.is_free || !Number.isInteger(amountCents) || amountCents <= 0) {
    return jsonResponse(
      { error: 'Selected item is not eligible for paid checkout.', code: 'ITEM_NOT_PAYABLE' },
      400,
      corsHeaders,
    )
  }

  let resolvedTargetTreeId: string | null = null

  if (shopItem.item_type === 'gift') {
    const cleanTreeId = targetTreeId?.trim() ?? ''
    if (!cleanTreeId) {
      return jsonResponse(
        { error: 'targetTreeId is required for paid gift purchases.', code: 'TARGET_TREE_REQUIRED' },
        400,
        corsHeaders,
      )
    }

    const { data: targetTree, error: treeErr } = await adminClient
      .from('trees')
      .select('id')
      .eq('id', cleanTreeId)
      .maybeSingle<{ id: string }>()

    if (treeErr) {
      console.error('[payments] Failed verifying target tree:', treeErr.code, treeErr.message)
      return jsonResponse(
        { error: 'Failed to verify recipient tree.', code: 'TREE_LOOKUP_ERROR' },
        500,
        corsHeaders,
      )
    }

    if (!targetTree) {
      return jsonResponse(
        { error: 'Recipient tree does not exist.', code: 'RECIPIENT_TREE_NOT_FOUND' },
        404,
        corsHeaders,
      )
    }

    resolvedTargetTreeId = targetTree.id
  } else {
    // Classic items (price_commits != null) are included in supporter-bundle;
    // Pix-only exclusives (price_commits == null) must still be purchasable by bundle owners.
    const unlockLookupIds =
      shopItem.price_commits !== null ? [shopItem.id, 'supporter-bundle'] : [shopItem.id]
    const { data: existingUnlocks, error: unlockErr } = await adminClient
      .from('user_unlocks')
      .select('item_id')
      .eq('user_id', user.id)
      .in('item_id', unlockLookupIds)

    if (unlockErr) {
      console.error('[payments] Failed checking existing unlocks:', unlockErr.code, unlockErr.message)
      return jsonResponse(
        { error: 'Failed to check existing unlocks.', code: 'UNLOCK_CHECK_ERROR' },
        500,
        corsHeaders,
      )
    }

    if ((existingUnlocks?.length ?? 0) > 0) {
      return jsonResponse(
        { error: 'Item is already unlocked on your account.', code: 'ITEM_ALREADY_OWNED' },
        409,
        corsHeaders,
      )
    }
  }

  const rateWindowIso = new Date(Date.now() - 10 * 60_000).toISOString()
  const { count: recentOrdersCount, error: rateErr } = await adminClient
    .from('payment_orders')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_user_id', user.id)
    .gte('created_at', rateWindowIso)

  if (rateErr) {
    console.error('[payments] Failed checking checkout rate limit:', rateErr.code, rateErr.message)
    return jsonResponse(
      { error: 'Failed to validate checkout limits.', code: 'RATE_LIMIT_CHECK_ERROR' },
      500,
      corsHeaders,
    )
  }

  if ((recentOrdersCount ?? 0) >= 15) {
    return jsonResponse(
      {
        error: 'Too many checkout attempts. Please wait a few minutes before trying again.',
        code: 'RATE_LIMIT_CHECKOUT',
      },
      429,
      corsHeaders,
    )
  }

  const { data: senderTree } = await adminClient
    .from('trees')
    .select('github_username')
    .eq('user_id', user.id)
    .maybeSingle<{ github_username: string }>()

  const githubIdentity = user.identities?.find((id) => id.provider === 'github')
  const identityData = (githubIdentity?.identity_data ?? {}) as Record<string, unknown>
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>

  const rawSenderUsername =
    senderTree?.github_username?.trim() ||
    (typeof identityData.user_name === 'string' && identityData.user_name.trim()) ||
    (typeof identityData.preferred_username === 'string' &&
      identityData.preferred_username.trim()) ||
    (typeof meta.user_name === 'string' && meta.user_name.trim()) ||
    (typeof meta.preferred_username === 'string' && meta.preferred_username.trim()) ||
    'github-dev'

  const senderUsername =
    Array.from(rawSenderUsername)
      .filter((ch) => {
        const code = ch.charCodeAt(0)
        return code >= 32 && code !== 127 && ch !== '<' && ch !== '>'
      })
      .join('')
      .trim()
      .slice(0, 39) || 'github-dev'

  return {
    shopItem,
    amountCents,
    resolvedTargetTreeId,
    senderUsername,
  }
}

export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const left = a.trim().toLowerCase()
  const right = b.trim().toLowerCase()
  if (left.length === 0 || left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return diff === 0
}

export interface PaymentOrderRow {
  id: string
  buyer_user_id: string | null
  target_tree_id: string | null
  item_id: string | null
  provider: string
  currency: 'BRL' | 'USD'
  amount_cents: number
  status: string
  external_reference: string | null
  provider_payment_id: string | null
  metadata: Record<string, unknown> | null
}
