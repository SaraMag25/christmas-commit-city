import {
  COMPANION_ACCESSORIES_CATALOG,
  COMPANION_SPECIES_CATALOG,
  EMPTY_EQUIPPED_ACCESSORIES,
  getAccessoryById,
  getSpeciesById,
  sanitizeCompanionName,
  withCreatorFullUnlock,
} from '../config/companions'
import { MIN_TREE_SPACING_GRID } from '../config/cityMapConfig'
import { GIFTS_CATALOG } from '../config/gifts'
import { CREATOR_CAMPAIGN, SUPPORTER_BUNDLE } from '../config/supportCampaign'
import { resolveTreeStage } from '../config/treeLevels'
import {
  allocateTreePosition,
  CURATED_TREE_PLOTS,
  getSpiralPlotPosition,
  selectStratifiedTreePlots,
} from '../game/layout/treePlacement'
import type {
  CityTree,
  GitHubContributionWeek,
  TreeGiftSummary,
  TreePosition,
} from '../types/city'
import type {
  BodyAccessoryId,
  CompanionAccessoryId,
  CompanionSpeciesId,
  EquipLoadoutRpcResult,
  HandAccessoryId,
  HeadAccessoryId,
  SendFreeGiftRpcResult,
  SupabasePrivateTreeGiftRow,
  SupabasePrivateTreeRow,
  SupabasePublicGiftCountRow,
  SupabasePublicTreeRow,
  SupabaseUserUnlockRow,
  TreeCompanionState,
  UnlockItemRpcResult,
  UserCompanionLoadout,
} from '../types/companion'
import { normalizeGitHubContributionStats, normalizeGitHubUsernameInput } from './githubSyncService'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const PUBLIC_TREE_LIGHT_SELECT =
  'id, github_username, display_name, avatar_url, total_commits, plot_index, active_companion_id, companion_custom_name, equipped_head_id, equipped_body_id, equipped_hand_id, last_synced_at, claimed, active_days, commit_level_counts'

const PUBLIC_TREE_FULL_SELECT = `${PUBLIC_TREE_LIGHT_SELECT}, contribution_calendar`

export const CITY_SECTOR_LIMIT = 3000
const TREE_PAGE_SIZE = 1000
const MAX_PARALLEL_TREE_PAGES = 4
const FALLBACK_SYNC_ISO = new Date().toISOString()

export function resolveTreePositionFromPlotIndex(
  plotIndex: number | null | undefined,
  occupiedPositions: readonly TreePosition[],
  username: string,
): TreePosition {
  if (typeof plotIndex === 'number' && Number.isInteger(plotIndex) && plotIndex >= 0) {
    return getSpiralPlotPosition(plotIndex)
  }
  return allocateTreePosition(occupiedPositions, username)
}

function toCompanionStateFromRow(row: {
  active_companion_id: string | null
  companion_custom_name: string | null
  equipped_head_id: string | null
  equipped_body_id: string | null
  equipped_hand_id: string | null
}): TreeCompanionState | undefined {
  const species = getSpeciesById(row.active_companion_id as CompanionSpeciesId | null)
  if (!species) return undefined

  const headAcc = getAccessoryById(row.equipped_head_id as CompanionAccessoryId | null)
  const bodyAcc = getAccessoryById(row.equipped_body_id as CompanionAccessoryId | null)
  const handAcc = getAccessoryById(row.equipped_hand_id as CompanionAccessoryId | null)

  return {
    species: species.id,
    customName: sanitizeCompanionName(row.companion_custom_name),
    equipped: {
      head: headAcc?.slot === 'head' ? (headAcc.id as HeadAccessoryId) : null,
      body: bodyAcc?.slot === 'body' ? (bodyAcc.id as BodyAccessoryId) : null,
      hand: handAcc?.slot === 'hand' ? (handAcc.id as HandAccessoryId) : null,
    },
  }
}

