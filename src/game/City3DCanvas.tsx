import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { CITY_MAP_CONFIG, CITY_PALETTE } from '../config/cityMapConfig'
import { useLocale } from '../context/localeContextStore'
import type { CityTree } from '../types/city'
import { toSafeHttpUrl } from '../utils/urlSafety'
import { gameEventBus, type GraphicsQualityMode } from './eventBus'
import {
  clampCameraTargetToContinent,
  getContinentRegionAtWorld,
  isWithinSafePlayableBounds,
} from './layout/continentGeography'
import { hashUsername } from './layout/treePlacement'
import { createInstancedCityTreesLayer } from './voxel/instancedCityTrees'
import {
  type AmbientTreePoint,
  createProceduralTreesLayer,
} from './voxel/proceduralTreesLayer'
import { updateCompanionAnimation } from './voxel/voxelCompanionBuilder'
import { createVoxelMesh, getUnitBoxGeometry } from './voxel/voxelMaterials'
import { updateCommitLightsTwinkle } from './voxel/voxelTreeBuilder'
import { buildVoxelWorld, gridToWorld, type InteractivePropHandle } from './voxel/voxelWorldBuilder'

interface City3DCanvasProps {
  trees: readonly CityTree[]
  decorativeTrees?: readonly CityTree[]
  graphicsQuality?: GraphicsQualityMode
  onLowFpsSuggested?: () => void
  onAmbientPointsReady?: (points: readonly AmbientTreePoint[]) => void
}

interface HoveredTooltipState {
  username: string
  avatarUrl: string | null
  commits: number
  isCreator: boolean
  regionName: string
  x: number
  y: number
}

const HIGH_PIXEL_SCALE = 3
const LOW_PIXEL_SCALE = 3.6
const MIN_CAMERA_DIST = 11
const MAX_CAMERA_DIST = 76
const MIN_POLAR_ANGLE = 0.5
const MAX_POLAR_ANGLE = 1.18
const SNOW_WRAP_SPAN_X = 240
const SNOW_WRAP_SPAN_Z = 200

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

