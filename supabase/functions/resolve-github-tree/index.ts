import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/
const NEGATIVE_CACHE_MS = 15 * 60 * 1000
const PER_IP_MAX_LOOKUPS = 20
const GLOBAL_MAX_LOOKUPS = 120
const RATE_WINDOW_SECONDS = 60

const GITHUB_GRAPHQL_QUERY = `
  query ResolvePublicDeveloperTree($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      name
      avatarUrl
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              color
            }
          }
        }
      }
    }
  }
`

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')?.trim()
  if (!raw) return DEFAULT_ALLOWED_ORIGINS
  const parsed = raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0)
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS
}

function buildCorsHeaders(req: Request): { headers: Record<string, string>; allowed: boolean } {
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

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function hashClientIp(req: Request): Promise<string> {
  const rawIp =
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawIp))
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function resolveContributionYear(rawYear: unknown): number {
  const currentYear = new Date().getUTCFullYear()
  if (typeof rawYear === 'number' && Number.isInteger(rawYear)) {
    if (rawYear >= 2020 && rawYear <= currentYear + 1) {
      return rawYear
    }
  }
  return currentYear
}

interface TreeRow {
  id: string
  github_username: string
  display_name: string
  avatar_url: string
  total_commits: number
  contribution_calendar: unknown
  plot_index: number
  active_companion_id: string | null
  companion_custom_name: string | null
  equipped_head_id: string | null
  equipped_body_id: string | null
  equipped_hand_id: string | null
  last_synced_at: string | null
  claimed: boolean
}

const PUBLIC_TREE_SELECT =
  'id, github_username, display_name, avatar_url, total_commits, contribution_calendar, plot_index, active_companion_id, companion_custom_name, equipped_head_id, equipped_body_id, equipped_hand_id, last_synced_at, claimed'

