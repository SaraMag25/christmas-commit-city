import { CITY_MAP_CONFIG, VILLAGE_OFFSET_X, VILLAGE_OFFSET_Y, WORLD_TILE_SIZE } from '../../config/cityMapConfig'

export type ContinentRegionId =
  | 'vila-central'
  | 'bosque-aurora'
  | 'vale-commits'
  | 'porto-glacial'
  | 'ilha-norte'

export interface ContinentRegionInfo {
  id: ContinentRegionId
  namePt: string
  nameEn: string
  subtitlePt: string
  subtitleEn: string
  x: number
  z: number
  hubRadius: number
  accentColor: string
  cameraDist: number
}

export interface ScenicLakeSpec {
  id: string
  namePt: string
  nameEn: string
  regionId: ContinentRegionId | 'ilha-cristalina'
  x: number
  z: number
  rx: number
  rz: number
  isletRadius: number
  isletOffsetX: number
  isletOffsetZ: number
  pierX: number
  pierZ: number
  pierDir: 'east' | 'west' | 'south' | 'north'
}

export const WORLD_MAP_BOUNDS = {
  minX: -440,
  maxX: 440,
  minZ: -490,
  maxZ: 425,
} as const

export const CONTINENT_REGIONS: readonly ContinentRegionInfo[] = [
  {
    id: 'vila-central',
    namePt: 'Vila Central',
    nameEn: 'Central Village',
    subtitlePt: 'Marco do Polo Norte · Praça & Mercado',
    subtitleEn: 'North Pole Landmark · Plaza & Market',
    x: 1.6,
    z: 1.6,
    hubRadius: 108,
    accentColor: '#39d353',
    cameraDist: 52,
  },
  {
    id: 'bosque-aurora',
    namePt: 'Bosque Aurora',
    nameEn: 'Aurora Woods',
    subtitlePt: 'Florestas boreais, iglus & Lago da Aurora',
    subtitleEn: 'Boreal pines, igloos & Aurora Lake',
    x: -214,
    z: -102,
    hubRadius: 112,
    accentColor: '#34d399',
    cameraDist: 58,
  },
  {
    id: 'vale-commits',
    namePt: 'Vale dos Commits',
    nameEn: 'Commit Valley',
    subtitlePt: 'Encostas luminosas & Lago Esmeralda',
    subtitleEn: 'Glowing pine slopes & Emerald Lake',
    x: 226,
    z: -104,
    hubRadius: 112,
    accentColor: '#5ee87a',
    cameraDist: 58,
  },
  {
    id: 'porto-glacial',
    namePt: 'Porto Glacial',
    nameEn: 'Glacial Harbor',
    subtitlePt: 'Cais, vila de iglus & Lagoa do Porto',
    subtitleEn: 'Frozen harbor piers, igloo village & Lagoon',
    x: 202,
    z: 202,
    hubRadius: 108,
    accentColor: '#38bdf8',
    cameraDist: 60,
  },
  {
    id: 'ilha-norte',
    namePt: 'Ilha Norte',
    nameEn: 'North Island',
    subtitlePt: 'Arquipélago polar, iglus & Lago Boreal',
    subtitleEn: 'Polar archipelago, igloos & Boreal Lake',
    x: -38,
    z: -384,
    hubRadius: 100,
    accentColor: '#ffd166',
    cameraDist: 60,
  },
] as const

export const CONTINENT_REGION_BY_ID: Record<ContinentRegionId, ContinentRegionInfo> = {
  'vila-central': CONTINENT_REGIONS[0],
  'bosque-aurora': CONTINENT_REGIONS[1],
  'vale-commits': CONTINENT_REGIONS[2],
  'porto-glacial': CONTINENT_REGIONS[3],
  'ilha-norte': CONTINENT_REGIONS[4],
}

/**
 * Six scenic glacial lakes distributed cleanly across the balanced continent & islands,
 * each with a snow islet and lantern-lit wooden pier.
 */
