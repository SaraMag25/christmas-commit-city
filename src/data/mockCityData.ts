import { resolveTreeStage } from '../config/treeLevels'
import { CITY_MAP_CONFIG } from '../config/cityMapConfig'
import type {
  CityCommunityStats,
  CityTree,
  GiftItem,
  GiftRarity,
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
    custom_message: params.customMessage,
    is_creator_special: params.isCreatorSpecial,
    last_synced_at: '2026-11-20T12:00:00Z',
  }
}

export const MOCK_CITY_TREES: readonly CityTree[] = [
  buildMockTree({
    id: 'creator-ufc',
    username: 'SaraMag25',
    name: 'Sara Magalhães',
    contributions: 540,
    gridX: CITY_MAP_CONFIG.plazaCenter.gridX,
    gridY: CITY_MAP_CONFIG.plazaCenter.gridY,
    isCreatorSpecial: true,
    customMessage:
      'Estou cursando Engenharia da Computação na UFC e criei esta vila para celebrarmos código aberto e Natal juntos!',
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
  }),
  buildMockTree({
    id: 'dev-1',
    username: 'ada-lovelace',
    name: 'Ada L.',
    contributions: 642,
    gridX: 13,
    gridY: 11,
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
  }),
  buildMockTree({
    id: 'dev-2',
    username: 'carlos-fortaleza',
    name: 'Carlos Eduardo',
    contributions: 384,
    gridX: 23,
    gridY: 11,
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
  }),
  buildMockTree({
    id: 'dev-3',
    username: 'mariana-ux',
    name: 'Mariana Costa',
    contributions: 215,
    gridX: 13,
    gridY: 16,
    customMessage: 'Pixel art e café quente neste inverno.',
  }),
  buildMockTree({
    id: 'dev-4',
    username: 'lucas-embedded',
    name: 'Lucas Ribeiro',
    contributions: 84,
    gridX: 23,
    gridY: 16,
    customMessage: 'Piscando LEDs e luzes de Natal!',
  }),
  buildMockTree({
    id: 'dev-5',
    username: 'beatriz-py',
    name: 'Beatriz Alves',
    contributions: 36,
    gridX: 9,
    gridY: 10,
    customMessage: 'Treinando modelos e decorando pinheiros.',
  }),
  buildMockTree({
    id: 'dev-6',
    username: 'joao-rust',
    name: 'João Pedro',
    contributions: 7,
    gridX: 27,
    gridY: 10,
    customMessage: 'Primeiro projeto open-source do ano!',
  }),
  buildMockTree({
    id: 'dev-7',
    username: 'helena-caloura',
    name: 'Helena Nunes',
    contributions: 0,
    gridX: 15,
    gridY: 7,
    customMessage: 'Pronta para dar meu primeiro commit!',
  }),
  buildMockTree({
    id: 'dev-8',
    username: 'rafael-go',
    name: 'Rafael Lima',
    contributions: 478,
    gridX: 20,
    gridY: 7,
    customMessage: 'Quase nos 500 commits antes do Natal!',
  }),
  buildMockTree({
    id: 'dev-9',
    username: 'julia-mobile',
    name: 'Júlia Ferreira',
    contributions: 148,
    gridX: 10,
    gridY: 16,
  }),
  buildMockTree({
    id: 'dev-10',
    username: 'thiago-data',
    name: 'Thiago Rocha',
    contributions: 63,
    gridX: 26,
    gridY: 16,
  }),
  buildMockTree({
    id: 'dev-11',
    username: 'camila-web',
    name: 'Camila Duarte',
    contributions: 19,
    gridX: 20,
    gridY: 22,
  }),
]

export const MOCK_TREE_MESSAGES: readonly TreeMessage[] = [
  {
    id: 'msg-1',
    tree_id: 'creator-ufc',
    sender_name: 'Carlos Eduardo',
    message: 'Que projeto lindo, Sara! Sucesso na reta final da Engenharia de Computação na UFC!',
    created_at: '2026-11-20T09:15:00Z',
  },
  {
    id: 'msg-2',
    tree_id: 'creator-ufc',
    sender_name: 'Mariana Costa',
    message: 'Amei a vibe Stardew Valley natalina! Feliz Natal para toda a comunidade dev.',
    created_at: '2026-11-20T11:40:00Z',
  },
  {
    id: 'msg-3',
    tree_id: 'dev-1',
    sender_name: 'Rafael Lima',
    message: '642 commits este ano?! Essa árvore virou um farol na praça!',
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

export function getTreeByUsername(username: string): CityTree | undefined {
  const normalized = username.trim().toLowerCase()
  return MOCK_CITY_TREES.find(
    (tree) => tree.profile.github_username.toLowerCase() === normalized,
  )
}

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
