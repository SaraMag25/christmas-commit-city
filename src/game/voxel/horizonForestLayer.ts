import * as THREE from 'three'
import {
  CITY_MAP_CONFIG,
  CITY_PALETTE,
  MIN_TREE_SPACING,
} from '../../config/cityMapConfig'
import type { CityTree } from '../../types/city'
import { CENTERED_CURATED_PLOTS, getSpiralPlotPosition } from '../layout/treePlacement'
import { getToonGradientMap, getUnitBoxGeometry } from './voxelMaterials'
import { gridToWorld } from './voxelWorldBuilder'

interface ScenicSlot {
  x: number
  z: number
  scale: number
  heightMult: number
  seed: number
  variant: number
}

export interface HorizonForestHandle {
  group: THREE.Group
  rebuildForRealTrees: (realTrees: readonly CityTree[]) => void
  updateTwinkle: (timeSec: number) => void
  dispose: () => void
}

const COLLISION_CLEARANCE = MIN_TREE_SPACING + 0.45
const COLLISION_CLEARANCE_SQ = COLLISION_CLEARANCE * COLLISION_CLEARANCE
const CELL_SIZE = COLLISION_CLEARANCE

const FOLIAGE_DARK_PALETTE = ['#061c24', '#07222b', '#081e2c', '#09242e']
const FOLIAGE_BRIGHT_PALETTE = ['#0c3340', '#11404f', '#14495a', '#0f3a48']
const HOLIDAY_LIGHT_PALETTE = ['#39d353', '#fde047', '#f43f5e', '#38bdf8', '#f97316', '#9be9a8']

const gradientMap = getToonGradientMap()
const trunkMat = new THREE.MeshToonMaterial({ color: '#6b4226', gradientMap })
const foliageMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap })
const snowMat = new THREE.MeshToonMaterial({ color: CITY_PALETTE.snow, gradientMap })
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff })

/**
 * Generates ~950 deterministic scenic holiday tree slots covering:
 * - unoccupied outer village lots beyond the central city plaza
 * - dense surrounding horizon belt (360 degrees around the metropolis)
 */
function buildScenicCandidateSlots(): ScenicSlot[] {
  const slots: ScenicSlot[] = []
  const cx = CITY_MAP_CONFIG.plazaCenter.gridX
  const cy = CITY_MAP_CONFIG.plazaCenter.gridY

  // 1. Fill remaining inner-village lots (behind real trees) with scenic pines when city is small/medium
  for (let i = 0; i < CENTERED_CURATED_PLOTS.length; i += 1) {
    const p = CENTERED_CURATED_PLOTS[i]
    const distPlaza = Math.hypot(p.gridX - cx, p.gridY - cy)
    // Leave immediate plaza framing crisp unless filled by real devs; keep outer ring lush
    if (distPlaza < 7.5 && i % 2 === 1) continue
    const w = gridToWorld(p.gridX, p.gridY)
    const hash = Math.abs(Math.imul(i + 17, 2654435761)) >>> 0
    slots.push({
      x: w.x,
      z: w.z,
      scale: 0.78 + (hash % 5) * 0.08,
      heightMult: 0.88 + ((hash >> 4) % 5) * 0.08,
      seed: hash,
      variant: hash % 4,
    })
  }

  // 2. Dense outer metropolis belt (~700 trees surrounding the core village cleanly)
  const outerOffset = CENTERED_CURATED_PLOTS.length
  for (let j = 0; j < 780; j += 1) {
    const p = getSpiralPlotPosition(outerOffset + j)
    const w = gridToWorld(p.gridX, p.gridY)
    const hash = Math.abs(Math.imul(j + 1013, 1597334677)) >>> 0
    // Slight sub-tile organic jitter (+/- 0.55u) for natural skyline feel
    const jx = (((hash % 11) - 5) / 5) * 0.48
    const jz = ((((hash >> 5) % 11) - 5) / 5) * 0.48
    slots.push({
      x: w.x + jx,
      z: w.z + jz,
      scale: 0.85 + (hash % 7) * 0.09,
      heightMult: 0.86 + ((hash >> 8) % 7) * 0.1,
      seed: hash,
      variant: hash % 4,
    })
  }

  return slots
}

const SCENIC_SLOTS: readonly ScenicSlot[] = buildScenicCandidateSlots()

