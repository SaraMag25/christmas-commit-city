import type {
  AccessorySlot,
  CompanionAccessoryId,
  CompanionAccessoryItem,
  CompanionSpeciesId,
  CompanionSpeciesItem,
  EquippedAccessories,
  UserCompanionLoadout,
} from '../types/companion'

export const COMPANION_NAME_MAX_LENGTH = 20

export const EMPTY_EQUIPPED_ACCESSORIES: EquippedAccessories = {
  head: null,
  body: null,
  hand: null,
}

export const COMPANION_SPECIES_CATALOG: readonly CompanionSpeciesItem[] = [
  {
    id: 'frog',
    defaultName: 'Bento',
    name: 'Sapo Verde',
    subtitle: 'Guardião do Brejo Nevado',
    description: 'Sapo compacto e simpático que adora acompanhar deploys noturnos.',
    story:
      'Um sapinho aprendiz de magia que trocou o brejo pela neve. Acredita firmemente que um bom feitiço — e um git rebase bem feito — resolve qualquer bug de inverno.',
    priceCommits: 250,
    priceBrl: 4.0,
    priceUsd: 2.0,
    primaryColor: '#16a34a',
    accentColor: '#4ade80',
  },
  {
    id: 'snake',
    defaultName: 'Pip',
    name: 'Cobra Python',
    subtitle: 'Ambiente Virtual Quentinho',
    description: 'Cobrinha azul e amarela enrolada que adora indentação perfeita.',
    story:
      'Uma cobrinha enrolada que adora código limpo, indentação perfeita e ambientes virtuais quentinhos. Dizem que um único `import natal` dela já ilumina metade da floresta.',
    priceCommits: 300,
    priceBrl: 4.0,
    priceUsd: 2.0,
    primaryColor: '#3776ab',
    accentColor: '#ffd43b',
  },
  {
    id: 'mouse',
    defaultName: 'Tico',
    name: 'Ratinho Polar',
    subtitle: 'Orelhas Grandes & Olhos Atentos',
    description: 'Ratinho azul-esverdeado super ágil para caçar bugs na neve.',
    story:
      'Um pequeno detetive polar de orelhas atentas e faro apurado para queijo e memory leaks. Guarda cada commit do ano como se fosse um tesouro escondido na neve.',
    priceCommits: 350,
    priceBrl: 5.0,
    priceUsd: 2.5,
    primaryColor: '#0d9488',
    accentColor: '#5eead4',
  },
  {
    id: 'otter',
    defaultName: 'Lola',
    name: 'Lontra Marrom',
    subtitle: 'Exploradora do Rio Gelado',
    description: 'Lontra marrom de barriga clarinha pronta para deslizar no gelo.',
    story:
      'A exploradora destemida do rio gelado. Atravessa a nevasca sob a aurora boreal para iluminar o caminho de devs perdidos em conflitos de merge.',
    priceCommits: 400,
    priceBrl: 5.0,
    priceUsd: 2.5,
    primaryColor: '#8c5835',
    accentColor: '#fde68a',
  },
  {
    id: 'capybara',
    defaultName: 'Cacau',
    name: 'Capivara Fofa',
    subtitle: 'Mestre da Calma em Produção',
    description: 'Capivara serena que mantém a paz mesmo nos merges de sexta-feira.',
    story:
      'A mestre suprema da serenidade em produção. Observa a neve cair com calma inabalável e lembra todo mundo de respirar fundo antes do deploy de sexta-feira.',
    priceCommits: 450,
    priceBrl: 6.0,
    priceUsd: 3.0,
    primaryColor: '#8c5835',
    accentColor: '#d97706',
  },
  {
    id: 'cat',
    defaultName: 'Maria',
    name: 'Gata Cinza Rajada',
    subtitle: 'Pelagem em Tons de Cinza & Listras',
    description: 'Gatinha rajada em vários tons de cinza, com listras chumbo e bigodes brancos.',
    story:
      'A guardiã felina mais curiosa do Polo Norte. Passa as noites caçando peixinhos no lago congelado e tirando cochilos em cima do teclado quente enquanto os commits sobem.',
    priceCommits: 500,
    priceBrl: 6.0,
    priceUsd: 3.0,
    primaryColor: '#64748b',
    accentColor: '#cbd5e1',
  },
] as const

