import type { Session } from '@supabase/supabase-js'
import { getStandardContributionWindow } from '../config/githubPeriod'
import { resolveTreeStage } from '../config/treeLevels'
import type { GitHubContributionStats, ProfileSummary, TreeLevelId } from '../types/city'
import { isSupabaseConfigured, supabase } from './supabaseClient'

export interface GitHubSyncResult {
  userId: string
  profile: ProfileSummary
  treeLevel: TreeLevelId
  contributionCount: number
  stats: GitHubContributionStats
  syncedAt: string
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

  const { year } = getStandardContributionWindow()
  const { data, error } = await supabase.functions.invoke<GitHubSyncResult>(
    'sync-github-contributions',
    {
      body: {
        providerToken: session.provider_token ?? undefined,
        year,
      },
    },
  )

  if (error) {
    throw new Error(error.message || 'Falha ao sincronizar contribuições do GitHub.')
  }
  if (!data || !data.profile) {
    throw new Error('Resposta inválida da função de sincronização do GitHub.')
  }

  const resolvedStage = resolveTreeStage(data.contributionCount)
  return {
    ...data,
    treeLevel: resolvedStage.level,
  }
}