function spatialKey(cx: number, cz: number): number {
  // Deterministic 2D integer pair hash without string allocation
  return ((cx + 512) << 12) | (cz + 512)
}

function disposeHorizonMeshes(group: THREE.Group): void {
  for (let i = group.children.length - 1; i >= 0; i -= 1) {
    const child = group.children[i]
    if (child instanceof THREE.InstancedMesh) {
      child.dispose()
    }
    group.remove(child)
  }
}

/**
 * Renders hundreds of glowing, snowy voxel Christmas pines around the city
 * in just 5 GPU draw calls (InstancedMesh), automatically hiding any scenic tree
 * whose coordinate overlaps a real developer's plot.
 */
export function createHorizonForestLayer(): HorizonForestHandle {
  const group = new THREE.Group()
  const unitGeom = getUnitBoxGeometry()
  let lastRealSignature = ''

  const dummy = new THREE.Object3D()
  const tmpColor = new THREE.Color()

  const rebuildForRealTrees = (realTrees: readonly CityTree[]) => {
    // Quick signature check avoids rebuilding 800 scenic instances when only metadata changes
    let sig = `${realTrees.length}:`
    for (let i = 0; i < realTrees.length; i += 1) {
      const p = realTrees[i].tree_position
      sig += `${p.gridX},${p.gridY};`
    }
    if (sig === lastRealSignature && group.children.length > 0) return
    lastRealSignature = sig

    disposeHorizonMeshes(group)

    // Spatial hash bucket index of all real trees for O(1) collision checking
    const realWorldPts: Array<{ x: number; z: number }> = new Array(realTrees.length)
    const buckets = new Map<number, number[]>()

    for (let i = 0; i < realTrees.length; i += 1) {
      const pos = gridToWorld(realTrees[i].tree_position.gridX, realTrees[i].tree_position.gridY)
      realWorldPts[i] = pos
      const bx = Math.floor(pos.x / CELL_SIZE)
      const bz = Math.floor(pos.z / CELL_SIZE)
      const key = spatialKey(bx, bz)
      const arr = buckets.get(key)
      if (arr) arr.push(i)
      else buckets.set(key, [i])
    }

    const visibleSlots: ScenicSlot[] = []
    for (let i = 0; i < SCENIC_SLOTS.length; i += 1) {
      const slot = SCENIC_SLOTS[i]
      const bx = Math.floor(slot.x / CELL_SIZE)
      const bz = Math.floor(slot.z / CELL_SIZE)
      let blocked = false

      for (let ox = -1; ox <= 1 && !blocked; ox += 1) {
        for (let oz = -1; oz <= 1 && !blocked; oz += 1) {
          const list = buckets.get(spatialKey(bx + ox, bz + oz))
          if (!list) continue
          for (let k = 0; k < list.length; k += 1) {
            const pt = realWorldPts[list[k]]
            const dx = pt.x - slot.x
            const dz = pt.z - slot.z
            if (dx * dx + dz * dz < COLLISION_CLEARANCE_SQ) {
              blocked = true
              break
            }
          }
        }
      }

      if (!blocked) {
        visibleSlots.push(slot)
      }
    }

    if (visibleSlots.length === 0) return

    const count = visibleSlots.length
    const trunks = new THREE.InstancedMesh(unitGeom, trunkMat, count)
    const darkCanopies = new THREE.InstancedMesh(unitGeom, foliageMat, count * 2)
    const brightCanopies = new THREE.InstancedMesh(unitGeom, foliageMat, count)
    const snowCaps = new THREE.InstancedMesh(unitGeom, snowMat, count * 3)
    const lights = new THREE.InstancedMesh(unitGeom, lightMat, count * 4)

    let darkIdx = 0
    let brightIdx = 0
    let snowIdx = 0
    let lightIdx = 0

    for (let i = 0; i < count; i += 1) {
      const slot = visibleSlots[i]
      const s = slot.scale
      const hm = slot.heightMult
      const trunkH = 1.35 * hm
      const darkHex = FOLIAGE_DARK_PALETTE[slot.variant % FOLIAGE_DARK_PALETTE.length]
      const brightHex = FOLIAGE_BRIGHT_PALETTE[slot.variant % FOLIAGE_BRIGHT_PALETTE.length]

      // 1. Trunk
      dummy.position.set(slot.x, trunkH * 0.5, slot.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(0.56 * s, trunkH, 0.56 * s)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)

      // 2. Three stacked pine tiers + snow ledges
      const y0 = trunkH + 0.52 * hm
      const w0 = 2.65 * s
      const h0 = 1.05 * hm
      dummy.position.set(slot.x, y0, slot.z)
      dummy.scale.set(w0, h0, w0)
      dummy.updateMatrix()
      darkCanopies.setMatrixAt(darkIdx, dummy.matrix)
      tmpColor.set(darkHex)
      darkCanopies.setColorAt(darkIdx, tmpColor)
      darkIdx += 1

      dummy.position.set(slot.x, y0 + h0 * 0.52, slot.z)
      dummy.scale.set(w0 * 0.88, 0.18 * hm, w0 * 0.88)
      dummy.updateMatrix()
      snowCaps.setMatrixAt(snowIdx, dummy.matrix)
      snowIdx += 1

      const y1 = y0 + 1.15 * hm
      const w1 = 2.02 * s
      const h1 = 0.96 * hm
      dummy.position.set(slot.x, y1, slot.z)
      dummy.scale.set(w1, h1, w1)
      dummy.updateMatrix()
      brightCanopies.setMatrixAt(brightIdx, dummy.matrix)
      tmpColor.set(brightHex)
      brightCanopies.setColorAt(brightIdx, tmpColor)
      brightIdx += 1

      dummy.position.set(slot.x, y1 + h1 * 0.52, slot.z)
      dummy.scale.set(w1 * 0.86, 0.17 * hm, w1 * 0.86)
      dummy.updateMatrix()
      snowCaps.setMatrixAt(snowIdx, dummy.matrix)
      snowIdx += 1

      const y2 = y1 + 1.04 * hm
      const w2 = 1.32 * s
      const h2 = 0.92 * hm
      dummy.position.set(slot.x, y2, slot.z)
      dummy.scale.set(w2, h2, w2)
      dummy.updateMatrix()
      darkCanopies.setMatrixAt(darkIdx, dummy.matrix)
      tmpColor.set(darkHex)
      darkCanopies.setColorAt(darkIdx, tmpColor)
      darkIdx += 1

      dummy.position.set(slot.x, y2 + h2 * 0.52, slot.z)
      dummy.scale.set(w2 * 0.8, 0.18 * hm, w2 * 0.8)
      dummy.updateMatrix()
      snowCaps.setMatrixAt(snowIdx, dummy.matrix)
      snowIdx += 1

      // 3. Three festive fairy lights around branches + 1 subtle golden/emerald topper
      const baseAng = (slot.seed % 360) * (Math.PI / 180)
      const lightHeights = [y0 + 0.1, y1 + 0.08, y2 + 0.06]
      const lightRadii = [w0 * 0.52, w1 * 0.52, w2 * 0.5]
      for (let l = 0; l < 3; l += 1) {
        const ang = baseAng + l * 2.15
        dummy.position.set(
          slot.x + Math.cos(ang) * lightRadii[l],
          lightHeights[l],
          slot.z + Math.sin(ang) * lightRadii[l],
        )
        dummy.scale.set(0.24, 0.24, 0.24)
        dummy.updateMatrix()
        lights.setMatrixAt(lightIdx, dummy.matrix)
        tmpColor.set(HOLIDAY_LIGHT_PALETTE[(slot.seed + l) % HOLIDAY_LIGHT_PALETTE.length])
        lights.setColorAt(lightIdx, tmpColor)
        lightIdx += 1
      }

      // Tiny treetop star/tip
      dummy.position.set(slot.x, y2 + h2 * 0.72, slot.z)
      dummy.scale.set(0.32, 0.36, 0.32)
      dummy.updateMatrix()
      lights.setMatrixAt(lightIdx, dummy.matrix)
      tmpColor.set(slot.variant % 2 === 0 ? '#fde047' : '#39d353')
      lights.setColorAt(lightIdx, tmpColor)
      lightIdx += 1
    }

    for (const mesh of [trunks, darkCanopies, brightCanopies, snowCaps, lights]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.frustumCulled = false
      group.add(mesh)
    }
  }

  const updateTwinkle = (timeSec: number) => {
    const pulse = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(timeSec * 2.2))
    lightMat.color.setRGB(pulse, pulse, pulse)
  }

  return {
    group,
    rebuildForRealTrees,
    updateTwinkle,
    dispose: () => {
      disposeHorizonMeshes(group)
    },
  }
}
