import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
const SYNC_COOLDOWN_MS = 5 * 60 * 1000

const GITHUB_GRAPHQL_QUERY = `
  query DeveloperContributions($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      name
      avatarUrl
      url
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

const TREE_THRESHOLDS = [
  { level: 0, min: 0 },
  { level: 1, min: 1 },
  { level: 2, min: 11 },
  { level: 3, min: 51 },
  { level: 4, min: 101 },
  { level: 5, min: 301 },
  { level: 6, min: 501 },
] as const

function resolveTreeLevel(contributions: number): number {
  const safe = Math.max(0, Math.floor(contributions))
  for (let i = TREE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (safe >= TREE_THRESHOLDS[i].min) {
      return TREE_THRESHOLDS[i].level
    }
  }
  return 0
}

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

interface ExistingTreeRow {
  id: string
  user_id: string
  github_username: string
  display_name: string
  avatar_url: string
  total_commits: number
  spent_commits: number
  contribution_calendar: unknown
  plot_index: number
  last_synced_at: string | null
  created_at: string
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
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
    const authHeader = req.headers.get('Authorization')?.trim() ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error.' }, 500, corsHeaders)
    }

    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing bearer authorization token.' }, 401, corsHeaders)
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      return jsonResponse({ error: 'Invalid bearer token.' }, 401, corsHeaders)
    }

    // Validate caller's JWT via Supabase Auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token)

    if (userError || !user) {
      console.error('[sync] Auth user validation failed:', userError?.message ?? 'missing user')
      return jsonResponse(
        { error: 'Invalid or expired Supabase session.', code: 'INVALID_SESSION' },
        401,
        corsHeaders,
      )
    }

    // Extract verified GitHub username strictly from the authenticated user's GitHub OAuth identity
    const githubIdentity = user.identities?.find((identity) => identity.provider === 'github')
    if (!githubIdentity) {
      return jsonResponse(
        { error: 'Authenticated account does not have a verified GitHub OAuth identity.' },
        403,
        corsHeaders,
      )
    }

    const identityData = (githubIdentity.identity_data ?? {}) as Record<string, unknown>
    const githubLogin =
      (typeof identityData.user_name === 'string' && identityData.user_name.trim()) ||
      (typeof identityData.preferred_username === 'string' &&
        identityData.preferred_username.trim()) ||
      (typeof user.user_metadata?.user_name === 'string' &&
        user.user_metadata.user_name.trim()) ||
      (typeof user.user_metadata?.preferred_username === 'string' &&
        user.user_metadata.preferred_username.trim()) ||
      ''

    if (!githubLogin) {
      return jsonResponse(
        { error: 'GitHub username was not found in verified OAuth identity.' },
        400,
        corsHeaders,
      )
    }

    const payload = (await req.json().catch(() => ({}))) as {
      providerToken?: string
      year?: number
    }

    // Always enforce the current standardized contribution year server-side
    const year = new Date().getUTCFullYear()

    // Privileged service-role client used ONLY inside this verified Edge Function
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: existingTree, error: existingErr } = await adminClient
      .from('trees')
      .select(
        'id, user_id, github_username, display_name, avatar_url, total_commits, spent_commits, contribution_calendar, plot_index, last_synced_at, created_at',
      )
      .eq('user_id', user.id)
      .maybeSingle<ExistingTreeRow>()

    if (existingErr) {
      console.error('[sync] Failed to read existing tree state:', existingErr.code, existingErr.message)
      return jsonResponse(
        { error: 'Failed to read existing tree state.', code: existingErr.code ?? 'DB_READ_ERROR' },
        500,
        corsHeaders,
      )
    }

    // Enforce 5-minute sync cooldown per user to prevent GitHub API abuse
    if (existingTree?.last_synced_at) {
      const lastMs = Date.parse(existingTree.last_synced_at)
      if (!Number.isNaN(lastMs) && Date.now() - lastMs < SYNC_COOLDOWN_MS) {
        const calendarWeeks = Array.isArray(existingTree.contribution_calendar)
          ? existingTree.contribution_calendar
          : []
        const cachedTotal = Math.max(0, existingTree.total_commits)
        return jsonResponse(
          {
            treeId: existingTree.id,
            userId: user.id,
            plotIndex: existingTree.plot_index,
            spentCommits: existingTree.spent_commits,
            cooldownActive: true,
            profile: {
              id: user.id,
              github_username: existingTree.github_username,
              github_name: existingTree.display_name,
              avatar_url: existingTree.avatar_url,
              created_at: existingTree.created_at,
            },
            treeLevel: resolveTreeLevel(cachedTotal),
            contributionCount: cachedTotal,
            stats: {
              periodYear: year,
              totalContributions: cachedTotal,
              commits: cachedTotal,
              pullRequests: 0,
              issues: 0,
              restrictedContributions: 0,
              calendarWeeks,
            },
            syncedAt: existingTree.last_synced_at,
          },
          200,
          corsHeaders,
        )
      }
    }

    const githubToken =
      payload.providerToken?.trim() || Deno.env.get('GITHUB_READONLY_TOKEN')?.trim() || ''

    if (!githubToken) {
      return jsonResponse(
        {
          error:
            'Missing GitHub access token. Re-authenticate with GitHub or configure GITHUB_READONLY_TOKEN in Supabase Edge Function secrets.',
        },
        400,
        corsHeaders,
      )
    }

    const fromIso = `${year}-01-01T00:00:00.000Z`
    const toIso = `${year}-12-31T23:59:59.999Z`

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
          login: githubLogin,
          from: fromIso,
          to: toIso,
        },
      }),
    })

    if (!ghRes.ok) {
      const errorText = await ghRes.text()
      console.error('[sync] GitHub GraphQL non-OK response:', ghRes.status, errorText.slice(0, 300))
      return jsonResponse(
        {
          error:
            ghRes.status === 401
              ? 'GitHub OAuth token expired or revoked. Please sign out and connect with GitHub again.'
              : `GitHub GraphQL returned ${ghRes.status}: ${errorText}`,
          code: ghRes.status === 401 ? 'GITHUB_TOKEN_INVALID' : 'GITHUB_API_ERROR',
        },
        ghRes.status === 401 ? 400 : 502,
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
            totalCommitContributions: number
            totalPullRequestContributions: number
            totalIssueContributions: number
            restrictedContributionsCount: number
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
        }
      }
      errors?: Array<{ message: string }>
    }

    if (ghJson.errors?.length || !ghJson.data?.user) {
      return jsonResponse(
        {
          error: ghJson.errors?.[0]?.message || 'Unable to retrieve GitHub user data.',
        },
        400,
        corsHeaders,
      )
    }

    const ghUser = ghJson.data.user
    const collection = ghUser.contributionsCollection
    const totalContributions = Math.max(0, Math.floor(collection.contributionCalendar.totalContributions))
    const calendarWeeks = collection.contributionCalendar.weeks
    const treeLevel = resolveTreeLevel(totalContributions)
    const syncedAt = new Date().toISOString()
    const displayName = ghUser.name?.trim() || ghUser.login

    let persistedTree: ExistingTreeRow | null = null

    if (existingTree) {
      const safeSpent = Math.min(existingTree.spent_commits, totalContributions)
      const { data: updated, error: updateErr } = await adminClient
        .from('trees')
        .update({
          github_username: ghUser.login,
          display_name: displayName,
          avatar_url: ghUser.avatarUrl,
          total_commits: totalContributions,
          spent_commits: safeSpent,
          contribution_calendar: calendarWeeks,
          last_synced_at: syncedAt,
        })
        .eq('id', existingTree.id)
        .select(
          'id, user_id, github_username, display_name, avatar_url, total_commits, spent_commits, contribution_calendar, plot_index, last_synced_at, created_at',
        )
        .single<ExistingTreeRow>()

      if (updateErr || !updated) {
        console.error(
          '[sync] Failed to persist updated tree contributions:',
          updateErr?.code,
          updateErr?.message,
        )
        return jsonResponse(
          {
            error: 'Failed to persist updated tree contributions.',
            code: updateErr?.code ?? 'DB_UPDATE_ERROR',
          },
          500,
          corsHeaders,
        )
      }
      persistedTree = updated
    } else {
      // Insert new tree; PostgreSQL sequence atomically assigns a unique `plot_index`
      const { data: inserted, error: insertErr } = await adminClient
        .from('trees')
        .insert({
          user_id: user.id,
          github_username: ghUser.login,
          display_name: displayName,
          avatar_url: ghUser.avatarUrl,
          total_commits: totalContributions,
          spent_commits: 0,
          contribution_calendar: calendarWeeks,
          last_synced_at: syncedAt,
        })
        .select(
          'id, user_id, github_username, display_name, avatar_url, total_commits, spent_commits, contribution_calendar, plot_index, last_synced_at, created_at',
        )
        .single<ExistingTreeRow>()

      if (insertErr || !inserted) {
        console.error(
          '[sync] Failed to create developer tree record:',
          insertErr?.code,
          insertErr?.message,
        )
        return jsonResponse(
          {
            error: 'Failed to create developer tree record.',
            code: insertErr?.code ?? 'DB_INSERT_ERROR',
          },
          500,
          corsHeaders,
        )
      }
      persistedTree = inserted
    }

    return jsonResponse(
      {
        treeId: persistedTree.id,
        userId: user.id,
        plotIndex: persistedTree.plot_index,
        spentCommits: persistedTree.spent_commits,
        cooldownActive: false,
        profile: {
          id: user.id,
          github_username: persistedTree.github_username,
          github_name: persistedTree.display_name,
          avatar_url: persistedTree.avatar_url,
          created_at: persistedTree.created_at,
        },
        treeLevel,
        contributionCount: totalContributions,
        stats: {
          periodYear: year,
          totalContributions,
          commits: collection.totalCommitContributions,
          pullRequests: collection.totalPullRequestContributions,
          issues: collection.totalIssueContributions,
          restrictedContributions: collection.restrictedContributionsCount,
          calendarWeeks,
        },
        syncedAt,
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return jsonResponse({ error: message }, 500, corsHeaders)
  }
})
