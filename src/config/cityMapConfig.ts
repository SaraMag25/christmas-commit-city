export const CITY_PALETTE = {
  nightBg: '#040914',
  nightMid: '#0a1428',
  nightSkyNum: 0x040914,
  pineDark: '#092419',
  pineMid: '#0f3626',
  pineBright: '#164d36',
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
  /** Total columns and rows of the dense Christmas tree forest city */
  cols: 40,
  rows: 30,
  /** Forest center coordinates for default camera framing */
  plazaCenter: {
    gridX: 20,
    gridY: 15,
  },
  /** Extra sky band above the northern tree line for starry night atmosphere */
  skyRows: 2,
} as const
