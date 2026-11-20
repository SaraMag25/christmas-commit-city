import { CITY_MAP_CONFIG } from '../../config/cityMapConfig'
import type { TreePosition } from '../../types/city'

export interface VillageBuildingPlacement {
  gridX: number
  gridY: number
  variant: 'storybook' | 'mushroom-pine' | 'mushroom-red' | 'stump'
}

export interface VillageDecorationPlacement {
  gridX: number
  gridY: number
  type: 'lamp' | 'snowman' | 'signpost' | 'gift-pile' | 'bench' | 'caretaker'
}

/**
 * Curated storybook cottage placements along the snowy village lanes.
 * Each cottage spans roughly a 3x3 lot anchored along bottom-center.
 */
export const VILLAGE_COTTAGES: readonly VillageBuildingPlacement[] = [
  { gridX: 6, gridY: 5, variant: 'storybook' },
  { gridX: 11, gridY: 5, variant: 'mushroom-pine' },
  { gridX: 22, gridY: 5, variant: 'stump' },
  { gridX: 27, gridY: 5, variant: 'mushroom-red' },
  { gridX: 6, gridY: 16, variant: 'mushroom-pine' },
  { gridX: 28, gridY: 16, variant: 'storybook' },
  { gridX: 11, gridY: 21, variant: 'stump' },
  { gridX: 23, gridY: 21, variant: 'mushroom-red' },
]

export const VILLAGE_DECORATIONS: readonly VillageDecorationPlacement[] = [
  // Central Plaza corner lanterns
  { gridX: 15, gridY: 11, type: 'lamp' },
  { gridX: 21, gridY: 11, type: 'lamp' },
  { gridX: 15, gridY: 16, type: 'lamp' },
  { gridX: 21, gridY: 16, type: 'lamp' },
  // Avenue lanterns
  { gridX: 10, gridY: 13, type: 'lamp' },
  { gridX: 26, gridY: 13, type: 'lamp' },
  { gridX: 18, gridY: 8, type: 'lamp' },
  { gridX: 18, gridY: 20, type: 'lamp' },
  // Cozy benches (inspired by ref_0 & ref_1)
  { gridX: 16, gridY: 11, type: 'bench' },
  { gridX: 20, gridY: 11, type: 'bench' },
  { gridX: 6, gridY: 21, type: 'bench' },
  // Cute winter caretaker NPC tending a pine sapling (inspired by ref_4)
  { gridX: 19, gridY: 14, type: 'caretaker' },
  // Festive snowmen, signs & gifts
  { gridX: 16, gridY: 15, type: 'snowman' },
  { gridX: 20, gridY: 15, type: 'gift-pile' },
  { gridX: 17, gridY: 15, type: 'signpost' },
  { gridX: 9, gridY: 7, type: 'snowman' },
  { gridX: 26, gridY: 7, type: 'gift-pile' },
  { gridX: 14, gridY: 23, type: 'snowman' },
]

/**
 * Curated non-overlapping plots for community developer trees.
 */
export const CURATED_TREE_PLOTS: readonly TreePosition[] = [
  { gridX: 13, gridY: 11 },
  { gridX: 23, gridY: 11 },
  { gridX: 13, gridY: 16 },
  { gridX: 23, gridY: 16 },
  { gridX: 9, gridY: 10 },
  { gridX: 27, gridY: 10 },
  { gridX: 15, gridY: 7 },
  { gridX: 20, gridY: 7 },
  { gridX: 10, gridY: 16 },
  { gridX: 26, gridY: 16 },
  { gridX: 20, gridY: 22 },
  { gridX: 15, gridY: 22 },
  { gridX: 5, gridY: 10 },
  { gridX: 31, gridY: 10 },
  { gridX: 14, gridY: 18 },
  { gridX: 22, gridY: 18 },
  { gridX: 7, gridY: 22 },
  { gridX: 30, gridY: 21 },
  { gridX: 3, gridY: 12 },
  { gridX: 33, gridY: 12 },
]

export function hashUsername(username: string): number {
  let hash = 2166136261
  for (let i = 0; i < username.length; i += 1) {
    hash ^= username.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Allocates the next free non-overlapping plot in the village for a newly
 * authenticated developer, starting with curated garden plots and expanding
 * deterministically around the town if all curated plots are occupied.
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const gx = 3 + ((seed + attempt * 5) % (CITY_MAP_CONFIG.cols - 6))
    const gy = CITY_MAP_CONFIG.skyRows + 2 + ((seed + attempt * 7) % (CITY_MAP_CONFIG.rows - 6))
    if (!isRoadTile(gx, gy) && !isPlazaTile(gx, gy) && !isFrozenPondTile(gx, gy) && !isOccupied(gx, gy)) {
      return { gridX: gx, gridY: gy }
    }
  }

  return { gridX: 4, gridY: 11 }
}

export function isRoadTile(gridX: number, gridY: number): boolean {
  const isMainHorizontal = (gridY === 13 || gridY === 14) && gridX >= 2 && gridX <= 33
  const isMainVertical = gridX === 18 && gridY >= 5 && gridY <= 23
  const isNorthLane = gridY === 8 && gridX >= 6 && gridX <= 30
  const isSouthLane = gridY === 20 && gridX >= 6 && gridX <= 30
  return isMainHorizontal || isMainVertical || isNorthLane || isSouthLane
}

export function isPlazaTile(gridX: number, gridY: number): boolean {
  const { plazaCenter } = CITY_MAP_CONFIG
  return (
    gridX >= plazaCenter.gridX - 3 &&
    gridX <= plazaCenter.gridX + 3 &&
    gridY >= plazaCenter.gridY - 2 &&
    gridY <= plazaCenter.gridY + 3
  )
}

export function isFrozenPondTile(gridX: number, gridY: number): boolean {
  return gridX >= 2 && gridX <= 5 && gridY >= 21 && gridY <= 23
}

export function isPierTile(gridX: number, gridY: number): boolean {
  return (gridX === 4 || gridX === 5) && gridY === 22
}
