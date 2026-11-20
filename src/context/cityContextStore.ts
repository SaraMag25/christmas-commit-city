import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CityCommunityStats, CityTree } from '../types/city'

export interface CityContextValue {
  trees: readonly CityTree[]
  stats: CityCommunityStats
  session: Session | null
  currentUserTree: CityTree | null
  isSupabaseReady: boolean
  isConnecting: boolean
  isSyncing: boolean
  authError: string | null
  connectWithGitHub: () => Promise<boolean>
  resyncMyTree: () => Promise<void>
  signOut: () => Promise<void>
  clearAuthError: () => void
}

export const CityContext = createContext<CityContextValue | null>(null)

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext)
  if (!ctx) {
    throw new Error('useCity must be used inside <CityProvider>.')
  }
  return ctx
}
