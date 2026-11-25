export const CITY_PALETTE = {
  nightBg: '#0a1633',
  nightMid: '#12244a',
  nightSkyNum: 0x0a1633,
  // Deep bluish-spruce foliage so GitHub green commit baubles pop cleanly
  pineDark: '#061c24',
  pineMid: '#0b2d37',
  pineBright: '#134652',
  cranberry: '#dc2626',
  cranberryBright: '#ef4444',
  gold: '#f59e0b',
  goldBright: '#fde047',
  // Organic North Pole snow & ice palette
  snow: '#f4f8ff',
  snowIce: '#e1ecfe',
  snowShadow: '#cad9f4',
  snowIndigo: '#9eb3db',
  snowTrail: '#d4e2fa',
  waterVivid: '#1d9bf0',
  iceVivid: '#7dd3fc',
  iceHighlight: '#bae6fd',
  trailStone: '#7c5334',
  trailHighlight: '#9c6644',
  poleRed: '#dc2626',
  poleWhite: '#f8fafc',
  warmGlow: '#ffbe55',
  warmEmber: '#ff9b3d',
  warmHighlight: '#ffd98e',
  woodDark: '#4a2a14',
  woodMid: '#7c4d2b',
  woodLight: '#a97149',
} as const

export const WORLD_TILE_SIZE = 3.2

/** Maximum radial reach of typical tree foliage radius in forest clusters */
export const TREE_CANOPY_CLEARANCE = 2.52
/** Front-right companion offset & footprint allowance outside lowest boughs */
export const COMPANION_BREATHING_ALLOWANCE = 2.24
/** Visual snow margin keeping every pet and gift clearly visible from overview camera */
export const COMPACT_FOREST_MARGIN = 0.84

/**
 * Balanced mandatory Euclidean spacing between ANY two trees in world units (exact 30% tighter than 8.0u):
 * 2.52 + 2.24 + 0.84 = 5.60 world units (1.75 grid tiles), keeping forest lush while guaranteeing pet visibility.
 */
export const MIN_TREE_SPACING =
  TREE_CANOPY_CLEARANCE + COMPANION_BREATHING_ALLOWANCE + COMPACT_FOREST_MARGIN // 5.60

/** Equivalent mandatory minimum Euclidean spacing in city grid tiles (5.60 / 3.2 = 1.75 tiles) */
export const MIN_TREE_SPACING_GRID = MIN_TREE_SPACING / WORLD_TILE_SIZE

/** Offset shifting the core 48x36 North Pole village into the 58x44 balanced woodland */
export const VILLAGE_OFFSET_X = 5
export const VILLAGE_OFFSET_Y = 4

export const CITY_MAP_CONFIG = {
  /** Base tile dimension in pixel-art texels */
  tileTexels: 16,
  /** Integer pixel scale factor applied when rendering tiles and sprites */
  pixelScale: 3,
  /** Final world tile size in pixels (16 * 3 = 48px) */
  get tileSize(): number {
    return this.tileTexels * this.pixelScale
  },
  /** Compact 58x44 grid keeping 380 community trees lush with open 30-degree pockets for every pet */
  cols: 58,
  rows: 44,
  /** North Pole center landmark coordinates for default camera framing */
  plazaCenter: {
    gridX: 24 + VILLAGE_OFFSET_X,
    gridY: 18 + VILLAGE_OFFSET_Y,
  },
  /** Extra sky band above the northern tree line for starry night atmosphere */
  skyRows: 2,
} as const

/**
 * Coordinates & snug reserved clearings for North Pole landmarks across the 58x44 map.
 * Single-sourced so terrain, paths, organic tree distribution, and 3D builders stay synchronized.
 */
export const NORTH_POLE_LANDMARKS = {
  santaTreehouse: {
    gridX: 28 + VILLAGE_OFFSET_X,
    gridY: 13 + VILLAGE_OFFSET_Y,
    centerGridX: 29.2 + VILLAGE_OFFSET_X,
    centerGridY: 14.2 + VILLAGE_OFFSET_Y,
    padX: 2.75,
    padY: 2.55,
  },
  crystalTower: {
    gridX: 5 + VILLAGE_OFFSET_X,
    gridY: 20 + VILLAGE_OFFSET_Y,
    centerGridX: 6.2 + VILLAGE_OFFSET_X,
    centerGridY: 21.2 + VILLAGE_OFFSET_Y,
    padX: 1.85,
    padY: 1.85,
  },
  elvenPavilion: {
    gridX: 38 + VILLAGE_OFFSET_X,
    gridY: 29 + VILLAGE_OFFSET_Y,
    centerGridX: 39.2 + VILLAGE_OFFSET_X,
    centerGridY: 30.2 + VILLAGE_OFFSET_Y,
    padX: 1.75,
    padY: 1.75,
  },
  marketStall: {
    gridX: 23.5 + VILLAGE_OFFSET_X,
    gridY: 14.0 + VILLAGE_OFFSET_Y,
    padX: 1.55,
    padY: 1.4,
  },
  mushroomHouses: [
    {
      gridX: 15.4 + VILLAGE_OFFSET_X,
      gridY: 21.5 + VILLAGE_OFFSET_Y,
      capTheme: 'spruce' as const,
      scale: 1.0,
      rotationY: 0.28,
      dialogueKey: 'bento' as const,
    },
    {
      gridX: 35.6 + VILLAGE_OFFSET_X,
      gridY: 17.8 + VILLAGE_OFFSET_Y,
      capTheme: 'crimson' as const,
      scale: 1.04,
      rotationY: -0.45,
      dialogueKey: 'cocoa' as const,
    },
    {
      gridX: 4.0 + VILLAGE_OFFSET_X,
      gridY: 13.8 + VILLAGE_OFFSET_Y,
      capTheme: 'crimson' as const,
      scale: 0.98,
      rotationY: 0.45,
      dialogueKey: 'refuge' as const,
    },
    {
      gridX: 27.5 + VILLAGE_OFFSET_X,
      gridY: 29.8 + VILLAGE_OFFSET_Y,
      capTheme: 'spruce' as const,
      scale: 1.02,
      rotationY: -0.22,
      dialogueKey: 'cafe' as const,
    },
  ],
} as const

