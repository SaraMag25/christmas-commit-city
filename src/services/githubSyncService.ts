import type { Session } from '@supabase/supabase-js'
import { getStandardContributionWindow } from '../config/githubPeriod'
import { resolveTreeStage } from '../config/treeLevels'
import type {
  GitHubContributionStats,
  GitHubContributionWeek,
  ProfileSummary,
  TreeLevelId,
} from '../types/city'
import type { SupabasePublicTreeRow } from '../types/companion'
import { parseEdgeFunctionError } from './edgeFunctionError'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const PROVIDER_TOKEN_SESSION_KEY = 'ccc_gh_provider_token_v1'
export const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/

export function normalizeGitHubUsernameInput(raw: string): string | null {
  const clean = raw.trim().replace(/^@+/, '').trim()
  if (!GITHUB_USERNAME_REGEX.test(clean)) return null
  return clean
}

export interface SessionGitHubUser {
  username: string
  avatarUrl: string
}

export function extractSessionGitHubUser(session: Session | null): SessionGitHubUser | null {
  if (!session?.user) return null
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
  const githubIdentity = session.user.identities?.find((item) => item.provider === 'github')
  const identityData = (githubIdentity?.identity_data ?? {}) as Record<string, unknown>

  const username =
    (typeof identityData.user_name === 'string' && identityData.user_name.trim()) ||
    (typeof identityData.preferred_username === 'string' &&
      identityData.preferred_username.trim()) ||
    (typeof meta.user_name === 'string' && meta.user_name.trim()) ||
    (typeof meta.preferred_username === 'string' && meta.preferred_username.trim()) ||
    ''

  if (!username) return null

  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    (typeof identityData.avatar_url === 'string' && identityData.avatar_url.trim()) ||
    ''

  return { username, avatarUrl }
}

export function cacheGitHubProviderToken(token: string | null | undefined): void {
  const trimmed = token?.trim()
  if (!trimmed) return
  try {
    window.sessionStorage.setItem(PROVIDER_TOKEN_SESSION_KEY, trimmed)
  } catch {
    // Ignore storage quota or private browsing errors gracefully.
  }
}

export function getCachedGitHubProviderToken(): string | null {
  try {
    const raw = window.sessionStorage.getItem(PROVIDER_TOKEN_SESSION_KEY)?.trim()
    return raw || null
  } catch {
    return null
  }
}

export function clearCachedGitHubProviderToken(): void {
  try {
    window.sessionStorage.removeItem(PROVIDER_TOKEN_SESSION_KEY)
  } catch {
    // Ignore private browsing errors gracefully.
  }
}

/**
 * Removes the empty trailing `#` left behind in the URL bar after Supabase OAuth
 * processes hash fragment tokens without triggering a page reload.
 */
export function cleanEmptyOAuthHashFromUrl(): void {
  if (typeof window === 'undefined') return
  const { href, pathname, search, hash } = window.location
  const hasOAuthParams =
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    hash.includes('provider_token=') ||
    hash.includes('error=')
  if (hasOAuthParams) return

  if (href.endsWith('#') || hash === '#') {
    const cleanUrl = `${pathname}${search}` || '/'
    window.history.replaceState(window.history.state, '', cleanUrl)
  }
}

