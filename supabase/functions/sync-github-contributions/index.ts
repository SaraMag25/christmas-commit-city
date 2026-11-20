import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authHeader = req.headers.get('Authorization')

    if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
      return jsonResponse({ error: 'Missing Supabase authorization context.' }, 401)
    }

    // Validate caller's Supabase Auth JWT without exposing privileged keys to the client
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ error: 'Invalid or expired Supabase session.' }, 401)
    }

    const payload = (await req.json().catch(() => ({}))) as {
      providerToken?: string
      year?: number
    }

    const githubLogin =
      (user.user_metadata?.user_name as string | undefined) ||
      (user.user_metadata?.preferred_username as string | undefined)

    if (!githubLogin) {
      return jsonResponse(
        { error: 'GitHub username was not found in authenticated user metadata.' },
        400,
      )
    }

    // Prefer user's OAuth read-only token; fallback to server-side secret if session refreshed
    const githubToken =
      payload.providerToken?.trim() || Deno.env.get('GITHUB_READONLY_TOKEN')?.trim() || ''

    if (!githubToken) {
      return jsonResponse(
        {
          error:
            'Missing GitHub access token. Re-authenticate with GitHub or configure GITHUB_READONLY_TOKEN in Supabase Edge Function secrets.',
        },
        400,
      )
    }

    const year = Number(payload.year || new Date().getUTCFullYear())
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
      return jsonResponse(
        { error: `GitHub GraphQL returned ${ghRes.status}: ${errorText}` },
        502,
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
      )
    }

    const ghUser = ghJson.data.user
    const collection = ghUser.contributionsCollection
    const totalContributions = collection.contributionCalendar.totalContributions
    const treeLevel = resolveTreeLevel(totalContributions)
    const syncedAt = new Date().toISOString()

    return jsonResponse({
      userId: user.id,
      profile: {
        id: user.id,
        github_username: ghUser.login,
        github_name: ghUser.name || ghUser.login,
        avatar_url: ghUser.avatarUrl,
        created_at: user.created_at ?? syncedAt,
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
        calendarWeeks: collection.contributionCalendar.weeks,
      },
      syncedAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return jsonResponse({ error: message }, 500)
  }
})