export const COMPANION_ACCESSORIES_CATALOG: readonly CompanionAccessoryItem[] = [
  // Básicos (80–100 commits | R$ 1,50 | $1.00)
  {
    id: 'leaf-scarf',
    slot: 'body',
    name: 'Cachecol de Folhas Verdes',
    description: 'Golinha aconchegante entrelaçada com folhas pinho e broto dourado.',
    priceCommits: 80,
    priceBrl: 1.5,
    priceUsd: 1.0,
    accentColor: '#34d399',
  },
  {
    id: 'cheese-wedge',
    slot: 'hand',
    name: 'Pedaço de Queijo',
    description: 'Fatia dourada cheia de furinhos para lanches de madrugada.',
    priceCommits: 90,
    priceBrl: 1.5,
    priceUsd: 1.0,
    accentColor: '#facc15',
  },
  {
    id: 'white-fish',
    slot: 'hand',
    name: 'Peixinho Branco',
    description: 'Peixinho fresquinho pescado no lago congelado, o favorito da Maria.',
    priceCommits: 95,
    priceBrl: 1.5,
    priceUsd: 1.0,
    accentColor: '#bae6fd',
  },
  {
    id: 'santa-hat',
    slot: 'head',
    name: 'Gorro Natalino',
    description: 'Clássico gorro vermelho do Polo Norte com barra fofa e pompom branco.',
    priceCommits: 100,
    priceBrl: 1.5,
    priceUsd: 1.0,
    accentColor: '#ef4444',
  },

  // Intermediários (120–170 commits | R$ 2,00 | $1.50)
  {
    id: 'round-glasses',
    slot: 'body',
    name: 'Óculos Redondos Grandes',
    description: 'Armação clássica de dev com lentes azul-gelo cintilantes.',
    priceCommits: 120,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#38bdf8',
  },
  {
    id: 'strawberry-hat',
    slot: 'head',
    name: 'Touca de Morango',
    description: 'Gorrinho tricotado vermelho com sementinhas e folha verde no topo.',
    priceCommits: 130,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#fb7185',
  },
  {
    id: 'leaf-umbrella',
    slot: 'head',
    name: 'Folha Guarda-Chuva',
    description: 'Folha ampla verde que protege da neve caindo na floresta.',
    priceCommits: 140,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#4ade80',
  },
  {
    id: 'binary_sweater',
    slot: 'body',
    name: 'Suéter Binário 01 + Crachá',
    description:
      'Suéter natalino de programador estampado com `0` e `1` na barriga e crachá de evento tech pendurado.',
    priceCommits: 140,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#fbbf24',
  },
  {
    id: 'coffee-mug',
    slot: 'hand',
    name: 'Caneca de Café Quente',
    description: 'Caneca quentinha soltando vapor contínuo enquanto compila.',
    priceCommits: 150,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#fbbf24',
  },
  {
    id: 'rubber_duck',
    slot: 'head',
    name: 'Patinho de Debug',
    description:
      'Mini patinho de borracha amarelo equilibrado na cabeça — o melhor ouvinte para resolver qualquer bug.',
    priceCommits: 150,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#facc15',
  },
  {
    id: 'dev_hoodie',
    slot: 'body',
    name: 'Moletom Dev >_',
    description: 'Moletom grafite de madrugada de código com capuz fofo e estampa terminal em verde neon.',
    priceCommits: 160,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#39d353',
  },
  {
    id: 'mechanical_keyboard',
    slot: 'hand',
    name: 'Teclado Mecânico RGB',
    description: 'Teclado mecânico 60% compacto com switches táteis e fileira RGB brilhando a cada commit.',
    priceCommits: 160,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#c084fc',
  },
  {
    id: 'dev_headset',
    slot: 'head',
    name: 'Headset Dev RGB',
    description:
      'Fones over-ear com microfone ajustável e LEDs neon para virar a madrugada em pair programming.',
    priceCommits: 170,
    priceBrl: 2.0,
    priceUsd: 1.5,
    accentColor: '#38bdf8',
  },

  // Especiais (180–220 commits | R$ 3,00 | $2.00)
  {
    id: 'mini_laptop',
    slot: 'hand',
    name: 'Notebook de Código',
    description: 'Mini laptop aberto com tela brilhando em código verde neon para fazer deploy na neve.',
    priceCommits: 180,
    priceBrl: 3.0,
    priceUsd: 2.0,
    accentColor: '#39d353',
  },
  {
    id: 'wizard-cloak',
    slot: 'body',
    name: 'Capa Roxa de Mago',
    description: 'Manto roxo estrelado preso no pescoço com broche dourado.',
    priceCommits: 180,
    priceBrl: 3.0,
    priceUsd: 2.0,
    accentColor: '#c084fc',
  },
  {
    id: 'wizard-hat',
    slot: 'head',
    name: 'Chapéu de Mago Roxo',
    description: 'Chapéu pontudo roxo com faixa e fivela dourada arcana.',
    priceCommits: 200,
    priceBrl: 3.0,
    priceUsd: 2.0,
    accentColor: '#a855f7',
  },
  {
    id: 'golden-butterfly',
    slot: 'head',
    name: 'Borboleta Dourada',
    description: 'Borboleta dourada emissiva flutuando suavemente ao lado da orelha.',
    priceCommits: 200,
    priceBrl: 3.0,
    priceUsd: 2.0,
    accentColor: '#fde047',
  },
  {
    id: 'code_visor',
    slot: 'body',
    name: 'Visor de Código Neon',
    description:
      'Visor holográfico translúcido que projeta logs e linhas de código direto nos olhos do seu amigo.',
    priceCommits: 210,
    priceBrl: 3.0,
    priceUsd: 2.0,
    accentColor: '#39d353',
  },
  {
    id: 'glow-lantern',
    slot: 'hand',
    name: 'Lanterna Brilhante',
    description: 'Lanterna portátil com chama dourada emissiva para guiar no inverno.',
    priceCommits: 220,
    priceBrl: 3.0,
    priceUsd: 2.0,
    accentColor: '#fde047',
  },
  {
    id: 'snow_globe',
    slot: 'head',
    name: 'Globo de Neve Natalino',
    description: 'Mini globo de vidro com um bonequinho de neve de cachecol vermelho e flocos caindo lá dentro.',
    priceCommits: 220,
    priceBrl: 3.0,
    priceUsd: 2.0,
    accentColor: '#bae6fd',
  },
] as const

