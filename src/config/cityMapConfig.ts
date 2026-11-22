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