export interface OuterChaletPlacement {
  id: string
  gridX: number
  gridY: number
  rotationY: number
  roofTheme: 'spruce' | 'crimson'
  variant?: 'chalet' | 'fisherman' | 'stall'
  title: string
  text: string
  titleEn: string
  textEn: string
}

export interface OuterWatchtowerPlacement {
  id: string
  gridX: number
  gridY: number
  rotationY: number
  beaconColor: string
  title: string
  text: string
  titleEn: string
  textEn: string
}

export interface OuterWoodlandPropPlacement {
  gridX: number
  gridY: number
  type: 'lamp' | 'campfire' | 'snowman' | 'signpost' | 'igloo'
}

export interface OuterIglooPlacement {
  id: string
  gridX: number
  gridY: number
  rotationY: number
  accent?: 'lantern' | 'campfire' | 'snowman' | 'snowpile'
  title: string
  text: string
  titleEn: string
  textEn: string
}

/**
 * Cozy outer neighborhood chalets, lakeside fisherman cabins & woodland cocoa stalls
 * distributed across the expanded continent regions, 6 scenic lakes & both islands.
 */
export const OUTER_NEIGHBORHOOD_CHALETS: readonly OuterChaletPlacement[] = [
  // Lago da Vila (just SW of Vila Central)
  {
    id: 'fisherman-vila',
    gridX: 15.38,
    gridY: 37.75,
    rotationY: -1.35,
    roofTheme: 'spruce',
    variant: 'fisherman',
    title: 'Cabana do Lago da Vila',
    text: 'Abrigo de pesca à beira do Lago da Vila, com redes penduradas, píer de madeira e lanterna quente.',
    titleEn: 'Village Lake Fisherman Cabin',
    textEn: 'A riverside timber angler hut beside Village Frost Lake with a warm lantern and frost dock.',
  },
  // Bosque Aurora
  {
    id: 'chalet-aurora',
    gridX: -33.38,
    gridY: -22.88,
    rotationY: 0.48,
    roofTheme: 'spruce',
    title: 'Chalé do Bosque Aurora',
    text: 'Cabana acolhedora no coração do Bosque Aurora, cercada por pinheiros nevados, raposas e cogumelos vermelhos.',
    titleEn: 'Aurora Woods Chalet',
    textEn: 'A cozy timber lodge in the heart of Aurora Woods, framed by snowy pines and polka-dot toadstools.',
  },
  {
    id: 'fisherman-aurora',
    gridX: -39.63,
    gridY: -14.75,
    rotationY: -1.42,
    roofTheme: 'spruce',
    variant: 'fisherman',
    title: 'Cabana do Lago da Aurora',
    text: 'Pequena casa de pescador junto ao píer do Lago da Aurora, observando os reflexos da aurora na água gelada.',
    titleEn: 'Aurora Lake Angler Cabin',
    textEn: 'A quiet timber fishing hut beside Aurora Mirror Lake overlooking the ice-blue cove.',
  },
  {
    id: 'stall-aurora',
    gridX: -40.88,
    gridY: -21.63,
    rotationY: 0.72,
    roofTheme: 'crimson',
    variant: 'stall',
    title: 'Barraca de Chocolate Quente · Aurora',
    text: 'Quiosque natalino no meio da floresta servindo chocolate quente e biscoitos para quem explora o oeste.',
    titleEn: 'Aurora Hot Cocoa Kiosk',
    textEn: 'A woodland holiday cocoa stand keeping explorers warm along the Aurora mirror trails.',
  },
  {
    id: 'chalet-aurora-cove',
    gridX: -59.63,
    gridY: 12.75,
    rotationY: 1.08,
    roofTheme: 'crimson',
    title: 'Refúgio da Enseada Oeste',
    text: 'Abrigo quentinho perto do litoral oeste e dos canais que seguem para a ponte sul.',
    titleEn: 'Western Cove Refuge',
    textEn: 'A warm shelter perched near the western shore and icy coastal sea coves.',
  },
  // Southwest Mainland Woods
  {
    id: 'chalet-sw-woods',
    gridX: -24.0,
    gridY: 55.25,
    rotationY: 0.62,
    roofTheme: 'spruce',
    title: 'Cabana dos Pinheiros do Sul',
    text: 'Clareira silenciosa entre pinheiros altos no caminho entre a Vila Central e a Ilha Cristalina.',
    titleEn: 'Southern Pines Cabin',
    textEn: 'A peaceful clearing lodge halfway between Central Village and Crystal Isle.',
  },
  // Vale dos Commits
  {
    id: 'chalet-vale',
    gridX: 99.13,
    gridY: -6.63,
    rotationY: -0.45,
    roofTheme: 'crimson',
    title: 'Estalagem do Vale dos Commits',
    text: 'Lareira acesa e sinos natalinos entre as árvores brilhantes do Vale dos Commits.',
    titleEn: 'Commit Valley Inn',
    textEn: 'Glowing hearthfire nestled among the brightest commit pines of eastern Valley.',
  },
  {
    id: 'fisherman-esmeralda',
    gridX: 101.0,
    gridY: -17.25,
    rotationY: 1.48,
    roofTheme: 'spruce',
    variant: 'fisherman',
    title: 'Cabana do Lago Esmeralda',
    text: 'Trapiche e cabana ribeirinha na margem oeste do Lago Esmeralda, cercada por árvores luminosas.',
    titleEn: 'Emerald Lake Cabin',
    textEn: 'Lakeside timber cabin on the western cove of Emerald Commit Lake.',
  },
  {
    id: 'stall-vale',
    gridX: 105.38,
    gridY: -8.5,
    rotationY: -0.68,
    roofTheme: 'spruce',
    variant: 'stall',
    title: 'Feirinha do Vale dos Commits',
    text: 'Pequeno posto de chá natalino e mapas polares na travessia rumo ao Lago Esmeralda.',
    titleEn: 'Commit Valley Tea Stall',
    textEn: 'Cozy woodland spice stall beside Emerald Lake and Commit Valley trails.',
  },
  {
    id: 'chalet-vale-hills',
    gridX: 125.38,
    gridY: 2.75,
    rotationY: -1.15,
    roofTheme: 'crimson',
    title: 'Chalé das Encostas Leste',
    text: 'Vista panorâmica sobre a baía leste e os grandes icebergs do mar ártico.',
    titleEn: 'Eastern Slopes Chalet',
    textEn: 'Overlooking the eastern icy bay with warm golden windows shining over drifting icebergs.',
  },
  // Porto Glacial & Lagoa do Porto
  {
    id: 'fisherman-porto',
    gridX: 68.5,
    gridY: 72.75,
    rotationY: 1.4,
    roofTheme: 'spruce',
    variant: 'fisherman',
    title: 'Cabana da Lagoa do Porto',
    text: 'Casa do pescador na orla tranquila da Lagoa do Porto, onde pinguins descansam perto do píer.',
    titleEn: 'Harbor Lagoon Angler Hut',
    textEn: 'Quiet ice-lagoon cabin watched over by friendly penguins along the snowy shore.',
  },
  {
    id: 'chalet-porto',
    gridX: 101.0,
    gridY: 87.13,
    rotationY: -0.58,
    roofTheme: 'crimson',
    title: 'Casa do Porto Glacial',
    text: 'Chalé acolhedor perto da vila de iglus do Porto Glacial e dos trapiches gelados.',
    titleEn: 'Glacial Harbor Lodge',
    textEn: 'Cozy lodge near Glacial Harbor’s snow igloo village and frozen docks.',
  },
  {
    id: 'stall-porto',
    gridX: 116.0,
    gridY: 100.88,
    rotationY: -0.92,
    roofTheme: 'crimson',
    variant: 'stall',
    title: 'Mercado da Maré · Porto Glacial',
    text: 'Barraca portuária com sidra quente, velas e lanternas para marinheiros que chegam do oceano.',
    titleEn: 'Harbor Tide Stall',
    textEn: 'Coastal market stand with glowing lanterns warming sailors arriving at Glacial Harbor.',
  },
  // Ilha Norte & Lago Boreal
  {
    id: 'chalet-ilha-norte',
    gridX: 21.63,
    gridY: -94.75,
    rotationY: 0.25,
    roofTheme: 'spruce',
    title: 'Cabana da Ilha Norte',
    text: 'Depois da longa ponte ártica sobre o mar congelado, um refúgio tranquilo sob a aurora boreal.',
    titleEn: 'North Island Cabin',
    textEn: 'Beyond the long arctic sea bridge lies this quiet haven beneath the northern aurora.',
  },
  {
    id: 'fisherman-boreal',
    gridX: 11.63,
    gridY: -99.75,
    rotationY: -1.45,
    roofTheme: 'crimson',
    variant: 'fisherman',
    title: 'Cabana do Lago Boreal',
    text: 'Abrigo de pescadores na margem do Lago Boreal, o lago mais ao norte de todo o Polo Norte.',
    titleEn: 'Boreal Lake Fisherman Hut',
    textEn: 'The northernmost lakeside timber cabin along icy Boreal Island Lake.',
  },
  // Ilha Cristalina & Lago Cristalino
  {
    id: 'chalet-ilha-sul',
    gridX: -42.75,
    gridY: 108.38,
    rotationY: 0.42,
    roofTheme: 'crimson',
    title: 'Chalé da Ilha Cristalina',
    text: 'Pequena vila insular ao sudoeste ligada ao continente pela longa ponte de madeira sobre o mar.',
    titleEn: 'Crystal Isle Chalet',
    textEn: 'A peaceful southwestern island outpost linked to the mainland by the long sea bridge.',
  },
  {
    id: 'fisherman-cristal',
    gridX: -48.38,
    gridY: 113.38,
    rotationY: -1.35,
    roofTheme: 'spruce',
    variant: 'fisherman',
    title: 'Cabana do Lago Cristalino',
    text: 'Cabana de pesca na margem do Lago Cristalino, cercada por iglus luminosos da ilha sudoeste.',
    titleEn: 'Crystal Lake Angler Cabin',
    textEn: 'Lakeside timber cabin beside Crystal Isle Lake surrounded by glowing snow igloos.',
  },
] as const

