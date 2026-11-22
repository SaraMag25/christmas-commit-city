import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  buildVoxelCompanion,
  disposeBuiltCompanion,
  updateCompanionAnimation,
  type BuiltCompanion,
} from '../../game/voxel/voxelCompanionBuilder'
import { createVoxelMesh } from '../../game/voxel/voxelMaterials'
import type { CompanionSpeciesId, EquippedAccessories } from '../../types/companion'

interface CompanionPreviewCanvasProps {
  species: CompanionSpeciesId
  equipped: EquippedAccessories
  sizePx?: number
}

const PIXEL_SCALE = 3
const FRONT_THREE_QUARTER_YAW = -0.52

/**
 * Turntable-only 3D pixel-art preview of a companion.
 * Keeps a persistent scene & yaw ref across re-renders so hovering or updating UI
 * never restarts the rotation from the beginning.
 */
export function CompanionPreviewCanvas({
  species,
  equipped,
  sizePx = 216,
}: CompanionPreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const activeCompanionRef = useRef<BuiltCompanion | null>(null)
  const yawRef = useRef<number>(FRONT_THREE_QUARTER_YAW)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(32, 1, 0.2, 40)

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    })
    renderer.toneMapping = THREE.NoToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(1)
    const renderRes = Math.max(48, Math.floor(sizePx / PIXEL_SCALE))
    renderer.setSize(renderRes, renderRes, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.imageRendering = 'pixelated'
    renderer.domElement.className = 'pixelated pointer-events-none block'
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xc2e4ff, 0x6278ad, 1.12))
    const keyLight = new THREE.DirectionalLight(0xfff5d8, 1.2)
    keyLight.position.set(6, 10, 8)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0xffb74d, 0.35)
    rimLight.position.set(-6, 5, -6)
    scene.add(rimLight)

    const snowPad = createVoxelMesh(0, -0.08, 0, 1.8, 0.16, 1.8, '#dce8fc')
    scene.add(snowPad)

    camera.position.set(0, 1.28, 3.65)
    camera.lookAt(0, 0.56, 0)

    let animId = 0
    let lastTime = performance.now()
    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now

      yawRef.current += dt * 0.55
      const current = activeCompanionRef.current
      if (current) {
        current.group.rotation.y = yawRef.current
        updateCompanionAnimation(current, now / 1000, 0)
      }

      renderer.render(scene, camera)
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      if (activeCompanionRef.current) {
        scene.remove(activeCompanionRef.current.group)
        disposeBuiltCompanion(activeCompanionRef.current)
        activeCompanionRef.current = null
      }
      sceneRef.current = null
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [sizePx])

  const head = equipped.head
  const body = equipped.body
  const hand = equipped.hand

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (activeCompanionRef.current) {
      scene.remove(activeCompanionRef.current.group)
      disposeBuiltCompanion(activeCompanionRef.current)
    }

    const built = buildVoxelCompanion(species, { head, body, hand })
    built.group.rotation.y = yawRef.current
    scene.add(built.group)
    activeCompanionRef.current = built
  }, [species, head, body, hand])

  return (
    <div
      ref={containerRef}
      style={{ width: sizePx, height: sizePx }}
      className="pixelated pointer-events-none relative select-none"
      aria-label="Prévia 3D do companheiro"
    />
  )
}
