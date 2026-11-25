import {
  CITY_MAP_CONFIG,
  MIN_TREE_SPACING,
  MIN_TREE_SPACING_GRID,
  NORTH_POLE_LANDMARKS,
  OUTER_IGLOO_VILLAGES,
  OUTER_NEIGHBORHOOD_CHALETS,
  OUTER_WATCHTOWERS,
  OUTER_WOODLAND_PROPS,
  VILLAGE_OFFSET_X,
  VILLAGE_OFFSET_Y,
} from '../../config/cityMapConfig'
import type { TreePosition } from '../../types/city'
import {
  CONTINENT_REGIONS,
  type ContinentRegionId,
  getBridgeDirectionWorld,
  getEastTributaryWorldZ,
  getMainRiverWorldX,
  getNearestLakeDistanceWorld,
  getWestStreamWorldZ,
  gridToWorldCoords,
  isLakePierWorld,
  isMajorTrailWorld,
  isRiverWorld,
  isSafeInlandWorld,
  worldToGridCoords,
} from './continentGeography'

export interface VillageBuildingPlacement {
  gridX: number
  gridY: number
  variant: 'santa-treehouse' | 'crystal-tower' | 'elven-pavilion'
}

export interface VillageDecorationPlacement {
  gridX: number
  gridY: number
  type:
    | 'north-pole'
    | 'lamp'
    | 'campfire'
    | 'sleigh'
    | 'igloo'
    | 'candy-cane'
    | 'snowman'
    | 'signpost'
    | 'gift-pile'
    | 'caretaker'
    | 'market-stall'
    | 'mushroom-house'
}

export const VILLAGE_COTTAGES: readonly VillageBuildingPlacement[] = [
  {
    gridX: NORTH_POLE_LANDMARKS.santaTreehouse.gridX,
    gridY: NORTH_POLE_LANDMARKS.santaTreehouse.gridY,
    variant: 'santa-treehouse',
  },
  {
    gridX: NORTH_POLE_LANDMARKS.crystalTower.gridX,
    gridY: NORTH_POLE_LANDMARKS.crystalTower.gridY,
    variant: 'crystal-tower',
  },
  {
    gridX: NORTH_POLE_LANDMARKS.elvenPavilion.gridX,
    gridY: NORTH_POLE_LANDMARKS.elvenPavilion.gridY,
    variant: 'elven-pavilion',
  },
]

const OX = VILLAGE_OFFSET_X
const OY = VILLAGE_OFFSET_Y

export const VILLAGE_DECORATIONS: readonly VillageDecorationPlacement[] = [
  { gridX: 24 + OX, gridY: 18 + OY, type: 'north-pole' },
  { gridX: 22.5 + OX, gridY: 17.5 + OY, type: 'campfire' },
  { gridX: 25.5 + OX, gridY: 17 + OY, type: 'candy-cane' },
  { gridX: 22.5 + OX, gridY: 19 + OY, type: 'candy-cane' },
  { gridX: 25.5 + OX, gridY: 19 + OY, type: 'gift-pile' },
  { gridX: 25.8 + OX, gridY: 18 + OY, type: 'caretaker' },
  { gridX: 22 + OX, gridY: 18 + OY, type: 'signpost' },

  {
    gridX: NORTH_POLE_LANDMARKS.marketStall.gridX,
    gridY: NORTH_POLE_LANDMARKS.marketStall.gridY,
    type: 'market-stall',
  },

  { gridX: 26.2 + OX, gridY: 15.6 + OY, type: 'candy-cane' },
  { gridX: 31.8 + OX, gridY: 15.6 + OY, type: 'candy-cane' },
  { gridX: 25.8 + OX, gridY: 13.8 + OY, type: 'lamp' },

  { gridX: 18.5 + OX, gridY: 12.5 + OY, type: 'sleigh' },
  { gridX: 17 + OX, gridY: 13.5 + OY, type: 'campfire' },

  { gridX: 9.5 + OX, gridY: 28.5 + OY, type: 'igloo' },
  { gridX: 3.5 + OX, gridY: 25.2 + OY, type: 'igloo' },
  { gridX: 7.8 + OX, gridY: 26.2 + OY, type: 'snowman' },

  { gridX: 7.2 + OX, gridY: 19.2 + OY, type: 'lamp' },
  { gridX: 5.5 + OX, gridY: 15.5 + OY, type: 'lamp' },
  { gridX: 14.5 + OX, gridY: 18 + OY, type: 'lamp' },
  { gridX: 14.8 + OX, gridY: 19.8 + OY, type: 'lamp' },
  { gridX: 21 + OX, gridY: 21.5 + OY, type: 'lamp' },
  { gridX: 33 + OX, gridY: 17.2 + OY, type: 'lamp' },
  { gridX: 33 + OX, gridY: 20 + OY, type: 'lamp' },
  { gridX: 26.2 + OX, gridY: 28.0 + OY, type: 'lamp' },
  { gridX: 15 + OX, gridY: 9 + OY, type: 'lamp' },
  { gridX: 35 + OX, gridY: 10 + OY, type: 'lamp' },

  { gridX: 34 + OX, gridY: 23.5 + OY, type: 'campfire' },
  { gridX: 35.5 + OX, gridY: 13.5 + OY, type: 'snowman' },
  { gridX: 17.2 + OX, gridY: 20.6 + OY, type: 'snowman' },
  { gridX: 22.0 + OX, gridY: 15.5 + OY, type: 'snowman' },

  ...NORTH_POLE_LANDMARKS.mushroomHouses.map((m) => ({
    gridX: m.gridX,
    gridY: m.gridY,
    type: 'mushroom-house' as const,
  })),
]