export const OUTER_WATCHTOWERS: readonly OuterWatchtowerPlacement[] = [
  {
    id: 'tower-aurora',
    gridX: -25.25,
    gridY: -32.25,
    rotationY: 0.35,
    beaconColor: '#34d399',
    title: 'Farol do Bosque Aurora',
    text: 'Torre de vigia esmeralda guiando exploradores pelas trilhas nevadas e pelo Lago da Aurora.',
    titleEn: 'Aurora Woods Watchtower',
    textEn: 'Emerald woodland beacon guiding travelers along snowy northwestern lakes and trails.',
  },
  {
    id: 'tower-west-fjord',
    gridX: -57.75,
    gridY: 27.75,
    rotationY: 0.88,
    beaconColor: '#38bdf8',
    title: 'Mirante do Fiorde Oeste',
    text: 'Farol ocidental de onde se avista o bosque gelado e os canais nevados do sudoeste.',
    titleEn: 'Western Fjord Lookout',
    textEn: 'Western woodland tower gazing across frozen channels and aurora ridges.',
  },
  {
    id: 'tower-vale',
    gridX: 109.75,
    gridY: -30.38,
    rotationY: -0.42,
    beaconColor: '#5ee87a',
    title: 'Mirante do Vale dos Commits',
    text: 'Farol no topo do vale que ilumina as encostas e o Lago Esmeralda com brilho natalino.',
    titleEn: 'Commit Valley Lookout',
    textEn: 'Hilltop timber tower lighting up eastern slopes and Emerald Commit Lake.',
  },
  {
    id: 'tower-harbor',
    gridX: 122.88,
    gridY: 103.38,
    rotationY: -0.78,
    beaconColor: '#38bdf8',
    title: 'Farol do Porto Glacial',
    text: 'Luz azul-gelo erguida na ponta costeira do Porto Glacial para guiar navegantes no mar ártico.',
    titleEn: 'Glacial Harbor Lighthouse',
    textEn: 'Ice-blue coastal lighthouse standing on the harbor headland above drifting icebergs.',
  },
  {
    id: 'tower-south-cape',
    gridX: 33.5,
    gridY: 102.75,
    rotationY: 0.15,
    beaconColor: '#38bdf8',
    title: 'Mirante do Cabo Austral',
    text: 'Torre sul olhando as colinas nevadas onde os grandes pinheiros encontram os iglus do sul.',
    titleEn: 'Southern Cape Lookout',
    textEn: 'Southern beacon overlooking snow ridges and sunlit southern igloo glades.',
  },
  {
    id: 'tower-north-island',
    gridX: 36.0,
    gridY: -107.25,
    rotationY: 0.18,
    beaconColor: '#ffd166',
    title: 'Farol da Ilha Norte',
    text: 'O marco dourado mais setentrional do Polo Norte, voltado diretamente para a aurora boreal.',
    titleEn: 'North Island Beacon',
    textEn: 'The northernmost golden beacon of the archipelago, shining beneath the aurora.',
  },
  {
    id: 'tower-south-island',
    gridX: -62.13,
    gridY: 120.88,
    rotationY: 0.65,
    beaconColor: '#ffd166',
    title: 'Torre da Ilha Cristalina',
    text: 'Torre vigia na ilha sudoeste olhando a aldeia de iglus e o Lago Cristalino.',
    titleEn: 'Crystal Isle Watchtower',
    textEn: 'Southwestern island beacon overlooking Crystal Lake and its cozy snow igloo village.',
  },
] as const

