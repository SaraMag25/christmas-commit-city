import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CityCommunityStats, CityTree, GiftItem, TreeGiftSummary } from '../types/city'
import type {
  AccessorySlot,
  CompanionAccessoryId,
  CompanionSpeciesId,
  SupportCurrency,
  UnlockPaymentMethod,
  UserCompanionLoadout,
} from '../types/companion'

export interface CompanionActionResult {
  ok: boolean
  error?: string
  paymentPendingPhase7?: boolean
}

export interface TreeGiftActionResult {
  ok: boolean
  gift?: TreeGiftSummary
  error?: string
  paymentPendingPhase7?: boolean
}

export interface CityContextValue {
  trees: readonly CityTree[]
  decorativeTrees: readonly CityTree[]
  stats: CityCommunityStats
  session: Session | null
  currentUserTree: CityTree | null
  isSupabaseReady: boolean
  isLoadingTrees: boolean
  isConnecting: boolean
  isSyncing: boolean
  authError: string | null
  connectWithGitHub: () => Promise<boolean>
  resyncMyTree: () => Promise<void>
  signOut: () => Promise<void>
  clearAuthError: () => void
  getCompanionLoadout: (username: string) => UserCompanionLoadout
  getAvailableCommits: (username: string, totalCommits: number) => number
  unlockAndSelectSpecies: (
    username: string,
    speciesId: CompanionSpeciesId,
    method: UnlockPaymentMethod,
    currency?: SupportCurrency,
  ) => Promise<CompanionActionResult>
  equipSpecies: (
    username: string,
    speciesId: CompanionSpeciesId | null,
  ) => Promise<CompanionActionResult>
  unlockAndEquipAccessory: (
    username: string,
    accessoryId: CompanionAccessoryId,
    method: UnlockPaymentMethod,
    currency?: SupportCurrency,
  ) => Promise<CompanionActionResult>
  toggleEquippedAccessory: (
    username: string,
    slot: AccessorySlot,
    accessoryId: CompanionAccessoryId | null,
  ) => Promise<CompanionActionResult>
  unlockSupporterBundle: (
    username: string,
    currency: SupportCurrency,
  ) => Promise<CompanionActionResult>
  renameCompanion: (username: string, rawName: string) => Promise<CompanionActionResult>
  sendGiftToTree: (
    targetUsername: string,
    gift: GiftItem,
    senderName?: string,
  ) => Promise<TreeGiftActionResult>
}

export const CityContext = createContext<CityContextValue | null>(null)

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext)
  if (!ctx) {
    throw new Error('useCity must be used inside <CityProvider>.')
  }
  return ctx
}
