import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  COMPANION_ACCESSORIES_CATALOG,
  COMPANION_SPECIES_CATALOG,
  computeAvailableCommits,
  createEmptyCompanionLoadout,
  DEFAULT_EMPTY_LOADOUT,
  EMPTY_EQUIPPED_ACCESSORIES,
  getAccessoryById,
  getSpeciesById,
  sanitizeCompanionName,
} from '../config/companions'
import { normalizeTreeGiftSummary } from '../config/gifts'
import { SUPPORTER_BUNDLE } from '../config/supportCampaign'
import { MOCK_CITY_TREES } from '../data/mockCityData'
import { gameEventBus } from '../game/eventBus'
import { allocateTreePosition } from '../game/layout/treePlacement'
import {
  cacheGitHubProviderToken,
  cleanEmptyOAuthHashFromUrl,
  clearCachedGitHubProviderToken,
  extractSessionGitHubUser,
  signInWithGitHubReadOnly,
  signOutFromCity,
  syncAuthenticatedGitHubTree,
} from '../services/githubSyncService'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'
import {
  buildDecorativeForestTrees,
  fetchOwnerPrivateState,
  fetchPublicCityTrees,
  formatBackendActionError,
  resolveTreePositionFromPlotIndex,
  rpcEquipCompanionLoadout,
  rpcSendFreeGift,
  rpcUnlockItemWithCommits,
} from '../services/supabaseCityService'
import type { CityTree, GiftItem, TreeGiftSummary } from '../types/city'
import type {
  AccessorySlot,
  CompanionAccessoryId,
  CompanionSpeciesId,
  CompanionTransactionRecord,
  SupportCurrency,
  TreeCompanionState,
  UnlockPaymentMethod,
  UserCompanionLoadout,
} from '../types/companion'
import {
  CityContext,
  type CompanionActionResult,
  type TreeGiftActionResult,
} from './cityContextStore'

const COMPANION_STORAGE_KEY = 'ccc_companion_loadouts_v2'
const GIFT_STORAGE_KEY = 'ccc_tree_gifts_v1'