/**
 * 40 charming voxel snow & ice igloos forming cold-biome igloo villages, lakeside camps,
 * and hidden forest glades across all regions & islands.
 */
export const OUTER_IGLOO_VILLAGES: readonly OuterIglooPlacement[] = [
  // Lago da Vila lakeside igloos
  { id: 'igloo-vila-w', gridX: -0.95, gridY: 35.34, rotationY: 1.2, accent: 'lantern', title: 'Iglu da Orla Oeste · Vila', text: 'Iglu de gelo luminoso contemplando as águas tranquilas do Lago da Vila.', titleEn: 'West Shore Village Igloo', textEn: 'Glowing ice dome looking out over peaceful Village Frost Lake.' },
  { id: 'igloo-vila-s', gridX: 5.38, gridY: 47.13, rotationY: -2.8, accent: 'campfire', title: 'Iglu Sul do Lago', text: 'Fogueira acesa na porta aquecendo os visitantes que passeiam ao sul do lago.', titleEn: 'South Lake Igloo', textEn: 'Warm hearth crackling beside the doorway on the southern lakeside.' },
  // Lago da Aurora + Bosque Aurora cold ridges
  { id: 'igloo-aurora-l1', gridX: -58.97, gridY: -10.19, rotationY: 1.4, accent: 'lantern', title: 'Iglu da Aurora Oeste', text: 'Cúpula de neve brilhante na margem oeste do Lago da Aurora.', titleEn: 'Aurora Lake West Igloo', textEn: 'Shining snow dome along the western bank of Aurora Mirror Lake.' },
  { id: 'igloo-aurora-l2', gridX: -49.6, gridY: -21.34, rotationY: -0.2, accent: 'snowman', title: 'Iglu Espelho da Aurora', text: 'Boneco de neve e luz quente refletindo a aurora boreal no lago.', titleEn: 'Aurora Mirror Igloo', textEn: 'Friendly snowman and amber glow reflecting the aurora across the ice lake.' },
  { id: 'igloo-aurora-l3', gridX: -39.0, gridY: -24.75, rotationY: -0.9, accent: 'campfire', title: 'Iglu da Enseada Norte', text: 'Pequeno abrigo acolhedor perto dos pinheiros brilhantes da orla nordeste.', titleEn: 'North Cove Igloo', textEn: 'Cozy ice shelter nestled beneath glowing northeastern shoreline pines.' },
  { id: 'igloo-aurora-ridge1', gridX: -46.47, gridY: 9.45, rotationY: 0.4, accent: 'snowpile', title: 'Iglu das Dunas Geladas', text: 'Refúgio solitário entre dunas de neve fofa ao sul do Bosque Aurora.', titleEn: 'Frost Dunes Igloo', textEn: 'Quiet snow shelter among soft drifts south of Aurora Woods.' },
  { id: 'igloo-aurora-ridge2', gridX: -54.77, gridY: -0.63, rotationY: 0.9, accent: 'lantern', title: 'Iglu da Clareira Oeste', text: 'Lanterna dourada guiando exploradores entre pinheiros antigos.', titleEn: 'West Glade Igloo', textEn: 'Warm amber doorway guiding explorers through ancient snowy pines.' },
  { id: 'igloo-aurora-ridge3', gridX: -23.71, gridY: -26.25, rotationY: -0.6, accent: 'campfire', title: 'Iglu da Colina Boreal', text: 'Acampamento elevado observando todo o vale oeste sob a lua polar.', titleEn: 'Boreal Hill Igloo', textEn: 'Hilltop winter camp overlooking the western woods beneath the moon.' },
  { id: 'igloo-aurora-ridge4', gridX: -33.08, gridY: 4.99, rotationY: 2.1, accent: 'lantern', title: 'Iglu do Riacho Oeste', text: 'Construído numa clareira tranquila ao lado do afluente ocidental.', titleEn: 'West Creek Igloo', textEn: 'Tucked in a quiet pine glade beside the icy western stream.' },
  // Lago Esmeralda + Vale dos Commits ridges
  { id: 'igloo-esmeralda-l1', gridX: 121.32, gridY: -14.65, rotationY: -1.5, accent: 'lantern', title: 'Iglu do Lago Esmeralda', text: 'Blocos azul-claros iluminados por uma entrada dourada na orla leste.', titleEn: 'Emerald Lake Igloo', textEn: 'Ice-blue dome glowing softly along the eastern bank of Emerald Lake.' },
  { id: 'igloo-esmeralda-l2', gridX: 113.29, gridY: -25.36, rotationY: 0.3, accent: 'campfire', title: 'Iglu dos Cristais Verdes', text: 'Fogueira quentinha perto das árvores mais vibrantes do Vale dos Commits.', titleEn: 'Emerald Pines Igloo', textEn: 'Cozy campfire beside vibrant commit pines on the lakeside.' },
  { id: 'igloo-esmeralda-l3', gridX: 105.26, gridY: -24.47, rotationY: 0.8, accent: 'snowpile', title: 'Iglu da Curva Esmeralda', text: 'Refúgio na curva norte do Lago Esmeralda cercado por cogumelos vermelhos.', titleEn: 'Emerald Bend Igloo', textEn: 'Peaceful igloo on Emerald Lake’s northern bend ringed by toadstools.' },
  { id: 'igloo-vale-v1', gridX: 122.66, gridY: -6.17, rotationY: -0.9, accent: 'snowman', title: 'Iglu das Encostas Leste', text: 'Iglu familiar com boneco de neve nas encostas brilhantes do leste.', titleEn: 'Eastern Slopes Igloo', textEn: 'Cheerful hillside igloo guarded by a carrot-nosed snowman.' },
  { id: 'igloo-vale-v2', gridX: 118.64, gridY: 13.47, rotationY: -2.2, accent: 'lantern', title: 'Iglu da Baía Oriental', text: 'Ponto de descanso antes das trilhas que descem para o Porto Glacial.', titleEn: 'Eastern Bay Igloo', textEn: 'Rest stop overlooking the snowy ridge between Valley and Harbor.' },
  { id: 'igloo-vale-v3', gridX: 82.94, gridY: -28.04, rotationY: 0.5, accent: 'campfire', title: 'Iglu do Alto do Vale', text: 'Iglu no bosque alto norte, iluminado pelas cores verdes do GitHub.', titleEn: 'Upper Valley Igloo', textEn: 'High forest igloo bathed in green commit glow up north.' },
  // Lagoa do Porto + Vila de Iglus do Porto Glacial (Cold SE Ice Village)
  { id: 'igloo-porto-l1', gridX: 86.07, gridY: 68.8, rotationY: -1.4, accent: 'lantern', title: 'Iglu da Lagoa Leste', text: 'Entrada voltada para os peixinhos brilhantes e pinguins da Lagoa do Porto.', titleEn: 'Lagoon East Igloo', textEn: 'Warm doorway facing playful penguins and glowing fish on Harbor Lagoon.' },
  { id: 'igloo-porto-l2', gridX: 77.59, gridY: 81.3, rotationY: -2.9, accent: 'campfire', title: 'Iglu Sul da Lagoa', text: 'Brilho âmbar saindo pela portinha sobre a neve macia ao sul da lagoa.', titleEn: 'Lagoon South Igloo', textEn: 'Amber doorway light warming the snowy south bank of Harbor Lagoon.' },
  { id: 'igloo-porto-l3', gridX: 70.45, gridY: 79.96, rotationY: 2.3, accent: 'snowpile', title: 'Iglu do Píer da Lagoa', text: 'Ao lado dos degraus nevados que levam ao trapiche de madeira.', titleEn: 'Lagoon Pier Igloo', textEn: 'Snug beside the snow trail leading down to the lagoon dock.' },
  { id: 'igloo-porto-v1', gridX: 86.96, gridY: 96.47, rotationY: 0.9, accent: 'campfire', title: 'Vila dos Iglus · Porto Norte', text: 'Parte da encantadora vila de iglus do Porto Glacial, onde pinguins passeiam livremente.', titleEn: 'Glacial Harbor Igloo Village', textEn: 'Heart of Glacial Harbor’s charming coastal igloo settlement.' },
  { id: 'igloo-porto-v2', gridX: 91.42, gridY: 100.04, rotationY: 0.3, accent: 'snowman', title: 'Vila dos Iglus · Praça de Gelo', text: 'Boneco de neve festivo no centro da pequena aldeia congelada do porto.', titleEn: 'Ice Square Igloo', textEn: 'Festive snowman standing watch in Harbor’s snowy igloo square.' },
  { id: 'igloo-porto-v3', gridX: 96.78, gridY: 96.92, rotationY: -0.4, accent: 'lantern', title: 'Vila dos Iglus · Porto Leste', text: 'Cúpula de gelo cristalino com lanterna na porta voltada para o farol.', titleEn: 'Harbor East Igloo', textEn: 'Crystal-ice igloo glowing warmly toward the coastal lighthouse.' },
  { id: 'igloo-porto-v4', gridX: 106.15, gridY: 78.62, rotationY: -1.1, accent: 'lantern', title: 'Iglu das Marés', text: 'Iglu costeiro próximo aos pinheiros nevados e à estalagem do porto.', titleEn: 'Tide Ridge Igloo', textEn: 'Coastal igloo tucked near snowy harbor pines and warm timber lodges.' },
  { id: 'igloo-porto-v5', gridX: 111.95, gridY: 82.19, rotationY: -0.7, accent: 'campfire', title: 'Iglu do Mirante Glacial', text: 'Fogueira de acampamento aquecendo marinheiros que descansam na neve.', titleEn: 'Glacier Lookout Igloo', textEn: 'Harbor cliffside igloo with a warm crackling snow campfire.' },
  // Ilha Norte + Vila de Iglus Boreal (Northernmost Polar Village)
  { id: 'igloo-norte-v1', gridX: -4.52, gridY: -94.08, rotationY: 1.5, accent: 'lantern', title: 'Iglu Oeste do Lago Boreal', text: 'Na margem calma do Lago Boreal, iluminado pelo reflexo verde da aurora.', titleEn: 'Boreal Lake West Igloo', textEn: 'Peaceful igloo on Boreal Island Lake illuminated by shimmering aurora.' },
  { id: 'igloo-norte-v2', gridX: 2.81, gridY: -105.25, rotationY: 0.2, accent: 'campfire', title: 'Iglu Polar do Norte', text: 'Um dos iglus mais setentrionais do mundo, com luz quente brilhando na neve.', titleEn: 'Far North Boreal Igloo', textEn: 'One of the northernmost igloos at the North Pole, glowing warmly.' },
  { id: 'igloo-norte-v3', gridX: 14.22, gridY: -105.24, rotationY: -0.4, accent: 'snowman', title: 'Aldeia Boreal · Cúpula Central', text: 'Iglu tradicional com túnel longo para proteger do vento ártico.', titleEn: 'Boreal Village Central Igloo', textEn: 'Classic snow dome with an insulated icy tunnel against polar winds.' },
  { id: 'igloo-norte-v4', gridX: 30.29, gridY: -99.88, rotationY: -1.2, accent: 'campfire', title: 'Aldeia Boreal · Fogueira Norte', text: 'Fogueira central onde viajantes da Ilha Norte trocam histórias de código.', titleEn: 'Boreal Hearth Igloo', textEn: 'Northern camp hearth where visiting coders warm up beneath the stars.' },
  { id: 'igloo-norte-v5', gridX: 33.41, gridY: -95.42, rotationY: -1.8, accent: 'lantern', title: 'Aldeia Boreal · Leste', text: 'Iglu próximo ao caminho do Farol Dourado da Ilha Norte.', titleEn: 'Boreal East Igloo', textEn: 'Snow dome perched beside the path to the golden North Island beacon.' },
  { id: 'igloo-norte-v6', gridX: 26.27, gridY: -103.45, rotationY: -0.9, accent: 'snowpile', title: 'Aldeia Boreal · Pinhal Alto', text: 'Cercado por pinheiros luminosos sob a faixa da aurora boreal.', titleEn: 'Boreal Pines Igloo', textEn: 'Surrounded by glowing evergreen commit pines under aurora ribbons.' },
  { id: 'igloo-norte-v7', gridX: -1.4, gridY: -90.51, rotationY: 0.7, accent: 'lantern', title: 'Iglu do Riacho Boreal', text: 'Abrigo aconchegante ao sul do Lago Boreal observando as águas correntes.', titleEn: 'Boreal Creek Igloo', textEn: 'Cozy southern Boreal dome watching the icy creek wind toward sea.' },
  // Ilha Cristalina + Lago Cristalino Iglu Village
  { id: 'igloo-cristal-l1', gridX: -66.11, gridY: 108.52, rotationY: 1.4, accent: 'lantern', title: 'Iglu do Lago Cristalino', text: 'Iglu brilhando na margem oeste do Lago Cristalino na ilha sudoeste.', titleEn: 'Crystal Lake West Igloo', textEn: 'Warm amber doorway shining on Crystal Isle Lake’s western shore.' },
  { id: 'igloo-cristal-l2', gridX: -58.97, gridY: 118.34, rotationY: -2.8, accent: 'campfire', title: 'Iglu Cristalino Sul', text: 'Fogueira na porta refletindo nas águas azuladas do Lago Cristalino.', titleEn: 'Crystal Lake South Igloo', textEn: 'Lakeside campfire reflecting onto the glassy blue Crystal Lake.' },
  { id: 'igloo-cristal-v1', gridX: -37.1, gridY: 114.77, rotationY: 0.6, accent: 'snowman', title: 'Aldeia Cristalina · Leste', text: 'Pequena vila de iglus próxima à ponte longa de madeira da Ilha Cristalina.', titleEn: 'Crystal Village East Igloo', textEn: 'Igloo village dome beside Crystal Isle’s long northern sea bridge.' },
  { id: 'igloo-cristal-v2', gridX: -41.56, gridY: 119.23, rotationY: 0.2, accent: 'lantern', title: 'Aldeia Cristalina · Refúgio Sul', text: 'Blocos de gelo brilhando suavemente entre coelhos e pinheiros nevados.', titleEn: 'Crystal South Igloo', textEn: 'Gently glowing snow bricks surrounded by bunnies and frosty spruce.' },
  { id: 'igloo-cristal-v3', gridX: -53.61, gridY: 98.26, rotationY: 1.1, accent: 'snowpile', title: 'Aldeia Cristalina · Norte', text: 'Portal quente acolhendo quem chega à ilha atravessando o mar congelado.', titleEn: 'Crystal North Igloo', textEn: 'Warm arctic greeting right where explorers reach Crystal Isle.' },
  // Forest glades & crossroads across Vila Central outskirts
  { id: 'igloo-glade-ne', gridX: 63.76, gridY: 3.2, rotationY: -0.7, accent: 'lantern', title: 'Iglu da Clareira Leste', text: 'Iglu charmoso em clareira silenciosa entre a Vila Central e o Vale dos Commits.', titleEn: 'Eastern Glade Igloo', textEn: 'Charming forest clearing igloo between Central Village and Commit Valley.' },
  { id: 'igloo-glade-nw', gridX: -4.08, gridY: -0.37, rotationY: 0.8, accent: 'campfire', title: 'Iglu do Bosque Noroeste', text: 'Pequeno abrigo nevado no caminho arborizado rumo ao Bosque Aurora.', titleEn: 'NW Woodland Igloo', textEn: 'Snug woodland igloo tucked on the scenic trail toward Aurora Woods.' },
  { id: 'igloo-glade-se', gridX: 61.52, gridY: 54.08, rotationY: -1.1, accent: 'snowpile', title: 'Iglu da Trilha Sul', text: 'Descanso aconchegante entre árvores iluminadas rumo à Lagoa do Porto.', titleEn: 'South Trail Igloo', textEn: 'Cozy woodland shelter on the southern forest trail toward Harbor Lagoon.' },
  { id: 'igloo-glade-sw', gridX: -5.42, gridY: 73.27, rotationY: 0.5, accent: 'lantern', title: 'Iglu do Pinheiral Austral', text: 'Clareira isolada ao sudoeste, cercada por pinheiros nevados e raposas.', titleEn: 'Southern Spruce Igloo', textEn: 'Secluded snow-clearing igloo framed by tall pines and arctic foxes.' },
  { id: 'igloo-glade-n', gridX: 43.67, gridY: -27.59, rotationY: -0.3, accent: 'campfire', title: 'Iglu do Vale Setentrional', text: 'Pequeno iglu com fogueira ao norte das encostas brilhantes de commits.', titleEn: 'Northern Vale Igloo', textEn: 'Warm woodland igloo perched along frosty northern pine glades.' },
] as const

