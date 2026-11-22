import {
  CITY_MAP_CONFIG,
  MIN_TREE_SPACING_GRID,
  NORTH_POLE_LANDMARKS,
  VILLAGE_OFFSET_X,
  VILLAGE_OFFSET_Y,
} from '../../config/cityMapConfig'
import type { TreePosition } from '../../types/city'

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

/**
 * Hero North Pole structures: monumental Santa's Treehouse landmark, Crystal Tower
 * observatory on the left-bank woodland clearing, and southeastern timber pavilion.
 */
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

/**
 * North Pole landmarks, market stall, giant magic mushrooms, rustic lanterns, sleigh,
 * igloos, candy canes, and warm campfires spaced harmoniously without leaving bare snow strips.
 */
const OX = VILLAGE_OFFSET_X
const OY = VILLAGE_OFFSET_Y

export const VILLAGE_DECORATIONS: readonly VillageDecorationPlacement[] = [
  // Central North Pole monument & surrounding festive accents
  { gridX: 24 + OX, gridY: 18 + OY, type: 'north-pole' },
  { gridX: 22.5 + OX, gridY: 17.5 + OY, type: 'campfire' },
  { gridX: 25.5 + OX, gridY: 17 + OY, type: 'candy-cane' },
  { gridX: 22.5 + OX, gridY: 19 + OY, type: 'candy-cane' },
  { gridX: 25.5 + OX, gridY: 19 + OY, type: 'gift-pile' },
  { gridX: 25.8 + OX, gridY: 18 + OY, type: 'caretaker' },
  { gridX: 22 + OX, gridY: 18 + OY, type: 'signpost' },

  // North Pole Market Stall overlooking the central plaza
  {
    gridX: NORTH_POLE_LANDMARKS.marketStall.gridX,
    gridY: NORTH_POLE_LANDMARKS.marketStall.gridY,
    type: 'market-stall',
  },

  // Monumental Santa Treehouse courtyard accents
  { gridX: 26.2 + OX, gridY: 15.6 + OY, type: 'candy-cane' },
  { gridX: 31.8 + OX, gridY: 15.6 + OY, type: 'candy-cane' },
  { gridX: 25.8 + OX, gridY: 13.8 + OY, type: 'lamp' },

  // Sleigh parked near the northern reindeer meadow
  { gridX: 18.5 + OX, gridY: 12.5 + OY, type: 'sleigh' },
  { gridX: 17 + OX, gridY: 13.5 + OY, type: 'campfire' },

  // Igloos & snowman along the frozen pond shore
  { gridX: 9.5 + OX, gridY: 28.5 + OY, type: 'igloo' },
  { gridX: 3.5 + OX, gridY: 25.2 + OY, type: 'igloo' },
  { gridX: 7.8 + OX, gridY: 26.2 + OY, type: 'snowman' },

  // Rustic wooden lanterns along trails, Crystal Tower clearing, Mushroom Houses & expanded woods
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
  { gridX: 4.5, gridY: 38, type: 'lamp' },
  { gridX: 53.5, gridY: 11.5, type: 'lamp' },

  // Additional cozy snowmen & campfires
  { gridX: 34 + OX, gridY: 23.5 + OY, type: 'campfire' },
  { gridX: 35.5 + OX, gridY: 13.5 + OY, type: 'snowman' },
  { gridX: 17.2 + OX, gridY: 20.6 + OY, type: 'snowman' },
  { gridX: 22.0 + OX, gridY: 15.5 + OY, type: 'snowman' },
  { gridX: 4.5, gridY: 23.5, type: 'snowman' },
  { gridX: 53.5, gridY: 38.5, type: 'snowman' },

  // Cozy Pixel Mushroom Houses tucked into woodland clearings
  ...NORTH_POLE_LANDMARKS.mushroomHouses.map((m) => ({
    gridX: m.gridX,
    gridY: m.gridY,
    type: 'mushroom-house' as const,
  })),
]

export function getMainRiverCenterX(gridY: number): number {
  const localY = gridY - OY
  return 11.5 + OX + Math.sin(localY * 0.24) * 2.7
}

