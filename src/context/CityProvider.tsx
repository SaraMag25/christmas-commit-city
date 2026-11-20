import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { computeCommunityStats, MOCK_CITY_TREES } from '../data/mockCityData'
import { gameEventBus } from '../game/eventBus'
import { allocateTreePosition } from '../game/layout/treePlacement'
import {
  signInWithGitHubReadOnly,
  signOutFromCity,
  syncAuthenticatedGitHubTree,
} from '../services/githubSyncService'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'
import type { CityTree } from '../types/city'
import { CityContext } from './cityContextStore'

function upsertUserTree(baseTrees: readonly CityTree[], syncedTree: CityTree): CityTree[] {
  const usernameLower = syncedTree.profile.github_username.toLowerCase()
  const existingIndex = baseTrees.findIndex(
    (t) => t.profile.github_username.toLowerCase() === usernameLower,
  )

  if (existingIndex >= 0) {
    const existing = baseTrees[existingIndex]
    const updated: CityTree = {
      ...existing,
      user_id: syncedTree.user_id,
      profile: syncedTree.profile,
      contribution_count: syncedTree.contribution_count,
      tree_level: syncedTree.tree_level,
      stats: syncedTree.stats,
      last_synced_at: syncedTree.last_synced_at,
    }
    return baseTrees.map((t, i) => (i === existingIndex ? updated : t))
  }

  return [...baseTrees, syncedTree]
}

export function CityProvider({ children }: { children: ReactNode }) {
  const [trees, setTrees] = useState<readonly CityTree[]>(MOCK_CITY_TREES)
  const [session, setSession] = useState<Session | null>(null)
  const [authenticatedUsername, setAuthenticatedUsername] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const syncedSessionUserRef = useRef<string | null>(null)

  const syncFromSession = useCallback(async (activeSession: Session) => {
    setIsSyncing(true)
    setAuthError(null)
    try {
      const result = await syncAuthenticatedGitHubTree(activeSession)
      const username = result.profile.github_username

      setTrees((prevTrees) => {
        const existing = prevTrees.find(
          (t) => t.profile.github_username.toLowerCase() === username.toLowerCase(),
        )
        const position =
          existing?.tree_position ??
          allocateTreePosition(
            prevTrees.map((t) => t.tree_position),
            username,
          )

        const syncedTree: CityTree = {
          id: existing?.id ?? `gh-${result.userId}`,
          user_id: result.userId,
          profile: result.profile,
          contribution_count: result.contributionCount,
          tree_level: result.treeLevel,
          tree_position: position,
          gifts: existing?.gifts ?? [],
          stats: result.stats,
          custom_message: existing?.custom_message,
          is_creator_special: existing?.is_creator_special,
          last_synced_at: result.syncedAt,
        }

        const next = upsertUserTree(prevTrees, syncedTree)
        gameEventBus.emit('city:trees-updated', next)
        return next
      })

      setAuthenticatedUsername(username)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível sincronizar suas contribuições no GitHub.'
      setAuthError(message)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const current = data.session
      setSession(current)
      if (current && syncedSessionUserRef.current !== current.user.id) {
        syncedSessionUserRef.current = current.user.id
        void syncFromSession(current)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        syncedSessionUserRef.current = null
        setAuthenticatedUsername(null)
        return
      }
      if (syncedSessionUserRef.current !== nextSession.user.id) {
        syncedSessionUserRef.current = nextSession.user.id
        void syncFromSession(nextSession)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [syncFromSession])

  const connectWithGitHub = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      return false
    }
    setIsConnecting(true)
    setAuthError(null)
    try {
      await signInWithGitHubReadOnly()
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao iniciar autenticação com o GitHub.'
      setAuthError(message)
      setIsConnecting(false)
      return false
    }
  }, [])

  const resyncMyTree = useCallback(async () => {
    if (!session) return
    await syncFromSession(session)
  }, [session, syncFromSession])

  const signOut = useCallback(async () => {
    await signOutFromCity()
    setSession(null)
    setAuthenticatedUsername(null)
    syncedSessionUserRef.current = null
  }, [])

  const stats = useMemo(() => computeCommunityStats(trees), [trees])

  const currentUserTree = useMemo(() => {
    if (!authenticatedUsername) return null
    const lower = authenticatedUsername.toLowerCase()
    return trees.find((t) => t.profile.github_username.toLowerCase() === lower) ?? null
  }, [trees, authenticatedUsername])

  return (
    <CityContext.Provider
      value={{
        trees,
        stats,
        session,
        currentUserTree,
        isSupabaseReady: isSupabaseConfigured,
        isConnecting,
        isSyncing,
        authError,
        connectWithGitHub,
        resyncMyTree,
        signOut,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </CityContext.Provider>
  )
}