async function formatEdgeFunctionInvokeError(error: unknown): Promise<string> {
  const detail = await parseEdgeFunctionError(error, 'github-sync')

  if (detail.isFetchError) {
    return `Não foi possível alcançar a Edge Function sync-github-contributions (rede ou CORS bloqueado para ${window.location.origin}). Verifique ALLOWED_ORIGINS no Supabase.`
  }

  if (detail.isRelayError) {
    return detail.status
      ? `Erro do gateway Supabase ao chamar sync-github-contributions (HTTP ${detail.status}).`
      : 'Erro de comunicação com o gateway Supabase para a Edge Function.'
  }

  if (typeof detail.status === 'number') {
    const { status, code: serverCode = '', serverMessage: serverError = '' } = detail

    if (status === 404) {
      return 'Edge Function "sync-github-contributions" não publicada ou não encontrada (HTTP 404). Execute npx supabase functions deploy sync-github-contributions --no-verify-jwt.'
    }

    if (status === 401) {
      return `Sessão Supabase inválida ou expirada (HTTP 401)${serverError ? `: ${serverError}` : '.'} Clique em Sair e conecte novamente.`
    }

    if (status === 403) {
      if (serverError.toLowerCase().includes('cors')) {
        return `Bloqueio de CORS na Edge Function (HTTP 403): confira ALLOWED_ORIGINS para ${window.location.origin}.`
      }
      return `Acesso negado na Edge Function (HTTP 403)${serverError ? `: ${serverError}` : '.'}`
    }

    if (status === 400 || serverCode === 'GITHUB_TOKEN_INVALID') {
      const missingOrInvalidToken =
        serverCode === 'GITHUB_TOKEN_INVALID' ||
        serverError.toLowerCase().includes('missing github access token') ||
        serverError.toLowerCase().includes('bad credentials')
      if (missingOrInvalidToken) {
        return 'Token OAuth do GitHub ausente ou expirado nesta sessão. Clique em Sair e conecte novamente com o GitHub.'
      }
      return `Erro na requisição de sincronização (HTTP ${status})${serverError ? `: ${serverError}` : '.'}`
    }

    if (status === 502) {
      return `Erro na GraphQL API do GitHub (HTTP 502)${serverError ? `: ${serverError}` : '.'}`
    }

    if (status >= 500) {
      return `Erro interno no servidor da Edge Function (HTTP ${status})${serverError ? `: ${serverError}` : '.'}`
    }

    return serverError
      ? `${serverError} (HTTP ${status})`
      : `Falha na sincronização GitHub (HTTP ${status}).`
  }

  return detail.serverMessage || 'Falha ao sincronizar contribuições do GitHub.'
}

export interface GitHubSyncResult {
  treeId?: string
  userId: string
  plotIndex?: number
  spentCommits?: number
  cooldownActive?: boolean
  profile: ProfileSummary
  treeLevel: TreeLevelId
  contributionCount: number
  stats: GitHubContributionStats
  syncedAt: string
}

/**
 * Official 4 activity levels of the GitHub contribution graph (1 = low .. 4 = peak).
 */
export type GitHubContributionLevel = 1 | 2 | 3 | 4

export interface CalendarOrnamentEntry {
  date: string
  count: number
  weekIndex: number
  dayOfWeek: number
  level: GitHubContributionLevel
}

function classifyGitHubContributionLevel(
  count: number,
  maxDayCount: number,
): GitHubContributionLevel {
  // Level 4 (peak): 10+ commits or top ~22% peak days (>= 5) for active devs
  if (count >= 10 || (maxDayCount >= 5 && count >= Math.max(5, Math.ceil(maxDayCount * 0.78)))) {
    return 4
  }
  // Level 3 (medium-high): 5–9 commits or upper mid tier
  if (count >= 5 || (maxDayCount >= 4 && count >= Math.max(3, Math.ceil(maxDayCount * 0.48)))) {
    return 3
  }
  // Level 2 (medium-low): 2–4 commits
  if (count >= 2) {
    return 2
  }
  // Level 1 (few commits): 1 commit
  return 1
}

/**
 * Normalizes contribution stats returned by the Supabase Edge Function
 * (`sync-github-contributions`) so missing or malformed calendar arrays
 * always degrade cleanly.
 */