export function getMainRiverCenterX(gridY: number): number {
  const { z } = gridToWorldCoords(0, gridY)
  return worldToGridCoords(getMainRiverWorldX(z), z).gridX
}

export function getEastTributaryCenterY(gridX: number): number {
  const { x } = gridToWorldCoords(gridX, 0)
  return worldToGridCoords(x, getEastTributaryWorldZ(x)).gridY
}

export function getWestTributaryCenterY(gridX: number): number {
  const { x } = gridToWorldCoords(gridX, 0)
  return worldToGridCoords(x, getWestStreamWorldZ(x)).gridY
}

export function isRiverTile(gridX: number, gridY: number): boolean {
  const { x, z } = gridToWorldCoords(gridX, gridY)
  return isRiverWorld(x, z)
}

export function getBridgeOrientation(
  gridX: number,
  gridY: number,
): 'horizontal' | 'vertical' | null {
  const { x, z } = gridToWorldCoords(gridX, gridY)
  return getBridgeDirectionWorld(x, z)
}

export function isBridgeTile(gridX: number, gridY: number): boolean {
  return getBridgeOrientation(gridX, gridY) !== null
}

export function isRoadTile(_gridX: number, _gridY: number): boolean {
  void _gridX
  void _gridY
  return false
}

export function isSnowTrailTile(gridX: number, gridY: number): boolean {
  const lx = gridX - OX
  const ly = gridY - OY

  // Central village cozy footpaths
  if (lx >= 9 && lx <= 23 && Math.abs(ly - (18 + Math.sin((lx - 12) * 0.32) * 0.6)) <= 0.55) {
    return !isRiverTile(gridX, gridY)
  }
  if (
    lx >= 6 &&
    lx <= 8.8 &&
    Math.abs(ly - (21.2 - ((gxDiff) => gxDiff * 3.2)((lx - 6.2) / 2.6))) <= 0.55
  ) {
    return !isRiverTile(gridX, gridY)
  }
  if (ly >= 14.5 && ly <= 20.2 && Math.abs(lx - (6.0 - (20.2 - ly) * 0.34)) <= 0.5) {
    return !isRiverTile(gridX, gridY)
  }
  if (lx >= 25 && lx <= 29.5) {
    const t = (lx - 25) / 4.5
    const targetY = 18 - t * 3.0
    if (Math.abs(ly - targetY) <= 0.55) return !isRiverTile(gridX, gridY)
  }
  if (lx >= 31.2 && lx <= 34.8) {
    const t = (lx - 31.2) / 3.6
    const targetY = 15.8 + t * 1.8
    if (Math.abs(ly - targetY) <= 0.5) return !isRiverTile(gridX, gridY)
  }
  if (ly >= 15 && ly <= 17.5 && Math.abs(lx - 23.6) <= 0.55) {
    return !isRiverTile(gridX, gridY)
  }
  if (ly >= 19 && ly <= 26 && Math.abs(lx - (24.5 + Math.sin((ly - 19) * 0.4) * 0.5)) <= 0.55) {
    return !isRiverTile(gridX, gridY)
  }
  if (ly >= 18.6 && ly <= 20.8 && Math.abs(lx - 15.2) <= 0.5) {
    return !isRiverTile(gridX, gridY)
  }
  if (ly >= 26.2 && ly <= 29.0 && Math.abs(lx - (25.2 + (ly - 26.2) * 0.72)) <= 0.5) {
    return !isRiverTile(gridX, gridY)
  }

  const { x, z } = gridToWorldCoords(gridX, gridY)
  return isMajorTrailWorld(x, z)
}

