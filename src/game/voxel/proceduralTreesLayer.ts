import * as THREE from 'three'
import type { CityTree, TreeLevelId } from '../../types/city'
import {
  CONTINENT_REGIONS,
  getContinentElevationFactor,
  getNearestLakeDistanceWorld,
  gridToWorldCoords,
  isLakePierWorld,
  isRiverWorld,
  isSafeInlandWorld,
  WORLD_MAP_BOUNDS,
  worldToGridCoords,
} from '../layout/continentGeography'
import { isBlockedForTree } from '../layout/treePlacement'
import { getUnitBoxGeometry, syncInstancedMeshState } from './voxelMaterials'
import {
  type ColoredBox,
  generateVoxelTreeGeometryData,
  sharedTreeInstancedMaterials,
  type VoxelTreeGeometryData,
} from './voxelTreeBuilder'

export interface AmbientTreePoint {
  x: number
  z: number
  intensity: 0 | 1 | 2 | 3
}

export interface ProceduralTreesHandle {
  group: THREE.Group
  rebuild: (realTrees: readonly CityTree[]) => void
  setLowGraphicsMode: (low: boolean) => void
  getMinimapPoints: () => readonly AmbientTreePoint[]
  getCounts: () => { highCount: number; lowCount: number; activeCount: number }
  dispose: () => void
}

interface PlacedEmulatedTree {
  x: number
  z: number
  rotY: number
  templateIdx: number
  intensity: 0 | 1 | 2 | 3
}

interface MeshCutoffCounts {
  shadow: number
  trunk: number
  foliage: number
  emissive: number
  snow: number
}

// Rigid ratio rule: emulated trees must ALWAYS be strictly fewer than real GitHub trees (0 in Low mode)
const MAX_EMULATED_RATIO_TO_REAL = 0.45
const MAX_EMULATED_ABSOLUTE = 1350
const TARGET_AMBIENT_LOW = 0
const SPATIAL_CELL = 10

interface BoxItem {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rotY: number
  color: string
}

let cachedTemplatePool: VoxelTreeGeometryData[] | null = null

/**
 * Precomputes 56 varied real-tree voxel geometries via `generateVoxelTreeGeometryData`
 * so emulated trees have 100% identical carved cubic-grid boughs, roots, snow touches,
 * multi-ray golden toppers, micro-lights, and glowing GitHub commit cubes.
 */
function getRealVoxelTemplatePool(): readonly VoxelTreeGeometryData[] {
  if (cachedTemplatePool) return cachedTemplatePool

  const pool: VoxelTreeGeometryData[] = []
  const levels: readonly TreeLevelId[] = [0, 1, 1, 2, 2, 3, 3, 4, 5]
  for (let i = 0; i < 56; i += 1) {
    const level = levels[i % levels.length]
    const commits =
      level === 0
        ? 8 + (i % 15)
        : level === 1
          ? 24 + (i % 42)
          : level === 2
            ? 75 + (i % 80)
            : level === 3
              ? 180 + (i % 140)
              : level === 4
                ? 360 + (i % 220)
                : 620 + (i % 340)
    const activeDays = Math.min(260, Math.max(8, Math.round(commits * 0.45)))
    const l1 = Math.max(2, Math.round(activeDays * 0.44))
    const l2 = Math.max(1, Math.round(activeDays * 0.3))
    const l3 = Math.max(1, Math.round(activeDays * 0.16))
    const l4 = Math.max(0, activeDays - l1 - l2 - l3)
    const gx = 10 + ((i * 7) % 40)
    const gy = 8 + ((i * 11) % 30)

    pool.push(
      generateVoxelTreeGeometryData({
        level,
        seed: 7919 + i * 104729,
        gridX: gx,
        gridY: gy,
        contributionCount: commits,
        activeDays,
        commitLevelCounts: [l1, l2, l3, l4],
      }),
    )
  }

  cachedTemplatePool = pool
  return pool
}