export const ACCESSORY_SLOT_LABELS: Record<AccessorySlot, string> = {
  head: 'Cabeça',
  body: 'Rosto / Corpo',
  hand: 'Item',
}

export function getSpeciesById(id: CompanionSpeciesId | null | undefined): CompanionSpeciesItem | null {
  if (!id) return null
  return COMPANION_SPECIES_CATALOG.find((s) => s.id === id) ?? null
}

export function getAccessoryById(
  id: CompanionAccessoryId | null | undefined,
): CompanionAccessoryItem | null {
  if (!id) return null
  return COMPANION_ACCESSORIES_CATALOG.find((a) => a.id === id) ?? null
}

export function sanitizeCompanionName(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  const withoutControls = Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  const cleaned = withoutControls
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, COMPANION_NAME_MAX_LENGTH)
  return cleaned.length > 0 ? cleaned : undefined
}

export function resolveCompanionDisplayName(
  speciesId: CompanionSpeciesId,
  customName?: string,
  localizedDefaultName?: string,
): string {
  const sanitized = sanitizeCompanionName(customName)
  if (sanitized) return sanitized
  if (localizedDefaultName) return localizedDefaultName
  return getSpeciesById(speciesId)?.defaultName ?? speciesId
}

export const DEFAULT_EMPTY_LOADOUT: UserCompanionLoadout = {
  species: null,
  customName: undefined,
  equipped: EMPTY_EQUIPPED_ACCESSORIES,
  unlockedSpecies: [],
  unlockedAccessories: [],
  spentCommits: 0,
  supporterBundleUnlocked: false,
  unlockedViaPixIds: [],
  transactions: [],
  updatedAt: '2026-11-20T00:00:00.000Z',
}

export function createEmptyCompanionLoadout(): UserCompanionLoadout {
  return {
    ...DEFAULT_EMPTY_LOADOUT,
    equipped: { ...EMPTY_EQUIPPED_ACCESSORIES },
    unlockedSpecies: [],
    unlockedAccessories: [],
    unlockedViaPixIds: [],
    transactions: [],
    updatedAt: new Date().toISOString(),
  }
}

export function computeAvailableCommits(totalCommits: number, spentCommits: number): number {
  return Math.max(0, Math.floor(totalCommits) - Math.max(0, Math.floor(spentCommits)))
}