export function normalizeGitHubContributionStats(
  rawStats: Partial<GitHubContributionStats> | undefined,
  fallbackTotal = 0,
  fallbackYear = getStandardContributionWindow().year,
): GitHubContributionStats {
  const calendarWeeks: GitHubContributionWeek[] = Array.isArray(rawStats?.calendarWeeks)
    ? rawStats.calendarWeeks.map((week) => ({
        contributionDays: Array.isArray(week?.contributionDays)
          ? week.contributionDays.map((day) => ({
              date: String(day?.date ?? ''),
              contributionCount: Math.max(0, Math.floor(Number(day?.contributionCount ?? 0))),
              color: typeof day?.color === 'string' ? day.color : undefined,
            }))
          : [],
      }))
    : []

  const calendarSum = calendarWeeks.reduce(
    (acc, w) => acc + w.contributionDays.reduce((dAcc, d) => dAcc + d.contributionCount, 0),
    0,
  )

  const totalContributions = Math.max(
    0,
    Math.floor(Number(rawStats?.totalContributions ?? (calendarSum || fallbackTotal))),
  )

  return {
    periodYear: Number(rawStats?.periodYear ?? fallbackYear),
    totalContributions,
    commits: Math.max(0, Math.floor(Number(rawStats?.commits ?? totalContributions))),
    pullRequests: Math.max(0, Math.floor(Number(rawStats?.pullRequests ?? 0))),
    issues: Math.max(0, Math.floor(Number(rawStats?.issues ?? 0))),
    restrictedContributions: Math.max(
      0,
      Math.floor(Number(rawStats?.restrictedContributions ?? 0)),
    ),
    calendarWeeks,
  }
}

/**
 * Extracts chronological active contribution entries from either real GitHub
 * GraphQL `calendarWeeks` or the synthetic calendar generated by `mockCityData.ts`,
 * mapping each active day's volume into GitHub's 4 contribution levels (1..4).
 */
export function extractCommitOrnamentEntries(opts: {
  contributionCount: number
  calendarWeeks?: GitHubContributionWeek[]
}): CalendarOrnamentEntry[] {
  const { contributionCount, calendarWeeks } = opts
  const safeTotal = Math.max(0, Math.floor(contributionCount))
  if (safeTotal <= 0 && (!calendarWeeks || calendarWeeks.length === 0)) {
    return []
  }

  const rawActive: Array<{
    date: string
    count: number
    weekIndex: number
    dayOfWeek: number
  }> = []

  if (Array.isArray(calendarWeeks) && calendarWeeks.length > 0) {
    calendarWeeks.forEach((week, weekIndex) => {
      if (!Array.isArray(week?.contributionDays)) return
      week.contributionDays.forEach((day, dayOfWeek) => {
        const count = Math.max(0, Math.floor(Number(day?.contributionCount ?? 0)))
        if (count > 0) {
          rawActive.push({
            date: day.date || `w${weekIndex}-d${dayOfWeek}`,
            count,
            weekIndex,
            dayOfWeek,
          })
        }
      })
    })
  }

  // Fallback synthesis when only total contribution count is available
  if (rawActive.length === 0 && safeTotal > 0) {
    const slots = Math.min(90, Math.max(1, Math.round(Math.sqrt(safeTotal) * 2.5)))
    const base = Math.max(1, Math.floor(safeTotal / slots))
    let remainder = safeTotal - base * slots
    for (let i = 0; i < slots; i += 1) {
      const extra = remainder > 0 ? 1 : 0
      if (remainder > 0) remainder -= 1
      const count = base + extra
      rawActive.push({
        date: `synthetic-${i}`,
        count,
        weekIndex: Math.floor((i / slots) * 52),
        dayOfWeek: i % 7,
      })
    }
  }

  if (rawActive.length === 0) return []

  const maxDayCount = rawActive.reduce((max, entry) => Math.max(max, entry.count), 0)
  return rawActive.map((entry) => ({
    ...entry,
    level: classifyGitHubContributionLevel(entry.count, maxDayCount),
  }))
}

/**
 * Initiates read-only GitHub OAuth via Supabase Auth.
 * Requests strictly `read:user` so repository write access is never asked.
 */
export async function signInWithGitHubReadOnly(): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user',
      redirectTo: window.location.origin,
    },
  })

  if (error) {
    throw error
  }
}

