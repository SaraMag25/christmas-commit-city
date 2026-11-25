import * as THREE from 'three'
import { CITY_MAP_CONFIG } from '../../config/cityMapConfig'
import type { CityTree } from '../../types/city'
import { hashUsername } from '../layout/treePlacement'
import {
  buildVoxelCompanion,
  disposeBuiltCompanion,
  type BuiltCompanion,
} from './voxelCompanionBuilder'
import {
  createVoxelMesh,
  getUnitBoxGeometry,
  syncInstancedMeshState,
} from './voxelMaterials'
import {
  buildTreeGiftsAndStarOverlay,
  generateVoxelTreeGeometryData,
  sharedTreeInstancedMaterials,
  type ColoredBox,
  type TreeVisualSpec,
} from './voxelTreeBuilder'
import { gridToWorld } from './voxelWorldBuilder'

export interface TreePickResult {
  tree: CityTree
  worldPos: THREE.Vector3
  height: number
  outerRadius: number
}

export interface AnimatedCompanionEntry {
  companion: BuiltCompanion
  phase: number
}

interface TreeSpatialRecord {
  tree: CityTree
  spec: TreeVisualSpec
  worldPos: THREE.Vector3
  centerPos: THREE.Vector3
  height: number
  outerRadius: number
  hitRadiusSq: number
  trunkStart: number
  trunkCount: number
  foliageStart: number
  foliageCount: number
  emissiveStart: number
  emissiveCount: number
  snowStart: number
  snowCount: number
}

interface TreeOverlayHandle {
  signature: string
  tree: CityTree
  giftGroup: THREE.Group | null
  companion: BuiltCompanion | null
  companionPhase: number
  companionGroup: THREE.Group | null
  plinthMeshes: THREE.Mesh[]
}

export interface InstancedCityTreesHandle {
  group: THREE.Group
  animatedCompanions: AnimatedCompanionEntry[]
  rebuild: (realTrees: readonly CityTree[]) => {
    maxAbsX: number
    maxAbsZ: number
    maxGridRadius: number
    maxWorldRadiusFromPlaza: number
  }
  setLowGraphicsMode: (low: boolean) => void
  pickTreeAtRay: (ray: THREE.Ray, raycaster: THREE.Raycaster) => TreePickResult | null
  pickOffCameraSwapSlot: (camera: THREE.Camera, excludedIds: Set<string>) => CityTree | null
  getTreeVisualInfo: (identifier: string) => TreePickResult | null
  getCreatorVisualInfo: () => TreePickResult | null
  dispose: () => void
}

interface BoxTransformEntry {
  treeIdx: number
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rotY: number
  color: string
}

const SPATIAL_CELL_SIZE = 8
const UNIT_BOX_MIN = new THREE.Vector3(-0.5, -0.5, -0.5)
const UNIT_BOX_MAX = new THREE.Vector3(0.5, 0.5, 0.5)
const UNIT_BOX = new THREE.Box3(UNIT_BOX_MIN, UNIT_BOX_MAX)
const FRONT_VIEW_YAW = Math.PI * 0.25

function spatialCellKey(cx: number, cz: number): number {
  return ((cx + 512) << 12) | (cz + 512)
}

function buildOverlaySignature(tree: CityTree): string {
  const giftSlugs =
    tree.gifts.length === 0 ? '' : tree.gifts.map((g) => g.gift_slug).join(',')
  const comp = tree.companion
  const compKey = comp
    ? `${comp.species}:${comp.equipped.head ?? ''}:${comp.equipped.body ?? ''}:${comp.equipped.hand ?? ''}`
    : ''
  return `${tree.contribution_count}|${tree.tree_level}|${tree.tree_position.gridX},${tree.tree_position.gridY}|${giftSlugs}|${compKey}`
}

function buildBaseTreesSignature(trees: readonly CityTree[]): string {
  let sig = `${trees.length}:`
  for (let i = 0; i < trees.length; i += 1) {
    const t = trees[i]
    const countsKey = t.commitLevelCounts ? t.commitLevelCounts.join(',') : ''
    sig += `${t.id}@${t.tree_position.gridX},${t.tree_position.gridY},${t.contribution_count},${t.tree_level},${t.activeDays ?? -1},${countsKey},${t.stats?.calendarWeeks?.length ?? 0},${t.is_creator_special ? 1 : 0};`
  }
  return sig
}

