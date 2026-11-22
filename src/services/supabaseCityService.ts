import {
  COMPANION_ACCESSORIES_CATALOG,
  COMPANION_SPECIES_CATALOG,
  EMPTY_EQUIPPED_ACCESSORIES,
  getAccessoryById,
  getSpeciesById,
  sanitizeCompanionName,
} from '../config/companions'
import { CITY_MAP_CONFIG, MIN_TREE_SPACING_GRID } from '../config/cityMapConfig'
import { GIFTS_CATALOG } from '../config/gifts'
import { CREATOR_CAMPAIGN, SUPPORTER_BUNDLE } from '../config/supportCampaign'
import { resolveTreeStage } from '../config/treeLevels'
import {
  allocateTreePosition,
  CURATED_TREE_PLOTS,
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
import { normalizeGitHubContributionStats } from './githubSyncService'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const CENTERED_CURATED_PLOTS: readonly TreePosition[] = [...CURATED_TREE_PLOTS].sort((a, b) => {
  const cx = CITY_MAP_CONFIG.plazaCenter.gridX
  const cy = CITY_MAP_CONFIG.plazaCenter.gridY
  const da = Math.hypot(a.gridX - cx, a.gridY - cy)
  const db = Math.hypot(b.gridX - cx, b.gridY - cy)
  return da - db
})

export function resolveTreePositionFromPlotIndex(
  plotIndex: number | null | undefined,
  occupiedPositions: readonly TreePosition[],
  username: string,
): TreePosition {
  if (typeof plotIndex === 'number' && Number.isInteger(plotIndex) && plotIndex >= 0) {
    if (plotIndex < CENTERED_CURATED_PLOTS.length) {
      return CENTERED_CURATED_PLOTS[plotIndex]
    }
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

export async function fetchPublicCityTrees(): Promise<CityTree[]> {
  if (!supabase || !isSupabaseConfigured) return []

  const [treesRes, countsRes] = await Promise.all([
    supabase
      .from('public_trees')
      .select(
        'id, github_username, display_name, avatar_url, total_commits, contribution_calendar, plot_index, active_companion_id, companion_custom_name, equipped_head_id, equipped_body_id, equipped_hand_id, last_synced_at',
      )
      .order('plot_index', { ascending: true }),
    supabase.rpc('get_public_tree_gift_counts'),
  ])

  if (treesRes.error) {
    throw new Error(treesRes.error.message || 'Erro ao carregar árvores do Polo Norte.')
  }

  const rows = (treesRes.data ?? []) as SupabasePublicTreeRow[]
  const countRows = countsRes.error
    ? []
    : ((countsRes.data ?? []) as SupabasePublicGiftCountRow[])

  const giftById = new Map(GIFTS_CATALOG.map((g) => [g.id, g]))
  const giftsByTreeId = new Map<string, TreeGiftSummary[]>()

  for (const row of countRows) {
    const giftMeta = giftById.get(row.gift_id)
    if (!giftMeta) continue
    const qty = Math.max(0, Math.min(200, Math.floor(Number(row.gift_count) || 0)))
    if (qty <= 0) continue

    const list = giftsByTreeId.get(row.recipient_tree_id) ?? []
    for (let i = 0; i < qty; i += 1) {
      list.push({
        id: `pub-${row.recipient_tree_id}-${giftMeta.id}-${i}`,
        gift_id: giftMeta.id,
        gift_slug: giftMeta.slug,
        gift_name: giftMeta.name,
        category: giftMeta.category,
        rarity: giftMeta.rarity,
        sender_name: '',
        created_at: new Date(0).toISOString(),
      })
    }
    giftsByTreeId.set(row.recipient_tree_id, list)
  }

  const occupiedPositions: TreePosition[] = []
  const result: CityTree[] = []

  for (const row of rows) {
    const position = resolveTreePositionFromPlotIndex(
      row.plot_index,
      occupiedPositions,
      row.github_username,
    )
    occupiedPositions.push(position)

    const calendarWeeks = Array.isArray(row.contribution_calendar)
      ? (row.contribution_calendar as GitHubContributionWeek[])
      : []
    const totalCommits = Math.max(0, Math.floor(Number(row.total_commits) || 0))
    const stage = resolveTreeStage(totalCommits)
    const isCreator = row.github_username.trim().toLowerCase() === 'saramag25'
    const syncedAt = row.last_synced_at ?? new Date().toISOString()

    result.push({
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
      plotIndex: row.plot_index,
      gifts: giftsByTreeId.get(row.id) ?? [],
      companion: toCompanionStateFromRow(row),
      stats: normalizeGitHubContributionStats(
        {
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
    })
  }

  return result
}

export interface OwnerPrivateState {
  treeRow: SupabasePrivateTreeRow | null
  loadout: UserCompanionLoadout | null
  ownerGifts: TreeGiftSummary[] | null
}

export async function fetchOwnerPrivateState(userId: string): Promise<OwnerPrivateState> {
  if (!supabase || !isSupabaseConfigured) {
    return { treeRow: null, loadout: null, ownerGifts: null }
  }

  const [treeRes, unlocksRes, giftsRes] = await Promise.all([
    supabase
      .from('trees')
      .select(
        'id, user_id, spent_commits, active_companion_id, companion_custom_name, equipped_head_id, equipped_body_id, equipped_hand_id',
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

  const unlockedSpecies: CompanionSpeciesId[] = []
  const unlockedAccessories: CompanionAccessoryId[] = []
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
    }
  }

  const companionState = treeRow ? toCompanionStateFromRow(treeRow) : undefined
  const loadout: UserCompanionLoadout | null = treeRow
    ? {
        species: companionState?.species ?? null,
        customName: companionState?.customName,
        equipped: companionState?.equipped ?? { ...EMPTY_EQUIPPED_ACCESSORIES },
        unlockedSpecies: supporterBundleUnlocked
          ? COMPANION_SPECIES_CATALOG.map((s) => s.id)
          : unlockedSpecies,
        unlockedAccessories: supporterBundleUnlocked
          ? COMPANION_ACCESSORIES_CATALOG.map((a) => a.id)
          : unlockedAccessories,
        spentCommits: Math.max(0, Number(treeRow.spent_commits) || 0),
        supporterBundleUnlocked,
        unlockedViaPixIds,
        transactions: [],
        updatedAt: new Date().toISOString(),
      }
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

  return { treeRow, loadout, ownerGifts }
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
  if (msg.includes('GIFT_NOT_FREE_OR_INVALID')) {
    return language === 'en'
      ? 'Paid gifts require checkout confirmation (Phase 7).'
      : 'Presentes pagos exigem confirmação de pagamento (Fase 7).'
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
