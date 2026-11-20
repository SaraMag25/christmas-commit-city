import type { TreeStageConfig } from '../types/city'

/**
 * Configurable contribution thresholds for each Christmas tree stage.
 * Changing these values updates both the visual city renderer and UI badges.
 */
export const TREE_STAGES: readonly TreeStageConfig[] = [
  {
    level: 0,
    slug: 'seedling',
    name: 'Pequeno Pinheiro',
    minContributions: 0,
    maxContributions: 0,
    badgeLabel: '0 commits',
    description: 'Um brotinho recém-plantado na neve, pronto para o primeiro commit.',
    visualFeatures: ['Pinheiro jovem', 'Toque de neve fresca'],
    accentColor: '#94a3b8',
    hasLights: false,
    hasStar: false,
    hasAura: false,
  },
  {
    level: 1,
    slug: 'small',
    name: 'Árvore Pequena',
    minContributions: 1,
    maxContributions: 10,
    badgeLabel: '1–10 commits',
    description: 'Os primeiros commits deram forma aos galhos iniciais.',
    visualFeatures: ['2 camadas de galhos', 'Copa verde-pinheiro'],
    accentColor: '#34d399',
    hasLights: false,
    hasStar: false,
    hasAura: false,
  },
  {
    level: 2,
    slug: 'medium',
    name: 'Árvore Média',
    minContributions: 11,
    maxContributions: 50,
    badgeLabel: '11–50 commits',
    description: 'Ganha corpo, galhos simétricos e os primeiros enfeites vermelhos.',
    visualFeatures: ['3 camadas de galhos', 'Primeiras bolas natalinas'],
    accentColor: '#22c55e',
    hasLights: false,
    hasStar: false,
    hasAura: false,
  },
  {
    level: 3,
    slug: 'decorated',
    name: 'Árvore Decorada',
    minContributions: 51,
    maxContributions: 100,
    badgeLabel: '51–100 commits',
    description: 'Enfeitada com guirlanda festiva e bolas douradas e carmesim.',
    visualFeatures: ['4 camadas de galhos', 'Guirlanda e bolas coloridas'],
    accentColor: '#f87171',
    hasLights: false,
    hasStar: false,
    hasAura: false,
  },
  {
    level: 4,
    slug: 'illuminated',
    name: 'Árvore Iluminada',
    minContributions: 101,
    maxContributions: 300,
    badgeLabel: '101–300 commits',
    description: 'Pisca-piscas quentes acendem a vila durante a noite de inverno.',
    visualFeatures: ['Luzes cintilantes', 'Topo com ponta dourada'],
    accentColor: '#fbbf24',
    hasLights: true,
    hasStar: false,
    hasAura: false,
  },
  {
    level: 5,
    slug: 'grand',
    name: 'Árvore Grande',
    minContributions: 301,
    maxContributions: 500,
    badgeLabel: '301–500 commits',
    description: 'Imponente e luminosa, com estrela no topo e presentes ao pé do tronco.',
    visualFeatures: ['5 camadas densas', 'Estrela dourada', 'Presentes na base'],
    accentColor: '#f59e0b',
    hasLights: true,
    hasStar: true,
    hasAura: false,
  },
  {
    level: 6,
    slug: 'special',
    name: 'Árvore Especial',
    minContributions: 501,
    maxContributions: null,
    badgeLabel: '500+ commits',
    description: 'Marco lendário da comunidade, irradiando aura dourada sobre a praça.',
    visualFeatures: ['Copa máxima', 'Aura luminosa', 'Estrela radiante e presentes'],
    accentColor: '#fde047',
    hasLights: true,
    hasStar: true,
    hasAura: true,
  },
] as const

export function resolveTreeStage(contributionCount: number): TreeStageConfig {
  const safeCount = Math.max(0, Math.floor(contributionCount))
  for (let i = TREE_STAGES.length - 1; i >= 0; i -= 1) {
    if (safeCount >= TREE_STAGES[i].minContributions) {
      return TREE_STAGES[i]
    }
  }
  return TREE_STAGES[0]
}