export function expandGiftCountsToSummaries(
  treeId: string,
  countRows: ReadonlyArray<{ gift_id: string; gift_count: number }>,
): TreeGiftSummary[] {
  const giftById = new Map(GIFTS_CATALOG.map((g) => [g.id, g]))
  const list: TreeGiftSummary[] = []

  for (const row of countRows) {
    const giftMeta = giftById.get(row.gift_id)
    if (!giftMeta) continue
    const qty = Math.max(0, Math.min(200, Math.floor(Number(row.gift_count) || 0)))
    for (let i = 0; i < qty; i += 1) {
      list.push({
        id: `pub-${treeId}-${giftMeta.id}-${i}`,
        gift_id: giftMeta.id,
        gift_slug: giftMeta.slug,
        gift_name: giftMeta.name,
        category: giftMeta.category,
        rarity: giftMeta.rarity,
        sender_name: '',
        created_at: new Date(0).toISOString(),
      })
    }
  }

  return list
}

export function mapPublicTreeRowToCityTree(
  row: SupabasePublicTreeRow,
  gifts: TreeGiftSummary[],
  occupiedPositions: readonly TreePosition[] = [],
  periodYear?: number,
): CityTree {
  const position = resolveTreePositionFromPlotIndex(
    row.plot_index,
    occupiedPositions,
    row.github_username,
  )
  const calendarWeeks = Array.isArray(row.contribution_calendar)
    ? (row.contribution_calendar as GitHubContributionWeek[])
    : []
  const totalCommits = Math.max(0, Math.floor(Number(row.total_commits) || 0))
  const stage = resolveTreeStage(totalCommits)
  const isCreator = row.github_username.trim().toLowerCase() === 'saramag25'
  const syncedAt = row.last_synced_at ?? FALLBACK_SYNC_ISO
  const activeDays =
    typeof row.active_days === 'number' && Number.isFinite(row.active_days) && row.active_days >= 0
      ? Math.floor(row.active_days)
      : undefined
  const commitLevelCounts =
    Array.isArray(row.commit_level_counts) && row.commit_level_counts.length === 4
      ? ([
          Math.max(0, Number(row.commit_level_counts[0]) || 0),
          Math.max(0, Number(row.commit_level_counts[1]) || 0),
          Math.max(0, Number(row.commit_level_counts[2]) || 0),
          Math.max(0, Number(row.commit_level_counts[3]) || 0),
        ] as const)
      : undefined

  return {
    id: row.id,
    user_id: row.id,
    profile: {
      id: row.id,
      github_username: row.github_username,
      github_name: row.display_name || row.github_username,
      avatar_url: row.avatar_url,
      created_at: syncedAt,
    },
    contribution_count: totalCommits,
    tree_level: stage.level,
    tree_position: position,
    plotIndex: typeof row.plot_index === 'number' ? row.plot_index : undefined,
    claimed: row.claimed ?? true,
    activeDays,
    commitLevelCounts,
    gifts,
    companion: toCompanionStateFromRow(row),
    stats: normalizeGitHubContributionStats(
      {
        periodYear,
        totalContributions: totalCommits,
        commits: totalCommits,
        pullRequests: 0,
        issues: 0,
        calendarWeeks,
      },
      totalCommits,
    ),
    custom_message: isCreator ? CREATOR_CAMPAIGN.message : undefined,
    is_creator_special: isCreator,
    last_synced_at: syncedAt,
  }
}

function compactSectorTrees(
  rows: readonly SupabasePublicTreeRow[],
  countsByTreeId: Map<string, Array<{ gift_id: string; gift_count: number }>>,
): CityTree[] {
  const uniqueRows: SupabasePublicTreeRow[] = []
  const seenIds = new Set<string>()
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (seenIds.has(row.id)) continue
    seenIds.add(row.id)
    uniqueRows.push(row)
  }

  // Keep creator anchor at center plaza plot 0
  const creatorIdx = uniqueRows.findIndex(
    (r) => r.github_username.trim().toLowerCase() === 'saramag25',
  )
  if (creatorIdx > 0) {
    const [creatorRow] = uniqueRows.splice(creatorIdx, 1)
    uniqueRows.unshift(creatorRow)
  }

  const result: CityTree[] = new Array(uniqueRows.length)
  for (let i = 0; i < uniqueRows.length; i += 1) {
    const row = uniqueRows[i]
    const compactedRow: SupabasePublicTreeRow = {
      ...row,
      plot_index: i,
    }
    const rawCounts = countsByTreeId.get(row.id) ?? []
    const gifts = expandGiftCountsToSummaries(row.id, rawCounts)
    result[i] = mapPublicTreeRowToCityTree(compactedRow, gifts)
  }

  return result
}