export const CONTINENT_LAKES: readonly ScenicLakeSpec[] = [
  {
    id: 'lago-vila',
    namePt: 'Lago da Vila',
    nameEn: 'Village Frost Lake',
    regionId: 'vila-central',
    x: -72,
    z: 54,
    rx: 23,
    rz: 17,
    isletRadius: 4.8,
    isletOffsetX: -2,
    isletOffsetZ: 1.5,
    pierX: -51,
    pierZ: 51,
    pierDir: 'west',
  },
  {
    id: 'lago-aurora',
    namePt: 'Lago da Aurora',
    nameEn: 'Aurora Mirror Lake',
    regionId: 'bosque-aurora',
    x: -252,
    z: -112,
    rx: 28,
    rz: 21,
    isletRadius: 6.0,
    isletOffsetX: 2,
    isletOffsetZ: -1.5,
    pierX: -229,
    pierZ: -110,
    pierDir: 'west',
  },
  {
    id: 'lago-esmeralda',
    namePt: 'Lago Esmeralda',
    nameEn: 'Emerald Commit Lake',
    regionId: 'vale-commits',
    x: 270,
    z: -126,
    rx: 27,
    rz: 20,
    isletRadius: 5.8,
    isletOffsetX: -2,
    isletOffsetZ: 2,
    pierX: 245,
    pierZ: -128,
    pierDir: 'east',
  },
  {
    id: 'lagoa-porto',
    namePt: 'Lagoa do Porto',
    nameEn: 'Harbor Ice Lagoon',
    regionId: 'porto-glacial',
    x: 160,
    z: 168,
    rx: 25,
    rz: 19,
    isletRadius: 5.4,
    isletOffsetX: 2,
    isletOffsetZ: -1.5,
    pierX: 137,
    pierZ: 166,
    pierDir: 'east',
  },
  {
    id: 'lago-boreal',
    namePt: 'Lago Boreal',
    nameEn: 'Boreal Island Lake',
    regionId: 'ilha-norte',
    x: -84,
    z: -384,
    rx: 23,
    rz: 17,
    isletRadius: 4.8,
    isletOffsetX: -1.5,
    isletOffsetZ: 1,
    pierX: -63,
    pierZ: -382,
    pierDir: 'west',
  },
  {
    id: 'lago-cristal',
    namePt: 'Lago Cristalino',
    nameEn: 'Crystal Isle Lake',
    regionId: 'ilha-cristalina',
    x: -272,
    z: 290,
    rx: 21,
    rz: 16,
    isletRadius: 4.4,
    isletOffsetX: 1.5,
    isletOffsetZ: -1,
    pierX: -253,
    pierZ: 288,
    pierDir: 'west',
  },
] as const

export function gridToWorldCoords(gridX: number, gridY: number): { x: number; z: number } {
  const { cols, rows } = CITY_MAP_CONFIG
  return {
    x: (gridX - cols / 2 + 0.5) * WORLD_TILE_SIZE,
    z: (gridY - rows / 2 + 0.5) * WORLD_TILE_SIZE,
  }
}

