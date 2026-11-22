import { GIFTS_CATALOG } from '../config/gifts'
import { STANDARD_CONTRIBUTION_YEAR } from '../config/githubPeriod'
import { CREATOR_CAMPAIGN } from '../config/supportCampaign'
import { resolveTreeStage } from '../config/treeLevels'
import {
  CURATED_TREE_PLOTS,
  hashUsername,
  selectStratifiedTreePlots,
} from '../game/layout/treePlacement'
import type {
  CityCommunityStats,
  CityTree,
  GitHubContributionStats,
  GitHubContributionWeek,
} from '../types/city'
import type { TreeCompanionState } from '../types/companion'

export const MOCK_GIFTS_CATALOG = GIFTS_CATALOG

function buildSyntheticCalendarStats(
  username: string,
  totalContributions: number,
): GitHubContributionStats {
  const seed = hashUsername(username)
  const weeks: GitHubContributionWeek[] = []
  const startDate = new Date(Date.UTC(STANDARD_CONTRIBUTION_YEAR, 0, 1))
  const safeTotal = Math.max(0, Math.floor(totalContributions))

  // First pass: collect deterministic active days across all 364 days of the year
  const rawWeights = new Array<number>(364).fill(0)
  const candidateActiveIndices: number[] = []
  const activeChance =
    safeTotal <= 0 ? 0 : Math.min(0.68, 0.1 + safeTotal / 950)

  for (let i = 0; i < 364; i += 1) {
    const h = (seed ^ Math.imul(i + 17, 2654435761)) >>> 0
    if ((h % 1000) / 1000 < activeChance) {
      candidateActiveIndices.push(i)
      rawWeights[i] = 1 + ((h >> 8) % (safeTotal > 400 ? 10 : 5))
    }
  }

  // Ensure at least one active day when safeTotal > 0 and never more active days than total commits
  if (safeTotal > 0 && candidateActiveIndices.length === 0) {
    const fallbackIdx = seed % 364
    candidateActiveIndices.push(fallbackIdx)
    rawWeights[fallbackIdx] = 1
  }

  let selectedIndices = candidateActiveIndices
  if (candidateActiveIndices.length > safeTotal) {
    selectedIndices = []
    for (let k = 0; k < safeTotal; k += 1) {
      const pick = Math.floor((k * candidateActiveIndices.length) / safeTotal)
      selectedIndices.push(candidateActiveIndices[pick])
    }
  }

  const dailyCounts = new Array<number>(364).fill(0)
  if (safeTotal > 0 && selectedIndices.length > 0) {
    // Guarantee 1 commit per selected active day spread evenly across the full 52-week year
    let remaining = safeTotal
    for (const idx of selectedIndices) {
      if (remaining <= 0) break
      dailyCounts[idx] = 1
      remaining -= 1
    }

    // Distribute remaining commits proportionally by deterministic weight across active days
    const selectedWeightSum = selectedIndices.reduce((acc, idx) => acc + rawWeights[idx], 0)
    if (remaining > 0 && selectedWeightSum > 0) {
      const bonusPool = remaining
      for (const idx of selectedIndices) {
        if (remaining <= 0) break
        const extra = Math.min(
          remaining,
          Math.floor((rawWeights[idx] / selectedWeightSum) * bonusPool),
        )
        if (extra > 0) {
          dailyCounts[idx] += extra
          remaining -= extra
        }
      }
    }

    // Spread any small rounding remainder across active days across the year (not clumped in week 0)
    let cursor = seed % selectedIndices.length
    while (remaining > 0) {
      const idx = selectedIndices[cursor % selectedIndices.length]
      dailyCounts[idx] += 1
      remaining -= 1
      cursor += 3
    }
  }

  for (let w = 0; w < 52; w += 1) {
    const days = []
    for (let d = 0; d < 7; d += 1) {
      const idx = w * 7 + d
      const date = new Date(startDate.getTime() + idx * 86400000).toISOString().slice(0, 10)
      days.push({ date, contributionCount: dailyCounts[idx] })
    }
    weeks.push({ contributionDays: days })
  }

  const commits = safeTotal

  return {
    periodYear: STANDARD_CONTRIBUTION_YEAR,
    totalContributions: safeTotal,
    commits,
    pullRequests: 0,
    issues: 0,
    restrictedContributions: 0,
    calendarWeeks: weeks,
  }
}