export function City3DCanvas({
  trees,
  decorativeTrees = [],
  graphicsQuality = 'high',
  onLowFpsSuggested,
  onAmbientPointsReady,
}: City3DCanvasProps) {
  const { language } = useLocale()
  const languageRef = useRef(language)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const latestTreesRef = useRef<readonly CityTree[]>(trees)
  const applyTreesUpdateRef = useRef<((nextTrees: readonly CityTree[]) => void) | null>(null)
  const graphicsQualityRef = useRef<GraphicsQualityMode>(graphicsQuality)
  const applyGraphicsModeRef = useRef<((mode: GraphicsQualityMode) => void) | null>(null)
  const onLowFpsSuggestedRef = useRef(onLowFpsSuggested)
  const onAmbientPointsReadyRef = useRef(onAmbientPointsReady)
  const [hoveredLabel, setHoveredLabel] = useState<HoveredTooltipState | null>(null)

  useEffect(() => {
    languageRef.current = language
  }, [language])

  useEffect(() => {
    onLowFpsSuggestedRef.current = onLowFpsSuggested
  }, [onLowFpsSuggested])

  useEffect(() => {
    onAmbientPointsReadyRef.current = onAmbientPointsReady
  }, [onAmbientPointsReady])

  useEffect(() => {
    graphicsQualityRef.current = graphicsQuality
    applyGraphicsModeRef.current?.(graphicsQuality)
  }, [graphicsQuality])

  useEffect(() => {
    // Only non-decorative real trees render in the clickable city InstancedMesh layer
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
    const fog = new THREE.Fog(CITY_PALETTE.nightSkyNum, 66, 148)
    scene.fog = fog

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 1650)
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    })
    renderer.toneMapping = THREE.NoToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
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

    // Build 3D Arctic continent, islands, oceans, rivers, bridges & 5 neighborhood districts
    const world = buildVoxelWorld()
    scene.add(world.root)

    // 100% clickable instanced real developer Christmas trees distributed across all 5 neighborhoods
    const cityTreesLayer = createInstancedCityTreesLayer()
    scene.add(cityTreesLayer.group)

    // Emulated border/neighborhood trees rendered identically via generateVoxelTreeGeometryData (<= 45% of real trees)
    const proceduralTrees = createProceduralTreesLayer()
    scene.add(proceduralTrees.group)

    // Shared highlight rings & light beams for selected / hovered / creator trees (O(1))
    const selectionGroup = new THREE.Group()
    const selectionRing = createVoxelMesh(0, 0.08, 0, 4.2, 0.1, 4.2, '#40c463', true, 0.82)
    const selectionBeamOuter = createVoxelMesh(0, 12.5, 0, 1.25, 25, 1.25, '#40c463', true, 0.14, false)
    const selectionBeamCore = createVoxelMesh(0, 12.5, 0, 0.45, 25, 0.45, '#a7f3d0', true, 0.24, false)
    selectionGroup.add(selectionRing, selectionBeamOuter, selectionBeamCore)
    selectionGroup.visible = false
    scene.add(selectionGroup)

    const creatorAuraGroup = new THREE.Group()
    const creatorRing = createVoxelMesh(0, 0.07, 0, 4.6, 0.08, 4.6, '#fde047', true, 0.45)
    const creatorBeam = createVoxelMesh(0, 13.5, 0, 0.85, 27, 0.85, '#fde047', true, 0.1, false)
    creatorAuraGroup.add(creatorRing, creatorBeam)
    creatorAuraGroup.visible = false
    scene.add(creatorAuraGroup)

    const hoverRing = createVoxelMesh(0, 0.09, 0, 4.4, 0.08, 4.4, '#fde047', true, 0.42)
    hoverRing.visible = false
    scene.add(hoverRing)

    const updateRendererSizeForQuality = (mode: GraphicsQualityMode) => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      const isLow = mode === 'low'
      const pixelScale = isLow ? LOW_PIXEL_SCALE : HIGH_PIXEL_SCALE
      renderer.setPixelRatio(isLow ? 1 : Math.min(window.devicePixelRatio || 1, 1.25))
      renderer.setSize(
        Math.max(140, Math.floor(w / pixelScale)),
        Math.max(105, Math.floor(h / pixelScale)),
        false,
      )
    }

    const applyGraphicsMode = (mode: GraphicsQualityMode) => {
      const isLow = mode === 'low'
      updateRendererSizeForQuality(mode)
      warmFill.visible = !isLow
      for (let i = 0; i < world.pointLights.length; i += 1) {
        world.pointLights[i].visible = !isLow
      }
      cityTreesLayer.setLowGraphicsMode(isLow)
      proceduralTrees.setLowGraphicsMode(isLow)
      const ambientPts = proceduralTrees.getMinimapPoints()
      onAmbientPointsReadyRef.current?.(ambientPts)
      gameEventBus.emit('city:ambient-points-updated', ambientPts)
      world.snowParticles.count = isLow
        ? Math.min(160, world.snowData.length)
        : world.snowData.length
      world.snowParticles.instanceMatrix.needsUpdate = true
      world.magicParticles.visible = !isLow
      for (let i = 0; i < world.smokePuffs.length; i += 1) {
        world.smokePuffs[i].mesh.visible = !isLow
      }
      for (let i = 0; i < world.wisps.length; i += 1) {
        world.wisps[i].mesh.visible = !isLow
      }
      for (let i = 0; i < world.riverRipples.length; i += 1) {
        world.riverRipples[i].mesh.visible = !isLow
      }
      selectionBeamOuter.visible = !isLow
      creatorBeam.visible = !isLow
    }

    applyGraphicsModeRef.current = applyGraphicsMode
    applyGraphicsMode(graphicsQualityRef.current)

    const plazaPos = gridToWorld(
      CITY_MAP_CONFIG.plazaCenter.gridX,
      CITY_MAP_CONFIG.plazaCenter.gridY,
    )

    let selectedTreeId: string | null = null
    let hoveredTreeId: string | null = null
    let pendingFocusIdentifier: string | null = null

    const syncRingsVisibility = () => {
      const sel = selectedTreeId ? cityTreesLayer.getTreeVisualInfo(selectedTreeId) : null
      if (sel) {
        selectionGroup.position.set(sel.worldPos.x, 0, sel.worldPos.z)
        selectionGroup.visible = true
      } else {
        selectionGroup.visible = false
      }

      const creator = cityTreesLayer.getCreatorVisualInfo()
      if (creator) {
        creatorAuraGroup.position.set(creator.worldPos.x, 0, creator.worldPos.z)
        creatorAuraGroup.visible = true
      } else {
        creatorAuraGroup.visible = false
      }

      const hov = hoveredTreeId ? cityTreesLayer.getTreeVisualInfo(hoveredTreeId) : null
      if (hov && hov.tree.id !== selectedTreeId) {
        hoverRing.position.set(hov.worldPos.x, 0.09, hov.worldPos.z)
        hoverRing.visible = true
      } else {
        hoverRing.visible = false
      }
    }

    const rebuildTrees = (treeList: readonly CityTree[]) => {
      const realTrees = treeList.filter((t) => !t.isDecorative)
      cityTreesLayer.rebuild(realTrees)
      proceduralTrees.rebuild(realTrees)
      const ambientPts = proceduralTrees.getMinimapPoints()
      onAmbientPointsReadyRef.current?.(ambientPts)
      gameEventBus.emit('city:ambient-points-updated', ambientPts)
      syncRingsVisibility()
    }

    const highlightSelected = (treeId: string | null) => {
      selectedTreeId = treeId
      syncRingsVisibility()
    }

    rebuildTrees(latestTreesRef.current)

    // Camera orbit + pan state framed comfortably over the North Pole plaza
    const camState = {
      targetX: plazaPos.x,
      targetZ: plazaPos.z,
      desiredX: plazaPos.x,
      desiredZ: plazaPos.z,
      azimuth: Math.PI * 0.25,
      desiredAzimuth: Math.PI * 0.25,
      polar: 0.64,
      desiredPolar: 0.64,
      distance: 58,
      desiredDistance: 58,
    }
    let searchFlightRollback: {
      x: number
      z: number
      distance: number
      polar: number
    } | null = null

    const stepCameraWithinSafeBounds = (stepX: number, stepZ: number) => {
      const nextX = camState.desiredX + stepX
      const nextZ = camState.desiredZ + stepZ
      if (isWithinSafePlayableBounds(nextX, nextZ)) {
        camState.desiredX = nextX
        camState.desiredZ = nextZ
        return
      }
      if (isWithinSafePlayableBounds(nextX, camState.desiredZ)) {
        camState.desiredX = nextX
        return
      }
      if (isWithinSafePlayableBounds(camState.desiredX, nextZ)) {
        camState.desiredZ = nextZ
        return
      }
      if (!isWithinSafePlayableBounds(camState.desiredX, camState.desiredZ)) {
        const clamped = clampCameraTargetToContinent(nextX, nextZ)
        camState.desiredX = clamped.x
        camState.desiredZ = clamped.z
      }
    }

    const focusOnPos = (x: number, z: number, distance = 24) => {
      searchFlightRollback = null
      const clamped = isWithinSafePlayableBounds(x, z)
        ? { x, z }
        : clampCameraTargetToContinent(x, z)
      camState.desiredX = clamped.x
      camState.desiredZ = clamped.z
      camState.desiredDistance = THREE.MathUtils.clamp(distance, MIN_CAMERA_DIST, MAX_CAMERA_DIST)
    }

    const resetToPlaza = () => {
      searchFlightRollback = null
      camState.desiredX = plazaPos.x
      camState.desiredZ = plazaPos.z
      camState.desiredAzimuth = Math.PI * 0.25
      camState.desiredPolar = 0.64
      camState.desiredDistance = 58
    }

    // Spatial-grid accelerated InstancedMesh raycasting & multi-touch pointer controls
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

      const picked = cityTreesLayer.pickTreeAtRay(raycaster.ray, raycaster)
      if (picked) {
        renderer.domElement.style.cursor = 'pointer'
        if (hoveredTreeId !== picked.tree.id) {
          hoveredTreeId = picked.tree.id
          syncRingsVisibility()
          gameEventBus.emit('city:tree-hovered', picked.tree)
        }
        projectedVec
          .copy(picked.worldPos)
          .setY(picked.height + 1.35)
          .project(camera)
        const rawX = ((projectedVec.x + 1) / 2) * rect.width
        const rawY = ((-projectedVec.y + 1) / 2) * rect.height
        const hoverRegion = getContinentRegionAtWorld(picked.worldPos.x, picked.worldPos.z)
        setHoveredLabel({
          username: picked.tree.profile.github_username,
          avatarUrl: toSafeHttpUrl(picked.tree.profile.avatar_url, { allowRelative: true }),
          commits: picked.tree.contribution_count,
          isCreator: Boolean(picked.tree.is_creator_special),
          regionName: languageRef.current === 'en' ? hoverRegion.nameEn : hoverRegion.namePt,
          x: THREE.MathUtils.clamp(rawX, 92, Math.max(92, rect.width - 92)),
          y: THREE.MathUtils.clamp(rawY, 44, Math.max(44, rect.height - 24)),
        })
        return
      }

      const propHits = raycaster.intersectObjects(
        world.interactiveProps.map((p) => p.mesh),
        true,
      )
      if (propHits.length > 0) {
        renderer.domElement.style.cursor = 'pointer'
        clearHover()
        return
      }

      renderer.domElement.style.cursor = 'grab'
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
        const throttleMs = graphicsQualityRef.current === 'low' ? 60 : 28
        if (nowMs - lastHoverTimeMs < throttleMs) return
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
          MIN_POLAR_ANGLE,
          MAX_POLAR_ANGLE,
        )
      } else if (pointerMode === 'pan') {
        const panFactor = camState.distance * 0.00185
        const cosA = Math.cos(camState.azimuth)
        const sinA = Math.sin(camState.azimuth)
        stepCameraWithinSafeBounds(
          -(dx * cosA + dy * sinA) * panFactor,
          -(-dx * sinA + dy * cosA) * panFactor,
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

      const picked = cityTreesLayer.pickTreeAtRay(raycaster.ray, raycaster)
      if (picked) {
        highlightSelected(picked.tree.id)
        focusOnPos(picked.worldPos.x, picked.worldPos.z, 24)
        gameEventBus.emit('city:tree-selected', picked.tree)
        return
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
      updateRendererSizeForQuality(graphicsQualityRef.current)
    }
    window.addEventListener('resize', handleResize)

    const focusTreeByIdentifier = (identifier: string) => {
      const target = cityTreesLayer.getTreeVisualInfo(identifier)
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
      gameEventBus.on('city:pan-to-world', ({ x, z, distance }) => {
        if (!isWithinSafePlayableBounds(x, z)) return
        camState.desiredX = x
        camState.desiredZ = z
        if (typeof distance === 'number') {
          camState.desiredDistance = THREE.MathUtils.clamp(
            distance,
            MIN_CAMERA_DIST,
            MAX_CAMERA_DIST,
          )
        }
      }),
      gameEventBus.on('city:orbit-left', () => {
        camState.desiredAzimuth -= Math.PI * 0.25
      }),
      gameEventBus.on('city:orbit-right', () => {
        camState.desiredAzimuth += Math.PI * 0.25
      }),
      gameEventBus.on('city:focus-tree', focusTreeByIdentifier),
      gameEventBus.on('city:search-flight-start', ({ username }) => {
        if (!searchFlightRollback) {
          searchFlightRollback = {
            x: camState.desiredX,
            z: camState.desiredZ,
            distance: camState.desiredDistance,
            polar: camState.desiredPolar,
          }
        }
        const driftSeed = hashUsername(username)
        const driftAngle = ((driftSeed % 360) * Math.PI) / 180
        const driftRadius = 22
        const nextDist = THREE.MathUtils.clamp(
          Math.max(camState.desiredDistance, 68),
          MIN_CAMERA_DIST,
          MAX_CAMERA_DIST,
        )
        const clamped = clampCameraTargetToContinent(
          camState.desiredX * 0.45 + Math.cos(driftAngle) * driftRadius,
          camState.desiredZ * 0.45 + Math.sin(driftAngle) * driftRadius,
        )
        camState.desiredX = clamped.x
        camState.desiredZ = clamped.z
        camState.desiredDistance = nextDist
        camState.desiredPolar = THREE.MathUtils.clamp(camState.desiredPolar, 0.56, 0.86)
      }),
      gameEventBus.on('city:search-flight-abort', () => {
        if (!searchFlightRollback) return
        camState.desiredX = searchFlightRollback.x
        camState.desiredZ = searchFlightRollback.z
        camState.desiredDistance = searchFlightRollback.distance
        camState.desiredPolar = searchFlightRollback.polar
        searchFlightRollback = null
      }),
      gameEventBus.on('city:request-swap-slot', ({ excludedIds, onResolve }) => {
        onResolve(cityTreesLayer.pickOffCameraSwapSlot(camera, excludedIds))
      }),
      gameEventBus.on('city:focus-creator', () => {
        const creator = cityTreesLayer.getCreatorVisualInfo()
        if (!creator) return
        highlightSelected(creator.tree.id)
        focusOnPos(creator.worldPos.x, creator.worldPos.z, 24)
        gameEventBus.emit('city:tree-selected', creator.tree)
      }),
      gameEventBus.on('city:request-telemetry', () => {
        gameEventBus.emit('city:camera-telemetry', {
          targetX: camState.targetX,
          targetZ: camState.targetZ,
          distance: camState.distance,
          azimuth: camState.azimuth,
          polar: camState.polar,
        })
      }),
    ]

    gameEventBus.emit('city:ready')

    let animId = 0
    let lastTime = performance.now()
    let warmupElapsed = 0
    let fpsSampleFrames = 0
    let fpsSampleElapsed = 0
    let lowFpsWindows = 0
    let lowFpsPromptSent = false
    let lastTelemX = NaN
    let lastTelemZ = NaN
    let lastTelemDist = NaN
    let lastTelemAz = NaN
    const dummy = new THREE.Object3D()
    const lampBaseScales = world.lampGlows.map((glow) => ({
      x: glow.scale.x,
      y: glow.scale.y,
      z: glow.scale.z,
    }))

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      const rawDt = (now - lastTime) / 1000
      const dt = Math.min(0.05, Math.max(0.001, rawDt))
      lastTime = now
      const t = now / 1000
      const isLow = graphicsQualityRef.current === 'low'

      // Sustained low-FPS monitor offers an optional discreet Low-graphics quick switch
      if (!document.hidden && rawDt > 0 && rawDt < 0.25) {
        warmupElapsed += rawDt
        if (warmupElapsed >= 4.0 && !isLow && !lowFpsPromptSent) {
          fpsSampleFrames += 1
          fpsSampleElapsed += rawDt
          if (fpsSampleElapsed >= 2.0) {
            const avgFps = fpsSampleFrames / fpsSampleElapsed
            lowFpsWindows = avgFps < 24 ? lowFpsWindows + 1 : 0
            fpsSampleFrames = 0
            fpsSampleElapsed = 0
            if (lowFpsWindows >= 2) {
              lowFpsWindows = 0
              lowFpsPromptSent = true
              onLowFpsSuggestedRef.current?.()
              gameEventBus.emit('city:low-fps-suggested')
            }
          }
        }
      }

      const activeTag = document.activeElement?.tagName
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        let kx = 0
        let kz = 0
        if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) kx -= 1
        if (pressedKeys.has('d') || pressedKeys.has('arrowright')) kx += 1
        if (pressedKeys.has('w') || pressedKeys.has('arrowup')) kz -= 1
        if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) kz += 1

        if (kx !== 0 || kz !== 0) {
          const speed = Math.max(40, camState.distance * 0.85) * dt
          const cosA = Math.cos(camState.azimuth)
          const sinA = Math.sin(camState.azimuth)
          const moveX = (kx * cosA + kz * sinA) * speed
          const moveZ = (-kx * sinA + kz * cosA) * speed
          stepCameraWithinSafeBounds(moveX, moveZ)
        }
      }

      const damp = 1 - Math.exp(-8 * dt)
      camState.targetX = THREE.MathUtils.lerp(camState.targetX, camState.desiredX, damp)
      camState.targetZ = THREE.MathUtils.lerp(camState.targetZ, camState.desiredZ, damp)
      camState.azimuth = THREE.MathUtils.lerp(camState.azimuth, camState.desiredAzimuth, damp)
      camState.polar = THREE.MathUtils.lerp(camState.polar, camState.desiredPolar, damp)
      camState.distance = THREE.MathUtils.lerp(camState.distance, camState.desiredDistance, damp)

      // Calibrated winter haze dissolves forest horizon naturally well inside the safe playable zone
      fog.near = 44 + camState.distance * 0.34
      fog.far = 96 + camState.distance * 0.72

      const sinP = Math.sin(camState.polar)
      const cosP = Math.cos(camState.polar)
      camera.position.set(
        camState.targetX + camState.distance * cosP * Math.sin(camState.azimuth),
        camState.distance * sinP + 1.5,
        camState.targetZ + camState.distance * cosP * Math.cos(camState.azimuth),
      )
      camera.lookAt(camState.targetX, 1.8, camState.targetZ)

      if (
        Math.abs(camState.targetX - lastTelemX) > 0.08 ||
        Math.abs(camState.targetZ - lastTelemZ) > 0.08 ||
        Math.abs(camState.distance - lastTelemDist) > 0.1 ||
        Math.abs(camState.azimuth - lastTelemAz) > 0.005
      ) {
        lastTelemX = camState.targetX
        lastTelemZ = camState.targetZ
        lastTelemDist = camState.distance
        lastTelemAz = camState.azimuth
        gameEventBus.emit('city:camera-telemetry', {
          targetX: camState.targetX,
          targetZ: camState.targetZ,
          distance: camState.distance,
          azimuth: camState.azimuth,
          polar: camState.polar,
        })
      }

      // Twinkle GitHub green commit baubles across all real & ambient trees (paused in low mode)
      updateCommitLightsTwinkle(t, !isLow)

      // Animate adopted developer companions beside trees
      const compList = cityTreesLayer.animatedCompanions
      for (let i = 0; i < compList.length; i += 1) {
        const entry = compList[i]
        updateCompanionAnimation(entry.companion, t, entry.phase)
      }

      // Falling 3D voxel snow wrapped smoothly around camera target across entire metropolis
      const activeSnowCount = world.snowParticles.count
      for (let i = 0; i < activeSnowCount; i += 1) {
        const flake = world.snowData[i]
        flake.y -= flake.speed * dt
        if (flake.y < 0.2) {
          flake.y = 34
        }
        const relX =
          ((((flake.ox - camState.targetX) % SNOW_WRAP_SPAN_X) + SNOW_WRAP_SPAN_X * 1.5) %
            SNOW_WRAP_SPAN_X) -
          SNOW_WRAP_SPAN_X * 0.5
        const relZ =
          ((((flake.oz - camState.targetZ) % SNOW_WRAP_SPAN_Z) + SNOW_WRAP_SPAN_Z * 1.5) %
            SNOW_WRAP_SPAN_Z) -
          SNOW_WRAP_SPAN_Z * 0.5
        const fx = camState.targetX + relX + Math.sin(t * 1.4 + flake.drift) * 0.45
        const fz = camState.targetZ + relZ
        dummy.position.set(fx, flake.y, fz)
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
            : actor.kind === 'penguin'
              ? Math.abs(Math.sin(t * 4.8 + actor.phase)) * 0.12
              : actor.kind === 'reindeer' || actor.kind === 'fox'
                ? Math.abs(Math.sin(t * 4.5 + actor.phase)) * 0.08
                : 0
        actor.mesh.position.set(nx, hopY, nz)
        actor.mesh.rotation.y = Math.atan2(dx, dz)
        actor.mesh.rotation.z =
          actor.kind === 'penguin' ? Math.sin(t * 4.8 + actor.phase) * 0.14 : 0
      }

      if (!isLow) {
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
      }

      renderer.render(scene, camera)
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      applyTreesUpdateRef.current = null
      applyGraphicsModeRef.current = null
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

      cityTreesLayer.dispose()
      proceduralTrees.dispose()
      disposeObjectGeometries(selectionGroup)
      disposeObjectGeometries(creatorAuraGroup)
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
          <span className="font-normal text-slate-400">· {hoveredLabel.regionName}</span>
        </div>
      )}
    </div>
  )
}
