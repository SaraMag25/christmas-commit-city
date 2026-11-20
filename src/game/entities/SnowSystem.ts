import Phaser from 'phaser'

interface Snowflake {
  sprite: Phaser.GameObjects.Image
  speedY: number
  driftX: number
  swayPhase: number
}

interface TwinklingStar {
  rect: Phaser.GameObjects.Rectangle
  phase: number
  speed: number
}

export class SnowSystem {
  private readonly snowflakes: Snowflake[] = []
  private readonly stars: TwinklingStar[] = []
  private readonly worldWidth: number
  private readonly worldHeight: number

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number, skyHeight: number) {
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    // Twinkling stars in the night sky band
    for (let i = 0; i < 65; i += 1) {
      const sx = Phaser.Math.Between(8, worldWidth - 8)
      const sy = Phaser.Math.Between(8, Math.max(24, skyHeight - 10))
      const size = i % 5 === 0 ? 3 : 2
      const color = i % 7 === 0 ? 0xfef08a : 0xf8fafc
      const rect = scene.add.rectangle(sx, sy, size, size, color).setDepth(5)
      this.stars.push({
        rect,
        phase: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 2.2,
      })
    }

    // Gentle falling pixel snowflakes across the village
    for (let i = 0; i < 110; i += 1) {
      const x = Math.random() * worldWidth
      const y = Math.random() * worldHeight
      const scale = i % 4 === 0 ? 2 : 1.5
      const sprite = scene.add
        .image(x, y, 'particle-snow')
        .setScale(scale)
        .setAlpha(0.45 + Math.random() * 0.45)
        .setDepth(5000)

      this.snowflakes.push({
        sprite,
        speedY: 18 + Math.random() * 26,
        driftX: (Math.random() - 0.35) * 14,
        swayPhase: Math.random() * Math.PI * 2,
      })
    }
  }

  update(timeSeconds: number, deltaSeconds: number): void {
    for (const star of this.stars) {
      const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSeconds * star.speed + star.phase))
      star.rect.setAlpha(alpha)
    }

    for (const flake of this.snowflakes) {
      flake.sprite.y += flake.speedY * deltaSeconds
      flake.sprite.x +=
        (flake.driftX + Math.sin(timeSeconds * 1.4 + flake.swayPhase) * 8) * deltaSeconds

      if (flake.sprite.y > this.worldHeight) {
        flake.sprite.y = -4
        flake.sprite.x = Math.random() * this.worldWidth
      }
      if (flake.sprite.x < -4) {
        flake.sprite.x = this.worldWidth + 2
      } else if (flake.sprite.x > this.worldWidth + 4) {
        flake.sprite.x = -2
      }
    }
  }
}