export const OUTER_WOODLAND_PROPS: readonly OuterWoodlandPropPlacement[] = [
  // Lago da Vila & approaches
  { gridX: 14.22, gridY: 36.28, type: 'lamp' },
  { gridX: 16.86, gridY: 39.35, type: 'campfire' },
  { gridX: 0.74, gridY: 42.94, type: 'snowman' },
  { gridX: 9.94, gridY: 30.78, type: 'signpost' },
  // Bosque Aurora & Lago da Aurora
  { gridX: -35.76, gridY: -24.2, type: 'lamp' },
  { gridX: -30.41, gridY: -20.98, type: 'campfire' },
  { gridX: -40.9, gridY: -13.49, type: 'lamp' },
  { gridX: -38.97, gridY: -9.2, type: 'campfire' },
  { gridX: -54.68, gridY: -7.42, type: 'snowman' },
  { gridX: -22.91, gridY: -29.91, type: 'signpost' },
  { gridX: -57.18, gridY: 10.43, type: 'lamp' },
  { gridX: -62.18, gridY: 14.36, type: 'campfire' },
  { gridX: -43.26, gridY: 24.71, type: 'lamp' },
  // Vale dos Commits & Lago Esmeralda
  { gridX: 97.04, gridY: -4.92, type: 'lamp' },
  { gridX: 103.11, gridY: -10.27, type: 'campfire' },
  { gridX: 102.3, gridY: -17.94, type: 'lamp' },
  { gridX: 98.12, gridY: -14.56, type: 'snowman' },
  { gridX: 123.46, gridY: 0.79, type: 'lamp' },
  { gridX: 127.75, gridY: 4.72, type: 'campfire' },
  { gridX: 107.4, gridY: -28.12, type: 'signpost' },
  { gridX: 80.98, gridY: 26.14, type: 'lamp' },
  // Porto Glacial & Lagoa do Porto
  { gridX: 70.88, gridY: 71.29, type: 'lamp' },
  { gridX: 67.06, gridY: 75.05, type: 'campfire' },
  { gridX: 86.33, gridY: 74.69, type: 'snowman' },
  { gridX: 98.47, gridY: 85.4, type: 'lamp' },
  { gridX: 103.47, gridY: 89.33, type: 'campfire' },
  { gridX: 113.82, gridY: 98.61, type: 'lamp' },
  { gridX: 120.96, gridY: 101.83, type: 'signpost' },
  { gridX: 66.7, gridY: 56.13, type: 'lamp' },
  { gridX: 79.55, gridY: 46.13, type: 'lamp' },
  // Southern Cape & Western Woods
  { gridX: 31.0, gridY: 101.11, type: 'lamp' },
  { gridX: 35.64, gridY: 105.04, type: 'campfire' },
  { gridX: -21.48, gridY: 53.63, type: 'lamp' },
  { gridX: -25.77, gridY: 57.2, type: 'campfire' },
  { gridX: -3.28, gridY: 68.98, type: 'snowman' },
  // Ilha Norte & Northern Sea Bridge approaches
  { gridX: 18.29, gridY: -45.26, type: 'lamp' },
  { gridX: 17.79, gridY: -66.68, type: 'lamp' },
  { gridX: 23.5, gridY: -92.74, type: 'lamp' },
  { gridX: 18.86, gridY: -97.02, type: 'campfire' },
  { gridX: 12.79, gridY: -97.38, type: 'lamp' },
  { gridX: 8.13, gridY: -101.87, type: 'snowman' },
  { gridX: 34.21, gridY: -105.24, type: 'signpost' },
  // Ilha Cristalina & Southwest Sea Bridge approaches
  { gridX: -38.97, gridY: 67.27, type: 'lamp' },
  { gridX: -38.97, gridY: 90.4, type: 'lamp' },
  { gridX: -41.47, gridY: 105.4, type: 'lamp' },
  { gridX: -45.4, gridY: 108.97, type: 'campfire' },
  { gridX: -50.15, gridY: 108.8, type: 'lamp' },
  { gridX: -59.68, gridY: 117.53, type: 'signpost' },
] as const
