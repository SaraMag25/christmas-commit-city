import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { CITY_MAP_CONFIG, CITY_PALETTE } from '../config/cityMapConfig'
import type { CityTree } from '../types/city'
import { gameEventBus } from './eventBus'
import { hashUsername } from './layout/treePlacement'
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
  tree: CityTree
  built: BuiltVoxelTree
  companionGroup: THREE.Group | null
  ring: THREE.Mesh
  worldPos: THREE.Vector3
}

const PIXEL_SCALE = 3

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
  return instanced
}

export function City3DCanvas({ trees, decorativeTrees = [] }: City3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const latestTreesRef = useRef<readonly CityTree[]>([...trees, ...decorativeTrees])
  const [hoveredLabel, setHoveredLabel] = useState<{
    username: string
    isCreator: boolean
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    const combined = [...trees, ...decorativeTrees]
    latestTreesRef.current = combined
    gameEventBus.emit('city:trees-updated', combined)
  }, [trees, decorativeTrees])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(CITY_PALETTE.nightBg)
    scene.fog = new THREE.Fog(CITY_PALETTE.nightSkyNum, 82, 200)

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 320)
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

    // Crisp Cool-vs-Warm North Pole lighting: icy arctic sky + lavender shadow + golden moon/rim
    const hemiLight = new THREE.HemisphereLight(0xc2e4ff, 0x6278ad, 1.05)
    scene.add(hemiLight)

    const moonLight = new THREE.DirectionalLight(0xfff5d8, 1.18)
    moonLight.position.set(42, 58, -40)
    scene.add(moonLight)

    const warmFill = new THREE.DirectionalLight(0xffbe55, 0.42)
    warmFill.position.set(-32, 22, 36)
    scene.add(warmFill)

    // Build 3D North Pole winter forest & village
    const world = buildVoxelWorld()
    scene.add(world.root)

    // Developer Christmas trees layer + global instanced GitHub bauble layers
    const treesGroup = new THREE.Group()
    scene.add(treesGroup)
    const treeHandles = new Map<string, TreeHandle>()
    let companionHandles: Array<{ companion: BuiltCompanion; phase: number }> = []
    let selectedTreeId: string | null = null
    let hoveredTreeId: string | null = null

    const disposeGroupGeometries = (group: THREE.Object3D) => {
      group.traverse((obj) => {
        if (obj instanceof THREE.InstancedMesh) {
          obj.dispose()
        } else if (obj instanceof THREE.Mesh && obj.geometry && obj.geometry.type !== 'BoxGeometry') {
          obj.geometry.dispose()
        }
      })
    }

    const rebuildTrees = (treeList: readonly CityTree[]) => {
      for (let i = 0; i < companionHandles.length; i += 1) {
        disposeBuiltCompanion(companionHandles[i].companion)
      }
      disposeGroupGeometries(treesGroup)
      treesGroup.clear()
      treeHandles.clear()
      companionHandles = []

      const l12Entries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []
      const l3Entries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []
      const l4aEntries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []
      const l4bEntries: Array<{ x: number; y: number; z: number; size: number; color: string }> = []

      const appendWorldBaubles = (
        worldX: number,
        worldZ: number,
        rotY: number,
        baubles: BaubleInstanceData[],
      ) => {
        const cosR = Math.cos(rotY)
        const sinR = Math.sin(rotY)
        for (let i = 0; i < baubles.length; i += 1) {
          const b = baubles[i]
          const wx = worldX + b.x * cosR + b.z * sinR
          const wz = worldZ - b.x * sinR + b.z * cosR
          const item = { x: wx, y: b.y, z: wz, size: b.size, color: b.color }
          if (b.bucket === 'l4a') l4aEntries.push(item)
          else if (b.bucket === 'l4b') l4bEntries.push(item)
          else if (b.bucket === 'l3') l3Entries.push(item)
          else l12Entries.push(item)
        }
      }

      const FRONT_VIEW_YAW = Math.PI * 0.25

      treeList.forEach((tree) => {
        const seed = hashUsername(tree.profile.github_username)
        const built = buildVoxelChristmasTree({
          level: tree.tree_level,
          seed,
          gridX: tree.tree_position.gridX,
          gridY: tree.tree_position.gridY,
          gifts: tree.isDecorative ? [] : tree.gifts,
          giftCount: tree.isDecorative ? 0 : tree.gifts.length,
          isCreatorSpecial: tree.is_creator_special,
          contributionCount: tree.contribution_count,
          calendarWeeks: tree.stats?.calendarWeeks,
          frontYaw: FRONT_VIEW_YAW,
          preserveFrontOrientation: true,
          separateBaubles: true,
        })

        const pos = gridToWorld(tree.tree_position.gridX, tree.tree_position.gridY)
        built.group.position.set(pos.x, 0, pos.z)
        treesGroup.add(built.group)
        appendWorldBaubles(pos.x, pos.z, built.rotationY, built.baubleInstances)

        // Decorative Day-1 background pines stay non-interactive and excluded from treeHandles
        if (tree.isDecorative) {
          return
        }

        built.group.userData = { treeId: tree.id }

        // Crisp emerald selection ring beneath selected developer tree
        const ring = createVoxelMesh(pos.x, 0.08, pos.z, 4.1, 0.1, 4.1, '#40c463', true, 0.78)
        ring.visible = tree.id === selectedTreeId
        treesGroup.add(ring)

        let companionGroup: THREE.Group | null = null
        if (tree.companion?.species) {
          const companion = buildVoxelCompanion(tree.companion.species, tree.companion.equipped)
          // Stand completely outside this tree's real outer foliage radius inside the open 30-deg circumcenter pocket
          const compRadius = Math.max(1.86, built.outerRadius + 0.34)
          const compX = pos.x + 0.866 * compRadius
          const compZ = pos.z + 0.5 * compRadius

          const plinthBase = createVoxelMesh(compX, 0.025, compZ, 1.32, 0.05, 1.32, '#dbeafe')
          const plinthTop = createVoxelMesh(compX, 0.065, compZ, 1.1, 0.06, 1.1, '#f4f8ff')
          plinthBase.userData = { treeId: tree.id }
          plinthTop.userData = { treeId: tree.id }
          treesGroup.add(plinthBase)
          treesGroup.add(plinthTop)

          companion.group.position.set(compX, 0.08, compZ)
          companion.group.scale.setScalar(1.46)
          companion.group.rotation.y = 0.62
          companion.group.userData = { treeId: tree.id }
          treesGroup.add(companion.group)
          companionGroup = companion.group
          companionHandles.push({ companion, phase: (seed % 100) * 0.17 })
        }

        treeHandles.set(tree.id, {
          tree,
          built,
          companionGroup,
          ring,
          worldPos: new THREE.Vector3(pos.x, 0, pos.z),
        })
      })

      // Render thousands of GitHub green commit baubles across 350–500+ trees in just 4 draw calls
      const l12Layer = createInstancedBaubleLayer(l12Entries, instancedBaubleMaterials.l12)
      const l3Layer = createInstancedBaubleLayer(l3Entries, instancedBaubleMaterials.l3)
      const l4aLayer = createInstancedBaubleLayer(l4aEntries, instancedBaubleMaterials.l4a)
      const l4bLayer = createInstancedBaubleLayer(l4bEntries, instancedBaubleMaterials.l4b)

      if (l12Layer) treesGroup.add(l12Layer)
      if (l3Layer) treesGroup.add(l3Layer)
      if (l4aLayer) treesGroup.add(l4aLayer)
      if (l4bLayer) treesGroup.add(l4bLayer)
    }

    const highlightSelected = (treeId: string | null) => {
      selectedTreeId = treeId
      treeHandles.forEach((h, id) => {
        h.ring.visible = id === treeId
      })
    }

    rebuildTrees(latestTreesRef.current)

    // Camera orbit + pan state framed over the expanded North Pole woodland
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
      distance: 60,
      desiredDistance: 60,
    }

    const focusOnPos = (x: number, z: number, distance = 22) => {
      camState.desiredX = x
      camState.desiredZ = z
      camState.desiredDistance = distance
    }

    const resetToPlaza = () => {
      camState.desiredX = plazaPos.x
      camState.desiredZ = plazaPos.z
      camState.desiredAzimuth = Math.PI * 0.25
      camState.desiredPolar = 0.62
      camState.desiredDistance = 60
    }

    // Raycasting & pointer interaction
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    let pointerMode: 'none' | 'pan' | 'orbit' = 'none'
    let dragStartX = 0
    let dragStartY = 0
    let lastX = 0
    let lastY = 0
    let totalMoved = 0
    let pinchStartDist: number | null = null
    let pinchStartDistanceVal = camState.desiredDistance

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

    const updateHoverAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)

      const treeTargets: THREE.Object3D[] = []
      treeHandles.forEach((h) => {
        treeTargets.push(h.built.group)
        if (h.companionGroup) treeTargets.push(h.companionGroup)
      })
      const hits = raycaster.intersectObjects(treeTargets, true)
      if (hits.length > 0) {
        const hitId = findTreeIdFromObject(hits[0].object)
        const handle = hitId ? treeHandles.get(hitId) : undefined
        if (handle) {
          renderer.domElement.style.cursor = 'pointer'
          if (hoveredTreeId !== handle.tree.id) {
            hoveredTreeId = handle.tree.id
            gameEventBus.emit('city:tree-hovered', handle.tree)
          }
          const projected = handle.worldPos
            .clone()
            .add(new THREE.Vector3(0, handle.built.height + 1.2, 0))
            .project(camera)
          setHoveredLabel({
            username: handle.tree.profile.github_username,
            isCreator: Boolean(handle.tree.is_creator_special),
            x: ((projected.x + 1) / 2) * rect.width,
            y: ((-projected.y + 1) / 2) * rect.height,
          })
          return
        }
      }

      const propHits = raycaster.intersectObjects(
        world.interactiveProps.map((p) => p.mesh),
        true,
      )
      renderer.domElement.style.cursor = propHits.length > 0 ? 'pointer' : 'grab'

      if (hoveredTreeId !== null) {
        hoveredTreeId = null
        gameEventBus.emit('city:tree-hovered', null)
      }
      setHoveredLabel(null)
    }

    const onPointerDown = (e: PointerEvent) => {
      dragStartX = e.clientX
      dragStartY = e.clientY
      lastX = e.clientX
      lastY = e.clientY
      totalMoved = 0

      if (e.button === 2 || e.shiftKey) {
        pointerMode = 'orbit'
      } else {
        pointerMode = 'pan'
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (pointerMode === 'none') {
        if (e.target !== renderer.domElement) {
          if (hoveredTreeId !== null) {
            hoveredTreeId = null
            gameEventBus.emit('city:tree-hovered', null)
          }
          setHoveredLabel(null)
          return
        }
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
          0.36,
          1.18,
        )
      } else if (pointerMode === 'pan') {
        const panFactor = camState.distance * 0.0018
        const cosA = Math.cos(camState.azimuth)
        const sinA = Math.sin(camState.azimuth)
        camState.desiredX = THREE.MathUtils.clamp(
          camState.desiredX - (dx * cosA + dy * sinA) * panFactor,
          -92,
          92,
        )
        camState.desiredZ = THREE.MathUtils.clamp(
          camState.desiredZ - (-dx * sinA + dy * cosA) * panFactor,
          -68,
          68,
        )
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const moved = totalMoved || Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY)
      const wasPanOrOrbit = pointerMode
      pointerMode = 'none'

      if (moved > 8 || wasPanOrOrbit === 'orbit') return

      const rect = renderer.domElement.getBoundingClientRect()
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)

      const treeTargets: THREE.Object3D[] = []
      treeHandles.forEach((h) => {
        treeTargets.push(h.built.group)
        if (h.companionGroup) treeTargets.push(h.companionGroup)
      })
      const treeHits = raycaster.intersectObjects(treeTargets, true)
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
        14,
        120,
      )
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        pinchStartDistanceVal = camState.desiredDistance
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        const ratio = pinchStartDist / Math.max(10, d)
        camState.desiredDistance = THREE.MathUtils.clamp(pinchStartDistanceVal * ratio, 14, 120)
      }
    }

    const onTouchEnd = () => {
      pinchStartDist = null
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    const dom = renderer.domElement
    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('touchstart', onTouchStart, { passive: true })
    dom.addEventListener('touchmove', onTouchMove, { passive: true })
    dom.addEventListener('touchend', onTouchEnd)
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

    const unsubs = [
      gameEventBus.on('city:trees-updated', (nextTrees) => {
        rebuildTrees(nextTrees)
      }),
      gameEventBus.on('city:zoom-in', () => {
        camState.desiredDistance = THREE.MathUtils.clamp(camState.desiredDistance * 0.82, 14, 120)
      }),
      gameEventBus.on('city:zoom-out', () => {
        camState.desiredDistance = THREE.MathUtils.clamp(camState.desiredDistance * 1.2, 14, 120)
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
      gameEventBus.on('city:focus-tree', (identifier) => {
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
        if (!target) return
        highlightSelected(target.tree.id)
        focusOnPos(target.worldPos.x, target.worldPos.z, 24)
        gameEventBus.emit('city:tree-selected', target.tree)
      }),
      gameEventBus.on('city:focus-creator', () => {
        const creator = treeHandles.get('creator-ufc')
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
          camState.desiredX = THREE.MathUtils.clamp(camState.desiredX + moveX, -92, 92)
          camState.desiredZ = THREE.MathUtils.clamp(camState.desiredZ + moveZ, -68, 68)
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

      // Twinkle GitHub green commit baubles across all 350–500+ trees in O(1)
      updateCommitLightsTwinkle(t)

      // Animate adopted developer companions beside trees (bobbing, lanterns, coffee steam)
      for (let i = 0; i < companionHandles.length; i += 1) {
        const entry = companionHandles[i]
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

      // Instanced golden / cyan / lilac magic sparkles around landmarks & giant mushrooms
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

      // Cozy flicker for warm lantern, campfire, and window glow pads on snow
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
      unsubs.forEach((u) => u())
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('touchstart', onTouchStart)
      dom.removeEventListener('touchmove', onTouchMove)
      dom.removeEventListener('touchend', onTouchEnd)
      dom.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', handleResize)
      disposeGroupGeometries(treesGroup)
      disposeGroupGeometries(world.root)
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
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-amber-400/70 bg-[#070d1f]/90 px-2 py-0.5 text-[10px] font-bold shadow-md"
        >
          <span className={hoveredLabel.isCreator ? 'text-amber-300' : 'text-slate-100'}>
            {hoveredLabel.isCreator ? '★ ' : ''}@{hoveredLabel.username}
          </span>
        </div>
      )}
    </div>
  )
}
