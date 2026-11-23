import type { GiftItem, TreeGiftSummary } from '../types/city'

export const RETRO_PC_GIFT_ID = 'gift-retro-pc'
export const RETRO_PC_GIFT_SLUG = 'retro-pc'
export const LEGACY_SPECIAL_GIFT_ID = 'gift-crown'
export const LEGACY_SPECIAL_GIFT_SLUG = 'ufc-ornament'

export const GIFTS_CATALOG: readonly GiftItem[] = [
  {
    id: 'gift-star',
    slug: 'golden-star',
    name: 'Estrela Dourada',
    category: 'special',
    price: 3,
    priceUsd: 2,
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
    price: 7,
    priceUsd: 3,
    rarity: 'epic',
    description: 'Um ursinho com cachecol natalino colocado junto ao tronco.',
    accentColor: '#d97706',
  },
  {
    id: RETRO_PC_GIFT_ID,
    slug: RETRO_PC_GIFT_SLUG,
    name: 'PC Retrô',
    category: 'special',
    price: 5,
    priceUsd: 4,
    rarity: 'legendary',
    description:
      'Um computador clássico de tubo com teclado e mouse deixado debaixo da árvore para maratonas de código.',
    accentColor: '#4ade80',
  },
]

export function normalizeGiftSlug(slug: string): string {
  return slug === LEGACY_SPECIAL_GIFT_SLUG ? RETRO_PC_GIFT_SLUG : slug
}

export function normalizeTreeGiftSummary(gift: TreeGiftSummary): TreeGiftSummary {
  if (
    gift.gift_slug === LEGACY_SPECIAL_GIFT_SLUG ||
    gift.gift_id === LEGACY_SPECIAL_GIFT_ID
  ) {
    return {
      ...gift,
      gift_id: RETRO_PC_GIFT_ID,
      gift_slug: RETRO_PC_GIFT_SLUG,
      gift_name: 'PC Retrô',
      rarity: 'legendary',
    }
  }
  return gift
}

export function resolveGiftUsdPrice(gift: GiftItem): number {
  return gift.priceUsd ?? Math.max(1, Math.round((gift.price / 5) * 100) / 100)
}