function readStoredGifts(): Record<string, TreeGiftSummary[]> {
  try {
    const raw = window.localStorage.getItem(GIFT_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, TreeGiftSummary[]>
    if (!parsed || typeof parsed !== 'object') return {}
    const cleaned: Record<string, TreeGiftSummary[]> = {}
    for (const [key, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) {
        cleaned[key.toLowerCase()] = list
          .filter(
            (item) =>
              item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.gift_slug === 'string',
          )
          .map(normalizeTreeGiftSummary)
      }
    }
    return cleaned
  } catch {
    return {}
  }
}

function persistStoredGifts(map: Record<string, TreeGiftSummary[]>): void {
  try {
    window.localStorage.setItem(GIFT_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage quota or private browsing errors gracefully.
  }
}

function mergeTreeGifts(
  baseGifts: readonly TreeGiftSummary[],
  storedGifts: readonly TreeGiftSummary[] | undefined,
): TreeGiftSummary[] {
  if (!storedGifts || storedGifts.length === 0) return [...baseGifts]
  const existingIds = new Set(baseGifts.map((g) => g.id))
  const extra = storedGifts.filter((g) => !existingIds.has(g.id))
  return [...baseGifts, ...extra]
}

function buildSeededLoadoutFromTree(tree: CityTree): UserCompanionLoadout | null {
  if (!tree.companion?.species) return null
  const species = getSpeciesById(tree.companion.species)
  if (!species) return null

  const equipped = {
    head: tree.companion.equipped.head,
    body: tree.companion.equipped.body,
    hand: tree.companion.equipped.hand,
  }
  const unlockedAccessories: CompanionAccessoryId[] = [
    equipped.head,
    equipped.body,
    equipped.hand,
  ].filter((id): id is CompanionAccessoryId => Boolean(id))

  let runningSpent = 0
  const pixIds: string[] = []
  const transactions: CompanionTransactionRecord[] = []

  if (tree.contribution_count >= species.priceCommits) {
    runningSpent += species.priceCommits
    transactions.push({
      id: `seed-sp-${tree.id}`,
      itemType: 'species',
      itemId: species.id,
      provider: 'commits',
      currency: 'COMMITS',
      amount: species.priceCommits,
      status: 'paid',
      externalReference: `SEED-${tree.profile.github_username}`,
      createdAt: tree.last_synced_at,
    })
  } else {
    pixIds.push(`species:${species.id}`)
    transactions.push({
      id: `seed-sp-pix-${tree.id}`,
      itemType: 'species',
      itemId: species.id,
      provider: 'pix',
      currency: 'BRL',
      amount: species.priceBrl,
      status: 'paid',
      externalReference: `SEED-PIX-${tree.profile.github_username}`,
      createdAt: tree.last_synced_at,
    })
  }

  for (const accId of unlockedAccessories) {
    const item = getAccessoryById(accId)
    if (!item) continue
    if (runningSpent + item.priceCommits <= tree.contribution_count) {
      runningSpent += item.priceCommits
      transactions.push({
        id: `seed-acc-${tree.id}-${accId}`,
        itemType: 'accessory',
        itemId: item.id,
        provider: 'commits',
        currency: 'COMMITS',
        amount: item.priceCommits,
        status: 'paid',
        externalReference: `SEED-${tree.profile.github_username}`,
        createdAt: tree.last_synced_at,
      })
    } else {
      pixIds.push(`accessory:${item.id}`)
      transactions.push({
        id: `seed-acc-pix-${tree.id}-${accId}`,
        itemType: 'accessory',
        itemId: item.id,
        provider: 'pix',
        currency: 'BRL',
        amount: item.priceBrl,
        status: 'paid',
        externalReference: `SEED-PIX-${tree.profile.github_username}`,
        createdAt: tree.last_synced_at,
      })
    }
  }

  return {
    species: species.id,
    customName: sanitizeCompanionName(tree.companion.customName),
    equipped,
    unlockedSpecies: [species.id],
    unlockedAccessories,
    spentCommits: runningSpent,
    supporterBundleUnlocked: false,
    unlockedViaPixIds: pixIds,
    transactions,
    updatedAt: tree.last_synced_at,
  }
}

function migrateStoredSpeciesId(raw: string | null | undefined): CompanionSpeciesId | null {
  if (!raw) return null
  const normalized = raw === 'duckling' ? 'snake' : raw
  return getSpeciesById(normalized as CompanionSpeciesId)?.id ?? null
}

function normalizeStoredLoadout(raw: UserCompanionLoadout): UserCompanionLoadout {
  const species = migrateStoredSpeciesId(raw.species as string | null)
  const unlockedSpecies = Array.from(
    new Set(
      (raw.unlockedSpecies ?? [])
        .map((id) => migrateStoredSpeciesId(id as string))
        .filter((id): id is CompanionSpeciesId => Boolean(id)),
    ),
  )
  const unlockedAccessories = Array.from(
    new Set(
      (raw.unlockedAccessories ?? []).filter((id) => Boolean(getAccessoryById(id))),
    ),
  )
  const unlockedViaPixIds = Array.from(
    new Set(
      (raw.unlockedViaPixIds ?? []).map((entry) =>
        entry === 'species:duckling' ? 'species:snake' : entry,
      ),
    ),
  )
  const transactions = (raw.transactions ?? []).map((tx) =>
    tx.itemType === 'species' && tx.itemId === 'duckling' ? { ...tx, itemId: 'snake' } : tx,
  )

  return {
    ...raw,
    species,
    customName: sanitizeCompanionName(raw.customName),
    equipped: {
      head: raw.equipped?.head && getAccessoryById(raw.equipped.head) ? raw.equipped.head : null,
      body: raw.equipped?.body && getAccessoryById(raw.equipped.body) ? raw.equipped.body : null,
      hand: raw.equipped?.hand && getAccessoryById(raw.equipped.hand) ? raw.equipped.hand : null,
    },
    unlockedSpecies,
    unlockedAccessories,
    unlockedViaPixIds,
    transactions,
  }
}

function readStoredLoadouts(): Record<string, UserCompanionLoadout> {
  try {
    const raw = window.localStorage.getItem(COMPANION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, UserCompanionLoadout>
    if (!parsed || typeof parsed !== 'object') return {}
    const migrated: Record<string, UserCompanionLoadout> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === 'object') {
        migrated[key] = normalizeStoredLoadout(value)
      }
    }
    return migrated
  } catch {
    return {}
  }
}

function persistLoadouts(map: Record<string, UserCompanionLoadout>): void {
  try {
    window.localStorage.setItem(COMPANION_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage quota or private browsing errors gracefully.
  }
}

function buildInitialMockLoadouts(): Record<string, UserCompanionLoadout> {
  if (isSupabaseConfigured) return {}
  const initial: Record<string, UserCompanionLoadout> = {}
  for (const tree of MOCK_CITY_TREES) {
    const seeded = buildSeededLoadoutFromTree(tree)
    if (seeded) {
      initial[tree.profile.github_username.toLowerCase()] = seeded
    }
  }
  const stored = readStoredLoadouts()
  return { ...initial, ...stored }
}

function toTreeCompanionState(loadout: UserCompanionLoadout | undefined): TreeCompanionState | undefined {
  if (!loadout?.species) return undefined
  return {
    species: loadout.species,
    customName: sanitizeCompanionName(loadout.customName),
    equipped: { ...loadout.equipped },
  }
}

function upsertUserTree(baseTrees: readonly CityTree[], syncedTree: CityTree): CityTree[] {
  const usernameLower = syncedTree.profile.github_username.toLowerCase()
  const existingIndex = baseTrees.findIndex(
    (t) => t.profile.github_username.toLowerCase() === usernameLower,
  )

  if (existingIndex >= 0) {
    const existing = baseTrees[existingIndex]
    const updated: CityTree = {
      ...existing,
      id: syncedTree.id || existing.id,
      user_id: syncedTree.user_id,
      profile: syncedTree.profile,
      contribution_count: syncedTree.contribution_count,
      tree_level: syncedTree.tree_level,
      tree_position: syncedTree.tree_position ?? existing.tree_position,
      plotIndex: syncedTree.plotIndex ?? existing.plotIndex,
      companion: syncedTree.companion ?? existing.companion,
      stats: syncedTree.stats,
      last_synced_at: syncedTree.last_synced_at,
    }
    return baseTrees.map((t, i) => (i === existingIndex ? updated : t))
  }

  return [...baseTrees, syncedTree]
}

const PAID_CHECKOUT_PHASE7_MSG =
  'Checkout automático (Pix BRL / Stripe USD) em ativação na Fase 7 — a prévia 3D continua disponível e desbloqueios por commits já funcionam no servidor.'

export function CityProvider({ children }: { children: ReactNode }) {
  const [loadoutsByUsername, setLoadoutsByUsername] = useState<Record<string, UserCompanionLoadout>>(
    () => buildInitialMockLoadouts(),
  )
  const loadoutsRef = useRef(loadoutsByUsername)

  const [storedGiftsByUsername, setStoredGiftsByUsername] = useState<
    Record<string, TreeGiftSummary[]>
  >(() => (isSupabaseConfigured ? {} : readStoredGifts()))
  const storedGiftsRef = useRef(storedGiftsByUsername)

  const [trees, setTrees] = useState<readonly CityTree[]>(() => {
    if (isSupabaseConfigured) return []
    return MOCK_CITY_TREES.map((tree) => {
      const key = tree.profile.github_username.toLowerCase()
      const override = loadoutsByUsername[key]
      const extraGifts = storedGiftsByUsername[key]
      if (!override && (!extraGifts || extraGifts.length === 0)) return tree
      return {
        ...tree,
        companion: override ? toTreeCompanionState(override) : tree.companion,
        gifts: mergeTreeGifts(tree.gifts, extraGifts),
      }
    })
  })
  const treesRef = useRef(trees)
  useEffect(() => {
    treesRef.current = trees
  }, [trees])

  const [isLoadingTrees, setIsLoadingTrees] = useState<boolean>(isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [authenticatedUsername, setAuthenticatedUsername] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const syncedSessionUserRef = useRef<string | null>(null)
  const ownerGiftsRef = useRef<TreeGiftSummary[] | null>(null)

  const decorativeTrees = useMemo<readonly CityTree[]>(() => {
    if (!isSupabaseConfigured) return []
    if (trees.length >= 120) return []
    return buildDecorativeForestTrees(
      trees.map((t) => t.tree_position),
      150,
    )
  }, [trees])

  const emitForestUpdate = useCallback(
    (nextRealTrees: readonly CityTree[]) => {
      const nextDeco =
        isSupabaseConfigured && nextRealTrees.length < 120
          ? buildDecorativeForestTrees(
              nextRealTrees.map((t) => t.tree_position),
              150,
            )
          : []
      gameEventBus.emit('city:trees-updated', [...nextRealTrees, ...nextDeco])
    },
    [],
  )

  const refreshSupabaseTreesAndOwner = useCallback(
    async (activeUserId?: string, focusUsername?: string) => {
      if (!isSupabaseConfigured) return
      const publicTrees = await fetchPublicCityTrees()

      let mergedTrees = publicTrees
      if (activeUserId) {
        const ownerState = await fetchOwnerPrivateState(activeUserId)
        ownerGiftsRef.current = ownerState.ownerGifts

        if (ownerState.treeRow) {
          const ownerTreeId = ownerState.treeRow.id
          const matchedTree = publicTrees.find((t) => t.id === ownerTreeId)
          if (matchedTree && ownerState.loadout) {
            const key = matchedTree.profile.github_username.toLowerCase()
            const nextLoadouts = {
              ...loadoutsRef.current,
              [key]: ownerState.loadout,
            }
            loadoutsRef.current = nextLoadouts
            setLoadoutsByUsername(nextLoadouts)
          }

          mergedTrees = publicTrees.map((t) => {
            if (t.id !== ownerTreeId) return t
            return {
              ...t,
              gifts: ownerState.ownerGifts ?? t.gifts,
            }
          })
        }
      }

      setTrees(mergedTrees)
      emitForestUpdate(mergedTrees)

      if (focusUsername) {
        gameEventBus.emit('city:focus-tree', focusUsername)
      }
    },
    [emitForestUpdate],
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    fetchPublicCityTrees()
      .then((loaded) => {
        if (!active || syncedSessionUserRef.current) return
        setTrees(loaded)
        emitForestUpdate(loaded)
      })
      .catch((err) => {
        if (!active) return
        setAuthError(
          err instanceof Error ? err.message : 'Erro ao carregar árvores da comunidade.',
        )
      })
      .finally(() => {
        if (active) setIsLoadingTrees(false)
      })

    return () => {
      active = false
    }
  }, [emitForestUpdate])

  const applyOfflineLoadoutUpdate = useCallback(
    (username: string, nextLoadout: UserCompanionLoadout) => {
      const key = username.trim().toLowerCase()
      const nextMap = {
        ...loadoutsRef.current,
        [key]: {
          ...nextLoadout,
          updatedAt: new Date().toISOString(),
        },
      }
      loadoutsRef.current = nextMap
      setLoadoutsByUsername(nextMap)
      persistLoadouts(nextMap)

      const nextCompanion = toTreeCompanionState(nextLoadout)
      setTrees((prevTrees) => {
        const nextTrees = prevTrees.map((t) =>
          t.profile.github_username.toLowerCase() === key
            ? { ...t, companion: nextCompanion }
            : t,
        )
        gameEventBus.emit('city:trees-updated', nextTrees)
        return nextTrees
      })
    },
    [],
  )

  const getCompanionLoadout = useCallback(
    (username: string): UserCompanionLoadout => {
      const key = username.trim().toLowerCase()
      return loadoutsByUsername[key] ?? DEFAULT_EMPTY_LOADOUT
    },
    [loadoutsByUsername],
  )

  const getAvailableCommits = useCallback(
    (username: string, totalCommits: number): number => {
      const loadout = getCompanionLoadout(username)
      return computeAvailableCommits(totalCommits, loadout.spentCommits)
    },
    [getCompanionLoadout],
  )

  const unlockAndSelectSpecies = useCallback(
    async (
      username: string,
      speciesId: CompanionSpeciesId,
      method: UnlockPaymentMethod,
      currency: SupportCurrency = method === 'international' ? 'USD' : 'BRL',
    ): Promise<CompanionActionResult> => {
      const species = getSpeciesById(speciesId)
      if (!species) return { ok: false, error: 'Espécie não encontrada.' }

      const key = username.trim().toLowerCase()
      const targetTree = treesRef.current.find(
        (t) => t.profile.github_username.toLowerCase() === key,
      )
      if (!targetTree) return { ok: false, error: 'Árvore não encontrada.' }

      const current = loadoutsRef.current[key] ?? createEmptyCompanionLoadout()

      // Production Supabase mode: strict server RPCs, zero fake paid unlocks
      if (isSupabaseConfigured) {
        if (!session?.user?.id || authenticatedUsername?.toLowerCase() !== key) {
          return { ok: false, error: 'Conecte sua conta GitHub para personalizar seu companheiro.' }
        }

        const alreadyOwned =
          current.unlockedSpecies.includes(speciesId) || current.supporterBundleUnlocked

        if (!alreadyOwned && method !== 'commits') {
          return {
            ok: false,
            paymentPendingPhase7: true,
            error: PAID_CHECKOUT_PHASE7_MSG,
          }
        }

        try {
          if (alreadyOwned) {
            await rpcEquipCompanionLoadout({
              companionId: speciesId,
              headId: current.equipped.head,
              bodyId: current.equipped.body,
              handId: current.equipped.hand,
              customName: current.customName,
            })
          } else {
            await rpcUnlockItemWithCommits(speciesId)
          }
          await refreshSupabaseTreesAndOwner(session.user.id)
          return { ok: true }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao desbloquear espécie.'
          return { ok: false, error: formatBackendActionError(msg, 'pt-BR') }
        }
      }

      // Offline local preview mode
      if (current.unlockedSpecies.includes(speciesId) || current.supporterBundleUnlocked) {
        applyOfflineLoadoutUpdate(username, {
          ...current,
          species: speciesId,
          unlockedSpecies: current.unlockedSpecies.includes(speciesId)
            ? current.unlockedSpecies
            : [...current.unlockedSpecies, speciesId],
        })
        return { ok: true }
      }

      if (method === 'commits') {
        const available = computeAvailableCommits(
          targetTree.contribution_count,
          current.spentCommits,
        )
        if (available < species.priceCommits) {
          return {
            ok: false,
            error: `Faltam ${species.priceCommits - available} commits.`,
          }
        }
        const tx: CompanionTransactionRecord = {
          id: `tx-${Date.now()}-${speciesId}`,
          itemType: 'species',
          itemId: speciesId,
          provider: 'commits',
          currency: 'COMMITS',
          amount: species.priceCommits,
          status: 'paid',
          externalReference: `COMMITS-${key}-${speciesId}`,
          createdAt: new Date().toISOString(),
        }
        applyOfflineLoadoutUpdate(username, {
          ...current,
          species: speciesId,
          unlockedSpecies: [...current.unlockedSpecies, speciesId],
          spentCommits: current.spentCommits + species.priceCommits,
          transactions: [...(current.transactions ?? []), tx],
        })
        return { ok: true }
      }

      const provider = currency === 'USD' ? 'international' : 'pix'
      const amount = currency === 'USD' ? species.priceUsd : species.priceBrl
      const unlockKey = `species:${speciesId}`
      const tx: CompanionTransactionRecord = {
        id: `tx-${Date.now()}-${speciesId}`,
        itemType: 'species',
        itemId: speciesId,
        provider,
        currency,
        amount,
        status: 'paid',
        externalReference: `CCC-${currency}-${key}-${speciesId}`.toUpperCase(),
        createdAt: new Date().toISOString(),
      }

      applyOfflineLoadoutUpdate(username, {
        ...current,
        species: speciesId,
        unlockedSpecies: [...current.unlockedSpecies, speciesId],
        unlockedViaPixIds: current.unlockedViaPixIds.includes(unlockKey)
          ? current.unlockedViaPixIds
          : [...current.unlockedViaPixIds, unlockKey],
        transactions: [...(current.transactions ?? []), tx],
      })
      return { ok: true }
    },
    [
      session,
      authenticatedUsername,
      refreshSupabaseTreesAndOwner,
      applyOfflineLoadoutUpdate,
    ],
  )

  const equipSpecies = useCallback(
    async (
      username: string,
      speciesId: CompanionSpeciesId | null,
    ): Promise<CompanionActionResult> => {
      const key = username.trim().toLowerCase()
      const current = loadoutsRef.current[key] ?? createEmptyCompanionLoadout()
      if (
        speciesId &&
        !current.unlockedSpecies.includes(speciesId) &&
        !current.supporterBundleUnlocked
      ) {
        return { ok: false, error: 'Espécie ainda não desbloqueada.' }
      }

      if (isSupabaseConfigured) {
        if (!session?.user?.id || authenticatedUsername?.toLowerCase() !== key) {
          return { ok: false, error: 'Conecte sua conta GitHub para alterar seu companheiro.' }
        }
        try {
          await rpcEquipCompanionLoadout({
            companionId: speciesId,
            headId: current.equipped.head,
            bodyId: current.equipped.body,
            handId: current.equipped.hand,
            customName: current.customName,
          })
          await refreshSupabaseTreesAndOwner(session.user.id)
          return { ok: true }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao equipar companheiro.'
          return { ok: false, error: formatBackendActionError(msg, 'pt-BR') }
        }
      }

      applyOfflineLoadoutUpdate(username, {
        ...current,
        species: speciesId,
      })
      return { ok: true }
    },
    [session, authenticatedUsername, refreshSupabaseTreesAndOwner, applyOfflineLoadoutUpdate],
  )

  const unlockAndEquipAccessory = useCallback(
    async (
      username: string,
      accessoryId: CompanionAccessoryId,
      method: UnlockPaymentMethod,
      currency: SupportCurrency = method === 'international' ? 'USD' : 'BRL',
    ): Promise<CompanionActionResult> => {
      const item = getAccessoryById(accessoryId)
      if (!item) return { ok: false, error: 'Acessório não encontrado.' }

      const key = username.trim().toLowerCase()
      const targetTree = treesRef.current.find(
        (t) => t.profile.github_username.toLowerCase() === key,
      )
      if (!targetTree) return { ok: false, error: 'Árvore não encontrada.' }

      const current = loadoutsRef.current[key] ?? createEmptyCompanionLoadout()
      const nextEquipped = {
        ...EMPTY_EQUIPPED_ACCESSORIES,
        ...current.equipped,
        [item.slot]: accessoryId,
      }

      if (isSupabaseConfigured) {
        if (!session?.user?.id || authenticatedUsername?.toLowerCase() !== key) {
          return { ok: false, error: 'Conecte sua conta GitHub para desbloquear acessórios.' }
        }
        const alreadyOwned =
          current.unlockedAccessories.includes(accessoryId) || current.supporterBundleUnlocked

        if (!alreadyOwned && method !== 'commits') {
          return {
            ok: false,
            paymentPendingPhase7: true,
            error: PAID_CHECKOUT_PHASE7_MSG,
          }
        }

        try {
          if (alreadyOwned) {
            await rpcEquipCompanionLoadout({
              companionId: current.species,
              headId: nextEquipped.head,
              bodyId: nextEquipped.body,
              handId: nextEquipped.hand,
              customName: current.customName,
            })
          } else {
            await rpcUnlockItemWithCommits(accessoryId)
          }
          await refreshSupabaseTreesAndOwner(session.user.id)
          return { ok: true }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao desbloquear acessório.'
          return { ok: false, error: formatBackendActionError(msg, 'pt-BR') }
        }
      }

      if (current.unlockedAccessories.includes(accessoryId) || current.supporterBundleUnlocked) {
        applyOfflineLoadoutUpdate(username, {
          ...current,
          equipped: nextEquipped,
          unlockedAccessories: current.unlockedAccessories.includes(accessoryId)
            ? current.unlockedAccessories
            : [...current.unlockedAccessories, accessoryId],
        })
        return { ok: true }
      }

      if (method === 'commits') {
        const available = computeAvailableCommits(
          targetTree.contribution_count,
          current.spentCommits,
        )
        if (available < item.priceCommits) {
          return {
            ok: false,
            error: `Faltam ${item.priceCommits - available} commits.`,
          }
        }
        const tx: CompanionTransactionRecord = {
          id: `tx-${Date.now()}-${accessoryId}`,
          itemType: 'accessory',
          itemId: accessoryId,
          provider: 'commits',
          currency: 'COMMITS',
          amount: item.priceCommits,
          status: 'paid',
          externalReference: `COMMITS-${key}-${accessoryId}`,
          createdAt: new Date().toISOString(),
        }
        applyOfflineLoadoutUpdate(username, {
          ...current,
          equipped: nextEquipped,
          unlockedAccessories: [...current.unlockedAccessories, accessoryId],
          spentCommits: current.spentCommits + item.priceCommits,
          transactions: [...(current.transactions ?? []), tx],
        })
        return { ok: true }
      }

      const provider = currency === 'USD' ? 'international' : 'pix'
      const amount = currency === 'USD' ? item.priceUsd : item.priceBrl
      const unlockKey = `accessory:${accessoryId}`
      const tx: CompanionTransactionRecord = {
        id: `tx-${Date.now()}-${accessoryId}`,
        itemType: 'accessory',
        itemId: accessoryId,
        provider,
        currency,
        amount,
        status: 'paid',
        externalReference: `CCC-${currency}-${key}-${accessoryId}`.toUpperCase(),
        createdAt: new Date().toISOString(),
      }

      applyOfflineLoadoutUpdate(username, {
        ...current,
        equipped: nextEquipped,
        unlockedAccessories: [...current.unlockedAccessories, accessoryId],
        unlockedViaPixIds: current.unlockedViaPixIds.includes(unlockKey)
          ? current.unlockedViaPixIds
          : [...current.unlockedViaPixIds, unlockKey],
        transactions: [...(current.transactions ?? []), tx],
      })
      return { ok: true }
    },
    [session, authenticatedUsername, refreshSupabaseTreesAndOwner, applyOfflineLoadoutUpdate],
  )

  const toggleEquippedAccessory = useCallback(
    async (
      username: string,
      slot: AccessorySlot,
      accessoryId: CompanionAccessoryId | null,
    ): Promise<CompanionActionResult> => {
      const key = username.trim().toLowerCase()
      const current = loadoutsRef.current[key] ?? createEmptyCompanionLoadout()
      if (
        accessoryId !== null &&
        !current.unlockedAccessories.includes(accessoryId) &&
        !current.supporterBundleUnlocked
      ) {
        return { ok: false, error: 'Acessório ainda não desbloqueado.' }
      }

      const nextSlotValue = current.equipped[slot] === accessoryId ? null : accessoryId
      const nextEquipped = {
        ...current.equipped,
        [slot]: nextSlotValue,
      }

      if (isSupabaseConfigured) {
        if (!session?.user?.id || authenticatedUsername?.toLowerCase() !== key) {
          return { ok: false, error: 'Conecte sua conta GitHub para alterar acessórios.' }
        }
        try {
          await rpcEquipCompanionLoadout({
            companionId: current.species,
            headId: nextEquipped.head,
            bodyId: nextEquipped.body,
            handId: nextEquipped.hand,
            customName: current.customName,
          })
          await refreshSupabaseTreesAndOwner(session.user.id)
          return { ok: true }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao atualizar acessório.'
          return { ok: false, error: formatBackendActionError(msg, 'pt-BR') }
        }
      }

      applyOfflineLoadoutUpdate(username, {
        ...current,
        equipped: nextEquipped,
      })
      return { ok: true }
    },
    [session, authenticatedUsername, refreshSupabaseTreesAndOwner, applyOfflineLoadoutUpdate],
  )

  const unlockSupporterBundle = useCallback(
    async (username: string, currency: SupportCurrency): Promise<CompanionActionResult> => {
      if (isSupabaseConfigured) {
        return {
          ok: false,
          paymentPendingPhase7: true,
          error: PAID_CHECKOUT_PHASE7_MSG,
        }
      }

      const key = username.trim().toLowerCase()
      const targetTree = treesRef.current.find(
        (t) => t.profile.github_username.toLowerCase() === key,
      )
      if (!targetTree) return { ok: false, error: 'Árvore não encontrada.' }

      const current = loadoutsRef.current[key] ?? createEmptyCompanionLoadout()
      const allSpecies = COMPANION_SPECIES_CATALOG.map((s) => s.id)
      const allAccessories = COMPANION_ACCESSORIES_CATALOG.map((a) => a.id)
      const provider = currency === 'USD' ? 'international' : 'pix'
      const amount = currency === 'USD' ? SUPPORTER_BUNDLE.priceUsd : SUPPORTER_BUNDLE.priceBrl
      const bundleKey = `bundle:${SUPPORTER_BUNDLE.id}`

      const tx: CompanionTransactionRecord = {
        id: `tx-bundle-${Date.now()}`,
        itemType: 'supporter_bundle',
        itemId: SUPPORTER_BUNDLE.id,
        provider,
        currency,
        amount,
        status: 'paid',
        externalReference: `CCC-${currency}-${key}-SUPPORTER`.toUpperCase(),
        createdAt: new Date().toISOString(),
      }

      applyOfflineLoadoutUpdate(username, {
        ...current,
        species: current.species ?? 'cat',
        unlockedSpecies: allSpecies,
        unlockedAccessories: allAccessories,
        supporterBundleUnlocked: true,
        unlockedViaPixIds: current.unlockedViaPixIds.includes(bundleKey)
          ? current.unlockedViaPixIds
          : [...current.unlockedViaPixIds, bundleKey],
        transactions: [...(current.transactions ?? []), tx],
      })
      return { ok: true }
    },
    [applyOfflineLoadoutUpdate],
  )

  const renameCompanion = useCallback(
    async (username: string, rawName: string): Promise<CompanionActionResult> => {
      const key = username.trim().toLowerCase()
      const current = loadoutsRef.current[key] ?? createEmptyCompanionLoadout()
      const sanitized = sanitizeCompanionName(rawName)

      if (isSupabaseConfigured) {
        if (!session?.user?.id || authenticatedUsername?.toLowerCase() !== key) {
          return { ok: false, error: 'Conecte sua conta GitHub para renomear seu companheiro.' }
        }
        try {
          await rpcEquipCompanionLoadout({
            companionId: current.species,
            headId: current.equipped.head,
            bodyId: current.equipped.body,
            handId: current.equipped.hand,
            customName: sanitized,
          })
          await refreshSupabaseTreesAndOwner(session.user.id)
          return { ok: true }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao salvar nome.'
          return { ok: false, error: formatBackendActionError(msg, 'pt-BR') }
        }
      }

      applyOfflineLoadoutUpdate(username, {
        ...current,
        customName: sanitized,
      })
      return { ok: true }
    },
    [session, authenticatedUsername, refreshSupabaseTreesAndOwner, applyOfflineLoadoutUpdate],
  )

  const sendGiftToTree = useCallback(
    async (
      targetUsername: string,
      gift: GiftItem,
      senderName?: string,
    ): Promise<TreeGiftActionResult> => {
      const key = targetUsername.trim().toLowerCase()
      if (!key) return { ok: false, error: 'Destinatário inválido.' }

      if (isSupabaseConfigured) {
        if (gift.category !== 'free') {
          return {
            ok: false,
            paymentPendingPhase7: true,
            error: PAID_CHECKOUT_PHASE7_MSG,
          }
        }
        if (!session?.user?.id) {
          return {
            ok: false,
            error: 'Conecte sua conta GitHub primeiro para enviar presentes gratuitos.',
          }
        }
        const targetTree = treesRef.current.find(
          (t) => t.profile.github_username.toLowerCase() === key && !t.isDecorative,
        )
        if (!targetTree) {
          return { ok: false, error: 'Árvore não encontrada no Polo Norte.' }
        }

        try {
          const res = await rpcSendFreeGift(targetTree.id, gift.id)
          const confirmedGift: TreeGiftSummary = {
            id: res.id,
            gift_id: gift.id,
            gift_slug: gift.slug,
            gift_name: gift.name,
            category: gift.category,
            rarity: gift.rarity,
            sender_name: authenticatedUsername ? `@${authenticatedUsername}` : '',
            created_at: res.created_at,
          }
          await refreshSupabaseTreesAndOwner(session.user.id)
          return { ok: true, gift: confirmedGift }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro ao enviar presente.'
          return { ok: false, error: formatBackendActionError(msg, 'pt-BR') }
        }
      }

      const resolvedSender =
        senderName?.trim() ||
        (authenticatedUsername ? `@${authenticatedUsername}` : 'Visitante do Polo Norte')

      const newGift: TreeGiftSummary = {
        id: `gift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        gift_id: gift.id,
        gift_slug: gift.slug,
        gift_name: gift.name,
        category: gift.category,
        rarity: gift.rarity,
        sender_name: resolvedSender,
        created_at: new Date().toISOString(),
      }

      const prevStored = storedGiftsRef.current[key] ?? []
      const nextStoredMap: Record<string, TreeGiftSummary[]> = {
        ...storedGiftsRef.current,
        [key]: [...prevStored, newGift],
      }
      storedGiftsRef.current = nextStoredMap
      setStoredGiftsByUsername(nextStoredMap)
      persistStoredGifts(nextStoredMap)

      let created: TreeGiftSummary | null = null
      setTrees((prevTrees) => {
        const nextTrees = prevTrees.map((t) => {
          if (t.profile.github_username.toLowerCase() !== key) return t
          created = newGift
          return {
            ...t,
            gifts: [...t.gifts, newGift],
          }
        })
        gameEventBus.emit('city:trees-updated', nextTrees)
        return nextTrees
      })

      return { ok: true, gift: created ?? newGift }
    },
    [session, authenticatedUsername, refreshSupabaseTreesAndOwner],
  )

  const syncFromSession = useCallback(
    async (activeSession: Session, focusOnComplete = false) => {
      setIsSyncing(true)
      setAuthError(null)
      try {
        const result = await syncAuthenticatedGitHubTree(activeSession)
        const username = result.profile.github_username

        if (isSupabaseConfigured) {
          await refreshSupabaseTreesAndOwner(
            activeSession.user.id,
            focusOnComplete ? username : undefined,
          )
          setAuthenticatedUsername(username)
          return
        }

        const savedLoadout = loadoutsRef.current[username.toLowerCase()]
        setTrees((prevTrees) => {
          const existing = prevTrees.find(
            (t) => t.profile.github_username.toLowerCase() === username.toLowerCase(),
          )
          const occupiedPositions = prevTrees
            .filter((t) => t.id !== existing?.id)
            .map((t) => t.tree_position)
          const position =
            existing?.tree_position ??
            (typeof result.plotIndex === 'number'
              ? resolveTreePositionFromPlotIndex(result.plotIndex, occupiedPositions, username)
              : allocateTreePosition(occupiedPositions, username))

          const key = username.toLowerCase()
          const syncedTree: CityTree = {
            id: result.treeId ?? existing?.id ?? `gh-${result.userId}`,
            user_id: result.userId,
            profile: result.profile,
            contribution_count: result.contributionCount,
            tree_level: result.treeLevel,
            tree_position: position,
            plotIndex: result.plotIndex ?? existing?.plotIndex,
            gifts: mergeTreeGifts(existing?.gifts ?? [], storedGiftsRef.current[key]),
            companion: toTreeCompanionState(savedLoadout) ?? existing?.companion,
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
        if (focusOnComplete) {
          gameEventBus.emit('city:focus-tree', username)
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Não foi possível sincronizar suas contribuições no GitHub.'
        setAuthError(message)
      } finally {
        setIsSyncing(false)
      }
    },
    [refreshSupabaseTreesAndOwner],
  )

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return

    let active = true
    const shouldFocusOnHome = () =>
      window.location.pathname === '/' && !new URLSearchParams(window.location.search).has('focus')

    const applyAuthenticatedSession = (nextSession: Session, focusOnComplete: boolean) => {
      cleanEmptyOAuthHashFromUrl()
      if (nextSession.provider_token) {
        cacheGitHubProviderToken(nextSession.provider_token)
      }
      const ghUser = extractSessionGitHubUser(nextSession)
      if (ghUser?.username) {
        setAuthenticatedUsername((prev) => prev ?? ghUser.username)
      }
      if (syncedSessionUserRef.current !== nextSession.user.id) {
        syncedSessionUserRef.current = nextSession.user.id
        void syncFromSession(nextSession, focusOnComplete)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      cleanEmptyOAuthHashFromUrl()
      const current = data.session
      setSession(current)
      if (current) {
        applyAuthenticatedSession(current, shouldFocusOnHome())
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      cleanEmptyOAuthHashFromUrl()
      setSession(nextSession)
      if (!nextSession) {
        clearCachedGitHubProviderToken()
        syncedSessionUserRef.current = null
        ownerGiftsRef.current = null
        setAuthenticatedUsername(null)
        setIsConnecting(false)
        void refreshSupabaseTreesAndOwner()
        return
      }
      const shouldFocusEvent =
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && shouldFocusOnHome()
      applyAuthenticatedSession(nextSession, shouldFocusEvent)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [syncFromSession, refreshSupabaseTreesAndOwner])

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
    const latestSession = supabase
      ? ((await supabase.auth.getSession()).data.session ?? session)
      : session
    if (!latestSession) return
    setSession(latestSession)
    await syncFromSession(latestSession, true)
  }, [session, syncFromSession])

  const refreshCityState = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const latestSession = supabase
      ? ((await supabase.auth.getSession()).data.session ?? session)
      : session
    await refreshSupabaseTreesAndOwner(latestSession?.user?.id)
  }, [session, refreshSupabaseTreesAndOwner])

  const signOut = useCallback(async () => {
    await signOutFromCity()
    setSession(null)
    setAuthenticatedUsername(null)
    setAuthError(null)
    setIsConnecting(false)
    syncedSessionUserRef.current = null
    ownerGiftsRef.current = null
    if (isSupabaseConfigured) {
      loadoutsRef.current = {}
      setLoadoutsByUsername({})
      await refreshSupabaseTreesAndOwner()
    }
  }, [refreshSupabaseTreesAndOwner])

  const currentUserTree = useMemo(() => {
    if (!authenticatedUsername) return null
    const lower = authenticatedUsername.toLowerCase()
    return trees.find((t) => t.profile.github_username.toLowerCase() === lower) ?? null
  }, [trees, authenticatedUsername])

  return (
    <CityContext.Provider
      value={{
        trees,
        decorativeTrees,
        session,
        currentUserTree,
        isSupabaseReady: isSupabaseConfigured,
        isLoadingTrees,
        isConnecting,
        isSyncing,
        authError,
        connectWithGitHub,
        resyncMyTree,
        refreshCityState,
        signOut,
        clearAuthError: () => setAuthError(null),
        getCompanionLoadout,
        getAvailableCommits,
        unlockAndSelectSpecies,
        equipSpecies,
        unlockAndEquipAccessory,
        toggleEquippedAccessory,
        unlockSupporterBundle,
        renameCompanion,
        sendGiftToTree,
      }}
    >
      {children}
    </CityContext.Provider>
  )
}
