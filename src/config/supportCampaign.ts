import type { PixCampaignConfig } from '../types/city'
import type { SupportCurrency, SupporterBundleConfig } from '../types/companion'

export { STANDARD_CONTRIBUTION_YEAR } from './githubPeriod'

const PT_CAMPAIGN_PARAGRAPHS = [
  'Oii! Meu nome é Sara e atualmente eu curso Engenharia da Computação na UFC. Às vezes eu até penso se não foi um erro (talvez seja mesmo), mas o que mais me faz pensar nisso é lembrar de quando precisei sair de onde eu moro para estudar, ir para uma cidade desconhecida e recomeçar a vida do zero. É paia, eu sei kkkk.',
  'Eu sinto muita falta da minha casa e, principalmente, de não ter que arcar com toda a vida adulta. Hoje eu vivo de bolsas da UFC, então, se você quiser ajudar essa pobre coitada, nem que seja com 1 real, eu aceito!',
  'Mas, se não puder contribuir agora, tudo bem também, meu mano! Você já ajuda muito de outras formas, tipo compartilhando o projeto.',
  'Enfim, muito obrigada mesmo por estar lendo isso e mais ainda por estar usando o meu site. Xero no coração e que você seja muito feliz! ❤️',
] as const

const EN_CAMPAIGN_PARAGRAPHS = [
  "Hii! My name is Sara and I'm currently studying Computer Engineering at UFC (Brazil). Sometimes I wonder if it wasn't a mistake (maybe it really was), and what makes me think about it most is remembering how I had to leave my hometown to study in an unfamiliar city and rebuild a life from scratch. Rough, I know haha.",
  "I really miss home and, above all, not having to deal with full adulting expenses. Right now I live off university scholarships at UFC, so if you'd like to help this poor soul out, even $1 is happily accepted!",
  "And if you can't chip in right now, that's totally fine too, my friend! You can still help a ton in other ways, like sharing the project.",
  'Anyway, thank you so much for reading this and even more for actually using my website. Lots of love and I truly wish you happiness! ❤️',
] as const

export const CREATOR_CAMPAIGN: PixCampaignConfig = {
  title: 'Campanha da Criadora: Rumo à Formatura na UFC',
  university: 'Universidade Federal do Ceará (UFC)',
  course: 'Engenharia da Computação',
  paragraphs: PT_CAMPAIGN_PARAGRAPHS,
  message: PT_CAMPAIGN_PARAGRAPHS.join('\n\n'),
  pixKey:
    import.meta.env.VITE_PIX_KEY?.trim() || '864ddb09-dc5f-43bd-8012-c7387964e00b',
  pixBrCode:
    import.meta.env.VITE_PIX_BR_CODE?.trim() ||
    '00020101021126580014br.gov.bcb.pix0136864ddb09-dc5f-43bd-8012-c7387964e00b5204000053039865802BR5919SARA DE S MAGALHAES6008AMONTADA62070503***63043E9F',
  pixQrImageUrl: '/images/pix-support-qr.png',
  recipientName: import.meta.env.VITE_PIX_RECIPIENT_NAME?.trim() || 'SARA DE S MAGALHAES',
  recipientCity: import.meta.env.VITE_PIX_RECIPIENT_CITY?.trim() || 'AMONTADA',
  goalAmount: Number(import.meta.env.VITE_PIX_GOAL_AMOUNT || 5000),
  // Placeholder display amount for Phase 1 visual showcase (never auto-confirmed on click)
  raisedAmount: 0,
}

export const CREATOR_CAMPAIGN_EN = {
  title: "Creator's Campaign: Road to Graduation at UFC",
  university: 'Federal University of Ceará (UFC), Brazil',
  course: 'Computer Engineering',
  paragraphs: EN_CAMPAIGN_PARAGRAPHS,
  message: EN_CAMPAIGN_PARAGRAPHS.join('\n\n'),
} as const

export const SUPPORTER_BUNDLE: SupporterBundleConfig = {
  id: 'supporter-bundle',
  priceBrl: 10.0,
  priceUsd: 7.0,
}

export function getInternationalCheckoutUrl(): string | null {
  const raw =
    import.meta.env.VITE_STRIPE_CHECKOUT_URL?.trim() ||
    import.meta.env.VITE_KOFI_URL?.trim() ||
    import.meta.env.VITE_SUPPORT_USD_URL?.trim() ||
    ''
  return raw.length > 0 ? raw : null
}

export function formatBrlPrice(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

export function formatUsdPrice(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

export function formatCurrencyPrice(amount: number, currency: SupportCurrency): string {
  return currency === 'BRL' ? formatBrlPrice(amount) : formatUsdPrice(amount)
}

export interface CompanionSupportPreview {
  currency: SupportCurrency
  provider: 'pix' | 'international'
  recipientName: string
  recipientCity: string
  pixKey: string
  checkoutUrl: string | null
  amount: number
  externalReference: string
}

export function buildCompanionSupportPreview(
  itemLabel: string,
  amount: number,
  currency: SupportCurrency,
  username: string,
): CompanionSupportPreview {
  const safeUser = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 14) || 'dev'
  const safeItem = itemLabel.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 14) || 'item'
  return {
    currency,
    provider: currency === 'BRL' ? 'pix' : 'international',
    recipientName: CREATOR_CAMPAIGN.recipientName,
    recipientCity: CREATOR_CAMPAIGN.recipientCity,
    pixKey: CREATOR_CAMPAIGN.pixKey,
    checkoutUrl: getInternationalCheckoutUrl(),
    amount,
    externalReference: `CCC-${currency}-${safeUser}-${safeItem}`.toUpperCase(),
  }
}

export function buildCompanionPixPreview(
  itemLabel: string,
  amountBrl: number,
  username: string,
) {
  const preview = buildCompanionSupportPreview(itemLabel, amountBrl, 'BRL', username)
  return {
    recipientName: preview.recipientName,
    recipientCity: preview.recipientCity,
    pixKey: preview.pixKey,
    amountBrl: preview.amount,
    referenceLabel: preview.externalReference,
  }
}