function buildMockTree(params: {
  id: string
  username: string
  name: string
  contributions: number
  gridX: number
  gridY: number
  customMessage?: string
  isCreatorSpecial?: boolean
  gifts?: CityTree['gifts']
  companion?: TreeCompanionState
}): CityTree {
  const stage = resolveTreeStage(params.contributions)
  return {
    id: params.id,
    user_id: `user-${params.id}`,
    profile: {
      id: `user-${params.id}`,
      github_username: params.username,
      github_name: params.name,
      avatar_url: `https://avatars.githubusercontent.com/${params.username}`,
      created_at: '2026-11-20T12:00:00Z',
    },
    contribution_count: params.contributions,
    tree_level: stage.level,
    tree_position: {
      gridX: params.gridX,
      gridY: params.gridY,
    },
    gifts: params.gifts ?? [],
    companion: params.companion,
    stats: buildSyntheticCalendarStats(params.username, params.contributions),
    custom_message: params.customMessage,
    is_creator_special: params.isCreatorSpecial,
    last_synced_at: '2026-11-20T12:00:00Z',
  }
}

const FEATURED_DEVS: Array<{
  id: string
  username: string
  name: string
  contributions: number
  customMessage?: string
  isCreatorSpecial?: boolean
  gifts?: CityTree['gifts']
  companion?: TreeCompanionState
}> = [
  {
    id: 'creator-ufc',
    username: 'SaraMag25',
    name: 'Sara Magalhães',
    contributions: 540,
    isCreatorSpecial: true,
    customMessage: CREATOR_CAMPAIGN.message,
    companion: {
      species: 'capybara',
      equipped: {
        head: 'santa-hat',
        body: 'leaf-scarf',
        hand: 'coffee-mug',
      },
    },
    gifts: [
      {
        id: 'tg-1',
        gift_id: 'gift-star',
        gift_slug: 'golden-star',
        gift_name: 'Estrela Dourada',
        category: 'special',
        rarity: 'legendary',
        sender_name: 'Amigos da Faculdade',
        created_at: '2026-11-20T10:00:00Z',
      },
      {
        id: 'tg-2',
        gift_id: 'gift-teddy',
        gift_slug: 'cozy-teddy',
        gift_name: 'Ursinho de Inverno',
        category: 'special',
        rarity: 'epic',
        sender_name: 'Amigos do LESC',
        created_at: '2026-11-20T11:00:00Z',
      },
    ],
  },
  {
    id: 'dev-1',
    username: 'ada-lovelace',
    name: 'Ada L.',
    contributions: 842,
    customMessage: 'Compilando flocos de neve em TypeScript!',
    companion: {
      species: 'cat',
      equipped: {
        head: 'golden-butterfly',
        body: 'round-glasses',
        hand: 'white-fish',
      },
    },
    gifts: [
      {
        id: 'tg-3',
        gift_id: 'gift-lights',
        gift_slug: 'colorful-lights',
        gift_name: 'Luzes Coloridas',
        category: 'free',
        rarity: 'rare',
        sender_name: 'linus-dev',
        created_at: '2026-11-20T09:00:00Z',
      },
    ],
  },
  {
    id: 'dev-2',
    username: 'carlos-fortaleza',
    name: 'Carlos Eduardo',
    contributions: 384,
    customMessage: 'Boas festas direto do Ceará!',
    companion: {
      species: 'snake',
      equipped: {
        head: null,
        body: 'leaf-scarf',
        hand: null,
      },
    },
    gifts: [
      {
        id: 'tg-4',
        gift_id: 'gift-box',
        gift_slug: 'gift-box',
        gift_name: 'Caixa de Presente',
        category: 'free',
        rarity: 'common',
        sender_name: 'mariana-ux',
        created_at: '2026-11-20T08:30:00Z',
      },
    ],
  },
  {
    id: 'dev-3',
    username: 'mariana-ux',
    name: 'Mariana Costa',
    contributions: 215,
    customMessage: 'Pixel art e café quente neste inverno.',
    companion: {
      species: 'mouse',
      equipped: {
        head: 'strawberry-hat',
        body: 'leaf-scarf',
        hand: 'cheese-wedge',
      },
    },
  },
  {
    id: 'dev-4',
    username: 'lucas-embedded',
    name: 'Lucas Ribeiro',
    contributions: 84,
    customMessage: 'Piscando LEDs verdes e luzes de Natal!',
  },
  {
    id: 'dev-5',
    username: 'beatriz-py',
    name: 'Beatriz Alves',
    contributions: 36,
    customMessage: 'Treinando modelos e decorando pinheiros.',
  },
  {
    id: 'dev-6',
    username: 'joao-rust',
    name: 'João Pedro',
    contributions: 7,
    customMessage: 'Primeiro projeto open-source do ano!',
  },
  {
    id: 'dev-7',
    username: 'helena-caloura',
    name: 'Helena Nunes',
    contributions: 0,
    customMessage: 'Pronta para dar meu primeiro commit!',
  },
  {
    id: 'dev-8',
    username: 'rafael-go',
    name: 'Rafael Lima',
    contributions: 678,
    customMessage: 'Mais de 600 commits antes do Natal!',
    companion: {
      species: 'frog',
      equipped: {
        head: 'wizard-hat',
        body: 'wizard-cloak',
        hand: 'glow-lantern',
      },
    },
  },
  {
    id: 'dev-9',
    username: 'julia-mobile',
    name: 'Júlia Ferreira',
    contributions: 148,
    companion: {
      species: 'otter',
      equipped: {
        head: 'leaf-umbrella',
        body: null,
        hand: 'coffee-mug',
      },
    },
  },
  {
    id: 'dev-10',
    username: 'thiago-data',
    name: 'Thiago Rocha',
    contributions: 63,
  },
  {
    id: 'dev-11',
    username: 'camila-web',
    name: 'Camila Duarte',
    contributions: 19,
  },
]