export function worldToGridCoords(x: number, z: number): { gridX: number; gridY: number } {
  const { cols, rows } = CITY_MAP_CONFIG
  return {
    gridX: x / WORLD_TILE_SIZE + cols / 2 - 0.5,
    gridY: z / WORLD_TILE_SIZE + rows / 2 - 0.5,
  }
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function coastlineWobble(x: number, z: number): number {
  return (
    Math.sin(x * 0.018 + z * 0.014) * 19 +
    Math.cos(x * 0.012 - z * 0.022) * 16 +
    Math.sin((x + z) * 0.032) * 9
  )
}

function computeNorthIslandField(x: number, z: number): number {
  const w = coastlineWobble(x * 1.06, z * 1.06) * 0.0048
  const nX = (x + 38) / 152
  const nZ = (z + 384) / 108
  return Math.hypot(nX, nZ) - w
}

function computeSouthWestIslandField(x: number, z: number): number {
  const w = coastlineWobble(x * 1.06, z * 1.06) * 0.0048
  const swX = (x + 244) / 134
  const swZ = (z - 286) / 102
  return Math.hypot(swX, swZ) - w
}

function computeMainContinentField(x: number, z: number): number {
  const bayIndent = Math.exp(-Math.pow((z - 38) / 62, 2)) * Math.max(0, (x - 238) * 0.003)
  const w = coastlineWobble(x, z) * 0.0045 - bayIndent

  const heartDist = Math.hypot((x + 48) / 294, (z + 20) / 224) - w
  const valleyDist = Math.hypot((x - 216) / 172, (z + 102) / 154) - w
  const harborDist = Math.hypot((x - 196) / 168, (z - 204) / 148) - w
  const capeDist = Math.hypot((x + 14) / 184, (z - 204) / 128) - w

  return Math.min(heartDist, valleyDist, harborDist, capeDist)
}

export type LandmassKind = 'main' | 'ilha-norte' | 'ilha-cristalina'

export function getLandmassKindWorld(x: number, z: number): LandmassKind | null {
  if (
    x < WORLD_MAP_BOUNDS.minX ||
    x > WORLD_MAP_BOUNDS.maxX ||
    z < WORLD_MAP_BOUNDS.minZ ||
    z > WORLD_MAP_BOUNDS.maxZ
  ) {
    return null
  }
  if (z < -280 && computeNorthIslandField(x, z) <= 1.0) {
    return 'ilha-norte'
  }
  if (z > 176 && x < -68 && computeSouthWestIslandField(x, z) <= 1.0) {
    return 'ilha-cristalina'
  }
  // Open Arctic Ocean strait separating mainland from North Island
  if (z < -248 && z > -290 && Math.abs(x + 38) < 176) {
    return null
  }
  if (computeMainContinentField(x, z) <= 1.0) {
    return 'main'
  }
  return null
}

/**
 * Checks whether (x, z) sits on a scenic lake (excluding central snow islets).
 */
export function isLakeIsletWorld(x: number, z: number): boolean {
  for (let i = 0; i < CONTINENT_LAKES.length; i += 1) {
    const lake = CONTINENT_LAKES[i]
    if (lake.isletRadius <= 0) continue
    const ix = lake.x + lake.isletOffsetX
    const iz = lake.z + lake.isletOffsetZ
    const wobble = Math.sin(x * 0.45 + z * 0.35) * 0.8
    if (Math.hypot(x - ix, z - iz) <= lake.isletRadius + wobble) {
      return true
    }
  }
  return false
}

export function isLakeWorld(x: number, z: number): boolean {
  if (!isLandWorld(x, z)) return false
  for (let i = 0; i < CONTINENT_LAKES.length; i += 1) {
    const lake = CONTINENT_LAKES[i]
    const dx = x - lake.x
    const dz = z - lake.z
    if (Math.abs(dx) > lake.rx + 7 || Math.abs(dz) > lake.rz + 7) continue

    const angle = Math.atan2(dz, dx)
    const rimWobble =
      Math.cos(angle * 3 + i * 1.4) * 0.12 +
      Math.sin(angle * 5 - i * 0.9) * 0.08
    const normDist = Math.hypot(dx / lake.rx, dz / lake.rz)
    if (normDist <= 1.0 + rimWobble && !isLakeIsletWorld(x, z)) {
      return true
    }
  }
  return false
}

export function isLakePierWorld(x: number, z: number): boolean {
  for (let i = 0; i < CONTINENT_LAKES.length; i += 1) {
    const lake = CONTINENT_LAKES[i]
    if (lake.pierDir === 'west' || lake.pierDir === 'east') {
      const sign = lake.pierDir === 'west' ? -1 : 1
      const along = (x - lake.pierX) * sign
      if (along >= -2.5 && along <= 10.5 && Math.abs(z - lake.pierZ) <= 1.8) {
        return true
      }
    } else {
      const sign = lake.pierDir === 'north' ? -1 : 1
      const along = (z - lake.pierZ) * sign
      if (along >= -2.5 && along <= 10.5 && Math.abs(x - lake.pierX) <= 1.8) {
        return true
      }
    }
  }
  return false
}

export function getNearestLakeDistanceWorld(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < CONTINENT_LAKES.length; i += 1) {
    const lake = CONTINENT_LAKES[i]
    const dCenter = Math.hypot(x - lake.x, z - lake.z)
    const approxEdgeDist = dCenter - (lake.rx + lake.rz) * 0.5
    if (approxEdgeDist < best) best = approxEdgeDist
  }
  return best
}

