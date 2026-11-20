import { useEffect, useRef, useState } from 'react'
import { drawTreeToCanvas } from '../../game/generators/treeCanvasRenderer'
import { hashUsername } from '../../game/layout/treePlacement'
import type { CityTree } from '../../types/city'

interface TreePixelCanvasProps {
  tree: CityTree
  scale?: number
  className?: string
}

/**
 * Animated pixel-art tree preview rendered on a 40x56 HTML canvas using the
 * exact same procedural renderer as the Phaser village map.
 */
export function TreePixelCanvas({ tree, scale = 5, className = '' }: TreePixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [lightsPhase, setLightsPhase] = useState<0 | 1>(0)

  useEffect(() => {
    if (tree.tree_level < 4 && !tree.is_creator_special) return
    const timer = window.setInterval(() => {
      setLightsPhase((prev) => (prev === 0 ? 1 : 0))
    }, 720)
    return () => window.clearInterval(timer)
  }, [tree.tree_level, tree.is_creator_special])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false

    const seed = hashUsername(tree.profile.github_username)
    drawTreeToCanvas(ctx, {
      level: tree.tree_level,
      seed,
      isCreatorSpecial: tree.is_creator_special,
      lightsPhase,
    })
  }, [tree, lightsPhase])

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={56}
      style={{ width: 40 * scale, height: 56 * scale }}
      className={`pixelated block ${className}`}
      aria-label={`Árvore de Natal em pixel art de @${tree.profile.github_username}`}
    />
  )
}