export function isRiverTile(gridX: number, gridY: number): boolean {
  const { cols, rows, skyRows } = CITY_MAP_CONFIG
  if (gridY < skyRows || gridY >= rows || gridX < 0 || gridX >= cols) return false

  const localX = gridX - OX
  const mainRiverCenterX = getMainRiverCenterX(gridY)
  const inMainRiver = Math.abs(gridX - mainRiverCenterX) <= 0.9

  const eastRiverCenterY = 23.8 + OY + Math.sin((localX - 11) * 0.2) * 2.1
  const inEastTributary = gridX >= 11 + OX && Math.abs(gridY - eastRiverCenterY) <= 0.85

  return inMainRiver || inEastTributary
}

export function isBridgeTile(gridX: number, gridY: number): boolean {
  const westBridge = gridY === 18 + OY && isRiverTile(gridX, gridY)
  const southBridge = gridX === 25 + OX && isRiverTile(gridX, gridY)
  return westBridge || southBridge
}

/**
 * Legacy straight gray streets are removed for the North Pole forest theme.
 * Kept for backwards compatibility with any caller importing `isRoadTile`.
 */
export function isRoadTile(_gridX: number, _gridY: number): boolean {
  void _gridX
  void _gridY
  return false
}

/**
 * Subtle organic packed-snow & timber stepping trails linking key North Pole spots.
 */
export function isSnowTrailTile(gridX: number, gridY: number): boolean {
  const lx = gridX - OX
  const ly = gridY - OY

  // Gentle curved path from west bridge to North Pole center
  if (lx >= 9 && lx <= 23 && Math.abs(ly - (18 + Math.sin((lx - 12) * 0.32) * 0.6)) <= 0.55) {
    return !isRiverTile(gridX, gridY)
  }
  // Lantern-lit path linking western bridge southwest to Crystal Tower and northward
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
  // Organic trail curving from North Pole center up-east to Santa's Treehouse
  if (lx >= 25 && lx <= 29.5) {
    const t = (lx - 25) / 4.5
    const targetY = 18 - t * 3.0
    if (Math.abs(ly - targetY) <= 0.55) return !isRiverTile(gridX, gridY)
  }
  // Gentle trail linking Santa's Treehouse eastern yard to the Cocoa Mushroom House
  if (lx >= 31.2 && lx <= 34.8) {
    const t = (lx - 31.2) / 3.6
    const targetY = 15.8 + t * 1.8
    if (Math.abs(ly - targetY) <= 0.5) return !isRiverTile(gridX, gridY)
  }
  // Short plaza spur north to the North Pole Market Stall
  if (ly >= 15 && ly <= 17.5 && Math.abs(lx - 23.6) <= 0.55) {
    return !isRiverTile(gridX, gridY)
  }
  // Short path from North Pole center south to the southeastern wooden bridge & mushroom spurs
  if (ly >= 19 && ly <= 26 && Math.abs(lx - (24.5 + Math.sin((ly - 19) * 0.4) * 0.5)) <= 0.55) {
    return !isRiverTile(gridX, gridY)
  }
  if (ly >= 18.6 && ly <= 20.8 && Math.abs(lx - 15.2) <= 0.5) {
    return !isRiverTile(gridX, gridY)
  }
  if (ly >= 26.2 && ly <= 29.0 && Math.abs(lx - (25.2 + (ly - 26.2) * 0.72)) <= 0.5) {
    return !isRiverTile(gridX, gridY)
  }
  return false
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

function isBlockedForTree(x: number, y: number): boolean {
  // Keep tree trunks safely off water & bridges without creating barren snow strips on banks
  const checkPoints = [
    [x, y],
    [x - 0.44, y],
    [x + 0.44, y],
    [x, y - 0.44],
    [x, y + 0.44],
  ]

  for (const [cx, cy] of checkPoints) {
    const gx = Math.round(cx)
    const gy = Math.round(cy)
    if (
      isRiverTile(gx, gy) ||
      isBridgeTile(gx, gy) ||
      isFrozenPondTile(gx, gy) ||
      isPierTile(gx, gy)
    ) {
      return true
    }
  }

  if (isPlazaTile(x, y) || isSnowTrailTile(Math.round(x), Math.round(y))) {
    return true
  }

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
        ? 1.45
        : d.type === 'north-pole'
          ? 2.15
          : d.type === 'mushroom-house'
            ? 1.45
            : 0.9
    if (Math.hypot(x - d.gridX, y - d.gridY) <= pad) {
      return true
    }
  }

  return false
}