export function isLandWorld(x: number, z: number): boolean {
  return getLandmassKindWorld(x, z) !== null
}

export function isSafeInlandWorld(x: number, z: number, marginWorld = 4.5): boolean {
  if (isLakeWorld(x, z) || isLakeIsletWorld(x, z)) return false
  return (
    isLandWorld(x, z) &&
    isLandWorld(x - marginWorld, z) &&
    isLandWorld(x + marginWorld, z) &&
    isLandWorld(x, z - marginWorld) &&
    isLandWorld(x, z + marginWorld) &&
    !isLakeWorld(x - marginWorld * 0.7, z) &&
    !isLakeWorld(x + marginWorld * 0.7, z) &&
    !isLakeWorld(x, z - marginWorld * 0.7) &&
    !isLakeWorld(x, z + marginWorld * 0.7)
  )
}

export function getContinentElevationFactor(x: number, z: number): number {
  const kind = getLandmassKindWorld(x, z)
  if (!kind) return 0
  const field =
    kind === 'ilha-norte'
      ? computeNorthIslandField(x, z)
      : kind === 'ilha-cristalina'
        ? computeSouthWestIslandField(x, z)
        : computeMainContinentField(x, z)
  return Math.max(0, Math.min(1, 1 - field))
}

export function getMainRiverWorldX(z: number): number {
  const { gridY } = worldToGridCoords(0, z)
  const localY = gridY - VILLAGE_OFFSET_Y
  const villageCurveGx = 11.5 + VILLAGE_OFFSET_X + Math.sin(localY * 0.24) * 2.7
  const northFade = smoothStep(-4, -24, localY)
  const southFade = smoothStep(34, 62, localY)
  const outerMeander = Math.sin(z * 0.014) * 32 + Math.cos(z * 0.008) * 14
  const baseWorldX = gridToWorldCoords(villageCurveGx, gridY).x
  return baseWorldX + Math.max(northFade, southFade) * outerMeander
}

export function getEastTributaryWorldZ(x: number): number {
  const { gridX } = worldToGridCoords(x, 0)
  const localX = gridX - VILLAGE_OFFSET_X
  const baseGy = 23.8 + VILLAGE_OFFSET_Y + Math.sin((localX - 11) * 0.2) * 2.1
  const eastFade = smoothStep(34, 64, localX)
  const outerMeanderZ = Math.sin((x - 48) * 0.014) * 26 - smoothStep(100, 320, x) * 26
  return gridToWorldCoords(gridX, baseGy).z + eastFade * outerMeanderZ
}

export function getWestStreamWorldZ(x: number): number {
  const junctionX = -38
  const dx = Math.max(0, junctionX - x)
  const bendFade = smoothStep(18, 112, dx)
  return -36 - Math.sin(dx * 0.015) * 28 - bendFade * 38
}

export function isMainRiverChannelWorld(x: number, z: number): boolean {
  if (!isLandWorld(x, z) && !isLandWorld(x - 6, z) && !isLandWorld(x + 6, z)) return false
  if (z < -265 || z > 312) return false
  const halfWidth = Math.abs(z) > 85 ? 5.2 : 3.4
  return Math.abs(x - getMainRiverWorldX(z)) <= halfWidth
}

export function isEastTributaryChannelWorld(x: number, z: number): boolean {
  const minX = getMainRiverWorldX(z) - 2
  if (x < minX || x > 385) return false
  if (!isLandWorld(x, z) && !isLandWorld(x, z - 6) && !isLandWorld(x, z + 6)) return false
  const halfWidth = x > 85 ? 4.6 : 3.1
  return Math.abs(z - getEastTributaryWorldZ(x)) <= halfWidth
}

export function isWestStreamChannelWorld(x: number, z: number): boolean {
  const junctionX = getMainRiverWorldX(-36) + 2
  if (x > junctionX || x < -378) return false
  if (!isLandWorld(x, z) && !isLandWorld(x, z - 6) && !isLandWorld(x, z + 6)) return false
  const halfWidth = x < -95 ? 4.4 : 3.1
  return Math.abs(z - getWestStreamWorldZ(x)) <= halfWidth
}