const FIRST_NAMES = [
  'ana', 'pedro', 'gabriel', 'larissa', 'matheus', 'luiza', 'bruno', 'clara',
  'felipe', 'amanda', 'rodrigo', 'sofia', 'henrique', 'leticia', 'diego', 'isabela',
  'vitor', 'nicole', 'gustavo', 'yasmin', 'igor', 'marina', 'caio', 'paula',
]

const STACK_SUFFIXES = [
  'ts', 'rust', 'py', 'go', 'k8s', 'react', 'linux', 'cpp', 'ml', 'node', 'wasm', 'vim',
]

function buildForestCommunityTrees(): CityTree[] {
  const trees: CityTree[] = []
  const totalPlots = CURATED_TREE_PLOTS.length
  // Populate all 380 community trees evenly across the compact 56x42 forest while keeping open slots for new devs
  const targetCommunityCount = Math.min(380, Math.max(12, totalPlots - 50))
  const populatedSlots = selectStratifiedTreePlots(CURATED_TREE_PLOTS, targetCommunityCount)

  // Place featured developers across well-spaced plots (creator near North Pole clearing)
  FEATURED_DEVS.forEach((dev, idx) => {
    const plotIdx =
      idx === 0
        ? Math.floor(populatedSlots.length * 0.46)
        : (idx * 17 + 7) % populatedSlots.length
    const slot = populatedSlots[plotIdx]
    trees.push(
      buildMockTree({
        ...dev,
        gridX: slot.gridX,
        gridY: slot.gridY,
      }),
    )
  })

  const usedPlotIndices = new Set(
    FEATURED_DEVS.map((_, idx) =>
      idx === 0
        ? Math.floor(populatedSlots.length * 0.46)
        : (idx * 17 + 7) % populatedSlots.length,
    ),
  )

  // Fill remaining plots with varied GitHub developers to form a dense Git-City forest
  let procIdx = 0
  for (let p = 0; p < populatedSlots.length; p += 1) {
    if (usedPlotIndices.has(p)) continue
    const slot = populatedSlots[p]
    const first = FIRST_NAMES[procIdx % FIRST_NAMES.length]
    const stack = STACK_SUFFIXES[Math.floor(procIdx / FIRST_NAMES.length) % STACK_SUFFIXES.length]
    const num = Math.floor(procIdx / (FIRST_NAMES.length * STACK_SUFFIXES.length))
    const username = num > 0 ? `${first}-${stack}-${num}` : `${first}-${stack}`
    const displayName = `${first[0].toUpperCase()}${first.slice(1)} (${stack.toUpperCase()})`

    // Realistic distribution: seedlings (0), light devs (1-50), active (51-300), high (301-1200)
    const h = hashUsername(username) % 100
    let contributions: number
    if (h < 8) contributions = 0
    else if (h < 26) contributions = 1 + ((h * 3) % 24)
    else if (h < 54) contributions = 25 + ((h * 7) % 95)
    else if (h < 80) contributions = 120 + ((h * 13) % 280)
    else if (h < 94) contributions = 400 + ((h * 19) % 350)
    else contributions = 750 + ((h * 29) % 620)

    trees.push(
      buildMockTree({
        id: `forest-${procIdx}`,
        username,
        name: displayName,
        contributions,
        gridX: slot.gridX,
        gridY: slot.gridY,
      }),
    )
    procIdx += 1
  }

  return trees
}

export const MOCK_CITY_TREES: readonly CityTree[] = buildForestCommunityTrees()

export function computeCommunityStats(trees: readonly CityTree[]): CityCommunityStats {
  return trees.reduce<CityCommunityStats>(
    (acc, tree) => ({
      totalTrees: acc.totalTrees + 1,
      totalContributions: acc.totalContributions + tree.contribution_count,
      totalGifts: acc.totalGifts + tree.gifts.length,
      illuminatedTrees: acc.illuminatedTrees + (tree.tree_level >= 4 ? 1 : 0),
    }),
    {
      totalTrees: 0,
      totalContributions: 0,
      totalGifts: 0,
      illuminatedTrees: 0,
    },
  )
}
