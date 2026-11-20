import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { CITY_PALETTE } from '../config/cityMapConfig'
import type { CityTree } from '../types/city'
import { gameEventBus } from './eventBus'
import { BootScene } from './scenes/BootScene'
import { CityScene } from './scenes/CityScene'

interface PhaserGameProps {
  trees: readonly CityTree[]
}

export function PhaserGame({ trees }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const latestTreesRef = useRef(trees)

  useEffect(() => {
    latestTreesRef.current = trees
    gameEventBus.emit('city:trees-updated', trees)
  }, [trees])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const unsubReady = gameEventBus.on('city:ready', () => {
      gameEventBus.emit('city:trees-updated', latestTreesRef.current)
    })

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      backgroundColor: CITY_PALETTE.nightBg,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: container.clientWidth || window.innerWidth,
        height: container.clientHeight || window.innerHeight,
      },
      render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true,
      },
      scene: [BootScene, CityScene],
    })

    return () => {
      unsubReady()
      game.destroy(true)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="pixelated h-full w-full touch-none select-none"
      aria-label="Mapa interativo em pixel art da Christmas Commit City"
    />
  )
}