export function isPlazaTile(gridX: number, gridY: number): boolean {
  const dx = gridX - CITY_MAP_CONFIG.plazaCenter.gridX
  const dy = gridY - CITY_MAP_CONFIG.plazaCenter.gridY
  return Math.hypot(dx, dy) <= 2.25
}

export function isFrozenPondTile(gridX: number, gridY: number): boolean {
  const lx = gridX - OX
  const ly = gridY - OY
  return lx >= 4 && lx <= 8 && ly >= 27 && ly <= 31
}

export function isPierTile(gridX: number, gridY: number): boolean {
  const lx = gridX - OX
  const ly = gridY - OY
  return (lx === 7 || lx === 8) && ly === 29
}

export function hashUsername(username: string): number {
  let hash = 2166136261
  for (let i = 0; i < username.length; i += 1) {
    hash ^= username.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mixHash32(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Checks whether a candidate plot collides with central village buildings, coastline cliffs,
 * rivers/bridges, trails, or neighborhood structures across the entire continent & islands.
 */
export function isBlockedForTree(x: number, y: number): boolean {
  const world = gridToWorldCoords(x, y)
  if (!isSafeInlandWorld(world.x, world.z, 4.4)) {
    return true
  }

  // Keep Harbor pier waterfront at Porto Glacial clear on the balanced SE coast
  if (world.x >= 316 && world.x <= 368 && world.z >= 254 && world.z <= 296) {
    return true
  }

  const checkOffsets = [
    [0, 0],
    [-2.1, 0],
    [2.1, 0],
    [0, -2.1],
    [0, 2.1],
  ]

  for (const [oxW, ozW] of checkOffsets) {
    const wx = world.x + oxW
    const wz = world.z + ozW
    if (
      isRiverWorld(wx, wz) ||
      isLakePierWorld(wx, wz) ||
      getBridgeDirectionWorld(wx, wz) !== null ||
      isMajorTrailWorld(wx, wz)
    ) {
      return true
    }
    const gx = Math.round(x + oxW / 3.2)
    const gy = Math.round(y + ozW / 3.2)
    if (isFrozenPondTile(gx, gy) || isPierTile(gx, gy) || isSnowTrailTile(gx, gy)) {
      return true
    }
  }

  if (isPlazaTile(x, y)) return true

  const { santaTreehouse, crystalTower, elvenPavilion, marketStall } = NORTH_POLE_LANDMARKS
  if (
    Math.abs(x - santaTreehouse.centerGridX) <= santaTreehouse.padX &&
    Math.abs(y - santaTreehouse.centerGridY) <= santaTreehouse.padY
  ) {
    return true
  }
  if (
    Math.abs(x - crystalTower.centerGridX) <= crystalTower.padX &&
    Math.abs(y - crystalTower.centerGridY) <= crystalTower.padY
  ) {
    return true
  }
  if (
    Math.abs(x - elvenPavilion.centerGridX) <= elvenPavilion.padX &&
    Math.abs(y - elvenPavilion.centerGridY) <= elvenPavilion.padY
  ) {
    return true
  }
  if (
    Math.abs(x - marketStall.gridX) <= marketStall.padX &&
    Math.abs(y - marketStall.gridY) <= marketStall.padY
  ) {
    return true
  }

  for (const d of VILLAGE_DECORATIONS) {
    if (d.type === 'market-stall') continue
    const pad =
      d.type === 'sleigh' || d.type === 'igloo'
        ? 1.5
        : d.type === 'north-pole'
          ? 2.2
          : d.type === 'mushroom-house'
            ? 1.55
            : 1.0
    if (Math.hypot(x - d.gridX, y - d.gridY) <= pad) {
      return true
    }
  }

  for (const chalet of OUTER_NEIGHBORHOOD_CHALETS) {
    const pad = chalet.variant === 'stall' ? 1.85 : 2.55
    if (Math.hypot(x - chalet.gridX, y - chalet.gridY) <= pad) {
      return true
    }
  }

  for (const tower of OUTER_WATCHTOWERS) {
    if (Math.hypot(x - tower.gridX, y - tower.gridY) <= 2.15) {
      return true
    }
  }

  for (const prop of OUTER_WOODLAND_PROPS) {
    const pad = prop.type === 'igloo' ? 1.8 : prop.type === 'campfire' ? 1.25 : 1.05
    if (Math.hypot(x - prop.gridX, y - prop.gridY) <= pad) {
      return true
    }
  }

  for (const igloo of OUTER_IGLOO_VILLAGES) {
    if (Math.hypot(x - igloo.gridX, y - igloo.gridY) <= 2.1) {
      return true
    }
  }

  return false
}

function isNaturalWoodlandGlade(wx: number, wz: number): boolean {
  // Keep Vila Central and inner districts homogeneously wooded without deserted clearings
  if (Math.hypot(wx - 1.6, wz - 1.6) < 115) return false
  const gladeWave =
    Math.sin(wx * 0.045 + Math.cos(wz * 0.036) * 1.9) *
    Math.cos(wz * 0.042 - Math.sin(wx * 0.028) * 1.5)
  return gladeWave > 0.84
}

// Multi-hub saturated Polar Poisson-Disc generator distributing up to 3,500 real developer trees
// across all 5 continent regions, Ilha Cristalina & all 6 scenic lakeshores
const PHI_CONJUGATE = (Math.sqrt(5) - 1) / 2
const SPATIAL_CELL_WORLD = 10
const CURATED_INNER_TARGET = 520

type PlacementHubId = ContinentRegionId | 'ilha-cristalina'

interface HubState {
  id: PlacementHubId
  centerX: number
  centerZ: number
  shellIdx: number
  probesDoneInShell: number
}

// Balanced distribution: ~30% Vila Central, ~20% Bosque Aurora, ~20% Vale dos Commits,
// ~15% Porto Glacial, ~10% Ilha Norte, ~5% Ilha Cristalina
const HUB_SCHEDULE: readonly PlacementHubId[] = [
  'vila-central',
  'bosque-aurora',
  'vale-commits',
  'vila-central',
  'porto-glacial',
  'ilha-norte',
  'bosque-aurora',
  'vila-central',
  'vale-commits',
  'porto-glacial',
  'vila-central',
  'ilha-cristalina',
  'bosque-aurora',
  'vale-commits',
  'vila-central',
  'porto-glacial',
  'ilha-norte',
  'bosque-aurora',
  'vila-central',
  'vale-commits',
]

const regionLookup = new Map(CONTINENT_REGIONS.map((r) => [r.id, r]))
const hubStates: Record<PlacementHubId, HubState> = {
  'vila-central': {
    id: 'vila-central',
    centerX: regionLookup.get('vila-central')?.x ?? 1.6,
    centerZ: regionLookup.get('vila-central')?.z ?? 1.6,
    shellIdx: 0,
    probesDoneInShell: 0,
  },
  'bosque-aurora': {
    id: 'bosque-aurora',
    centerX: regionLookup.get('bosque-aurora')?.x ?? -214,
    centerZ: regionLookup.get('bosque-aurora')?.z ?? -102,
    shellIdx: 0,
    probesDoneInShell: 0,
  },
  'vale-commits': {
    id: 'vale-commits',
    centerX: regionLookup.get('vale-commits')?.x ?? 226,
    centerZ: regionLookup.get('vale-commits')?.z ?? -104,
    shellIdx: 0,
    probesDoneInShell: 0,
  },
  'porto-glacial': {
    id: 'porto-glacial',
    centerX: regionLookup.get('porto-glacial')?.x ?? 202,
    centerZ: regionLookup.get('porto-glacial')?.z ?? 202,
    shellIdx: 0,
    probesDoneInShell: 0,
  },
  'ilha-norte': {
    id: 'ilha-norte',
    centerX: regionLookup.get('ilha-norte')?.x ?? -38,
    centerZ: regionLookup.get('ilha-norte')?.z ?? -384,
    shellIdx: 0,
    probesDoneInShell: 0,
  },
  'ilha-cristalina': {
    id: 'ilha-cristalina',
    centerX: -244,
    centerZ: 286,
    shellIdx: 0,
    probesDoneInShell: 0,
  },
}

const ALL_HUB_CENTERS: ReadonlyArray<{ x: number; z: number }> = Object.values(hubStates).map((h) => ({
  x: h.centerX,
  z: h.centerZ,
}))

function getRequiredRealTreeSpacingSq(wx: number, wz: number): number {
  const plazaDist = Math.hypot(wx - 1.6, wz - 1.6)
  if (plazaDist <= 68 || getNearestLakeDistanceWorld(wx, wz) <= 32) {
    return MIN_TREE_SPACING * MIN_TREE_SPACING
  }
  let minHubDist = Infinity
  for (let i = 0; i < ALL_HUB_CENTERS.length; i += 1) {
    const d = Math.hypot(wx - ALL_HUB_CENTERS[i].x, wz - ALL_HUB_CENTERS[i].z)
    if (d < minHubDist) minHubDist = d
  }
  if (minHubDist <= 90) return 6.0 * 6.0
  if (minHubDist <= 155) return 6.9 * 6.9
  return 7.8 * 7.8
}

const organicPlotsCache: TreePosition[] = []
const organicWorldCache: Array<{ x: number; z: number }> = []
const organicSpatialHash = new Map<number, number[]>()
let hubCursor = 0

function plotSpatialKey(cellX: number, cellZ: number): number {
  return ((cellX + 2048) << 12) | (cellZ + 2048)
}

function fitsWorldSpacing(wx: number, wz: number): boolean {
  const minDistSq = getRequiredRealTreeSpacingSq(wx, wz)
  const cx = Math.floor(wx / SPATIAL_CELL_WORLD)
  const cz = Math.floor(wz / SPATIAL_CELL_WORLD)
  for (let ox = -1; ox <= 1; ox += 1) {
    for (let oz = -1; oz <= 1; oz += 1) {
      const list = organicSpatialHash.get(plotSpatialKey(cx + ox, cz + oz))
      if (!list) continue
      for (let i = 0; i < list.length; i += 1) {
        const p = organicWorldCache[list[i]]
        const dx = p.x - wx
        const dz = p.z - wz
        if (dx * dx + dz * dz < minDistSq) {
          return false
        }
      }
    }
  }
  return true
}

function registerAcceptedWorldPlot(wx: number, wz: number): void {
  const idx = organicPlotsCache.length
  const grid = worldToGridCoords(wx, wz)
  organicPlotsCache.push({
    gridX: Number(grid.gridX.toFixed(2)),
    gridY: Number(grid.gridY.toFixed(2)),
  })
  organicWorldCache.push({ x: wx, z: wz })

  const cx = Math.floor(wx / SPATIAL_CELL_WORLD)
  const cz = Math.floor(wz / SPATIAL_CELL_WORLD)
  const key = plotSpatialKey(cx, cz)
  const bucket = organicSpatialHash.get(key)
  if (bucket) bucket.push(idx)
  else organicSpatialHash.set(key, [idx])
}

function tryAdvanceHubPlot(hub: HubState): boolean {
  const shellStep = 3.4
  const baseStart = hub.id === 'vila-central' ? 8.2 : 9.0

  for (let guard = 0; guard < 180; guard += 1) {
    // Expand organic hub shell radius across the ~880u balanced continent before softly folding back
    if (hub.shellIdx > 104) {
      hub.shellIdx = 0
      hub.probesDoneInShell = 0
      return false
    }

    const r0 = baseStart + hub.shellIdx * shellStep
    const rMid = r0 + shellStep * 0.5
    const probesInShell = Math.max(24, Math.ceil((2 * Math.PI * rMid) / 3.2))
    const shellOffsetFrac = mixHash32(hub.shellIdx * 31 + hub.centerX) / 0xffffffff

    while (hub.probesDoneInShell < probesInShell) {
      const m = hub.probesDoneInShell
      hub.probesDoneInShell += 1

      const probeSeed = (hub.shellIdx * 4099 + m) ^ Math.abs(Math.round(hub.centerX * 17))
      const hRad = mixHash32(probeSeed * 3 + 17) / 0xffffffff
      const hTheta = mixHash32(probeSeed * 5 + 41) / 0xffffffff
      const hJx = mixHash32(probeSeed * 7 + 79) / 0xffffffff
      const hJy = mixHash32(probeSeed * 11 + 109) / 0xffffffff

      const angleFrac = (m * PHI_CONJUGATE + shellOffsetFrac) % 1
      const angle = angleFrac * Math.PI * 2 + (hTheta - 0.5) * 0.5
      const r = r0 + hRad * shellStep

      const wx = hub.centerX + Math.cos(angle) * r + (hJx - 0.5) * 2.3
      const wz = hub.centerZ + Math.sin(angle) * r + (hJy - 0.5) * 2.3
      const { gridX, gridY } = worldToGridCoords(wx, wz)

      if (isNaturalWoodlandGlade(wx, wz) || isBlockedForTree(gridX, gridY)) continue
      if (!fitsWorldSpacing(wx, wz)) continue

      registerAcceptedWorldPlot(wx, wz)
      return true
    }

    hub.shellIdx += 1
    hub.probesDoneInShell = 0
  }

  return false
}

function ensureOrganicPlotsCapacity(minLength: number): void {
  if (organicPlotsCache.length === 0) {
    // Anchor slot 0 directly beside the central North Pole plaza (@SaraMag25)
    const cx = CITY_MAP_CONFIG.plazaCenter.gridX
    const cy = CITY_MAP_CONFIG.plazaCenter.gridY
    const anchor = gridToWorldCoords(cx + 2.35, cy + 2.15)
    registerAcceptedWorldPlot(anchor.x, anchor.z)
  }

  while (organicPlotsCache.length < minLength) {
    // Anchor first 140 trees nicely around Vila Central before fanning across all regions & lakes
    const hubId =
      organicPlotsCache.length < 140
        ? 'vila-central'
        : HUB_SCHEDULE[hubCursor % HUB_SCHEDULE.length]
    hubCursor += 1

    if (!tryAdvanceHubPlot(hubStates[hubId])) {
      tryAdvanceHubPlot(hubStates['vila-central'])
    }
  }
}

ensureOrganicPlotsCapacity(CURATED_INNER_TARGET)

export const CURATED_TREE_PLOTS: readonly TreePosition[] = organicPlotsCache.slice(
  0,
  CURATED_INNER_TARGET,
)

export const CENTERED_CURATED_PLOTS: readonly TreePosition[] = CURATED_TREE_PLOTS

/**
 * Deterministic, collision-free organic forest plot lookup across all 5 continent neighborhoods.
 */
export function getSpiralPlotPosition(plotIndex: number): TreePosition {
  const safeIndex = Math.max(0, Math.floor(plotIndex))
  ensureOrganicPlotsCapacity(safeIndex + 1)
  return organicPlotsCache[safeIndex]
}

export function isTreePlacementClear(
  x: number,
  y: number,
  occupiedPositions: readonly TreePosition[],
  minDistGrid = MIN_TREE_SPACING_GRID,
): boolean {
  const minDistSq = minDistGrid * minDistGrid
  for (let i = 0; i < occupiedPositions.length; i += 1) {
    const pos = occupiedPositions[i]
    const dx = pos.gridX - x
    const dy = pos.gridY - y
    if (dx * dx + dy * dy < minDistSq) {
      return false
    }
  }
  return true
}

export function selectStratifiedTreePlots(
  plots: readonly TreePosition[],
  targetCount: number,
): TreePosition[] {
  if (targetCount >= plots.length) return [...plots]
  const picked: TreePosition[] = []
  const used = new Set<number>()
  for (let i = 0; i < targetCount; i += 1) {
    const idx = Math.min(plots.length - 1, Math.floor((i * plots.length) / targetCount))
    if (!used.has(idx)) {
      used.add(idx)
      picked.push(plots[idx])
    }
  }
  return picked
}

export function allocateTreePosition(
  occupiedPositions: readonly TreePosition[],
  _username?: string,
): TreePosition {
  void _username
  const maxProbe = occupiedPositions.length + CURATED_INNER_TARGET + 256
  for (let idx = 0; idx < maxProbe; idx += 1) {
    const candidate = getSpiralPlotPosition(idx)
    if (isTreePlacementClear(candidate.gridX, candidate.gridY, occupiedPositions)) {
      return candidate
    }
  }
  return getSpiralPlotPosition(occupiedPositions.length + CURATED_INNER_TARGET)
}