interface CompactSectorTreeItem {
  id: string
  u: string
  dn?: string | null
  av?: string | null
  tc: number
  pi?: number | null
  cm?: string | null
  cn?: string | null
  eh?: string | null
  eb?: string | null
  ey?: string | null
  cl?: boolean | null
  ad?: number | null
  lc?: number[] | null
}

interface CompactSectorBundleResponse {
  trees?: CompactSectorTreeItem[]
  gifts?: Array<{ r: string; g: string; n: number }>
}

function normalizeCompactTreeRow(item: CompactSectorTreeItem): SupabasePublicTreeRow {
  return {
    id: item.id,
    github_username: item.u,
    display_name: item.dn ?? item.u,
    avatar_url: item.av ?? '',
    total_commits: item.tc ?? 0,
    plot_index: typeof item.pi === 'number' ? item.pi : null,
    active_companion_id: item.cm ?? null,
    companion_custom_name: item.cn ?? null,
    equipped_head_id: item.eh ?? null,
    equipped_body_id: item.eb ?? null,
    equipped_hand_id: item.ey ?? null,
    last_synced_at: FALLBACK_SYNC_ISO,
    claimed: Boolean(item.cl),
    active_days: typeof item.ad === 'number' ? item.ad : undefined,
    commit_level_counts: Array.isArray(item.lc) ? item.lc : undefined,
  }
}

export async function fetchCitySectorTrees(params: {
  sessionSeed: string
  limit?: number
  focusUsername?: string | null
  viewerUserId?: string | null
}): Promise<CityTree[]> {
  if (!supabase || !isSupabaseConfigured) return []
  const client = supabase
  const targetLimit = Math.max(1, Math.min(3500, params.limit ?? CITY_SECTOR_LIMIT))

  const rpcArgs = {
    p_session_seed: params.sessionSeed,
    p_limit: targetLimit,
    p_focus_username: params.focusUsername ?? null,
    p_viewer_user_id: params.viewerUserId ?? null,
  }

  // Fast path: single lean compact bundle query returns 3,000 trees + gift counts in 1 round-trip
  const bundleRes = await client.rpc('get_city_sector_bundle', rpcArgs)
  if (!bundleRes.error && bundleRes.data && typeof bundleRes.data === 'object') {
    const bundle = bundleRes.data as CompactSectorBundleResponse
    if (Array.isArray(bundle.trees)) {
      const countsByTreeId = new Map<string, Array<{ gift_id: string; gift_count: number }>>()
      for (const g of bundle.gifts ?? []) {
        const list = countsByTreeId.get(g.r) ?? []
        list.push({ gift_id: g.g, gift_count: g.n })
        countsByTreeId.set(g.r, list)
      }
      const normalizedRows = bundle.trees.map(normalizeCompactTreeRow)
      return compactSectorTrees(normalizedRows, countsByTreeId)
    }
  }

  // Fallback: parallel 1,000-row RPC batches + gift counts in a single concurrent burst
  const pagePromises = []
  for (let from = 0; from < targetLimit; from += TREE_PAGE_SIZE) {
    const to = Math.min(from + TREE_PAGE_SIZE, targetLimit) - 1
    pagePromises.push(client.rpc('get_city_sector_trees', rpcArgs).range(from, to))
  }
  const [countsRes, ...pageResults] = await Promise.all([
    client.rpc('get_public_tree_gift_counts'),
    ...pagePromises,
  ])

  const firstError = pageResults.find((r) => Boolean(r.error))?.error
  if (firstError) {
    if (firstError.code === 'PGRST202' || firstError.code === '42883') {
      const legacy = await fetchPublicCityTrees()
      return legacy.slice(0, targetLimit).map((tree, idx) => ({
        ...tree,
        plotIndex: idx,
        tree_position: getSpiralPlotPosition(idx),
      }))
    }
    throw new Error(firstError.message || 'Erro ao carregar setor da cidade.')
  }

  const combinedRows: SupabasePublicTreeRow[] = []
  for (const res of pageResults) {
    const rows = (res.data ?? []) as SupabasePublicTreeRow[]
    combinedRows.push(...rows)
  }

  const countRows = countsRes.error
    ? []
    : ((countsRes.data ?? []) as SupabasePublicGiftCountRow[])

  const countsByTreeId = new Map<string, Array<{ gift_id: string; gift_count: number }>>()
  for (const row of countRows) {
    const list = countsByTreeId.get(row.recipient_tree_id) ?? []
    list.push({ gift_id: row.gift_id, gift_count: row.gift_count })
    countsByTreeId.set(row.recipient_tree_id, list)
  }

  return compactSectorTrees(combinedRows, countsByTreeId)
}

