import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { CITY_MAP_CONFIG, CITY_PALETTE } from '../config/cityMapConfig'
import type { CityTree } from '../types/city'
import { gameEventBus } from './eventBus'
import { hashUsername } from './layout/treePlacement'
import { createVoxelMesh } from './voxel/voxelMaterials'
import { buildVoxelChristmasTree, updateCommitLightsTwinkle, type BuiltVoxelTree } from './voxel/voxelTreeBuilder'
import { buildVoxelWorld, gridToWorld, type InteractivePropHandle } from './voxel/voxelWorldBuilder'

interface City3DCanvasProps {
  trees: readonly CityTree[]
}

interface TreeHandle {
  tree: CityTree
  built: BuiltVoxelTree
  ring: THREE.Mesh
  worldPos: THREE.Vector3
}

const PIXEL_SCALE = 3

export function City3DCanvas({ trees }: City3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const latestTreesRef = useRef(trees)
  const [hoveredLabel, setHoveredLabel] = useState<{
    username: string
    isCreator: boolean
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    latestTreesRef.current = trees
    gameEventBus.emit('city:trees-updated', trees)
  }, [trees])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(CITY_PALETTE.nightBg)
    scene.fog = new THREE.FogExp2(CITY_PALETTE.nightBg, 0.0082)

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 280)
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    })
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

    // Balanced moonlight + warm forest ambient lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f2e24, 1.05)
    scene.add(hemiLight)

    const moonLight = new THREE.DirectionalLight(0xe0f2fe, 1.15)
    moonLight.position.set(35, 55, -40)
    scene.add(moonLight)

    const warmFill = new THREE.DirectionalLight(0xfbbf24, 0.35)
    warmFill.position.set(-25, 22, 30)
    scene.add(warmFill)

    // Build 3D enchanted Christmas forest & village
    const world = buildVoxelWorld()
    scene.add(world.root)

    // Developer Christmas trees layer
    const treesGroup = new THREE.Group()
    scene.add(treesGroup)
    const treeHandles = new Map<string, TreeHandle>()
    let selectedTreeId: string | null = null
    let hoveredTreeId: string | null = null

    const rebuildTrees = (treeList: readonly CityTree[]) => {
      treesGroup.clear()
      treeHandles.clear()

      treeList.forEach((tree) => {
        const seed = hashUsername(tree.profile.github_username)
        const built = buildVoxelChristmasTree({
          level: tree.tree_level,
          seed,
          gridX: tree.tree_position.gridX,
          gridY: tree.tree_position.gridY,
          giftCount: tree.gifts.length,
          isCreatorSpecial: tree.is_creator_special,
          contributionCount: tree.contribution_count,
          calendarWeeks: tree.stats?.calendarWeeks,
        })

        const pos = gridToWorld(tree.tree_position.gridX, tree.tree_position.gridY)
        built.group.position.set(pos.x, 0, pos.z)
        built.group.userData = { treeId: tree.id }

        // Uniform emerald/gold selection ring beneath any selected developer tree
        const ring = createVoxelMesh(pos.x, 0.08, pos.z, 4.4, 0.1, 4.4, '#4ade80', true, 0.72)
        ring.visible = tree.id === selectedTreeId
        treesGroup.add(ring)

        treesGroup.add(built.group)
        treeHandles.set(tree.id, {
          tree,
          built,
          ring,
          worldPos: new THREE.Vector3(pos.x, 0, pos.z),
        })
      })
    }

    const highlightSelected = (treeId: string | null) => {
      selectedTreeId = treeId
      treeHandles.forEach((h, id) => {
        h.ring.visible = id === treeId
      })
    }

    rebuildTrees(latestTreesRef.current)

    // Camera orbit + pan state (smoothly damped) framed over the dense forest skyline
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
      distance: 56,
      desiredDistance: 56,
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
      camState.desiredDistance = 56
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

      const treeTargets = Array.from(treeHandles.values()).map((h) => h.built.group)
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

      // Check interactive props for pointer cursor
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
        // Pan in camera-aligned XZ plane
        camState.desiredX = THREE.MathUtils.clamp(
          camState.desiredX - (dx * cosA + dy * sinA) * panFactor,
          -66,
          66,
        )
        camState.desiredZ = THREE.MathUtils.clamp(
          camState.desiredZ - (-dx * sinA + dy * cosA) * panFactor,
          -52,
          52,
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

      const treeTargets = Array.from(treeHandles.values()).map((h) => h.built.group)
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
        85,
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
        camState.desiredDistance = THREE.MathUtils.clamp(pinchStartDistanceVal * ratio, 14, 85)
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

    // Resize handling keeping crisp integer pixel scale
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

    // Bus listeners
    const unsubs = [
      gameEventBus.on('city:trees-updated', (nextTrees) => {
        rebuildTrees(nextTrees)
      }),
      gameEventBus.on('city:zoom-in', () => {
        camState.desiredDistance = THREE.MathUtils.clamp(camState.desiredDistance * 0.82, 14, 85)
      }),
      gameEventBus.on('city:zoom-out', () => {
        camState.desiredDistance = THREE.MathUtils.clamp(camState.desiredDistance * 1.2, 14, 85)
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

    // Animation loop
    let animId = 0
    let lastTime = performance.now()
    const dummy = new THREE.Object3D()

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const t = now / 1000

      // Keyboard movement
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
          camState.desiredX = THREE.MathUtils.clamp(camState.desiredX + moveX, -66, 66)
          camState.desiredZ = THREE.MathUtils.clamp(camState.desiredZ + moveZ, -52, 52)
        }
      }

      // Smooth camera damping
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

      // Twinkle green GitHub commit lights in O(1) across all forest trees
      updateCommitLightsTwinkle(t)

      // Falling 3D voxel snow
      for (let i = 0; i < world.snowData.length; i += 1) {
        const flake = world.snowData[i]
        flake.y -= flake.speed * dt
        if (flake.y < 0.2) {
          flake.y = 32
        }
        const fx = flake.x + Math.sin(t * 1.4 + flake.drift) * 0.45
        dummy.position.set(fx, flake.y, flake.z)
        dummy.scale.set(flake.size, flake.size, flake.size)
        dummy.updateMatrix()
        world.snowParticles.setMatrixAt(i, dummy.matrix)
      }
      world.snowParticles.instanceMatrix.needsUpdate = true

      // Living forest wildlife: reindeer, foxes, snow bunnies, and river/pond fish
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

      // Gently undulating Aurora Borealis ribbons
      for (const bar of world.auroraBars) {
        bar.mesh.position.y = bar.baseY + Math.sin(t * 0.8 + bar.phase) * 1.3
      }

      // Floating enchanted forest wisps
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
          const drop = ((t * 4.5 + r.phase) % 5.8)
          r.mesh.position.y = 6.2 - drop
        } else {
          const shimmer = Math.sin(t * 2.4 + r.phase)
          r.mesh.position.z = r.baseZ + ((t * 1.1 + r.phase) % 1.4) - 0.7
          r.mesh.scale.set(0.8 + shimmer * 0.22, 0.08, 0.45)
        }
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