function pushRotatedTemplateBoxes(
  boxes: readonly ColoredBox[],
  baseX: number,
  baseZ: number,
  rotY: number,
  cosR: number,
  sinR: number,
  out: BoxItem[],
): void {
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]
    out.push({
      x: baseX + b.x * cosR + b.z * sinR,
      y: b.y,
      z: baseZ - b.x * sinR + b.z * cosR,
      sx: b.sx,
      sy: b.sy,
      sz: b.sz,
      rotY,
      color: b.color,
    })
  }
}

function mixHash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

function cellKey(cx: number, cz: number): number {
  return ((cx + 512) << 12) | (cz + 512)
}

function insertPointHash(
  map: Map<number, Array<{ x: number; z: number; minR: number }>>,
  x: number,
  z: number,
  minR: number,
): void {
  const cx = Math.floor(x / SPATIAL_CELL)
  const cz = Math.floor(z / SPATIAL_CELL)
  const key = cellKey(cx, cz)
  const arr = map.get(key)
  if (arr) arr.push({ x, z, minR })
  else map.set(key, [{ x, z, minR }])
}

function hasNeighborCloserThan(
  map: Map<number, Array<{ x: number; z: number; minR: number }>>,
  x: number,
  z: number,
  requiredDist: number,
): boolean {
  const cx = Math.floor(x / SPATIAL_CELL)
  const cz = Math.floor(z / SPATIAL_CELL)
  for (let ox = -1; ox <= 1; ox += 1) {
    for (let oz = -1; oz <= 1; oz += 1) {
      const arr = map.get(cellKey(cx + ox, cz + oz))
      if (!arr) continue
      for (let i = 0; i < arr.length; i += 1) {
        const pt = arr[i]
        const distReq = Math.max(requiredDist, pt.minR)
        const dx = pt.x - x
        const dz = pt.z - z
        if (dx * dx + dz * dz < distReq * distReq) {
          return true
        }
      }
    }
  }
  return false
}

function nearestHubRatio(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < CONTINENT_REGIONS.length; i += 1) {
    const r = CONTINENT_REGIONS[i]
    const ratio = Math.hypot(x - r.x, z - r.z) / r.hubRadius
    if (ratio < best) best = ratio
  }
  return best
}

function disposeGroupMeshes(group: THREE.Group): void {
  for (let i = group.children.length - 1; i >= 0; i -= 1) {
    const child = group.children[i]
    if (child instanceof THREE.InstancedMesh) {
      child.dispose()
    }
    group.remove(child)
  }
}

/**
 * Generates up to `Math.floor(realTrees.length * 0.45)` (capped at 1,350 in High / 0 in Low)
 * non-interactive scenic trees using the exact same `generateVoxelTreeGeometryData` voxel geometry
 * and 5 shared `InstancedMesh` materials as real GitHub trees, filling district gaps and lakeshores.
 */