export async function fetchPublicCityTrees(): Promise<CityTree[]> {
  if (!supabase || !isSupabaseConfigured) return []
  const client = supabase

  // Fetch lightweight page 0 (omitting heavy `contribution_calendar` JSONB) + gift counts in parallel
  const [firstPageRes, countsRes] = await Promise.all([
    client
      .from('public_trees')
      .select(PUBLIC_TREE_LIGHT_SELECT, { count: 'exact' })
      .order('plot_index', { ascending: true })
      .range(0, TREE_PAGE_SIZE - 1),
    client.rpc('get_public_tree_gift_counts'),
  ])

  if (firstPageRes.error) {
    throw new Error(firstPageRes.error.message || 'Erro ao carregar árvores do Polo Norte.')
  }

  const firstBatch = (firstPageRes.data ?? []) as SupabasePublicTreeRow[]
  const allRows: SupabasePublicTreeRow[] = [...firstBatch]
  const totalCount = typeof firstPageRes.count === 'number' ? firstPageRes.count : null
  const pageSize = firstBatch.length

  if (pageSize > 0) {
    if (totalCount !== null && totalCount > firstBatch.length) {
      const remainingStarts: number[] = []
      for (let from = firstBatch.length; from < totalCount; from += pageSize) {
        remainingStarts.push(from)
      }

      for (let i = 0; i < remainingStarts.length; i += MAX_PARALLEL_TREE_PAGES) {
        const chunk = remainingStarts.slice(i, i + MAX_PARALLEL_TREE_PAGES)
        const responses = await Promise.all(
          chunk.map((from) =>
            client
              .from('public_trees')
              .select(PUBLIC_TREE_LIGHT_SELECT)
              .order('plot_index', { ascending: true })
              .range(from, from + pageSize - 1),
          ),
        )
        for (const res of responses) {
          if (res.error) {
            throw new Error(res.error.message || 'Erro ao carregar árvores do Polo Norte.')
          }
          const rows = (res.data ?? []) as SupabasePublicTreeRow[]
          allRows.push(...rows)
        }
      }
    } else if (totalCount === null && pageSize === TREE_PAGE_SIZE) {
      let from = pageSize
      while (true) {
        const { data, error } = await client
          .from('public_trees')
          .select(PUBLIC_TREE_LIGHT_SELECT)
          .order('plot_index', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          throw new Error(error.message || 'Erro ao carregar árvores do Polo Norte.')
        }

        const batch = (data ?? []) as SupabasePublicTreeRow[]
        allRows.push(...batch)
        if (batch.length < pageSize) break
        from += pageSize
      }
    }
  }

  const countRows = countsRes.error
    ? []
    : ((countsRes.data ?? []) as SupabasePublicGiftCountRow[])

  const countsByTreeId = new Map<string, Array<{ gift_id: string; gift_count: number }>>()
  for (const row of countRows) {
    const list = countsByTreeId.get(row.recipient_tree_id) ?? []
    list.push({ gift_id: row.gift_id, gift_count: row.gift_count })
    countsByTreeId.set(row.recipient_tree_id, list)
  }

  const fallbackOccupiedPositions: TreePosition[] = []
  const result: CityTree[] = new Array(allRows.length)

  for (let i = 0; i < allRows.length; i += 1) {
    const row = allRows[i]
    const rawCounts = countsByTreeId.get(row.id) ?? []
    const gifts = expandGiftCountsToSummaries(row.id, rawCounts)
    const tree = mapPublicTreeRowToCityTree(row, gifts, fallbackOccupiedPositions)
    if (typeof row.plot_index !== 'number' || !Number.isInteger(row.plot_index) || row.plot_index < 0) {
      fallbackOccupiedPositions.push(tree.tree_position)
    }
    result[i] = tree
  }

  return result
}