export function isRiverWorld(x: number, z: number): boolean {
  if (getLandmassKindWorld(x, z) === 'ilha-norte') {
    if (x <= -84 && x >= -182 && isLandWorld(x, z)) {
      const creekZ = -384 + Math.sin((x + 84) * 0.032) * 14
      return Math.abs(z - creekZ) <= 3.2
    }
    return false
  }
  return (
    isMainRiverChannelWorld(x, z) ||
    isEastTributaryChannelWorld(x, z) ||
    isWestStreamChannelWorld(x, z)
  )
}

export function isAnyWaterWorld(x: number, z: number): boolean {
  return !isLandWorld(x, z) || isRiverWorld(x, z) || isLakeWorld(x, z)
}

export function getBridgeDirectionWorld(
  x: number,
  z: number,
): 'horizontal' | 'vertical' | null {
  // Long Arctic Sea Bridges visually connecting mainland & islands
  if (Math.abs(x - -38) <= 2.6 && z >= -308 && z <= -224 && !isLandWorld(x, z)) {
    return 'vertical'
  }
  if (Math.abs(x - -220) <= 2.6 && z >= 134 && z <= 224 && !isLandWorld(x, z)) {
    return 'vertical'
  }

  // Mainland river bridges
  if ((Math.abs(z - 1.6) <= 1.9 || Math.abs(z - 148) <= 2.2) && isMainRiverChannelWorld(x, z)) {
    return 'horizontal'
  }
  if (Math.abs(x - 4.8) <= 1.9 && isEastTributaryChannelWorld(x, z)) {
    return 'vertical'
  }
  if (Math.abs(x - 166) <= 2.4 && isEastTributaryChannelWorld(x, z)) {
    return 'vertical'
  }
  if (Math.abs(x - -154) <= 2.4 && isWestStreamChannelWorld(x, z)) {
    return 'vertical'
  }

  return null
}

/**
 * Main avenues & woodland trails linking Vila Central across bridges & lakeshores to every district.
 */
export function isMajorTrailWorld(x: number, z: number): boolean {
  if (x >= -50 && x <= 1 && Math.abs(z - (1.6 + Math.sin(x * 0.08) * 2.2)) <= 2.2) {
    return !isAnyWaterWorld(x, z)
  }
  // Vila Central -> Bosque Aurora & Lago da Aurora
  if (x >= -216 && x <= 2 && z <= 4 && z >= -112) {
    const t = -x / 214
    const targetZ = 1.6 - t * 104 + Math.sin(t * Math.PI) * 20
    if (Math.abs(z - targetZ) <= 2.4) return !isAnyWaterWorld(x, z)
  }
  // Vila Central -> Vale dos Commits & Lago Esmeralda
  if (x >= 1 && x <= 230 && z <= 4 && z >= -114) {
    const t = x / 226
    const targetZ = 1.6 - t * 106 + Math.sin(t * Math.PI) * 18
    if (Math.abs(z - targetZ) <= 2.4) return !isAnyWaterWorld(x, z)
  }
  // Vale dos Commits <-> East Bridge (x=166) <-> Porto Glacial & Lagoa do Porto
  if (x >= 152 && x <= 232 && z >= -108 && z <= 206) {
    const t = (z + 104) / 306
    const targetX = 226 - Math.sin(t * Math.PI) * 60
    if (Math.abs(x - targetX) <= 2.4) return !isAnyWaterWorld(x, z)
  }
  // Vila Central -> Porto Glacial & Lagoa do Porto via South Bridge
  if (x >= 1 && x <= 206 && z >= 1 && z <= 206) {
    const t = Math.max(0, Math.min(1, x / 202))
    const targetZ = 1.6 + t * 200 + Math.sin(t * Math.PI) * 16
    if (Math.abs(z - targetZ) <= 2.4) return !isAnyWaterWorld(x, z)
  }
  // Vila Central -> Northern Sea Bridge (x=-38) -> Ilha Norte Center
  if (Math.abs(x - (1.6 - smoothStep(4, -225, z) * 39.6)) <= 2.5 && z <= 2 && z >= -386) {
    return (isLandWorld(x, z) || getBridgeDirectionWorld(x, z) !== null) && !isRiverWorld(x, z) && !isLakeWorld(x, z)
  }
  // South Cape -> Crystal Isle Sea Bridge (x=-220) -> Lago Cristalino
  if (x >= -248 && x <= -54 && z >= 142 && z <= 290) {
    if (Math.abs(z - 148) <= 2.4 || (Math.abs(x - -220) <= 2.5 && z >= 144)) {
      return (isLandWorld(x, z) || getBridgeDirectionWorld(x, z) !== null) && !isRiverWorld(x, z) && !isLakeWorld(x, z)
    }
  }
  return false
}

