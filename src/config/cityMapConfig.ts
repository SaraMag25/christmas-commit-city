export const CITY_PALETTE = {
  nightBg: '#070d1f',
  nightMid: '#0d1833',
  nightSkyNum: 0x070d1f,
  pineDark: '#0f2e24',
  pineMid: '#174636',
  pineBright: '#1f5c45',
  cranberry: '#b91c1c',
  cranberryBright: '#dc2626',
  gold: '#f59e0b',
  goldBright: '#fbbf24',
  snow: '#f8fafc',
  snowShadow: '#cbd5e1',
  woodDark: '#3b2110',
  woodMid: '#6b4226',
  woodLight: '#9c6644',
} as const

export const CITY_MAP_CONFIG = {
  /** Base tile dimension in pixel-art texels */
  tileTexels: 16,
  /** Integer pixel scale factor applied when rendering tiles and sprites */
  pixelScale: 3,
  /** Final world tile size in pixels (16 * 3 = 48px) */
  get tileSize(): number {
    return this.tileTexels * this.pixelScale
  },
  /** Total columns and rows of the snowy village */
  cols: 36,
  rows: 26,
  /** Central plaza coordinates (in tile units) where the creator's special tree stands */
  plazaCenter: {
    gridX: 18,
    gridY: 13,
  },
  /** Extra sky band above the northern tree line for starry night atmosphere */
  skyRows: 3,
} as const
