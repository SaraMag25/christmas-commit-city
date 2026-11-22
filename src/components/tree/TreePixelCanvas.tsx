import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { hashUsername } from '../../game/layout/treePlacement'
import {
  buildVoxelCompanion,
  disposeBuiltCompanion,
  updateCompanionAnimation,
  type BuiltCompanion,
} from '../../game/voxel/voxelCompanionBuilder'
import { createVoxelMesh } from '../../game/voxel/voxelMaterials'
import { buildVoxelChristmasTree, updateCommitLightsTwinkle } from '../../game/voxel/voxelTreeBuilder'
import type { CityTree } from '../../types/city'

interface TreePixelCanvasProps {
  tree: CityTree
  scale?: number
  className?: string
  /** Set false for non-interactive turntable previews (e.g. gift shop preview) */
  interactive?: boolean
}

const PIXEL_SCALE = 3
const INITIAL_YAW = 0.28

function disposeActiveSceneTree(
  scene: THREE.Scene,
  treeGroup: THREE.Group | null,
  companion: BuiltCompanion | null,
): void {
  if (companion) {
    treeGroup?.remove(companion.group)
    disposeBuiltCompanion(companion)
  }
  if (treeGroup) {
    scene.remove(treeGroup)
    treeGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry && obj.geometry.type !== 'BoxGeometry') {
        obj.geometry.dispose()
      }
    })
  }
}

/**
 * 3D pixel-art turntable preview of a developer's voxel Christmas tree + companion + gifts.
 * Uses persistent WebGL scene, renderer, and yaw refs so updating gifts or props never resets rotation or flickers.
 */
export function TreePixelCanvas({
  tree,
  scale = 5,
  className = '',
  interactive = true,
}: TreePixelCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const activeTreeGroupRef = useRef<THREE.Group | null>(null)
  const activeCompanionRef = useRef<BuiltCompanion | null>(null)
  const yawRef = useRef<number>(INITIAL_YAW)
  const isDraggingRef = useRef<boolean>(false)

  const widthPx = 48 * scale
  const heightPx = 64 * scale

  // Effect 1: persistent WebGLRenderer, lighting, turntable loop, and optional drag interaction
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(34, widthPx / heightPx, 0.5, 100)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    })
    renderer.toneMapping = THREE.NoToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(1)
    renderer.setSize(
      Math.max(48, Math.floor(widthPx / PIXEL_SCALE)),
      Math.max(64, Math.floor(heightPx / PIXEL_SCALE)),
      false,
    )
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.imageRendering = 'pixelated'
    renderer.domElement.className = interactive
      ? 'pixelated block cursor-grab active:cursor-grabbing'
      : 'pixelated pointer-events-none block'
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xc2e4ff, 0x6278ad, 1.05))
    const keyLight = new THREE.DirectionalLight(0xfff5d8, 1.2)
    keyLight.position.set(10, 16, 12)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0xffb74d, 0.35)
    rimLight.position.set(-10, 8, -10)
    scene.add(rimLight)

    let lastX = 0
    const onDown = (e: PointerEvent) => {
      if (!interactive) return
      isDraggingRef.current = true
      lastX = e.clientX
    }
    const onMove = (e: PointerEvent) => {
      if (!interactive || !isDraggingRef.current) return
      yawRef.current += (e.clientX - lastX) * 0.015
      lastX = e.clientX
    }
    const onUp = () => {
      isDraggingRef.current = false
    }

    const dom = renderer.domElement
    if (interactive) {
      dom.addEventListener('pointerdown', onDown)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    let animId = 0
    let lastTime = performance.now()
    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const t = now / 1000

      if (!isDraggingRef.current) {
        yawRef.current += dt * 0.45
      }
      if (activeTreeGroupRef.current) {
        activeTreeGroupRef.current.rotation.y = yawRef.current
      }
      updateCommitLightsTwinkle(t)
      if (activeCompanionRef.current) {
        updateCompanionAnimation(activeCompanionRef.current, t, 0.5)
      }

      renderer.render(scene, camera)
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      if (interactive) {
        dom.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      isDraggingRef.current = false
      disposeActiveSceneTree(scene, activeTreeGroupRef.current, activeCompanionRef.current)
      activeCompanionRef.current = null
      activeTreeGroupRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      renderer.dispose()
      if (dom.parentNode === container) {
        container.removeChild(dom)
      }
    }
  }, [widthPx, heightPx, interactive])

  // Effect 2: hot-swap the tree/gifts/companion meshes cleanly while keeping turntable angle continuous
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!scene || !camera) return

    disposeActiveSceneTree(scene, activeTreeGroupRef.current, activeCompanionRef.current)
    activeCompanionRef.current = null
    activeTreeGroupRef.current = null

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
      frontYaw: 0,
      preserveFrontOrientation: false,
      separateBaubles: false,
    })

    const compRadius = Math.max(1.88, built.outerRadius + 0.36)
    let companion: BuiltCompanion | null = null
    if (tree.companion?.species) {
      companion = buildVoxelCompanion(tree.companion.species, tree.companion.equipped)
      const compX = compRadius * 0.68
      const compZ = compRadius * 0.73
      built.group.add(createVoxelMesh(compX, 0.04, compZ, 1.14, 0.08, 1.14, '#e2e8f0'))

      companion.group.position.set(compX, 0.07, compZ)
      companion.group.scale.setScalar(1.34)
      companion.group.rotation.y = 0.22
      built.group.add(companion.group)
    }

    built.group.rotation.y = yawRef.current
    scene.add(built.group)
    activeTreeGroupRef.current = built.group
    activeCompanionRef.current = companion

    const camDistance = Math.max(14.0, built.height * 1.96, (compRadius + 1.45) / 0.215)
    camera.position.set(0, built.height * 0.52, camDistance)
    camera.lookAt(0, built.height * 0.44, 0)
  }, [tree, widthPx, heightPx, interactive])

  return (
    <div
      ref={containerRef}
      style={{ width: widthPx, height: heightPx }}
      className={`pixelated relative select-none ${interactive ? '' : 'pointer-events-none '} ${className}`}
      aria-label={`Árvore 3D em pixel art de @${tree.profile.github_username}`}
      title={interactive ? 'Arraste para girar a árvore 3D' : undefined}
    />
  )
}
