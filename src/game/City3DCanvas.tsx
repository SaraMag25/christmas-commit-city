import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { CITY_MAP_CONFIG, CITY_PALETTE } from '../config/cityMapConfig'
import type { CityTree } from '../types/city'
import { toSafeHttpUrl } from '../utils/urlSafety'
import { gameEventBus } from './eventBus'
import { hashUsername } from './layout/treePlacement'
import { createHorizonForestLayer } from './voxel/horizonForestLayer'
import { createVoxelMesh, getUnitBoxGeometry } from './voxel/voxelMaterials'
import {
  buildVoxelCompanion,
  disposeBuiltCompanion,
  updateCompanionAnimation,
  type BuiltCompanion,
} from './voxel/voxelCompanionBuilder'
import {
  buildVoxelChristmasTree,
  instancedBaubleMaterials,
  updateCommitLightsTwinkle,
  type BaubleInstanceData,
  type BuiltVoxelTree,
} from './voxel/voxelTreeBuilder'
import { buildVoxelWorld, gridToWorld, type InteractivePropHandle } from './voxel/voxelWorldBuilder'

interface City3DCanvasProps {
  trees: readonly CityTree[]
  decorativeTrees?: readonly CityTree[]
}

interface TreeHandle {
  signature: string
  tree: CityTree
  built: BuiltVoxelTree
  companion: BuiltCompanion | null
  companionPhase: number
  companionGroup: THREE.Group | null
  plinthMeshes: THREE.Mesh[]
  worldPos: THREE.Vector3
  centerPos: THREE.Vector3
  hitRadiusSq: number
}

interface HoveredTooltipState {
  username: string
  avatarUrl: string | null
  commits: number
  isCreator: boolean
  x: number
  y: number
}

const PIXEL_SCALE = 3
const MIN_CAMERA_DIST = 12
const MAX_CAMERA_DIST = 175
const MIN_PAN_BOUND_X = 115
const MIN_PAN_BOUND_Z = 88

function buildTreeSignature(tree: CityTree): string {
  const giftSlugs =
    tree.gifts.length === 0 ? '' : tree.gifts.map((g) => g.gift_slug).join(',')
  const comp = tree.companion
  const compKey = comp
    ? `${comp.species}:${comp.equipped.head ?? ''}:${comp.equipped.body ?? ''}:${comp.equipped.hand ?? ''}`
    : ''
  return `${tree.contribution_count}|${tree.tree_level}|${tree.tree_position.gridX},${tree.tree_position.gridY}|${giftSlugs}|${compKey}|${tree.is_creator_special ? 1 : 0}`
}

function createInstancedBaubleLayer(
  entries: Array<{ x: number; y: number; z: number; size: number; color: string }>,
  material: THREE.Material,
): THREE.InstancedMesh | null {
  if (entries.length === 0) return null
  const geom = getUnitBoxGeometry()
  const instanced = new THREE.InstancedMesh(geom, material, entries.length)
  const dummy = new THREE.Object3D()
  const c = new THREE.Color()

  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i]
    dummy.position.set(item.x, item.y, item.z)
    dummy.scale.set(item.size, item.size, item.size)
    dummy.updateMatrix()
    instanced.setMatrixAt(i, dummy.matrix)
    c.set(item.color)
    instanced.setColorAt(i, c)
  }

  instanced.instanceMatrix.needsUpdate = true
  if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
  instanced.frustumCulled = false
  return instanced
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

