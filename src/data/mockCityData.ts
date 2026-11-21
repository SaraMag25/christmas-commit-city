import { resolveTreeStage } from '../config/treeLevels'
import { STANDARD_CONTRIBUTION_YEAR } from '../config/githubPeriod'
import { CURATED_TREE_PLOTS, hashUsername } from '../game/layout/treePlacement'
import type {
  CityCommunityStats,
  CityTree,
  GiftItem,
  GiftRarity,
  GitHubContributionStats,
  GitHubContributionWeek,
  TreeMessage,
} from '../types/city'

export const MOCK_GIFTS_CATALOG: readonly GiftItem[] = [
  {
    id: 'gift-star',
    slug: 'golden-star',
    name: 'Estrela Dourada',
    category: 'special',
    price: 10,
    rarity: 'legendary',
    description: 'Brilha no topo dos galhos como símbolo de apoio comunitário.',
    accentColor: '#fbbf24',
  },
  {
    id: 'gift-baubles',
    slug: 'ornament-baubles',
    name: 'Bolas Natalinas',
    category: 'free',
    price: 0,
    rarity: 'common',
    description: 'Bolinhas clássicas vermelhas e douradas para celebrar commits.',
    accentColor: '#ef4444',
  },
  {
    id: 'gift-lights',
    slug: 'colorful-lights',
    name: 'Luzes Coloridas',
    category: 'free',
    price: 0,
    rarity: 'rare',
    description: 'Cordão cintilante que deixa qualquer pinheiro mais acolhedor.',
    accentColor: '#38bdf8',
  },
  {
    id: 'gift-bell',
    slug: 'festive-bell',
    name: 'Sinos',
    category: 'free',
    price: 0,
    rarity: 'common',
    description: 'Pequenos sinos dourados que anunciam a chegada do Natal.',
    accentColor: '#f59e0b',
  },
  {
    id: 'gift-snowflake',
    slug: 'crystal-snowflake',
    name: 'Flocos de Neve',
    category: 'free',
    price: 0,
    rarity: 'rare',
    description: 'Cristais de gelo cintilantes para enfeitar os ramos.',
    accentColor: '#bae6fd',
  },
  {
    id: 'gift-box',
    slug: 'gift-box',
    name: 'Caixa de Presente',
    category: 'free',
    price: 0,
    rarity: 'common',
    description: 'Uma caixinha embrulhada com laço vermelho ao pé da árvore.',
    accentColor: '#22c55e',
  },
  {
    id: 'gift-teddy',
    slug: 'cozy-teddy',
    name: 'Ursinho de Inverno',
    category: 'special',
    price: 15,
    rarity: 'epic',
    description: 'Um ursinho com cachecol natalino colocado junto ao tronco.',
    accentColor: '#d97706',
  },
  {
    id: 'gift-crown',
    slug: 'ufc-ornament',
    name: 'Enfeite Especial',
    category: 'special',
    price: 25,
    rarity: 'legendary',
    description: 'Enfeite raro em edição natalina para homenagear grandes projetos.',
    accentColor: '#fde047',
  },
]