export async function fetchPublicTreeCalendarById(
  treeId: string,
): Promise<GitHubContributionWeek[] | null> {
  if (!supabase || !isSupabaseConfigured || !treeId.trim()) return null

  const { data, error } = await supabase
    .from('public_trees')
    .select('contribution_calendar')
    .eq('id', treeId.trim())
    .maybeSingle<{ contribution_calendar?: unknown }>()

  if (error || !data) return null
  return Array.isArray(data.contribution_calendar)
    ? (data.contribution_calendar as GitHubContributionWeek[])
    : []
}

export async function findPublicTreeByUsername(rawUsername: string): Promise<CityTree | null> {
  if (!supabase || !isSupabaseConfigured) return null
  const clean = normalizeGitHubUsernameInput(rawUsername)
  if (!clean) return null

  const { data, error } = await supabase
    .from('public_trees')
    .select(PUBLIC_TREE_FULL_SELECT)
    .eq('github_username_lower', clean.toLowerCase())
    .maybeSingle<SupabasePublicTreeRow>()

  if (error || !data) return null

  const countsRes = await supabase.rpc('get_public_tree_gift_counts')
  const countRows = countsRes.error
    ? []
    : ((countsRes.data ?? []) as SupabasePublicGiftCountRow[])
        .filter((r) => r.recipient_tree_id === data.id)
        .map((r) => ({ gift_id: r.gift_id, gift_count: r.gift_count }))

  const gifts = expandGiftCountsToSummaries(data.id, countRows)
  return mapPublicTreeRowToCityTree(data, gifts)
}

export interface OwnerPrivateState {
  treeRow: SupabasePrivateTreeRow | null
  loadout: UserCompanionLoadout | null
  ownerGifts: TreeGiftSummary[] | null
  ownerCalendarWeeks: GitHubContributionWeek[] | null
}

