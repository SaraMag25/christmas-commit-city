import type { PixCampaignConfig } from '../types/city'
import type { SupportCurrency, SupporterBundleConfig } from '../types/companion'
import { toSafeHttpUrl } from '../utils/urlSafety'

export { STANDARD_CONTRIBUTION_YEAR } from './githubPeriod'

const PT_CAMPAIGN_PARAGRAPHS = [
  'Apoie a criadora nos seus estudos. Qualquer valor é bem recebido!',
] as const

const EN_CAMPAIGN_PARAGRAPHS = [
  'Support the creator in her studies. Any amount is welcome!',
] as const

export const CREATOR_CAMPAIGN: PixCampaignConfig = {
  title: 'Apoie a Criadora · UFC',
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
  title: 'Support the Creator · UFC',
  university: 'Federal University of Ceará (UFC), Brazil',
  course: 'Computer Engineering',
  paragraphs: EN_CAMPAIGN_PARAGRAPHS,
  message: EN_CAMPAIGN_PARAGRAPHS.join('\n\n'),
} as const

export const SUPPORTER_BUNDLE: SupporterBundleConfig = {
  id: 'supporter-bundle',
  priceBrl: 15.0,
  priceUsd: 7.0,
}

export function getInternationalCheckoutUrl(): string | null {
  const candidates = [
    import.meta.env.VITE_SUPPORT_USD_URL,
    import.meta.env.VITE_KOFI_URL,
    import.meta.env.VITE_STRIPE_CHECKOUT_URL,
  ]
  for (const candidate of candidates) {
    const safeUrl = toSafeHttpUrl(candidate)
    if (safeUrl) return safeUrl
  }
  return null
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