function buildSyntheticCalendarStats(
  username: string,
  totalContributions: number,
): GitHubContributionStats {
  const seed = hashUsername(username)
  const weeks: GitHubContributionWeek[] = []
  const startDate = new Date(Date.UTC(STANDARD_CONTRIBUTION_YEAR, 0, 1))
  let remaining = Math.max(0, totalContributions)

  // First pass: generate 52 weeks x 7 days deterministic activity weights
  const rawWeights: number[] = []
  let weightSum = 0

  for (let i = 0; i < 364; i += 1) {
    const h = (seed ^ Math.imul(i + 17, 2654435761)) >>> 0
    const activeChance = totalContributions <= 0 ? 0 : Math.min(0.82, 0.08 + totalContributions / 650)
    const isActive = (h % 1000) / 1000 < activeChance
    const weight = isActive ? 1 + ((h >> 8) % (totalContributions > 400 ? 11 : 5)) : 0
    rawWeights.push(weight)
    weightSum += weight
  }

  for (let w = 0; w < 52; w += 1) {
    const days = []
    for (let d = 0; d < 7; d += 1) {
      const idx = w * 7 + d
      const date = new Date(startDate.getTime() + idx * 86400000).toISOString().slice(0, 10)
      let count = 0
      if (remaining > 0 && weightSum > 0 && rawWeights[idx] > 0) {
        count = Math.max(1, Math.round((rawWeights[idx] / weightSum) * totalContributions))
        count = Math.min(remaining, count)
        remaining -= count
      }
      days.push({ date, contributionCount: count })
    }
    weeks.push({ contributionDays: days })
  }

  // Spread any rounding remainder onto active days
  if (remaining > 0) {
    for (let w = 0; w < weeks.length && remaining > 0; w += 1) {
      for (let d = 0; d < weeks[w].contributionDays.length && remaining > 0; d += 1) {
        if (weeks[w].contributionDays[d].contributionCount > 0 || totalContributions > 0) {
          const add = Math.min(remaining, 3)
          weeks[w].contributionDays[d].contributionCount += add
          remaining -= add
        }
      }
    }
  }

  const commits = Math.round(totalContributions * 0.82)
  const pullRequests = Math.round(totalContributions * 0.12)
  const issues = Math.max(0, totalContributions - commits - pullRequests)

  return {
    periodYear: STANDARD_CONTRIBUTION_YEAR,
    totalContributions,
    commits,
    pullRequests,
    issues,
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
}> = [
  {
    id: 'creator-ufc',
    username: 'SaraMag25',
    name: 'Sara Magalhães',
    contributions: 540,
    isCreatorSpecial: true,
    customMessage:
      'Estou cursando Engenharia da Computação na UFC e criei esta floresta para celebrarmos código aberto e Natal juntos!',
    gifts: [
      {
        id: 'tg-1',
        gift_id: 'gift-star',
        gift_slug: 'golden-star',
        gift_name: 'Estrela Dourada',
        category: 'special',
        rarity: 'legendary',
        sender_name: 'Comunidade UFC',
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
  },
  {
    id: 'dev-9',
    username: 'julia-mobile',
    name: 'Júlia Ferreira',
    contributions: 148,
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
  const targetCommunityCount = Math.min(220, Math.max(12, totalPlots - 12))

  // Place featured developers across normal distributed plots (no central privilege)
  FEATURED_DEVS.forEach((dev, idx) => {
    const plotIdx = (idx * 11 + 5) % targetCommunityCount
    const slot = CURATED_TREE_PLOTS[plotIdx]
    trees.push(
      buildMockTree({
        ...dev,
        gridX: slot.gridX,
        gridY: slot.gridY,
      }),
    )
  })

  const usedPlotIndices = new Set(FEATURED_DEVS.map((_, idx) => (idx * 11 + 5) % targetCommunityCount))

  // Fill remaining plots with varied GitHub developers to form a dense Git-City forest
  let procIdx = 0
  for (let p = 0; p < targetCommunityCount; p += 1) {
    if (usedPlotIndices.has(p)) continue
    const slot = CURATED_TREE_PLOTS[p]
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

export const MOCK_TREE_MESSAGES: readonly TreeMessage[] = [
  {
    id: 'msg-1',
    tree_id: 'creator-ufc',
    sender_name: 'Carlos Eduardo',
    message: 'Que projeto lindo, Sara! Sucesso na Engenharia da Computação na UFC!',
    created_at: '2026-11-20T09:15:00Z',
  },
  {
    id: 'msg-2',
    tree_id: 'creator-ufc',
    sender_name: 'Mariana Costa',
    message: 'Feliz Natal para toda a comunidade dev iluminando a floresta!',
    created_at: '2026-11-20T11:40:00Z',
  },
  {
    id: 'msg-3',
    tree_id: 'dev-1',
    sender_name: 'Rafael Lima',
    message: '842 commits este ano?! Essa copa está brilhando verde demais!',
    created_at: '2026-11-20T10:12:00Z',
  },
  {
    id: 'msg-4',
    tree_id: 'dev-2',
    sender_name: 'Beatriz Alves',
    message: 'Saudações natalinas de Fortaleza! Boas festas!',
    created_at: '2026-11-20T08:50:00Z',
  },
]

export function getMessagesByTreeId(treeId: string): TreeMessage[] {
  return MOCK_TREE_MESSAGES.filter((msg) => msg.tree_id === treeId)
}

const RARITY_WEIGHT: Record<GiftRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
}

export function computeTreeDecorationScore(tree: CityTree): number {
  const uniqueGiftTypes = new Set(tree.gifts.map((g) => g.gift_slug)).size
  const raritySum = tree.gifts.reduce((acc, gift) => acc + RARITY_WEIGHT[gift.rarity], 0)
  return tree.tree_level * 2 + uniqueGiftTypes * 3 + raritySum
}

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