/**
 * Generates a rich, cozy North Pole woodland across the 58x44 map while strictly enforcing
 * MIN_TREE_SPACING_GRID (1.75 tiles / 5.60 world units) and open 30-degree circumcenter pockets for pets.
 */
function buildSpacedForestPlots(): TreePosition[] {
  const plots: TreePosition[] = []
  const { cols, rows, skyRows } = CITY_MAP_CONFIG
  const minDistSq = MIN_TREE_SPACING_GRID * MIN_TREE_SPACING_GRID

  const fitsMinSpacing = (x: number, y: number): boolean => {
    for (let i = 0; i < plots.length; i += 1) {
      const p = plots[i]
      const dx = p.gridX - x
      const dy = p.gridY - y
      if (dx * dx + dy * dy < minDistSq) {
        return false
      }
    }
    return true
  }

  // Hexagonal lattice with 1.84 x 1.59 spacing (~5.89u side -> ~3.40u circumradius open pet pocket)
  const stepX = 1.84
  const stepY = 1.59

  let rowIdx = 0
  for (let baseY = skyRows + 1.1; baseY <= rows - 1.3; baseY += stepY) {
    const staggerX = rowIdx % 2 === 1 ? stepX * 0.5 : 0
    for (let baseX = 1.3 + staggerX; baseX <= cols - 1.4; baseX += stepX) {
      const cellHash = Math.abs(Math.round(baseX * 73) ^ Math.round(baseY * 139)) % 100
      const jitterX = (((cellHash % 7) - 3) / 3) * 0.1
      const jitterY = ((((Math.floor(cellHash / 7)) % 7) - 3) / 3) * 0.1
      const gx = Number((baseX + jitterX).toFixed(2))
      const gy = Number((baseY + jitterY).toFixed(2))

      if (gx < 1.1 || gx > cols - 1.2 || gy < skyRows + 1.0 || gy > rows - 1.2) continue
      if (isBlockedForTree(gx, gy) || !fitsMinSpacing(gx, gy)) continue

      plots.push({ gridX: gx, gridY: gy })
    }
    rowIdx += 1
  }

  // Fill organic edge pockets around landmarks, riverbanks, and trails while preserving MIN_TREE_SPACING_GRID
  for (let gy = skyRows + 1.2; gy <= rows - 1.4; gy += 0.6) {
    for (let gx = 1.3; gx <= cols - 1.4; gx += 0.6) {
      const rx = Number(gx.toFixed(2))
      const ry = Number(gy.toFixed(2))
      if (!isBlockedForTree(rx, ry) && fitsMinSpacing(rx, ry)) {
        plots.push({ gridX: rx, gridY: ry })
      }
    }
  }

  return plots
}

export const CURATED_TREE_PLOTS: readonly TreePosition[] = buildSpacedForestPlots()

/**
 * Selects `targetCount` plots evenly distributed across the entire north-to-south
 * and west-to-east forest span so center and outer regions maintain balanced spacing.
 */
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

/**
 * Allocates the next free non-overlapping plot in the North Pole forest honoring MIN_TREE_SPACING_GRID.
 */
export function allocateTreePosition(
  occupiedPositions: readonly TreePosition[],
  username: string,
): TreePosition {
  const minDistSq = MIN_TREE_SPACING_GRID * MIN_TREE_SPACING_GRID
  const isOccupied = (x: number, y: number) =>
    occupiedPositions.some((pos) => {
      const dx = pos.gridX - x
      const dy = pos.gridY - y
      return dx * dx + dy * dy < minDistSq
    })

  for (const slot of CURATED_TREE_PLOTS) {
    if (!isOccupied(slot.gridX, slot.gridY)) {
      return slot
    }
  }

  // Fallback denser search still honoring strict minimum Euclidean tree spacing
  const seed = hashUsername(username)
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const gx = Number((1.5 + (((seed + attempt * 17) % ((CITY_MAP_CONFIG.cols - 3) * 10)) / 10)).toFixed(2))
    const gy = Number(
      (
        CITY_MAP_CONFIG.skyRows +
        1.4 +
        (((seed + attempt * 23) % ((CITY_MAP_CONFIG.rows - 4) * 10)) / 10)
      ).toFixed(2),
    )
    if (!isBlockedForTree(gx, gy) && !isOccupied(gx, gy)) {
      return { gridX: gx, gridY: gy }
    }
  }

  return { gridX: 4, gridY: 6 }
}
