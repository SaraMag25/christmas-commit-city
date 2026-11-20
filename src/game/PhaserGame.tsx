import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { CITY_PALETTE } from '../config/cityMapConfig'
import { BootScene } from './scenes/BootScene'
import { CityScene } from './scenes/CityScene'

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

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
