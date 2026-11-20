import type { PixCampaignConfig } from '../types/city'

export { STANDARD_CONTRIBUTION_YEAR } from './githubPeriod'

export const CREATOR_CAMPAIGN: PixCampaignConfig = {
  title: 'Campanha da Criadora — Rumo à Formatura na UFC',
  university: 'Universidade Federal do Ceará (UFC)',
  course: 'Engenharia da Computação',
  message:
    'Estou cursando Engenharia da Computação na Universidade Federal do Ceará e criei esta cidade natalina para compartilhar um pouco da magia do Natal. Se você quiser contribuir para me ajudar a chegar até a formatura, qualquer valor será muito bem-vindo. Obrigada por fazer parte dessa história!',
  pixKey: import.meta.env.VITE_PIX_KEY || 'configurar-chave-pix@ufc.br',
  recipientName: import.meta.env.VITE_PIX_RECIPIENT_NAME || 'Sara Magalhães',
  recipientCity: import.meta.env.VITE_PIX_RECIPIENT_CITY || 'Fortaleza',
  goalAmount: Number(import.meta.env.VITE_PIX_GOAL_AMOUNT || 5000),
  // Placeholder display amount for Phase 1 visual showcase (never auto-confirmed on click)
  raisedAmount: 0,
}