async function fetchTreeGiftCounts(
  adminClient: ReturnType<typeof createClient>,
  treeId: string,
): Promise<Array<{ gift_id: string; gift_count: number }>> {
  const { data, error } = await adminClient
    .from('tree_gifts')
    .select('gift_id')
    .eq('recipient_tree_id', treeId)

  if (error || !Array.isArray(data)) return []
  const counts = new Map<string, number>()
  for (const row of data as Array<{ gift_id?: unknown }>) {
    if (typeof row.gift_id === 'string' && row.gift_id) {
      counts.set(row.gift_id, (counts.get(row.gift_id) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries()).map(([gift_id, gift_count]) => ({ gift_id, gift_count }))
}

Deno.serve(async (req: Request) => {
  const { headers: corsHeaders, allowed } = buildCorsHeaders(req)

  if (!allowed) {
    return jsonResponse({ error: 'Origin not allowed by CORS policy.' }, 403, corsHeaders)
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error.' }, 500, corsHeaders)
    }

    const payload = (await req.json().catch(() => ({}))) as {
      username?: unknown
      year?: unknown
    }

    const rawUsername = typeof payload.username === 'string' ? payload.username.trim() : ''
    const cleanUsername = rawUsername.replace(/^@+/, '').trim()

    if (!GITHUB_USERNAME_REGEX.test(cleanUsername)) {
      return jsonResponse(
        {
          error:
            'Invalid GitHub username. Use 1 to 39 letters, numbers, or single hyphens.',
          code: 'INVALID_USERNAME',
        },
        400,
        corsHeaders,
      )
    }

    const usernameLower = cleanUsername.toLowerCase()
    const targetYear = resolveContributionYear(payload.year)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Always check existing database entry first (zero GitHub quota used)
    const { data: existingRow, error: existingErr } = await adminClient
      .from('trees')
      .select(PUBLIC_TREE_SELECT)
      .eq('github_username_lower', usernameLower)
      .maybeSingle<TreeRow>()

    if (existingErr) {
      console.error('[resolve-github-tree] DB lookup failed:', existingErr.code, existingErr.message)
      return jsonResponse(
        { error: 'Failed to check existing trees.', code: 'DB_READ_ERROR' },
        500,
        corsHeaders,
      )
    }

    if (existingRow) {
      const giftCounts = await fetchTreeGiftCounts(adminClient, existingRow.id)
      return jsonResponse(
        {
          tree: existingRow,
          giftCounts,
          alreadyExists: true,
          periodYear: targetYear,
        },
        200,
        corsHeaders,
      )
    }

    // 2. Respect short negative cache so repeated lookups for non-existent users don't burn API quota
    const { data: guardRow } = await adminClient
      .from('github_lookup_guard')
      .select('status, checked_at')
      .eq('username_lower', usernameLower)
      .maybeSingle<{ status: string; checked_at: string }>()

    if (guardRow?.status === 'not_found') {
      const checkedMs = Date.parse(guardRow.checked_at)
      if (!Number.isNaN(checkedMs) && Date.now() - checkedMs < NEGATIVE_CACHE_MS) {
        return jsonResponse(
          {
            error: `GitHub user "@${cleanUsername}" was not found.`,
            code: 'GITHUB_USER_NOT_FOUND',
          },
          404,
          corsHeaders,
        )
      }
    }

    // 3. Distributed rate-limiting per client IP hash & global safety cap
    const ipHash = await hashClientIp(req)
    const [ipAllowedRes, globalAllowedRes] = await Promise.all([
      adminClient.rpc('consume_resolve_rate_limit', {
        p_bucket_key: `ip:${ipHash}`,
        p_max_requests: PER_IP_MAX_LOOKUPS,
        p_window_seconds: RATE_WINDOW_SECONDS,
      }),
      adminClient.rpc('consume_resolve_rate_limit', {
        p_bucket_key: 'global',
        p_max_requests: GLOBAL_MAX_LOOKUPS,
        p_window_seconds: RATE_WINDOW_SECONDS,
      }),
    ])

    if (ipAllowedRes.data === false || globalAllowedRes.data === false) {
      return jsonResponse(
        {
          error: 'Too many new GitHub lookups right now. Please wait a minute and try again.',
          code: 'RATE_LIMITED',
        },
        429,
        corsHeaders,
      )
    }

    // 4. Require server-only GitHub token secret (GITHUB_TOKEN preferred, fallback GITHUB_READONLY_TOKEN)
    const githubToken =
      Deno.env.get('GITHUB_TOKEN')?.trim() || Deno.env.get('GITHUB_READONLY_TOKEN')?.trim() || ''

    if (!githubToken) {
      return jsonResponse(
        {
          error:
            'GITHUB_TOKEN secret is missing on the Supabase Edge Function. Configure it with: npx supabase secrets set GITHUB_TOKEN=<your_github_token>',
          code: 'MISSING_GITHUB_TOKEN',
        },
        503,
        corsHeaders,
      )
    }

    const fromIso = `${targetYear}-01-01T00:00:00.000Z`
    const toIso = `${targetYear}-12-31T23:59:59.999Z`

    const ghRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Christmas-Commit-City-Edge-Function',
      },
      body: JSON.stringify({
        query: GITHUB_GRAPHQL_QUERY,
        variables: {
          login: cleanUsername,
          from: fromIso,
          to: toIso,
        },
      }),
    })

    if (!ghRes.ok) {
      const errorText = await ghRes.text()
      console.error(
        '[resolve-github-tree] GitHub GraphQL HTTP error:',
        ghRes.status,
        errorText.slice(0, 240),
      )
      return jsonResponse(
        {
          error:
            ghRes.status === 401
              ? 'Configured GITHUB_TOKEN is invalid or expired.'
              : ghRes.status === 403 || ghRes.status === 429
                ? 'GitHub API rate limit reached temporarily. Try again shortly.'
                : 'Failed to query GitHub GraphQL API.',
          code:
            ghRes.status === 401
              ? 'GITHUB_TOKEN_INVALID'
              : ghRes.status === 403 || ghRes.status === 429
                ? 'GITHUB_RATE_LIMITED'
                : 'GITHUB_API_ERROR',
        },
        ghRes.status === 403 || ghRes.status === 429 ? 429 : 502,
        corsHeaders,
      )
    }

    const ghJson = (await ghRes.json()) as {
      data?: {
        user?: {
          login: string
          name: string | null
          avatarUrl: string
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: number
              weeks: Array<{
                contributionDays: Array<{
                  date: string
                  contributionCount: number
                  color: string
                }>
              }>
            }
          }
        } | null
      }
      errors?: Array<{ type?: string; message?: string }>
    }

    const notFoundOnGitHub =
      !ghJson.data?.user ||
      Boolean(ghJson.errors?.some((err) => err.type === 'NOT_FOUND'))

    if (notFoundOnGitHub) {
      await adminClient.from('github_lookup_guard').upsert(
        {
          username_lower: usernameLower,
          status: 'not_found',
          checked_at: new Date().toISOString(),
        },
        { onConflict: 'username_lower' },
      )
      return jsonResponse(
        {
          error: `GitHub user "@${cleanUsername}" was not found.`,
          code: 'GITHUB_USER_NOT_FOUND',
        },
        404,
        corsHeaders,
      )
    }

    if (ghJson.errors?.length) {
      console.error('[resolve-github-tree] GitHub GraphQL errors:', ghJson.errors[0]?.message)
      return jsonResponse(
        {
          error: ghJson.errors[0]?.message || 'GitHub GraphQL query error.',
          code: 'GITHUB_API_ERROR',
        },
        502,
        corsHeaders,
      )
    }

    const ghUser = ghJson.data!.user!
    const totalContributions = Math.max(
      0,
      Math.floor(ghUser.contributionsCollection.contributionCalendar.totalContributions),
    )
    const calendarWeeks = ghUser.contributionsCollection.contributionCalendar.weeks
    const displayName = ghUser.name?.trim() || ghUser.login
    const syncedAt = new Date().toISOString()

    // Check canonical GitHub login too in case of account rename alias
    const canonicalLower = ghUser.login.toLowerCase()
    if (canonicalLower !== usernameLower) {
      const { data: aliasRow } = await adminClient
        .from('trees')
        .select(PUBLIC_TREE_SELECT)
        .eq('github_username_lower', canonicalLower)
        .maybeSingle<TreeRow>()

      if (aliasRow) {
        const giftCounts = await fetchTreeGiftCounts(adminClient, aliasRow.id)
        return jsonResponse(
          {
            tree: aliasRow,
            giftCounts,
            alreadyExists: true,
            periodYear: targetYear,
          },
          200,
          corsHeaders,
        )
      }
    }

    // 5. Persist unclaimed public tree; PostgreSQL sequence assigns unique `plot_index`
    const { data: insertedRow, error: insertErr } = await adminClient
      .from('trees')
      .insert({
        user_id: null,
        claimed: false,
        github_username: ghUser.login,
        display_name: displayName,
        avatar_url: ghUser.avatarUrl,
        total_commits: totalContributions,
        spent_commits: 0,
        contribution_calendar: calendarWeeks,
        last_synced_at: syncedAt,
      })
      .select(PUBLIC_TREE_SELECT)
      .single<TreeRow>()

    if (insertErr || !insertedRow) {
      // Handle race condition where another request inserted the same user concurrently
      if (insertErr?.code === '23505') {
        const { data: raceRow } = await adminClient
          .from('trees')
          .select(PUBLIC_TREE_SELECT)
          .eq('github_username_lower', canonicalLower)
          .maybeSingle<TreeRow>()

        if (raceRow) {
          const giftCounts = await fetchTreeGiftCounts(adminClient, raceRow.id)
          return jsonResponse(
            {
              tree: raceRow,
              giftCounts,
              alreadyExists: true,
              periodYear: targetYear,
            },
            200,
            corsHeaders,
          )
        }
      }

      console.error(
        '[resolve-github-tree] Failed to save tree:',
        insertErr?.code,
        insertErr?.message,
      )
      return jsonResponse(
        { error: 'Failed to save GitHub tree to city.', code: 'DB_INSERT_ERROR' },
        500,
        corsHeaders,
      )
    }

    return jsonResponse(
      {
        tree: insertedRow,
        giftCounts: [],
        alreadyExists: false,
        periodYear: targetYear,
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('[resolve-github-tree] Unexpected error:', err)
    return jsonResponse({ error: 'Unexpected server error.' }, 500, corsHeaders)
  }
})