export function City3DCanvas({ trees, decorativeTrees = [] }: City3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const latestTreesRef = useRef<readonly CityTree[]>(trees)
  const applyTreesUpdateRef = useRef<((nextTrees: readonly CityTree[]) => void) | null>(null)
  const [hoveredLabel, setHoveredLabel] = useState<HoveredTooltipState | null>(null)

  useEffect(() => {
    // Only non-decorative real trees live in interactive handles; horizon pines render via InstancedMesh
    const realTrees =
      decorativeTrees.length > 0
        ? [...trees, ...decorativeTrees].filter((t) => !t.isDecorative)
        : trees.filter((t) => !t.isDecorative)
    latestTreesRef.current = realTrees
    applyTreesUpdateRef.current?.(realTrees)
  }, [trees, decorativeTrees])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(CITY_PALETTE.nightBg)
    scene.fog = new THREE.Fog(CITY_PALETTE.nightSkyNum, 125, 315)

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 520)
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    })
    renderer.toneMapping = THREE.NoToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(1)
    renderer.setSize(
      Math.max(160, Math.floor(width / PIXEL_SCALE)),
      Math.max(120, Math.floor(height / PIXEL_SCALE)),
      false,
    )
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.imageRendering = 'pixelated'
    renderer.domElement.className = 'pixelated block'
    container.appendChild(renderer.domElement)

    // Crisp Cool-vs-Warm North Pole lighting
    const hemiLight = new THREE.HemisphereLight(0xc2e4ff, 0x6278ad, 1.05)
    scene.add(hemiLight)

    const moonLight = new THREE.DirectionalLight(0xfff5d8, 1.18)
    moonLight.position.set(42, 58, -40)
    scene.add(moonLight)

    const warmFill = new THREE.DirectionalLight(0xffbe55, 0.42)
    warmFill.position.set(-32, 22, 36)
    scene.add(warmFill)

    // Build 3D North Pole winter forest, village & infinite snowy ground apron
    const world = buildVoxelWorld()
    scene.add(world.root)

    // Dense 5-draw-call instanced holiday forest surrounding the city cleanly
    const horizonForest = createHorizonForestLayer()
    scene.add(horizonForest.group)

    // Developer Christmas trees layer + global instanced GitHub bauble layers
    const treesGroup = new THREE.Group()
    scene.add(treesGroup)

    // Single shared selection & hover highlight rings instead of N rings
    const selectionRing = createVoxelMesh(0, 0.08, 0, 4.1, 0.1, 4.1, '#40c463', true, 0.8)
    selectionRing.visible = false
    treesGroup.add(selectionRing)

    const hoverRing = createVoxelMesh(0, 0.09, 0, 4.4, 0.08, 4.4, '#fde047', true, 0.42)
    hoverRing.visible = false
    treesGroup.add(hoverRing)

    const treeHandles = new Map<string, TreeHandle>()
    let baubleMeshes: THREE.InstancedMesh[] = []
    let animatedCompanions: Array<{ companion: BuiltCompanion; phase: number }> = []
    let selectedTreeId: string | null = null
    let hoveredTreeId: string | null = null
    let pendingFocusIdentifier: string | null = null
    let panBoundX = MIN_PAN_BOUND_X
    let panBoundZ = MIN_PAN_BOUND_Z

    const disposeHandle = (handle: TreeHandle) => {
      treesGroup.remove(handle.built.group)
      disposeObjectGeometries(handle.built.group)
      if (handle.companionGroup && handle.companion) {
        treesGroup.remove(handle.companionGroup)
        disposeBuiltCompanion(handle.companion)
      }
      for (const mesh of handle.plinthMeshes) {
        treesGroup.remove(mesh)
      }
    }

    const syncRingsVisibility = () => {
      const sel = selectedTreeId ? treeHandles.get(selectedTreeId) : undefined
      if (sel) {
        selectionRing.position.set(sel.worldPos.x, 0.08, sel.worldPos.z)
        selectionRing.visible = true
      } else {
        selectionRing.visible = false
      }

      const hov = hoveredTreeId ? treeHandles.get(hoveredTreeId) : undefined
      if (hov && hov.tree.id !== selectedTreeId) {
        hoverRing.position.set(hov.worldPos.x, 0.09, hov.worldPos.z)
        hoverRing.visible = true
      } else {
        hoverRing.visible = false
      }
    }

    const rebuildTrees = (treeList: readonly CityTree[]) => {
      const realTrees = treeList.filter((t) => !t.isDecorative)
      const activeIds = new Set<string>()
      const FRONT_VIEW_YAW = Math.PI * 0.25

      for (const tree of realTrees) {
        activeIds.add(tree.id)
      }

      // 1. Dispose removed trees only
      for (const [id, handle] of treeHandles.entries()) {
        if (!activeIds.has(id)) {
          disposeHandle(handle)
          treeHandles.delete(id)
        }
      }

      let maxAbsX = MIN_PAN_BOUND_X - 24
      let maxAbsZ = MIN_PAN_BOUND_Z - 24

      // 2. Build only new or modified trees; keep untouched trees intact
      for (let i = 0; i < realTrees.length; i += 1) {
        const tree = realTrees[i]
        const sig = buildTreeSignature(tree)
        const existing = treeHandles.get(tree.id)

        if (existing && existing.signature === sig) {
          existing.tree = tree
          maxAbsX = Math.max(maxAbsX, Math.abs(existing.worldPos.x))
          maxAbsZ = Math.max(maxAbsZ, Math.abs(existing.worldPos.z))
          continue
        }

        if (existing) {
          disposeHandle(existing)
          treeHandles.delete(tree.id)
        }

        const seed = hashUsername(tree.profile.github_username)
        const built = buildVoxelChristmasTree({
          level: tree.tree_level,
          seed,
          gridX: tree.tree_position.gridX,
          gridY: tree.tree_position.gridY,
          gifts: tree.gifts,
          giftCount: tree.gifts.length,
          isCreatorSpecial: tree.is_creator_special,
          contributionCount: tree.contribution_count,
          calendarWeeks: tree.stats?.calendarWeeks,
          frontYaw: FRONT_VIEW_YAW,
          preserveFrontOrientation: true,
          separateBaubles: true,
        })

        const pos = gridToWorld(tree.tree_position.gridX, tree.tree_position.gridY)
        built.group.position.set(pos.x, 0, pos.z)
        built.group.userData = { treeId: tree.id }
        treesGroup.add(built.group)

        maxAbsX = Math.max(maxAbsX, Math.abs(pos.x))
        maxAbsZ = Math.max(maxAbsZ, Math.abs(pos.z))

        let companion: BuiltCompanion | null = null
        let companionGroup: THREE.Group | null = null
        const plinthMeshes: THREE.Mesh[] = []

        if (tree.companion?.species) {
          companion = buildVoxelCompanion(tree.companion.species, tree.companion.equipped)
          const compRadius = Math.max(1.86, built.outerRadius + 0.34)
          const compX = pos.x + 0.866 * compRadius
          const compZ = pos.z + 0.5 * compRadius

          const plinthBase = createVoxelMesh(compX, 0.025, compZ, 1.32, 0.05, 1.32, '#dbeafe')
          const plinthTop = createVoxelMesh(compX, 0.065, compZ, 1.1, 0.06, 1.1, '#f4f8ff')
          plinthBase.userData = { treeId: tree.id }
          plinthTop.userData = { treeId: tree.id }
          treesGroup.add(plinthBase)
          treesGroup.add(plinthTop)
          plinthMeshes.push(plinthBase, plinthTop)

          companion.group.position.set(compX, 0.08, compZ)
          companion.group.scale.setScalar(1.46)
          companion.group.rotation.y = 0.62
          companion.group.userData = { treeId: tree.id }
          treesGroup.add(companion.group)
          companionGroup = companion.group
        }

        const hitRadius = Math.max(2.8, built.outerRadius + 1.9)
        treeHandles.set(tree.id, {
          signature: sig,
          tree,
          built,
          companion,
          companionPhase: (seed % 100) * 0.17,
          companionGroup,
          plinthMeshes,
          worldPos: new THREE.Vector3(pos.x, 0, pos.z),
          centerPos: new THREE.Vector3(pos.x, built.height * 0.48, pos.z),
          hitRadiusSq: hitRadius * hitRadius,
        })
      }

      panBoundX = Math.min(280, Math.max(MIN_PAN_BOUND_X, maxAbsX + 32))
      panBoundZ = Math.min(260, Math.max(MIN_PAN_BOUND_Z, maxAbsZ + 32))

      // 3. Recompute flat animated companion array + 4 global bauble InstancedMeshes
      for (const m of baubleMeshes) {
        treesGroup.remove(m)
        m.dispose()
      }
      baubleMeshes = []
      animatedCompanions = []

      const l12Entries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []
      const l3Entries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []
      const l4aEntries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []
      const l4bEntries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []

      treeHandles.forEach((h) => {
        if (h.companion) {
          animatedCompanions.push({ companion: h.companion, phase: h.companionPhase })
        }
        const cosR = Math.cos(h.built.rotationY)
        const sinR = Math.sin(h.built.rotationY)
        const baubles: BaubleInstanceData[] = h.built.baubleInstances
        for (let i = 0; i < baubles.length; i += 1) {
          const b = baubles[i]
          const wx = h.worldPos.x + b.x * cosR + b.z * sinR
          const wz = h.worldPos.z - b.x * sinR + b.z * cosR
          const item = { x: wx, y: b.y, z: wz, size: b.size, color: b.color }
          if (b.bucket === 'l4a') l4aEntries.push(item)
          else if (b.bucket === 'l4b') l4bEntries.push(item)
          else if (b.bucket === 'l3') l3Entries.push(item)
          else l12Entries.push(item)
        }
      })

      const l12Layer = createInstancedBaubleLayer(l12Entries, instancedBaubleMaterials.l12)
      const l3Layer = createInstancedBaubleLayer(l3Entries, instancedBaubleMaterials.l3)
      const l4aLayer = createInstancedBaubleLayer(l4aEntries, instancedBaubleMaterials.l4a)
      const l4bLayer = createInstancedBaubleLayer(l4bEntries, instancedBaubleMaterials.l4b)

      for (const layer of [l12Layer, l3Layer, l4aLayer, l4bLayer]) {
        if (layer) {
          treesGroup.add(layer)
          baubleMeshes.push(layer)
        }
      }

      // 4. Rebuild instanced horizon scenic pines excluding every occupied real plot
      horizonForest.rebuildForRealTrees(realTrees)
      syncRingsVisibility()
    }

    const highlightSelected = (treeId: string | null) => {
      selectedTreeId = treeId
      syncRingsVisibility()
    }

    rebuildTrees(latestTreesRef.current)

    // Camera orbit + pan state framed over the North Pole plaza
    const plazaPos = gridToWorld(CITY_MAP_CONFIG.plazaCenter.gridX, CITY_MAP_CONFIG.plazaCenter.gridY)
    const camState = {
      targetX: plazaPos.x,
      targetZ: plazaPos.z,
      desiredX: plazaPos.x,
      desiredZ: plazaPos.z,
      azimuth: Math.PI * 0.25,
      desiredAzimuth: Math.PI * 0.25,
      polar: 0.62,
      desiredPolar: 0.62,
      distance: 62,
      desiredDistance: 62,
    }

    const focusOnPos = (x: number, z: number, distance = 22) => {
      camState.desiredX = THREE.MathUtils.clamp(x, -panBoundX, panBoundX)
      camState.desiredZ = THREE.MathUtils.clamp(z, -panBoundZ, panBoundZ)
      camState.desiredDistance = THREE.MathUtils.clamp(distance, MIN_CAMERA_DIST, MAX_CAMERA_DIST)
    }

    const resetToPlaza = () => {
      camState.desiredX = plazaPos.x
      camState.desiredZ = plazaPos.z
      camState.desiredAzimuth = Math.PI * 0.25
      camState.desiredPolar = 0.62
      camState.desiredDistance = 62
    }

    // Spatial pre-filtered raycasting & multi-touch friendly pointer controls
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    const projectedVec = new THREE.Vector3()
    const activePointers = new Map<number, { x: number; y: number }>()

    let pointerMode: 'none' | 'pan' | 'orbit' | 'pinch' = 'none'
    let dragStartX = 0
    let dragStartY = 0
    let lastX = 0
    let lastY = 0
    let totalMoved = 0
    let suppressTapUntilAllUp = false
    let pinchStartDist: number | null = null
    let pinchStartDistanceVal = camState.desiredDistance
    let lastHoverTimeMs = 0

    const findTreeIdFromObject = (obj: THREE.Object3D | null): string | null => {
      let cur: THREE.Object3D | null = obj
      while (cur) {
        if (cur.userData?.treeId) return cur.userData.treeId as string
        cur = cur.parent
      }
      return null
    }

    const findPropFromObject = (
      obj: THREE.Object3D | null,
      props: InteractivePropHandle[],
    ): InteractivePropHandle | null => {
      let cur: THREE.Object3D | null = obj
      while (cur) {
        const match = props.find((p) => p.mesh === cur)
        if (match) return match
        cur = cur.parent
      }
      return null
    }

    const collectRayCandidateTrees = (): THREE.Object3D[] => {
      const targets: THREE.Object3D[] = []
      treeHandles.forEach((h) => {
        if (raycaster.ray.distanceSqToPoint(h.centerPos) <= h.hitRadiusSq) {
          targets.push(h.built.group)
          if (h.companionGroup) targets.push(h.companionGroup)
        }
      })
      return targets
    }

    const clearHover = () => {
      if (hoveredTreeId !== null) {
        hoveredTreeId = null
        syncRingsVisibility()
        gameEventBus.emit('city:tree-hovered', null)
      }
      setHoveredLabel(null)
    }

    const updateHoverAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)

      const candidateTargets = collectRayCandidateTrees()
      if (candidateTargets.length > 0) {
        const hits = raycaster.intersectObjects(candidateTargets, true)
        if (hits.length > 0) {
          const hitId = findTreeIdFromObject(hits[0].object)
          const handle = hitId ? treeHandles.get(hitId) : undefined
          if (handle) {
            renderer.domElement.style.cursor = 'pointer'
            if (hoveredTreeId !== handle.tree.id) {
              hoveredTreeId = handle.tree.id
              syncRingsVisibility()
              gameEventBus.emit('city:tree-hovered', handle.tree)
            }
            projectedVec
              .copy(handle.worldPos)
              .setY(handle.built.height + 1.35)
              .project(camera)
            const rawX = ((projectedVec.x + 1) / 2) * rect.width
            const rawY = ((-projectedVec.y + 1) / 2) * rect.height
            setHoveredLabel({
              username: handle.tree.profile.github_username,
              avatarUrl: toSafeHttpUrl(handle.tree.profile.avatar_url, { allowRelative: true }),
              commits: handle.tree.contribution_count,
              isCreator: Boolean(handle.tree.is_creator_special),
              x: THREE.MathUtils.clamp(rawX, 76, Math.max(76, rect.width - 76)),
              y: THREE.MathUtils.clamp(rawY, 44, Math.max(44, rect.height - 24)),
            })
            return
          }
        }
      }

      const propHits = raycaster.intersectObjects(
        world.interactiveProps.map((p) => p.mesh),
        true,
      )
      renderer.domElement.style.cursor = propHits.length > 0 ? 'pointer' : 'grab'
      clearHover()
    }

    const computePinchDistance = (): number | null => {
      if (activePointers.size < 2) return null
      const pts = Array.from(activePointers.values())
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    }

    const onPointerDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (activePointers.size >= 2) {
        pointerMode = 'pinch'
        suppressTapUntilAllUp = true
        pinchStartDist = computePinchDistance()
        pinchStartDistanceVal = camState.desiredDistance
        clearHover()
        return
      }

      dragStartX = e.clientX
      dragStartY = e.clientY
      lastX = e.clientX
      lastY = e.clientY
      totalMoved = 0
      suppressTapUntilAllUp = false
      pointerMode = e.button === 2 || e.shiftKey ? 'orbit' : 'pan'
    }

    const onPointerMove = (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }

      if (pointerMode === 'pinch') {
        const dist = computePinchDistance()
        if (dist && pinchStartDist) {
          const ratio = pinchStartDist / Math.max(10, dist)
          camState.desiredDistance = THREE.MathUtils.clamp(
            pinchStartDistanceVal * ratio,
            MIN_CAMERA_DIST,
            MAX_CAMERA_DIST,
          )
        }
        return
      }

      if (pointerMode === 'none') {
        if (e.target !== renderer.domElement) {
          clearHover()
          return
        }
        const nowMs = performance.now()
        if (nowMs - lastHoverTimeMs < 24) return
        lastHoverTimeMs = nowMs
        updateHoverAt(e.clientX, e.clientY)
        return
      }

      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      totalMoved += Math.hypot(dx, dy)
      lastX = e.clientX
      lastY = e.clientY

      if (pointerMode === 'orbit') {
        camState.desiredAzimuth -= dx * 0.0065
        camState.desiredPolar = THREE.MathUtils.clamp(
          camState.desiredPolar - dy * 0.0055,
          0.34,
          1.2,
        )
      } else if (pointerMode === 'pan') {
        const panFactor = camState.distance * 0.00185
        const cosA = Math.cos(camState.azimuth)
        const sinA = Math.sin(camState.azimuth)
        camState.desiredX = THREE.MathUtils.clamp(
          camState.desiredX - (dx * cosA + dy * sinA) * panFactor,
          -panBoundX,
          panBoundX,
        )
        camState.desiredZ = THREE.MathUtils.clamp(
          camState.desiredZ - (-dx * sinA + dy * cosA) * panFactor,
          -panBoundZ,
          panBoundZ,
        )
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId)

      if (activePointers.size === 1 && pointerMode === 'pinch') {
        const remaining = Array.from(activePointers.values())[0]
        lastX = remaining.x
        lastY = remaining.y
        pointerMode = 'pan'
        pinchStartDist = null
        return
      }

      const moved = totalMoved || Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY)
      const prevMode = pointerMode
      if (activePointers.size === 0) {
        pointerMode = 'none'
        pinchStartDist = null
      }

      const allowTap = !suppressTapUntilAllUp && moved <= 8 && prevMode === 'pan'
      if (activePointers.size === 0) {
        suppressTapUntilAllUp = false
      }
      if (!allowTap) return

      const rect = renderer.domElement.getBoundingClientRect()
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)

      const candidateTargets = collectRayCandidateTrees()
      if (candidateTargets.length > 0) {
        const treeHits = raycaster.intersectObjects(candidateTargets, true)
        if (treeHits.length > 0) {
          const hitId = findTreeIdFromObject(treeHits[0].object)
          const handle = hitId ? treeHandles.get(hitId) : undefined
          if (handle) {
            highlightSelected(handle.tree.id)
            focusOnPos(handle.worldPos.x, handle.worldPos.z, 24)
            gameEventBus.emit('city:tree-selected', handle.tree)
            return
          }
        }
      }

      const propHits = raycaster.intersectObjects(
        world.interactiveProps.map((p) => p.mesh),
        true,
      )
      if (propHits.length > 0) {
        const prop = findPropFromObject(propHits[0].object, world.interactiveProps)
        if (prop) {
          gameEventBus.emit('city:prop-interacted', prop.dialogue)
        }
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camState.desiredDistance = THREE.MathUtils.clamp(
        camState.desiredDistance * (e.deltaY > 0 ? 1.09 : 0.91),
        MIN_CAMERA_DIST,
        MAX_CAMERA_DIST,
      )
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    const dom = renderer.domElement
    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('contextmenu', onContextMenu)

    // Keyboard WASD / Arrows
    const pressedKeys = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => pressedKeys.add(e.key.toLowerCase())
    const onKeyUp = (e: KeyboardEvent) => pressedKeys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(
        Math.max(160, Math.floor(w / PIXEL_SCALE)),
        Math.max(120, Math.floor(h / PIXEL_SCALE)),
        false,
      )
    }
    window.addEventListener('resize', handleResize)

    const focusTreeByIdentifier = (identifier: string) => {
      const norm = identifier.trim().toLowerCase()
      let target = treeHandles.get(identifier)
      if (!target) {
        for (const h of treeHandles.values()) {
          if (h.tree.profile.github_username.toLowerCase() === norm) {
            target = h
            break
          }
        }
      }
      if (!target) {
        pendingFocusIdentifier = identifier
        return
      }
      pendingFocusIdentifier = null
      highlightSelected(target.tree.id)
      focusOnPos(target.worldPos.x, target.worldPos.z, 24)
      gameEventBus.emit('city:tree-selected', target.tree)
    }

    applyTreesUpdateRef.current = (nextTrees: readonly CityTree[]) => {
      rebuildTrees(nextTrees)
      if (pendingFocusIdentifier) {
        focusTreeByIdentifier(pendingFocusIdentifier)
      }
    }

    const unsubs = [
      gameEventBus.on('city:trees-updated', (nextTrees) => {
        latestTreesRef.current = nextTrees
        applyTreesUpdateRef.current?.(nextTrees)
      }),
      gameEventBus.on('city:zoom-in', () => {
        camState.desiredDistance = THREE.MathUtils.clamp(
          camState.desiredDistance * 0.82,
          MIN_CAMERA_DIST,
          MAX_CAMERA_DIST,
        )
      }),
      gameEventBus.on('city:zoom-out', () => {
        camState.desiredDistance = THREE.MathUtils.clamp(
          camState.desiredDistance * 1.2,
          MIN_CAMERA_DIST,
          MAX_CAMERA_DIST,
        )
      }),
      gameEventBus.on('city:reset-camera', () => {
        resetToPlaza()
      }),
      gameEventBus.on('city:orbit-left', () => {
        camState.desiredAzimuth -= Math.PI * 0.25
      }),
      gameEventBus.on('city:orbit-right', () => {
        camState.desiredAzimuth += Math.PI * 0.25
      }),
      gameEventBus.on('city:focus-tree', focusTreeByIdentifier),
      gameEventBus.on('city:focus-creator', () => {
        let creator: TreeHandle | undefined = treeHandles.get('creator-ufc')
        if (!creator) {
          for (const h of treeHandles.values()) {
            if (h.tree.is_creator_special) {
              creator = h
              break
            }
          }
        }
        if (!creator) return
        highlightSelected(creator.tree.id)
        focusOnPos(creator.worldPos.x, creator.worldPos.z, 24)
        gameEventBus.emit('city:tree-selected', creator.tree)
      }),
    ]

    gameEventBus.emit('city:ready')

    let animId = 0
    let lastTime = performance.now()
    const dummy = new THREE.Object3D()
    const lampBaseScales = world.lampGlows.map((glow) => ({
      x: glow.scale.x,
      y: glow.scale.y,
      z: glow.scale.z,
    }))

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const t = now / 1000

      const activeTag = document.activeElement?.tagName
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        let kx = 0
        let kz = 0
        if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) kx -= 1
        if (pressedKeys.has('d') || pressedKeys.has('arrowright')) kx += 1
        if (pressedKeys.has('w') || pressedKeys.has('arrowup')) kz -= 1
        if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) kz += 1

        if (kx !== 0 || kz !== 0) {
          const speed = camState.distance * 0.65 * dt
          const cosA = Math.cos(camState.azimuth)
          const sinA = Math.sin(camState.azimuth)
          const moveX = (kx * cosA + kz * sinA) * speed
          const moveZ = (-kx * sinA + kz * cosA) * speed
          camState.desiredX = THREE.MathUtils.clamp(
            camState.desiredX + moveX,
            -panBoundX,
            panBoundX,
          )
          camState.desiredZ = THREE.MathUtils.clamp(
            camState.desiredZ + moveZ,
            -panBoundZ,
            panBoundZ,
          )
        }
      }

      const damp = 1 - Math.exp(-8 * dt)
      camState.targetX = THREE.MathUtils.lerp(camState.targetX, camState.desiredX, damp)
      camState.targetZ = THREE.MathUtils.lerp(camState.targetZ, camState.desiredZ, damp)
      camState.azimuth = THREE.MathUtils.lerp(camState.azimuth, camState.desiredAzimuth, damp)
      camState.polar = THREE.MathUtils.lerp(camState.polar, camState.desiredPolar, damp)
      camState.distance = THREE.MathUtils.lerp(camState.distance, camState.desiredDistance, damp)

      const sinP = Math.sin(camState.polar)
      const cosP = Math.cos(camState.polar)
      camera.position.set(
        camState.targetX + camState.distance * cosP * Math.sin(camState.azimuth),
        camState.distance * sinP + 1.5,
        camState.targetZ + camState.distance * cosP * Math.cos(camState.azimuth),
      )
      camera.lookAt(camState.targetX, 1.8, camState.targetZ)

      // Twinkle GitHub green commit baubles & outer horizon holiday pines in O(1)
      updateCommitLightsTwinkle(t)
      horizonForest.updateTwinkle(t)

      // Animate adopted developer companions beside trees
      for (let i = 0; i < animatedCompanions.length; i += 1) {
        const entry = animatedCompanions[i]
        updateCompanionAnimation(entry.companion, t, entry.phase)
      }

      // Falling 3D voxel snow
      for (let i = 0; i < world.snowData.length; i += 1) {
        const flake = world.snowData[i]
        flake.y -= flake.speed * dt
        if (flake.y < 0.2) {
          flake.y = 34
        }
        const fx = flake.x + Math.sin(t * 1.4 + flake.drift) * 0.45
        dummy.position.set(fx, flake.y, flake.z)
        dummy.scale.set(flake.size, flake.size, flake.size)
        dummy.updateMatrix()
        world.snowParticles.setMatrixAt(i, dummy.matrix)
      }
      world.snowParticles.instanceMatrix.needsUpdate = true

      // Living forest wildlife
      for (const actor of world.wildlife) {
        const angle = t * actor.speed + actor.phase
        const nx = actor.centerX + Math.cos(angle) * actor.radiusX
        const nz = actor.centerZ + Math.sin(angle) * actor.radiusZ
        const dx = -Math.sin(angle) * actor.radiusX
        const dz = Math.cos(angle) * actor.radiusZ
        const hopY =
          actor.kind === 'bunny'
            ? Math.abs(Math.sin(t * 5.2 + actor.phase)) * 0.35
            : actor.kind === 'reindeer' || actor.kind === 'fox'
              ? Math.abs(Math.sin(t * 4.5 + actor.phase)) * 0.08
              : 0
        actor.mesh.position.set(nx, hopY, nz)
        actor.mesh.rotation.y = Math.atan2(dx, dz)
      }

      // Rising chimney smoke puffs
      for (const puff of world.smokePuffs) {
        const cycle = (t * 0.45 + puff.phase) % 2.4
        puff.mesh.position.y = puff.baseY + cycle * 1.4
        const s = 0.42 + cycle * 0.14
        puff.mesh.scale.set(s, s * 0.8, s)
      }

      // Gentle spin + bobbing for Crystal Tower observatory spire
      for (const crystal of world.crystalRotators) {
        crystal.mesh.rotation.y = t * 0.55 + crystal.phase
        crystal.mesh.position.y = crystal.baseY + Math.sin(t * 1.9 + crystal.phase) * 0.35
      }

      // Instanced golden / cyan / lilac magic sparkles
      for (let i = 0; i < world.magicParticleData.length; i += 1) {
        const p = world.magicParticleData[i]
        const angle = t * p.speed + p.phase
        const px = p.centerX + Math.cos(angle) * p.radius
        const pz = p.centerZ + Math.sin(angle) * p.radius
        const py = p.baseY + Math.sin(t * 2.1 + p.phase * 1.7) * p.bobAmp
        const s = p.size * (0.78 + 0.32 * (0.5 + 0.5 * Math.sin(t * 3.8 + p.phase * 3.1)))
        dummy.position.set(px, py, pz)
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        world.magicParticles.setMatrixAt(i, dummy.matrix)
      }
      world.magicParticles.instanceMatrix.needsUpdate = true

      // Gently undulating Aurora Borealis ribbons
      for (const bar of world.auroraBars) {
        bar.mesh.position.y = bar.baseY + Math.sin(t * 0.8 + bar.phase) * 1.3
      }

      // Floating forest wisps
      for (const wisp of world.wisps) {
        wisp.mesh.position.set(
          wisp.baseX + Math.sin(t * 0.9 + wisp.phase) * 0.6,
          wisp.baseY + Math.cos(t * 1.4 + wisp.phase) * 0.35,
          wisp.baseZ + Math.cos(t * 0.7 + wisp.phase) * 0.6,
        )
      }

      // Flowing river ripples & mountain waterfall cascade
      for (const r of world.riverRipples) {
        if (r.isWaterfall) {
          const drop = (t * 4.5 + r.phase) % 5.8
          r.mesh.position.y = 6.2 - drop
        } else {
          const shimmer = Math.sin(t * 2.4 + r.phase)
          r.mesh.position.z = r.baseZ + ((t * 1.1 + r.phase) % 1.4) - 0.7
          r.mesh.scale.set(0.8 + shimmer * 0.22, 0.08, 0.45)
        }
      }

      // Cozy flicker for warm lantern, campfire, and window glow pads
      for (let i = 0; i < world.lampGlows.length; i += 1) {
        const glow = world.lampGlows[i]
        const base = lampBaseScales[i]
        const pulse = 1 + Math.sin(t * 3.1 + i * 1.3) * 0.06
        glow.scale.set(base.x * pulse, base.y, base.z * pulse)
      }

      renderer.render(scene, camera)
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      applyTreesUpdateRef.current = null
      unsubs.forEach((u) => u())
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', handleResize)

      treeHandles.forEach((handle) => disposeHandle(handle))
      treeHandles.clear()
      for (const m of baubleMeshes) {
        treesGroup.remove(m)
        m.dispose()
      }
      horizonForest.dispose()
      disposeObjectGeometries(treesGroup)
      disposeObjectGeometries(world.root)
      renderer.dispose()
      if (dom.parentNode === container) {
        container.removeChild(dom)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      aria-label="Mapa interativo 3D em pixel art da Christmas Commit City"
    >
      {hoveredLabel && (
        <div
          style={{
            left: hoveredLabel.x,
            top: hoveredLabel.y,
          }}
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 whitespace-nowrap rounded-sm border border-amber-400/70 bg-[#070d1f]/95 px-2 py-1 text-[10px] font-bold shadow-lg"
        >
          {hoveredLabel.avatarUrl && (
            <img
              src={hoveredLabel.avatarUrl}
              alt=""
              className="h-3.5 w-3.5 rounded-[2px] border border-slate-700"
            />
          )}
          <span className={hoveredLabel.isCreator ? 'text-amber-300' : 'text-slate-100'}>
            {hoveredLabel.isCreator ? '★ ' : ''}@{hoveredLabel.username}
          </span>
          <span className="font-normal text-emerald-300">
            · {hoveredLabel.commits.toLocaleString()} commits
          </span>
        </div>
      )}
    </div>
  )
}