export async function fetchOwnerPrivateState(userId: string): Promise<OwnerPrivateState> {
  if (!supabase || !isSupabaseConfigured) {
    return { treeRow: null, loadout: null, ownerGifts: null, ownerCalendarWeeks: null }
  }

  const [treeRes, unlocksRes, giftsRes] = await Promise.all([
    supabase
      .from('trees')
      .select(
        'id, user_id, github_username, spent_commits, contribution_calendar, active_companion_id, companion_custom_name, equipped_head_id, equipped_body_id, equipped_hand_id',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_unlocks')
      .select('item_id, unlock_source, created_at')
      .eq('user_id', userId),
    supabase
      .from('tree_gifts')
      .select('id, recipient_tree_id, gift_id, sender_username, source, created_at')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const treeRow = !treeRes.error ? ((treeRes.data ?? null) as SupabasePrivateTreeRow | null) : null
  const unlockRows = !unlocksRes.error ? ((unlocksRes.data ?? []) as SupabaseUserUnlockRow[]) : []
  const giftRows = !giftsRes.error
    ? ((giftsRes.data ?? null) as SupabasePrivateTreeGiftRow[] | null)
    : null

  const speciesSet = new Set(COMPANION_SPECIES_CATALOG.map((s) => s.id))
  const accessorySet = new Set(COMPANION_ACCESSORIES_CATALOG.map((a) => a.id))
  const giftIdSet = new Set(GIFTS_CATALOG.map((g) => g.id))

  const unlockedSpecies: CompanionSpeciesId[] = []
  const unlockedAccessories: CompanionAccessoryId[] = []
  const unlockedGifts: string[] = []
  const unlockedViaPixIds: string[] = []
  let supporterBundleUnlocked = false

  for (const row of unlockRows) {
    if (row.item_id === SUPPORTER_BUNDLE.id) {
      supporterBundleUnlocked = true
      unlockedViaPixIds.push(`bundle:${SUPPORTER_BUNDLE.id}`)
    } else if (speciesSet.has(row.item_id as CompanionSpeciesId)) {
      const spId = row.item_id as CompanionSpeciesId
      unlockedSpecies.push(spId)
      if (row.unlock_source !== 'commits') {
        unlockedViaPixIds.push(`species:${spId}`)
      }
    } else if (accessorySet.has(row.item_id as CompanionAccessoryId)) {
      const accId = row.item_id as CompanionAccessoryId
      unlockedAccessories.push(accId)
      if (row.unlock_source !== 'commits') {
        unlockedViaPixIds.push(`accessory:${accId}`)
      }
    } else if (giftIdSet.has(row.item_id)) {
      unlockedGifts.push(row.item_id)
    }
  }

  const companionState = treeRow ? toCompanionStateFromRow(treeRow) : undefined
  const baseLoadout: UserCompanionLoadout | null = treeRow
    ? {
        species: companionState?.species ?? null,
        customName: companionState?.customName,
        equipped: companionState?.equipped ?? { ...EMPTY_EQUIPPED_ACCESSORIES },
        unlockedSpecies: supporterBundleUnlocked
          ? Array.from(
              new Set([
                ...unlockedSpecies,
                ...COMPANION_SPECIES_CATALOG.filter((s) => !s.pixOnly).map((s) => s.id),
              ]),
            )
          : unlockedSpecies,
        unlockedAccessories: supporterBundleUnlocked
          ? Array.from(
              new Set([
                ...unlockedAccessories,
                ...COMPANION_ACCESSORIES_CATALOG.filter((a) => !a.pixOnly).map((a) => a.id),
              ]),
            )
          : unlockedAccessories,
        unlockedGifts,
        spentCommits: Math.max(0, Number(treeRow.spent_commits) || 0),
        supporterBundleUnlocked,
        unlockedViaPixIds,
        transactions: [],
        updatedAt: new Date().toISOString(),
      }
    : null
  const loadout: UserCompanionLoadout | null = baseLoadout
    ? withCreatorFullUnlock(treeRow?.github_username, baseLoadout)
    : null

  const giftById = new Map(GIFTS_CATALOG.map((g) => [g.id, g]))
  const ownerGifts: TreeGiftSummary[] | null = giftRows
    ? giftRows
        .map((row): TreeGiftSummary | null => {
          const meta = giftById.get(row.gift_id)
          if (!meta) return null
          return {
            id: row.id,
            gift_id: meta.id,
            gift_slug: meta.slug,
            gift_name: meta.name,
            category: meta.category,
            rarity: meta.rarity,
            sender_name: `@${row.sender_username.replace(/^@/, '')}`,
            created_at: row.created_at,
          }
        })
        .filter((item): item is TreeGiftSummary => item !== null)
    : null

  const ownerCalendarWeeks =
    treeRow && Array.isArray(treeRow.contribution_calendar)
      ? (treeRow.contribution_calendar as GitHubContributionWeek[])
      : null

  return { treeRow, loadout, ownerGifts, ownerCalendarWeeks }
}

export async function rpcUnlockItemWithCommits(itemId: string): Promise<UnlockItemRpcResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
  const { data, error } = await supabase.rpc('unlock_item_with_commits', {
    p_item_id: itemId,
  })
  if (error) {
    throw new Error(error.message)
  }
  return data as UnlockItemRpcResult
}

export async function rpcEquipCompanionLoadout(params: {
  companionId: CompanionSpeciesId | null
  headId: HeadAccessoryId | null
  bodyId: BodyAccessoryId | null
  handId: HandAccessoryId | null
  customName?: string
}): Promise<EquipLoadoutRpcResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
  const { data, error } = await supabase.rpc('equip_companion_loadout', {
    p_companion_id: params.companionId,
    p_head_id: params.headId,
    p_body_id: params.bodyId,
    p_hand_id: params.handId,
    p_custom_name: params.customName ?? null,
  })
  if (error) {
    throw new Error(error.message)
  }
  return data as EquipLoadoutRpcResult
}

export async function rpcSendFreeGift(
  recipientTreeId: string,
  giftId: string,
): Promise<SendFreeGiftRpcResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
  const { data, error } = await supabase.rpc('send_free_gift', {
    p_recipient_tree_id: recipientTreeId,
    p_gift_id: giftId,
  })
  if (error) {
    throw new Error(error.message)
  }
  return data as SendFreeGiftRpcResult
}

export async function rpcSendUnlockedGift(
  recipientTreeId: string,
  giftId: string,
): Promise<SendFreeGiftRpcResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
  const { data, error } = await supabase.rpc('send_unlocked_gift', {
    p_recipient_tree_id: recipientTreeId,
    p_gift_id: giftId,
  })
  if (error) {
    throw new Error(error.message)
  }
  return data as SendFreeGiftRpcResult
}

