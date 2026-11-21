import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { hashUsername } from '../../game/layout/treePlacement'
import { buildVoxelChristmasTree, updateCommitLightsTwinkle } from '../../game/voxel/voxelTreeBuilder'
import type { CityTree } from '../../types/city'

interface TreePixelCanvasProps {
  tree: CityTree
  scale?: number
  className?: string
}

const PIXEL_SCALE = 3

/**
 * Interactive 3D pixel-art turntable preview of a developer's voxel Christmas tree,
 * built with the exact same 3D voxel generator as the main village map.
 */
export function TreePixelCanvas({ tree, scale = 5, className = '' }: TreePixelCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widthPx = 48 * scale
  const heightPx = 64 * scale

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, widthPx / heightPx, 0.5, 100)

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    })
    renderer.setPixelRatio(1)
    renderer.setSize(
      Math.max(48, Math.floor(widthPx / PIXEL_SCALE)),
      Math.max(64, Math.floor(heightPx / PIXEL_SCALE)),
      false,
    )
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.imageRendering = 'pixelated'
    renderer.domElement.className = 'pixelated block cursor-grab active:cursor-grabbing'
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xbae6fd, 0x0f2e24, 1.15))
    const keyLight = new THREE.DirectionalLight(0xfef3c7, 1.25)
    keyLight.position.set(10, 16, 12)
    scene.add(keyLight)

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
    scene.add(built.group)

    const camDistance = Math.max(10.5, built.height * 1.85)
    camera.position.set(0, built.height * 0.52, camDistance)
    camera.lookAt(0, built.height * 0.45, 0)

    let yaw = 0.4
    let isDragging = false
    let lastX = 0

    const onDown = (e: PointerEvent) => {
      isDragging = true
      lastX = e.clientX
    }
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return
      yaw += (e.clientX - lastX) * 0.015
      lastX = e.clientX
    }
    const onUp = () => {
      isDragging = false
    }

    const dom = renderer.domElement
    dom.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let animId = 0
    let lastTime = performance.now()
    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const t = now / 1000

      if (!isDragging) {
        yaw += dt * 0.45
      }
      built.group.rotation.y = yaw
      updateCommitLightsTwinkle(t)

      renderer.render(scene, camera)
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      dom.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      renderer.dispose()
      if (dom.parentNode === container) {
        container.removeChild(dom)
      }
    }
  }, [tree, widthPx, heightPx])

  return (
    <div
      ref={containerRef}
      style={{ width: widthPx, height: heightPx }}
      className={`pixelated relative select-none ${className}`}
      aria-label={`Árvore 3D em pixel art de @${tree.profile.github_username}`}
      title="Arraste para girar a árvore 3D"
    />
  )
}