function pushRotatedBoxes(
  treeIdx: number,
  boxes: readonly ColoredBox[],
  baseX: number,
  baseZ: number,
  rotY: number,
  cosR: number,
  sinR: number,
  out: BoxTransformEntry[],
): void {
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]
    out.push({
      treeIdx,
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

function disposeMeshArray(parent: THREE.Group, meshes: THREE.InstancedMesh[]): void {
  for (let i = 0; i < meshes.length; i += 1) {
    parent.remove(meshes[i])
    meshes[i].dispose()
  }
  meshes.length = 0
}

function disposeObjectGeometries(obj: THREE.Object3D): void {
  const unitBox = getUnitBoxGeometry()
  obj.traverse((node) => {
    if (node instanceof THREE.InstancedMesh) {
      node.dispose()
    } else if (
      node instanceof THREE.Mesh &&
      node.geometry &&
      node.geometry !== unitBox &&
      node.geometry.type !== 'BoxGeometry'
    ) {
      node.geometry.dispose()
    }
  })
}

function createColoredInstancedMesh(
  entries: readonly BoxTransformEntry[],
  material: THREE.Material,
  treeRecords: readonly TreeSpatialRecord[],
  instanceToTree: Map<THREE.InstancedMesh, CityTree[]>,
  withColors = true,
): THREE.InstancedMesh | null {
  if (entries.length === 0) return null
  const geom = getUnitBoxGeometry()
  const mesh = new THREE.InstancedMesh(geom, material, entries.length)
  const dummy = new THREE.Object3D()
  const tmpColor = new THREE.Color()
  const mappedTrees: CityTree[] = new Array(entries.length)

  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i]
    dummy.position.set(item.x, item.y, item.z)
    dummy.rotation.set(0, item.rotY, 0)
    dummy.scale.set(item.sx, item.sy, item.sz)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    if (withColors) {
      tmpColor.set(item.color)
      mesh.setColorAt(i, tmpColor)
    }
    mappedTrees[i] = treeRecords[item.treeIdx].tree
  }

  mesh.instanceMatrix.needsUpdate = true
  if (withColors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  instanceToTree.set(mesh, mappedTrees)
  return mesh
}

/**
 * Renders 100% of real developer Christmas trees inside 5 shared clickable
 * `InstancedMesh` layers (shadow pad, trunk+roots, foliage+L1/L2 commits,
 * emissive L3/L4 commits+star+micro-lights, delicate snow tips) with an
 * `instanceId -> tree` map and O(1) spatial ray-cell picking.
 */
export function createInstancedCityTreesLayer(): InstancedCityTreesHandle {
  const group = new THREE.Group()
  const baseGroup = new THREE.Group()
  const overlaysGroup = new THREE.Group()
  group.add(baseGroup)
  group.add(overlaysGroup)

  const baseInstancedMeshes: THREE.InstancedMesh[] = []
  const instanceToTree = new Map<THREE.InstancedMesh, CityTree[]>()
  const recordsByTreeId = new Map<string, TreeSpatialRecord>()
  const recordsByUsernameLower = new Map<string, TreeSpatialRecord>()
  const spatialBuckets = new Map<number, number[]>()
  const overlaysByTreeId = new Map<string, TreeOverlayHandle>()

  let records: TreeSpatialRecord[] = []
  let creatorRecord: TreeSpatialRecord | null = null
  let shadowPadsMesh: THREE.InstancedMesh | null = null
  let trunksMesh: THREE.InstancedMesh | null = null
  let foliageMesh: THREE.InstancedMesh | null = null
  let emissiveMesh: THREE.InstancedMesh | null = null
  let snowCapsMesh: THREE.InstancedMesh | null = null
  let highMeshCutoffs = { shadow: 0, trunk: 0, foliage: 0, emissive: 0, snow: 0 }
  let maxTreeHeight = 14
  let lastBaseSignature = ''
  let lowGraphics = false
  const animatedCompanions: AnimatedCompanionEntry[] = []

  const tmpMatrix = new THREE.Matrix4()
  const tmpInvMatrix = new THREE.Matrix4()
  const tmpLocalRay = new THREE.Ray()
  const tmpHitPoint = new THREE.Vector3()
  const tmpStepPoint = new THREE.Vector3()
  const frustum = new THREE.Frustum()
  const projScreenMatrix = new THREE.Matrix4()

  const applyActiveCutoffs = (low: boolean) => {
    // Never truncate real GitHub trees in Low mode; only hide ground shadow pads for GPU relief.
    syncInstancedMeshState(shadowPadsMesh, highMeshCutoffs.shadow, !low)
    syncInstancedMeshState(trunksMesh, highMeshCutoffs.trunk, true)
    syncInstancedMeshState(foliageMesh, highMeshCutoffs.foliage, true)
    syncInstancedMeshState(emissiveMesh, highMeshCutoffs.emissive, true)
    syncInstancedMeshState(snowCapsMesh, highMeshCutoffs.snow, true)
  }

  const disposeOverlay = (overlay: TreeOverlayHandle) => {
    if (overlay.giftGroup) {
      overlaysGroup.remove(overlay.giftGroup)
      disposeObjectGeometries(overlay.giftGroup)
    }
    if (overlay.companionGroup && overlay.companion) {
      overlaysGroup.remove(overlay.companionGroup)
      disposeBuiltCompanion(overlay.companion)
    }
    for (let i = 0; i < overlay.plinthMeshes.length; i += 1) {
      overlaysGroup.remove(overlay.plinthMeshes[i])
    }
  }

  const rebuildBaseInstances = (realTrees: readonly CityTree[]) => {
    disposeMeshArray(baseGroup, baseInstancedMeshes)
    instanceToTree.clear()
    recordsByTreeId.clear()
    recordsByUsernameLower.clear()
    spatialBuckets.clear()
    records = []
    creatorRecord = null
    shadowPadsMesh = null
    trunksMesh = null
    foliageMesh = null
    emissiveMesh = null
    snowCapsMesh = null
    maxTreeHeight = 14

    if (realTrees.length === 0) return

    const shadowEntries: BoxTransformEntry[] = []
    const trunkEntries: BoxTransformEntry[] = []
    const foliageEntries: BoxTransformEntry[] = []
    const emissiveEntries: BoxTransformEntry[] = []
    const snowEntries: BoxTransformEntry[] = []

    for (let i = 0; i < realTrees.length; i += 1) {
      const tree = realTrees[i]
      const seed = hashUsername(tree.profile.github_username)
      const data = generateVoxelTreeGeometryData({
        level: tree.tree_level,
        seed,
        gridX: tree.tree_position.gridX,
        gridY: tree.tree_position.gridY,
        isCreatorSpecial: Boolean(tree.is_creator_special),
        contributionCount: tree.contribution_count,
        activeDays: tree.activeDays,
        commitLevelCounts: tree.commitLevelCounts,
        calendarWeeks: tree.stats?.calendarWeeks,
      })

      const pos = gridToWorld(tree.tree_position.gridX, tree.tree_position.gridY)
      const worldPos = new THREE.Vector3(pos.x, 0, pos.z)
      if (data.height > maxTreeHeight) maxTreeHeight = data.height

      const trunkStart = trunkEntries.length
      const foliageStart = foliageEntries.length
      const emissiveStart = emissiveEntries.length
      const snowStart = snowEntries.length

      const cosR = Math.cos(data.spec.rotationY)
      const sinR = Math.sin(data.spec.rotationY)

      shadowEntries.push({
        treeIdx: i,
        x: pos.x,
        y: 0.03,
        z: pos.z,
        sx: data.shadowPad.sx,
        sy: data.shadowPad.sy,
        sz: data.shadowPad.sz,
        rotY: data.spec.rotationY,
        color: '#a3b6dc',
      })

      pushRotatedBoxes(
        i,
        data.trunkBoxes,
        pos.x,
        pos.z,
        data.spec.rotationY,
        cosR,
        sinR,
        trunkEntries,
      )
      pushRotatedBoxes(
        i,
        data.foliageBoxes,
        pos.x,
        pos.z,
        data.spec.rotationY,
        cosR,
        sinR,
        foliageEntries,
      )
      pushRotatedBoxes(
        i,
        data.emissiveBoxes,
        pos.x,
        pos.z,
        data.spec.rotationY,
        cosR,
        sinR,
        emissiveEntries,
      )
      pushRotatedBoxes(
        i,
        data.snowBoxes,
        pos.x,
        pos.z,
        data.spec.rotationY,
        cosR,
        sinR,
        snowEntries,
      )

      const hitRadius = Math.max(2.6, data.outerRadius + 1.55)
      const record: TreeSpatialRecord = {
        tree,
        spec: data.spec,
        worldPos,
        centerPos: new THREE.Vector3(pos.x, data.height * 0.48, pos.z),
        height: data.height,
        outerRadius: data.outerRadius,
        hitRadiusSq: hitRadius * hitRadius,
        trunkStart,
        trunkCount: trunkEntries.length - trunkStart,
        foliageStart,
        foliageCount: foliageEntries.length - foliageStart,
        emissiveStart,
        emissiveCount: emissiveEntries.length - emissiveStart,
        snowStart,
        snowCount: snowEntries.length - snowStart,
      }
      records.push(record)
      recordsByTreeId.set(tree.id, record)
      recordsByUsernameLower.set(tree.profile.github_username.toLowerCase(), record)
      if (tree.is_creator_special) creatorRecord = record

      // Register in 2D spatial grid for sub-0.05ms ray picking
      const bx = Math.floor(pos.x / SPATIAL_CELL_SIZE)
      const bz = Math.floor(pos.z / SPATIAL_CELL_SIZE)
      const cellKey = spatialCellKey(bx, bz)
      const bucket = spatialBuckets.get(cellKey)
      if (bucket) bucket.push(i)
      else spatialBuckets.set(cellKey, [i])
    }

    highMeshCutoffs = {
      shadow: shadowEntries.length,
      trunk: trunkEntries.length,
      foliage: foliageEntries.length,
      emissive: emissiveEntries.length,
      snow: snowEntries.length,
    }

    shadowPadsMesh = createColoredInstancedMesh(
      shadowEntries,
      sharedTreeInstancedMaterials.shadowPad,
      records,
      instanceToTree,
      false,
    )
    if (shadowPadsMesh) {
      shadowPadsMesh.visible = !lowGraphics
      baseGroup.add(shadowPadsMesh)
      baseInstancedMeshes.push(shadowPadsMesh)
    }

    trunksMesh = createColoredInstancedMesh(
      trunkEntries,
      sharedTreeInstancedMaterials.trunk,
      records,
      instanceToTree,
    )
    if (trunksMesh) {
      baseGroup.add(trunksMesh)
      baseInstancedMeshes.push(trunksMesh)
    }

    foliageMesh = createColoredInstancedMesh(
      foliageEntries,
      sharedTreeInstancedMaterials.foliage,
      records,
      instanceToTree,
    )
    if (foliageMesh) {
      baseGroup.add(foliageMesh)
      baseInstancedMeshes.push(foliageMesh)
    }

    emissiveMesh = createColoredInstancedMesh(
      emissiveEntries,
      sharedTreeInstancedMaterials.emissive,
      records,
      instanceToTree,
    )
    if (emissiveMesh) {
      baseGroup.add(emissiveMesh)
      baseInstancedMeshes.push(emissiveMesh)
    }

    snowCapsMesh = createColoredInstancedMesh(
      snowEntries,
      sharedTreeInstancedMaterials.snow,
      records,
      instanceToTree,
    )
    if (snowCapsMesh) {
      baseGroup.add(snowCapsMesh)
      baseInstancedMeshes.push(snowCapsMesh)
    }

    applyActiveCutoffs(lowGraphics)
  }

  const syncOverlays = (realTrees: readonly CityTree[]) => {
    const activeIds = new Set<string>()
    for (let i = 0; i < realTrees.length; i += 1) {
      const t = realTrees[i]
      if (t.companion?.species || t.gifts.length > 0) {
        activeIds.add(t.id)
      }
    }

    // Dispose overlays no longer needed
    for (const [id, handle] of overlaysByTreeId.entries()) {
      if (!activeIds.has(id)) {
        disposeOverlay(handle)
        overlaysByTreeId.delete(id)
      }
    }

    animatedCompanions.length = 0

    for (let i = 0; i < realTrees.length; i += 1) {
      const tree = realTrees[i]
      if (!activeIds.has(tree.id)) continue

      const sig = buildOverlaySignature(tree)
      const existing = overlaysByTreeId.get(tree.id)
      if (existing && existing.signature === sig) {
        existing.tree = tree
        if (existing.companion) {
          animatedCompanions.push({
            companion: existing.companion,
            phase: existing.companionPhase,
          })
        }
        continue
      }

      if (existing) {
        disposeOverlay(existing)
        overlaysByTreeId.delete(tree.id)
      }

      const record = recordsByTreeId.get(tree.id)
      const pos = record?.worldPos ?? gridToWorld(tree.tree_position.gridX, tree.tree_position.gridY)
      const worldX = pos.x
      const worldZ = pos.z
      const seed = hashUsername(tree.profile.github_username)
      const outerRadius = record?.outerRadius ?? 2.2

      let giftGroup: THREE.Group | null = null
      if (tree.gifts.length > 0) {
        const builtGifts = buildTreeGiftsAndStarOverlay({
          level: tree.tree_level,
          seed,
          gridX: tree.tree_position.gridX,
          gridY: tree.tree_position.gridY,
          gifts: tree.gifts,
          contributionCount: tree.contribution_count,
          frontYaw: FRONT_VIEW_YAW,
          preserveFrontOrientation: true,
        })
        builtGifts.group.position.set(worldX, 0, worldZ)
        builtGifts.group.userData = { treeId: tree.id }
        overlaysGroup.add(builtGifts.group)
        giftGroup = builtGifts.group
      }

      let companion: BuiltCompanion | null = null
      let companionGroup: THREE.Group | null = null
      const plinthMeshes: THREE.Mesh[] = []

      if (tree.companion?.species) {
        companion = buildVoxelCompanion(tree.companion.species, tree.companion.equipped)
        const compRadius = Math.max(1.86, outerRadius + 0.34)
        const compX = worldX + 0.866 * compRadius
        const compZ = worldZ + 0.5 * compRadius

        const plinthBase = createVoxelMesh(compX, 0.025, compZ, 1.32, 0.05, 1.32, '#dbeafe')
        const plinthTop = createVoxelMesh(compX, 0.065, compZ, 1.1, 0.06, 1.1, '#f4f8ff')
        plinthBase.userData = { treeId: tree.id }
        plinthTop.userData = { treeId: tree.id }
        overlaysGroup.add(plinthBase)
        overlaysGroup.add(plinthTop)
        plinthMeshes.push(plinthBase, plinthTop)

        companion.group.position.set(compX, 0.08, compZ)
        companion.group.scale.setScalar(1.46)
        companion.group.rotation.y = 0.62
        companion.group.userData = { treeId: tree.id }
        overlaysGroup.add(companion.group)
        companionGroup = companion.group
      }

      const companionPhase = (seed % 100) * 0.17
      if (companion) {
        animatedCompanions.push({ companion, phase: companionPhase })
      }

      overlaysByTreeId.set(tree.id, {
        signature: sig,
        tree,
        giftGroup,
        companion,
        companionPhase,
        companionGroup,
        plinthMeshes,
      })
    }
  }

  const rebuild = (realTrees: readonly CityTree[]) => {
    const baseSig = buildBaseTreesSignature(realTrees)
    if (baseSig !== lastBaseSignature) {
      lastBaseSignature = baseSig
      rebuildBaseInstances(realTrees)
    } else {
      // Refresh latest tree object metadata (e.g. gifts/companion changes) without rebuilding geometry
      for (let i = 0; i < realTrees.length; i += 1) {
        const t = realTrees[i]
        const rec = recordsByTreeId.get(t.id)
        if (rec) rec.tree = t
      }
      instanceToTree.forEach((arr) => {
        for (let i = 0; i < arr.length; i += 1) {
          const rec = recordsByTreeId.get(arr[i].id)
          if (rec) arr[i] = rec.tree
        }
      })
    }

    syncOverlays(realTrees)

    let maxAbsX = 0
    let maxAbsZ = 0
    let maxGridRadius = 0
    let maxWorldRadiusFromPlaza = 0
    const plazaWorld = gridToWorld(
      CITY_MAP_CONFIG.plazaCenter.gridX,
      CITY_MAP_CONFIG.plazaCenter.gridY,
    )
    for (let i = 0; i < records.length; i += 1) {
      const r = records[i]
      maxAbsX = Math.max(maxAbsX, Math.abs(r.worldPos.x))
      maxAbsZ = Math.max(maxAbsZ, Math.abs(r.worldPos.z))
      const gx = r.tree.tree_position.gridX - CITY_MAP_CONFIG.plazaCenter.gridX
      const gy = r.tree.tree_position.gridY - CITY_MAP_CONFIG.plazaCenter.gridY
      maxGridRadius = Math.max(maxGridRadius, Math.hypot(gx, gy))
      maxWorldRadiusFromPlaza = Math.max(
        maxWorldRadiusFromPlaza,
        Math.hypot(r.worldPos.x - plazaWorld.x, r.worldPos.z - plazaWorld.z),
      )
    }

    return { maxAbsX, maxAbsZ, maxGridRadius, maxWorldRadiusFromPlaza }
  }

  const testInstancedSlice = (
    ray: THREE.Ray,
    mesh: THREE.InstancedMesh | null,
    startIdx: number,
    count: number,
    bestDistRef: { value: number },
    bestHitRef: { tree: CityTree | null },
  ) => {
    if (!mesh || count <= 0) return
    const treeMap = instanceToTree.get(mesh)
    if (!treeMap) return

    for (let idx = startIdx; idx < startIdx + count; idx += 1) {
      mesh.getMatrixAt(idx, tmpMatrix)
      tmpInvMatrix.copy(tmpMatrix).invert()
      tmpLocalRay.copy(ray).applyMatrix4(tmpInvMatrix)

      const hit = tmpLocalRay.intersectBox(UNIT_BOX, tmpHitPoint)
      if (!hit) continue

      hit.applyMatrix4(tmpMatrix)
      const dist = ray.origin.distanceTo(hit)
      if (dist < bestDistRef.value) {
        bestDistRef.value = dist
        bestHitRef.tree = treeMap[idx] ?? null
      }
    }
  }

  const pickTreeAtRay = (
    ray: THREE.Ray,
    raycaster: THREE.Raycaster,
  ): TreePickResult | null => {
    if (records.length === 0) return null

    const oy = ray.origin.y
    const dy = ray.direction.y
    let tMin = 0
    let tMax = 420

    if (Math.abs(dy) < 1e-4) {
      if (oy < -0.5 || oy > maxTreeHeight + 1.5) return null
    } else {
      const tA = (0 - oy) / dy
      const tB = (maxTreeHeight + 1.5 - oy) / dy
      tMin = Math.max(0, Math.min(tA, tB))
      tMax = Math.min(420, Math.max(tA, tB))
      if (tMax < tMin) return null
    }

    const x0 = ray.origin.x + ray.direction.x * tMin
    const z0 = ray.origin.z + ray.direction.z * tMin
    const x1 = ray.origin.x + ray.direction.x * tMax
    const z1 = ray.origin.z + ray.direction.z * tMax
    const xzDist = Math.hypot(x1 - x0, z1 - z0)
    const steps = Math.min(120, Math.max(1, Math.ceil(xzDist / (SPATIAL_CELL_SIZE * 0.5))))

    const candidateIndices = new Set<number>()
    for (let s = 0; s <= steps; s += 1) {
      const u = steps === 0 ? 0 : s / steps
      tmpStepPoint.set(x0 + (x1 - x0) * u, 0, z0 + (z1 - z0) * u)
      const cx = Math.floor(tmpStepPoint.x / SPATIAL_CELL_SIZE)
      const cz = Math.floor(tmpStepPoint.z / SPATIAL_CELL_SIZE)
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oz = -1; oz <= 1; oz += 1) {
          const list = spatialBuckets.get(spatialCellKey(cx + ox, cz + oz))
          if (!list) continue
          for (let k = 0; k < list.length; k += 1) {
            candidateIndices.add(list[k])
          }
        }
      }
    }

    if (candidateIndices.size === 0) return null

    const bestDistRef = { value: Infinity }
    const bestHitRef: { tree: CityTree | null } = { tree: null }
    const overlayTargets: THREE.Object3D[] = []

    candidateIndices.forEach((recIdx) => {
      const rec = records[recIdx]
      if (ray.distanceSqToPoint(rec.centerPos) > rec.hitRadiusSq) return

      testInstancedSlice(ray, trunksMesh, rec.trunkStart, rec.trunkCount, bestDistRef, bestHitRef)
      testInstancedSlice(ray, foliageMesh, rec.foliageStart, rec.foliageCount, bestDistRef, bestHitRef)
      testInstancedSlice(ray, emissiveMesh, rec.emissiveStart, rec.emissiveCount, bestDistRef, bestHitRef)
      testInstancedSlice(ray, snowCapsMesh, rec.snowStart, rec.snowCount, bestDistRef, bestHitRef)

      const overlay = overlaysByTreeId.get(rec.tree.id)
      if (overlay) {
        if (overlay.giftGroup) overlayTargets.push(overlay.giftGroup)
        if (overlay.companionGroup) overlayTargets.push(overlay.companionGroup)
        for (let p = 0; p < overlay.plinthMeshes.length; p += 1) {
          overlayTargets.push(overlay.plinthMeshes[p])
        }
      }
    })

    if (overlayTargets.length > 0) {
      const overlayHits = raycaster.intersectObjects(overlayTargets, true)
      if (overlayHits.length > 0 && overlayHits[0].distance < bestDistRef.value) {
        let cur: THREE.Object3D | null = overlayHits[0].object
        while (cur) {
          const tId = cur.userData?.treeId as string | undefined
          if (tId) {
            const rec = recordsByTreeId.get(tId)
            if (rec) {
              bestDistRef.value = overlayHits[0].distance
              bestHitRef.tree = rec.tree
            }
            break
          }
          cur = cur.parent
        }
      }
    }

    if (!bestHitRef.tree) return null
    const rec = recordsByTreeId.get(bestHitRef.tree.id)
    if (!rec) return null
    return {
      tree: rec.tree,
      worldPos: rec.worldPos,
      height: rec.height,
      outerRadius: rec.outerRadius,
    }
  }

  const pickOffCameraSwapSlot = (
    camera: THREE.Camera,
    excludedIds: Set<string>,
  ): CityTree | null => {
    if (records.length === 0) return null
    camera.updateMatrixWorld()
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(projScreenMatrix)

    const minDenseIdx = Math.min(18, Math.floor(records.length * 0.05))
    const maxDenseIdx = Math.max(minDenseIdx + 1, Math.floor(records.length * 0.85))
    const camPos = camera.position

    let bestOffCamera: CityTree | null = null
    let bestOffCameraScore = -Infinity
    let bestFallback: CityTree | null = null
    let bestFallbackScore = -Infinity

    for (let i = 0; i < records.length; i += 1) {
      const rec = records[i]
      const t = rec.tree
      if (t.is_creator_special || t.claimed || excludedIds.has(t.id)) continue

      const inDenseZone = i >= minDenseIdx && i <= maxDenseIdx
      const plainVisuals = !t.companion?.species && t.gifts.length === 0
      const distSq = camPos.distanceToSquared(rec.centerPos)
      const isOffScreen = !frustum.containsPoint(rec.centerPos)

      if (isOffScreen) {
        const zoneScore =
          (inDenseZone ? 1_000_000 : 0) +
          (plainVisuals ? 100_000 : 0) +
          Math.min(50_000, distSq * 0.25) -
          Math.abs(i - records.length * 0.35)
        if (zoneScore > bestOffCameraScore) {
          bestOffCameraScore = zoneScore
          bestOffCamera = t
        }
      } else {
        const fbScore = (inDenseZone ? 1_000_000 : 0) + (plainVisuals ? 100_000 : 0) + distSq
        if (fbScore > bestFallbackScore) {
          bestFallbackScore = fbScore
          bestFallback = t
        }
      }
    }

    return bestOffCamera ?? bestFallback
  }

  const getTreeVisualInfo = (identifier: string): TreePickResult | null => {
    const rec =
      recordsByTreeId.get(identifier) ??
      recordsByUsernameLower.get(identifier.trim().toLowerCase())
    if (!rec) return null
    return {
      tree: rec.tree,
      worldPos: rec.worldPos,
      height: rec.height,
      outerRadius: rec.outerRadius,
    }
  }

  const getCreatorVisualInfo = (): TreePickResult | null => {
    const rec = creatorRecord ?? recordsByTreeId.get('creator-ufc')
    if (!rec) return null
    return {
      tree: rec.tree,
      worldPos: rec.worldPos,
      height: rec.height,
      outerRadius: rec.outerRadius,
    }
  }

  const setLowGraphicsMode = (low: boolean) => {
    lowGraphics = low
    applyActiveCutoffs(low)
  }

  const dispose = () => {
    disposeMeshArray(baseGroup, baseInstancedMeshes)
    overlaysByTreeId.forEach((overlay) => disposeOverlay(overlay))
    overlaysByTreeId.clear()
    instanceToTree.clear()
    recordsByTreeId.clear()
    recordsByUsernameLower.clear()
    spatialBuckets.clear()
    records = []
    animatedCompanions.length = 0
  }

  return {
    group,
    animatedCompanions,
    rebuild,
    setLowGraphicsMode,
    pickTreeAtRay,
    pickOffCameraSwapSlot,
    getTreeVisualInfo,
    getCreatorVisualInfo,
    dispose,
  }
}