export async function signOutFromCity(): Promise<void> {
  clearCachedGitHubProviderToken()
  if (!supabase) return
  await supabase.auth.signOut()
}

/**
 * Calls the Supabase Edge Function `sync-github-contributions` so the GitHub
 * GraphQL API query runs server-side with full token hygiene.
 */
export async function syncAuthenticatedGitHubTree(
  session: Session,
): Promise<GitHubSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }

  if (session.provider_token) {
    cacheGitHubProviderToken(session.provider_token)
  }
  const providerToken = session.provider_token?.trim() || getCachedGitHubProviderToken() || undefined

  const { year } = getStandardContributionWindow()
  const { data, error } = await supabase.functions.invoke<GitHubSyncResult>(
    'sync-github-contributions',
    {
      headers: session.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
      body: {
        providerToken,
        year,
      },
    },
  )

  if (error) {
    const detailedMessage = await formatEdgeFunctionInvokeError(error)
    throw new Error(detailedMessage)
  }
  if (!data || !data.profile) {
    throw new Error('Resposta inválida da função de sincronização do GitHub.')
  }

  const normalizedStats = normalizeGitHubContributionStats(
    data.stats,
    data.contributionCount,
    year,
  )
  const resolvedCount = Math.max(
    0,
    Math.floor(Number(data.contributionCount ?? normalizedStats.totalContributions)),
  )
  const resolvedStage = resolveTreeStage(resolvedCount)

  return {
    ...data,
    contributionCount: resolvedCount,
    stats: normalizedStats,
    treeLevel: resolvedStage.level,
  }
}

export interface ResolvePublicGitHubTreeResult {
  tree: SupabasePublicTreeRow
  giftCounts: Array<{ gift_id: string; gift_count: number }>
  alreadyExists: boolean
  periodYear: number
}

export async function resolvePublicGitHubTree(
  rawUsername: string,
): Promise<ResolvePublicGitHubTreeResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }

  const cleanUsername = normalizeGitHubUsernameInput(rawUsername)
  if (!cleanUsername) {
    throw new Error('Nome de usuário do GitHub inválido.')
  }

  const { year } = getStandardContributionWindow()
  const { data, error } = await supabase.functions.invoke<ResolvePublicGitHubTreeResult>(
    'resolve-github-tree',
    {
      body: {
        username: cleanUsername,
        year,
      },
    },
  )

  if (error) {
    const detail = await parseEdgeFunctionError(error, 'resolve-github-tree')

    if (detail.isFetchError) {
      throw new Error(
        `Não foi possível conectar à Edge Function resolve-github-tree para ${window.location.origin}. Confira ALLOWED_ORIGINS no Supabase.`,
      )
    }

    if (detail.status === 404 && detail.code !== 'GITHUB_USER_NOT_FOUND') {
      throw new Error(
        'Edge Function "resolve-github-tree" não encontrada (HTTP 404). Execute: npx supabase functions deploy resolve-github-tree --no-verify-jwt.',
      )
    }

    if (detail.code === 'GITHUB_USER_NOT_FOUND') {
      throw new Error(`Usuário "@${cleanUsername}" não encontrado no GitHub.`)
    }

    if (detail.code === 'MISSING_GITHUB_TOKEN' || detail.status === 503) {
      throw new Error(
        detail.serverMessage ||
          'Secret GITHUB_TOKEN não configurado no Supabase (npx supabase secrets set GITHUB_TOKEN=...).',
      )
    }

    if (detail.status === 429 || detail.code === 'RATE_LIMITED' || detail.code === 'GITHUB_RATE_LIMITED') {
      throw new Error(
        'Muitas buscas consecutivas no GitHub agora. Aguarde um minuto e tente novamente.',
      )
    }

    throw new Error(
      detail.serverMessage || `Não foi possível buscar "@${cleanUsername}" no GitHub.`,
    )
  }

  if (!data || !data.tree || typeof data.tree.github_username !== 'string') {
    throw new Error('Resposta inválida ao buscar usuário no GitHub.')
  }

  return data
}