export function createProceduralTreesLayer(): ProceduralTreesHandle {
  const group = new THREE.Group()
  const unitGeom = getUnitBoxGeometry()

  let shadowPadsMesh: THREE.InstancedMesh | null = null
  let trunksMesh: THREE.InstancedMesh | null = null
  let foliageMesh: THREE.InstancedMesh | null = null
  let emissiveMesh: THREE.InstancedMesh | null = null
  let snowMesh: THREE.InstancedMesh | null = null
  const lowCutoffs: MeshCutoffCounts = { shadow: 0, trunk: 0, foliage: 0, emissive: 0, snow: 0 }
  let highCutoffs: MeshCutoffCounts = { shadow: 0, trunk: 0, foliage: 0, emissive: 0, snow: 0 }
  let lowGraphics = false
  let lastRealSignature = ''

  let placedTrees: PlacedEmulatedTree[] = []
  let minimapPoints: AmbientTreePoint[] = []

  const setLowGraphicsMode = (low: boolean) => {
    lowGraphics = low
    const cut = low ? lowCutoffs : highCutoffs
    group.visible = !low
    syncInstancedMeshState(shadowPadsMesh, cut.shadow, !low)
    syncInstancedMeshState(trunksMesh, cut.trunk, !low)
    syncInstancedMeshState(foliageMesh, cut.foliage, !low)
    syncInstancedMeshState(emissiveMesh, cut.emissive, !low)
    syncInstancedMeshState(snowMesh, cut.snow, !low)
  }

  const rebuild = (realTrees: readonly CityTree[]) => {
    const sig = `${realTrees.length}:${realTrees[0]?.id ?? ''}:${realTrees[realTrees.length - 1]?.id ?? ''}`
    if (sig === lastRealSignature && (trunksMesh !== null || realTrees.length < 3)) {
      return
    }
    lastRealSignature = sig

    disposeGroupMeshes(group)
    shadowPadsMesh = null
    trunksMesh = null
    foliageMesh = null
    emissiveMesh = null
    snowMesh = null
    placedTrees = []
    minimapPoints = []
    highCutoffs = { shadow: 0, trunk: 0, foliage: 0, emissive: 0, snow: 0 }

    const proportionalCap = Math.min(
      MAX_EMULATED_ABSOLUTE,
      Math.floor(realTrees.length * MAX_EMULATED_RATIO_TO_REAL),
    )
    if (proportionalCap <= 0) {
      return
    }

    const templatePool = getRealVoxelTemplatePool()
    const realHash = new Map<number, Array<{ x: number; z: number; minR: number }>>()
    for (let i = 0; i < realTrees.length; i += 1) {
      const p = realTrees[i].tree_position
      const w = gridToWorldCoords(p.gridX, p.gridY)
      insertPointHash(realHash, w.x, w.z, 5.2)
    }

    // Sample organic points across neighborhoods, lakeshores & trails so real + emulated trees blend seamlessly
    const baseStep = 4.6
    const candidates: Array<{ x: number; z: number; seed: number }> = []
    let idx = 0
    for (let z = WORLD_MAP_BOUNDS.minZ + 6; z <= WORLD_MAP_BOUNDS.maxZ - 6; z += baseStep) {
      for (let x = WORLD_MAP_BOUNDS.minX + 6; x <= WORLD_MAP_BOUNDS.maxX - 6; x += baseStep) {
        idx += 1
        const seed = mixHash(idx * 3 + 97)
        const jx = (((seed & 0xff) / 255) - 0.5) * (baseStep * 0.92)
        const jz = ((((seed >> 8) & 0xff) / 255) - 0.5) * (baseStep * 0.92)
        const wx = x + jx
        const wz = z + jz
        if (!isSafeInlandWorld(wx, wz, 4.2)) continue
        candidates.push({ x: wx, z: wz, seed })
      }
    }

    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = mixHash(i * 13 + 7) % (i + 1)
      const tmp = candidates[i]
      candidates[i] = candidates[j]
      candidates[j] = tmp
    }

    const ambientHash = new Map<number, Array<{ x: number; z: number; minR: number }>>()

    for (let i = 0; i < candidates.length && placedTrees.length < proportionalCap; i += 1) {
      const cand = candidates[i]
      const { x, z, seed } = cand

      if (isRiverWorld(x, z) || isLakePierWorld(x, z)) continue
      const { gridX, gridY } = worldToGridCoords(x, z)
      if (isBlockedForTree(gridX, gridY)) continue

      const hubRatio = nearestHubRatio(x, z)
      const lakeDist = getNearestLakeDistanceWorld(x, z)
      const isLakeshore = lakeDist >= 2.5 && lakeDist <= 34
      const coastElev = getContinentElevationFactor(x, z)

      const keepProb = isLakeshore
        ? 0.94
        : hubRatio <= 1.2
          ? 0.9
          : coastElev < 0.2
            ? 0.52
            : 0.78
      const roll = ((seed >> 16) & 0xff) / 255
      if (roll > keepProb) continue

      const localMinDist = isLakeshore ? 5.6 : hubRatio <= 1.2 ? 6.0 : 7.0
      if (hasNeighborCloserThan(realHash, x, z, 5.25)) continue
      if (hasNeighborCloserThan(ambientHash, x, z, localMinDist)) continue

      insertPointHash(ambientHash, x, z, localMinDist)

      const templateIdx = seed % templatePool.length
      const intensity: 0 | 1 | 2 | 3 = (templatePool[templateIdx].spec.tierRadii.length >= 4
        ? 2 + (seed % 2)
        : 1 + (seed % 2)) as 0 | 1 | 2 | 3

      placedTrees.push({
        x,
        z,
        rotY: ((seed % 4) * Math.PI) / 2 + (((seed >> 10) % 9) - 4) * 0.12,
        templateIdx,
        intensity,
      })
      minimapPoints.push({ x, z, intensity })
    }

    if (placedTrees.length === 0) return

    const shadowItems: BoxItem[] = []
    const trunkItems: BoxItem[] = []
    const foliageItems: BoxItem[] = []
    const emissiveItems: BoxItem[] = []
    const snowItems: BoxItem[] = []

    for (let i = 0; i < placedTrees.length; i += 1) {
      const t = placedTrees[i]
      const tpl = templatePool[t.templateIdx]
      const cosR = Math.cos(t.rotY)
      const sinR = Math.sin(t.rotY)

      shadowItems.push({
        x: t.x,
        y: 0.03,
        z: t.z,
        sx: tpl.shadowPad.sx,
        sy: tpl.shadowPad.sy,
        sz: tpl.shadowPad.sz,
        rotY: t.rotY,
        color: '#a3b6dc',
      })
      pushRotatedTemplateBoxes(tpl.trunkBoxes, t.x, t.z, t.rotY, cosR, sinR, trunkItems)
      pushRotatedTemplateBoxes(tpl.foliageBoxes, t.x, t.z, t.rotY, cosR, sinR, foliageItems)
      pushRotatedTemplateBoxes(tpl.emissiveBoxes, t.x, t.z, t.rotY, cosR, sinR, emissiveItems)
      pushRotatedTemplateBoxes(tpl.snowBoxes, t.x, t.z, t.rotY, cosR, sinR, snowItems)
    }

    highCutoffs = {
      shadow: shadowItems.length,
      trunk: trunkItems.length,
      foliage: foliageItems.length,
      emissive: emissiveItems.length,
      snow: snowItems.length,
    }

    const dummy = new THREE.Object3D()
    const tmpColor = new THREE.Color()

    const buildInstanced = (items: BoxItem[], mat: THREE.Material, withColors = true) => {
      const mesh = new THREE.InstancedMesh(unitGeom, mat, items.length)
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i]
        dummy.position.set(it.x, it.y, it.z)
        dummy.rotation.set(0, it.rotY, 0)
        dummy.scale.set(it.sx, it.sy, it.sz)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        if (withColors) {
          tmpColor.set(it.color)
          mesh.setColorAt(i, tmpColor)
        }
      }
      mesh.instanceMatrix.needsUpdate = true
      if (withColors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.frustumCulled = false
      group.add(mesh)
      return mesh
    }

    shadowPadsMesh = buildInstanced(shadowItems, sharedTreeInstancedMaterials.shadowPad, false)
    trunksMesh = buildInstanced(trunkItems, sharedTreeInstancedMaterials.trunk)
    foliageMesh = buildInstanced(foliageItems, sharedTreeInstancedMaterials.foliage)
    emissiveMesh = buildInstanced(emissiveItems, sharedTreeInstancedMaterials.emissive)
    snowMesh = buildInstanced(snowItems, sharedTreeInstancedMaterials.snow)

    setLowGraphicsMode(lowGraphics)
  }

  return {
    group,
    rebuild,
    setLowGraphicsMode,
    getMinimapPoints: () => (lowGraphics ? [] : minimapPoints),
    getCounts: () => ({
      highCount: placedTrees.length,
      lowCount: TARGET_AMBIENT_LOW,
      activeCount: lowGraphics ? TARGET_AMBIENT_LOW : placedTrees.length,
    }),
    dispose: () => {
      disposeGroupMeshes(group)
      placedTrees = []
      minimapPoints = []
    },
  }
}