/**
 * Generates purely decorative background pine trees for production launch when few real
 * users have joined yet so the North Pole forest stays lush without creating fake profiles.
 */
export function buildDecorativeForestTrees(
  occupiedPositions: readonly TreePosition[],
  targetForestDensity = 150,
): CityTree[] {
  const minDistSq = MIN_TREE_SPACING_GRID * MIN_TREE_SPACING_GRID
  const isNearOccupied = (pos: TreePosition) =>
    occupiedPositions.some((occ) => {
      const dx = occ.gridX - pos.gridX
      const dy = occ.gridY - pos.gridY
      return dx * dx + dy * dy < minDistSq
    })

  const available = CURATED_TREE_PLOTS.filter((slot) => !isNearOccupied(slot))
  const needed = Math.max(0, targetForestDensity - occupiedPositions.length)
  if (needed === 0 || available.length === 0) return []

  const chosen = selectStratifiedTreePlots(available, Math.min(needed, available.length))
  return chosen.map((slot, idx) => {
    const mod = (idx * 37 + 13) % 100
    const contrib =
      mod < 20 ? 0 : mod < 48 ? 14 : mod < 74 ? 72 : mod < 92 ? 190 : 380
    const stage = resolveTreeStage(contrib)
    return {
      id: `deco-pine-${idx}`,
      user_id: `deco-${idx}`,
      profile: {
        id: `deco-${idx}`,
        github_username: `north-pole-pine-${idx}`,
        github_name: 'Pinheiro do Polo Norte',
        avatar_url: '',
        created_at: '2026-11-20T00:00:00Z',
      },
      contribution_count: contrib,
      tree_level: stage.level,
      tree_position: slot,
      isDecorative: true,
      gifts: [],
      last_synced_at: '2026-11-20T00:00:00Z',
    }
  })
}

export function formatBackendActionError(rawMessage: string, language: 'pt-BR' | 'en'): string {
  const msg = rawMessage.toUpperCase()
  if (msg.includes('NOT_AUTHENTICATED')) {
    return language === 'en'
      ? 'Connect with your GitHub account first to perform this action.'
      : 'Conecte sua conta GitHub primeiro para realizar esta ação.'
  }
  if (msg.includes('INSUFFICIENT_COMMITS')) {
    return language === 'en'
      ? 'Insufficient commit balance for this item.'
      : 'Saldo de commits insuficiente para desbloquear este item.'
  }
  if (msg.includes('TREE_NOT_FOUND')) {
    return language === 'en'
      ? 'Sync your GitHub tree first before customizing companions.'
      : 'Sincronize sua árvore do GitHub primeiro antes de customizar companheiros.'
  }
  if (msg.includes('GIFT_NOT_UNLOCKED')) {
    return language === 'en'
      ? 'This special gift or scene prop is not unlocked on your account yet.'
      : 'Este presente ou objeto de cenário ainda não está desbloqueado na sua conta.'
  }
  if (
    msg.includes('COMPANION_NOT_UNLOCKED') ||
    msg.includes('ACCESSORY_NOT_UNLOCKED') ||
    msg.includes('INVALID_COMPANION') ||
    msg.includes('INVALID_BODY_ACCESSORY')
  ) {
    return language === 'en'
      ? 'Item not yet enabled on the Supabase database. Run the latest SQL migrations (`npx supabase db push`).'
      : 'Item ainda não liberado no banco Supabase — aplique as migrations SQL pendentes (`npx supabase db push`).'
  }
  if (msg.includes('GIFT_NOT_FREE_OR_INVALID')) {
    return language === 'en'
      ? 'Paid gifts require payment confirmation.'
      : 'Presentes pagos exigem confirmação de pagamento.'
  }
  if (msg.includes('RATE_LIMIT_SENDER_WINDOW')) {
    return language === 'en'
      ? 'Too many free gifts sent in a short window. Wait a few minutes before sending more.'
      : 'Limite temporário atingido: aguarde alguns minutos antes de enviar mais presentes gratuitos.'
  }
  if (msg.includes('RATE_LIMIT_TREE_DAILY')) {
    return language === 'en'
      ? 'Daily free-gift limit reached for this tree.'
      : 'Limite diário de presentes gratuitos atingido para esta árvore.'
  }
  return rawMessage
}