export function getContinentRegionAtWorld(x: number, z: number): ContinentRegionInfo {
  if (z < -280 || getLandmassKindWorld(x, z) === 'ilha-norte') {
    return CONTINENT_REGION_BY_ID['ilha-norte']
  }
  let best = CONTINENT_REGIONS[0]
  let bestScore = Infinity
  for (let i = 0; i < CONTINENT_REGIONS.length; i += 1) {
    const r = CONTINENT_REGIONS[i]
    if (r.id === 'ilha-norte') continue
    const d = Math.hypot(x - r.x, z - r.z) / (r.id === 'vila-central' ? 1.12 : 1.0)
    if (d < bestScore) {
      bestScore = d
      best = r
    }
  }
  return best
}

/**
 * Single authoritative playable-zone boundary shared between the 3D camera controller and the radar/minimap.
 * Returns `false` over open Arctic Ocean, empty sea straits, or coastal outer fringes so the camera can never
 * move to barren edges or open water by clicking the minimap, dragging, pressing WASD, or focusing bounds.
 */
export function isWithinSafePlayableBounds(x: number, z: number): boolean {
  const kind = getLandmassKindWorld(x, z)
  if (!kind) return false

  // Strict inland buffer away from the open sea & treeless shoreline
  const margin = kind === 'main' ? 70 : kind === 'ilha-norte' ? 46 : 44
  for (let k = 0; k < 8; k += 1) {
    const a = (k * Math.PI) / 4
    if (!isLandWorld(x + Math.cos(a) * margin, z + Math.sin(a) * margin)) {
      return false
    }
  }
  return true
}

/**
 * Clamps any target coordinate strictly inside `isWithinSafePlayableBounds(x, z)`.
 */
export function clampCameraTargetToContinent(x: number, z: number): { x: number; z: number } {
  const clampedX = Math.max(WORLD_MAP_BOUNDS.minX + 45, Math.min(WORLD_MAP_BOUNDS.maxX - 45, x))
  const clampedZ = Math.max(WORLD_MAP_BOUNDS.minZ + 45, Math.min(WORLD_MAP_BOUNDS.maxZ - 45, z))
  if (isWithinSafePlayableBounds(clampedX, clampedZ)) {
    return { x: clampedX, z: clampedZ }
  }

  let anchorX = CONTINENT_REGION_BY_ID['vila-central'].x
  let anchorZ = CONTINENT_REGION_BY_ID['vila-central'].z
  if (clampedZ < -265) {
    anchorX = CONTINENT_REGION_BY_ID['ilha-norte'].x
    anchorZ = CONTINENT_REGION_BY_ID['ilha-norte'].z
  } else if (clampedZ > 170 && clampedX < -105) {
    anchorX = -244
    anchorZ = 286
  }

  let bestX = anchorX
  let bestZ = anchorZ
  let lo = 0
  let hi = 1
  for (let iter = 0; iter < 14; iter += 1) {
    const mid = (lo + hi) * 0.5
    const tx = clampedX + (anchorX - clampedX) * mid
    const tz = clampedZ + (anchorZ - clampedZ) * mid
    if (isWithinSafePlayableBounds(tx, tz)) {
      hi = mid
      bestX = tx
      bestZ = tz
    } else {
      lo = mid
    }
  }
  return { x: bestX, z: bestZ }
}
