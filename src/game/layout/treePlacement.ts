import { CITY_MAP_CONFIG } from '../../config/cityMapConfig'
import type { TreePosition } from '../../types/city'

export interface VillageBuildingPlacement {
  gridX: number
  gridY: number
  variant: 'hobbit-emerald' | 'hobbit-amber' | 'elven-pavilion'
}

export interface VillageDecorationPlacement {
  gridX: number
  gridY: number
  type: 'lamp' | 'snowman' | 'signpost' | 'gift-pile' | 'caretaker' | 'elven-arch' | 'waystone'
}

/**
 * Discrete Shire-style Hobbit burrows and an Elven riverside pavilion.
 */
export const VILLAGE_COTTAGES: readonly VillageBuildingPlacement[] = [
  { gridX: 4, gridY: 18, variant: 'hobbit-emerald' },
  { gridX: 32, gridY: 7, variant: 'hobbit-amber' },
  { gridX: 31, gridY: 25, variant: 'elven-pavilion' },
]

/**
 * Subtle Lord-of-the-Rings & Christmas accents along river crossings & trails.
 */
export const VILLAGE_DECORATIONS: readonly VillageDecorationPlacement[] = [
  { gridX: 19, gridY: 15, type: 'lamp' },
  { gridX: 13, gridY: 15, type: 'lamp' },
  { gridX: 28, gridY: 15, type: 'lamp' },
  { gridX: 20, gridY: 9, type: 'lamp' },
  { gridX: 20, gridY: 25, type: 'lamp' },
  { gridX: 18, gridY: 15, type: 'signpost' },
  { gridX: 21, gridY: 14, type: 'caretaker' },
  { gridX: 6, gridY: 21, type: 'snowman' },
  { gridX: 19, gridY: 16, type: 'gift-pile' },
  { gridX: 30, gridY: 10, type: 'snowman' },
  { gridX: 15, gridY: 14, type: 'elven-arch' },
  { gridX: 25, gridY: 16, type: 'waystone' },
  { gridX: 14, gridY: 24, type: 'waystone' },
]

export function isRiverTile(gridX: number, gridY: number): boolean {
  const { cols, rows, skyRows } = CITY_MAP_CONFIG
  if (gridY < skyRows || gridY >= rows || gridX < 0 || gridX >= cols) return false

  // Western/Central winding river flowing from northern mountains down past the pond
  const mainRiverCenterX = 9.5 + Math.sin(gridY * 0.27) * 2.6
  const inMainRiver = Math.abs(gridX - mainRiverCenterX) <= 0.85

  // Eastern forest tributary branching near (x:11, y:19) toward southeast edge
  const eastRiverCenterY = 20.2 + Math.sin((gridX - 10) * 0.22) * 1.9
  const inEastTributary = gridX >= 10 && Math.abs(gridY - eastRiverCenterY) <= 0.8

  return inMainRiver || inEastTributary
}

export function isBridgeTile(gridX: number, gridY: number): boolean {
  // Bridge 1: East-west trail (y=15) crossing the main river
  const westBridge = gridY === 15 && isRiverTile(gridX, gridY)
  // Bridge 2: North-south trail (x=20) crossing the eastern tributary
  const southBridge = gridX === 20 && isRiverTile(gridX, gridY)
  return westBridge || southBridge
}

export function isRoadTile(gridX: number, gridY: number): boolean {
  const mainTrailX = gridY === 15 && gridX >= 3 && gridX <= 36 && gridX !== 20
  const mainTrailY = gridX === 20 && gridY >= 5 && gridY <= 27 && gridY !== 15
  return mainTrailX || mainTrailY
}

export function isPlazaTile(gridX: number, gridY: number): boolean {
  return gridX >= 19 && gridX <= 20 && gridY >= 14 && gridY <= 15
}

export function isFrozenPondTile(gridX: number, gridY: number): boolean {
  return gridX >= 3 && gridX <= 6 && gridY >= 24 && gridY <= 27
}

export function isPierTile(gridX: number, gridY: number): boolean {
  return (gridX === 5 || gridX === 6) && gridY === 25
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
  if (
    isRiverTile(x, y) ||
    isBridgeTile(x, y) ||
    isRoadTile(x, y) ||
    isPlazaTile(x, y) ||
    isFrozenPondTile(x, y) ||
    isPierTile(x, y)
  ) {
    return true
  }
  for (const c of VILLAGE_COTTAGES) {
    if (Math.abs(x - (c.gridX + 1)) <= 2 && Math.abs(y - (c.gridY + 1)) <= 2) return true
  }
  for (const d of VILLAGE_DECORATIONS) {
    if (Math.abs(x - d.gridX) <= 1 && Math.abs(y - d.gridY) <= 1) return true
  }
  return false
}

/**
 * Generates dense urban-forest plots arranged in organic clusters along
 * both sides of the winding rivers, maximizing forest density.
 */
function buildDenseForestPlots(): TreePosition[] {
  const plots: TreePosition[] = []
  const { cols, rows, skyRows } = CITY_MAP_CONFIG

  for (let gy = skyRows + 1; gy <= rows - 2; gy += 2) {
    for (let gx = 1; gx <= cols - 2; gx += 2) {
      if (isBlockedForTree(gx, gy)) continue
      plots.push({ gridX: gx, gridY: gy })
    }
  }

  return plots
}

export const CURATED_TREE_PLOTS: readonly TreePosition[] = buildDenseForestPlots()

/**
 * Allocates the next free non-overlapping plot in the forest city for a newly
 * authenticated developer.
 */
export function allocateTreePosition(
  occupiedPositions: readonly TreePosition[],
  username: string,
): TreePosition {
  const isOccupied = (x: number, y: number) =>
    occupiedPositions.some((pos) => Math.abs(pos.gridX - x) <= 1 && Math.abs(pos.gridY - y) <= 1)

  for (const slot of CURATED_TREE_PLOTS) {
    if (!isOccupied(slot.gridX, slot.gridY)) {
      return slot
    }
  }

  const seed = hashUsername(username)
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const gx = 2 + ((seed + attempt * 5) % (CITY_MAP_CONFIG.cols - 4))
    const gy = CITY_MAP_CONFIG.skyRows + 1 + ((seed + attempt * 7) % (CITY_MAP_CONFIG.rows - 4))
    if (!isBlockedForTree(gx, gy) && !isOccupied(gx, gy)) {
      return { gridX: gx, gridY: gy }
    }
  }

  return { gridX: 4, gridY: 11 }
}
