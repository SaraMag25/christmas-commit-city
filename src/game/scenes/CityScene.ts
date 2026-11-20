import Phaser from 'phaser'
import { CITY_MAP_CONFIG, CITY_PALETTE } from '../../config/cityMapConfig'
import { MOCK_CITY_TREES } from '../../data/mockCityData'
import { SnowSystem } from '../entities/SnowSystem'
import { TreeObject } from '../entities/TreeObject'
import { gameEventBus } from '../eventBus'
import {
  isFrozenPondTile,
  isPierTile,
  isPlazaTile,
  isRoadTile,
  VILLAGE_COTTAGES,
  VILLAGE_DECORATIONS,
} from '../layout/treePlacement'
import type { CityTree } from '../../types/city'

export class CityScene extends Phaser.Scene {
  private treeObjects = new Map<string, TreeObject>()
  private lampGlows: Phaser.GameObjects.Image[] = []
  private snowSystem: SnowSystem | null = null
  private lightsPhase: 0 | 1 = 0
  private lastTwinkleMs = 0
  private isDragging = false
  private dragStartX = 0
  private dragStartY = 0
  private camStartScrollX = 0
  private camStartScrollY = 0
  private initialPinchDist: number | null = null
  private initialPinchZoom = 1
  private unsubscribers: Array<() => void> = []

  constructor() {
    super({ key: 'CityScene' })
  }

  create(): void {
    const { cols, rows, skyRows, tileSize, pixelScale } = CITY_MAP_CONFIG
    const worldWidth = cols * tileSize
    const worldHeight = rows * tileSize
    const skyHeight = skyRows * tileSize

    // Enable second pointer for pinch-to-zoom on mobile touchscreens
    this.input.addPointer(1)

    this.drawNightSkyAndHorizon(worldWidth, skyHeight)
    this.drawVillageGround(cols, rows, skyRows, tileSize, pixelScale)
    this.drawCottagesAndDecorations(tileSize, pixelScale)
    this.renderTrees(MOCK_CITY_TREES)

    this.snowSystem = new SnowSystem(this, worldWidth, worldHeight, skyHeight)

    const camera = this.cameras.main
    camera.setBackgroundColor(CITY_PALETTE.nightSkyNum)
    camera.setBounds(0, 0, worldWidth, worldHeight)
    this.centerOnPlaza(true)

    this.setupCameraControls(camera)
    this.registerBusListeners()

    gameEventBus.emit('city:ready')
  }

  private drawNightSkyAndHorizon(worldWidth: number, skyHeight: number): void {
    const sky = this.add.graphics().setDepth(1)
    sky.fillGradientStyle(0x050a18, 0x050a18, 0x102046, 0x102046, 1)
    sky.fillRect(0, 0, worldWidth, skyHeight)

    // Crescent moon in the upper-right sky
    const moonX = worldWidth - 190
    const moonY = 58
    sky.fillStyle(0xfef08a, 0.95)
    sky.fillCircle(moonX, moonY, 18)
    sky.fillStyle(0x070d1f, 1)
    sky.fillCircle(moonX + 8, moonY - 4, 15)

    // Distant snowy pine silhouette along the northern ridge
    const ridge = this.add.graphics().setDepth(3)
    ridge.fillStyle(0x0d2137, 1)
    for (let x = 0; x < worldWidth; x += 24) {
      const h = 18 + ((x * 13) % 16)
      ridge.fillTriangle(x, skyHeight + 4, x + 12, skyHeight - h, x + 24, skyHeight + 4)
    }
  }

  private drawVillageGround(
    cols: number,
    rows: number,
    skyRows: number,
    tileSize: number,
    pixelScale: number,
  ): void {
    for (let y = skyRows; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        let textureKey = (x + y) % 2 === 0 ? 'tile-snow-0' : 'tile-snow-1'
        if (isPierTile(x, y)) {
          textureKey = 'tile-pier'
        } else if (isFrozenPondTile(x, y)) {
          textureKey = 'tile-ice'
        } else if (isPlazaTile(x, y)) {
          textureKey = 'tile-plaza'
        } else if (isRoadTile(x, y)) {
          textureKey = 'tile-cobble'
        }

        this.add
          .image(x * tileSize, y * tileSize, textureKey)
          .setOrigin(0, 0)
          .setScale(pixelScale)
          .setDepth(2)
      }
    }
  }

  private drawCottagesAndDecorations(tileSize: number, pixelScale: number): void {
    const cottageTextureMap = {
      storybook: 'cottage-storybook',
      'mushroom-pine': 'cottage-mushroom-pine',
      'mushroom-red': 'cottage-mushroom-red',
      stump: 'cottage-stump',
    } as const

    VILLAGE_COTTAGES.forEach((cottage) => {
      const centerX = (cottage.gridX + 1.5) * tileSize
      const bottomY = (cottage.gridY + 3) * tileSize
      const key = cottageTextureMap[cottage.variant]

      this.add.image(centerX, bottomY, key).setOrigin(0.5, 1).setScale(pixelScale).setDepth(bottomY)

      // Subtle warm glow radiating from cottage doorway & yard lanterns
      this.add
        .image(centerX, bottomY - tileSize * 0.75, 'deco-glow')
        .setScale(pixelScale * 1.45)
        .setAlpha(0.35)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(bottomY + 1)
    })

    VILLAGE_DECORATIONS.forEach((deco) => {
      const cx = (deco.gridX + 0.5) * tileSize
      const by = (deco.gridY + 0.9) * tileSize

      if (deco.type === 'lamp') {
        this.add.image(cx, by, 'deco-lamp').setOrigin(0.5, 1).setScale(pixelScale).setDepth(by)
        const halo = this.add
          .image(cx, by - 20 * pixelScale, 'deco-glow')
          .setScale(pixelScale * 1.4)
          .setAlpha(0.65)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(by + 5)
        this.lampGlows.push(halo)
      } else {
        const keyMap: Record<Exclude<typeof deco.type, 'lamp'>, string> = {
          snowman: 'deco-snowman',
          signpost: 'deco-signpost',
          'gift-pile': 'deco-gift-pile',
          bench: 'deco-bench',
          caretaker: 'deco-caretaker',
        }
        this.add
          .image(cx, by, keyMap[deco.type])
          .setOrigin(0.5, 1)
          .setScale(pixelScale)
          .setDepth(by)
      }
    })
  }

  private renderTrees(trees: readonly CityTree[]): void {
    this.treeObjects.forEach((obj) => obj.destroy())
    this.treeObjects.clear()

    trees.forEach((tree) => {
      const obj = new TreeObject(
        this,
        tree,
        (selected) => {
          this.highlightSelectedTree(selected.id)
          gameEventBus.emit('city:tree-selected', selected)
        },
        (hovered) => {
          gameEventBus.emit('city:tree-hovered', hovered)
        },
      )
      this.treeObjects.set(tree.id, obj)
    })
  }

  private highlightSelectedTree(treeId: string): void {
    this.treeObjects.forEach((obj, id) => {
      obj.setSelected(id === treeId)
    })
  }

  private centerOnPlaza(instant = false): void {
    const { plazaCenter, tileSize } = CITY_MAP_CONFIG
    const targetX = (plazaCenter.gridX + 0.5) * tileSize
    const targetY = (plazaCenter.gridY + 0.2) * tileSize
    const cam = this.cameras.main
    const fitZoom = Phaser.Math.Clamp(Math.min(this.scale.width / 1080, 1.15), 0.72, 1.15)

    if (instant) {
      cam.setZoom(fitZoom)
      cam.centerOn(targetX, targetY)
    } else {
      cam.pan(targetX, targetY, 450, 'Sine.easeInOut')
      cam.zoomTo(fitZoom, 450, 'Sine.easeInOut')
    }
  }

  private setupCameraControls(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this.isDragging = false
        this.initialPinchDist = Phaser.Math.Distance.Between(
          this.input.pointer1.x,
          this.input.pointer1.y,
          this.input.pointer2.x,
          this.input.pointer2.y,
        )
        this.initialPinchZoom = camera.zoom
        return
      }

      this.isDragging = true
      this.dragStartX = pointer.x
      this.dragStartY = pointer.y
      this.camStartScrollX = camera.scrollX
      this.camStartScrollY = camera.scrollY
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown && this.initialPinchDist) {
        const dist = Phaser.Math.Distance.Between(
          this.input.pointer1.x,
          this.input.pointer1.y,
          this.input.pointer2.x,
          this.input.pointer2.y,
        )
        const ratio = dist / this.initialPinchDist
        camera.setZoom(Phaser.Math.Clamp(this.initialPinchZoom * ratio, 0.55, 2.2))
        return
      }

      if (!this.isDragging || !pointer.isDown) return
      const dx = (pointer.x - this.dragStartX) / camera.zoom
      const dy = (pointer.y - this.dragStartY) / camera.zoom
      camera.scrollX = this.camStartScrollX - dx
      camera.scrollY = this.camStartScrollY - dy
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
      this.initialPinchDist = null
    })

    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _over: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        const nextZoom = camera.zoom * (dy > 0 ? 0.9 : 1.1)
        camera.setZoom(Phaser.Math.Clamp(nextZoom, 0.55, 2.2))
      },
    )
  }

  private registerBusListeners(): void {
    this.unsubscribers.push(
      gameEventBus.on('city:trees-updated', (trees) => {
        this.renderTrees(trees)
      }),
      gameEventBus.on('city:zoom-in', () => {
        const cam = this.cameras.main
        cam.zoomTo(Phaser.Math.Clamp(cam.zoom * 1.2, 0.55, 2.2), 200)
      }),
      gameEventBus.on('city:zoom-out', () => {
        const cam = this.cameras.main
        cam.zoomTo(Phaser.Math.Clamp(cam.zoom * 0.82, 0.55, 2.2), 200)
      }),
      gameEventBus.on('city:reset-camera', () => {
        this.centerOnPlaza(false)
      }),
      gameEventBus.on('city:focus-creator', () => {
        const creator = this.treeObjects.get('creator-ufc')
        if (!creator) return
        this.highlightSelectedTree(creator.id)
        this.cameras.main.pan(creator.worldX, creator.worldY - 30, 500, 'Sine.easeInOut')
        this.cameras.main.zoomTo(1.25, 500, 'Sine.easeInOut')
      }),
    )

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((unsub) => unsub())
      this.unsubscribers = []
    })
  }

  update(time: number, delta: number): void {
    const timeSec = time / 1000
    const deltaSec = delta / 1000

    this.snowSystem?.update(timeSec, deltaSec)

    // Alternate Christmas tree bulb phase every 720ms
    if (time - this.lastTwinkleMs > 720) {
      this.lastTwinkleMs = time
      this.lightsPhase = this.lightsPhase === 0 ? 1 : 0
      this.treeObjects.forEach((tree) => tree.setLightsPhase(this.lightsPhase))
    }

    // Subtle warm lantern shimmer
    const lampPulse = 0.58 + 0.1 * Math.sin(timeSec * 2.5)
    for (const halo of this.lampGlows) {
      halo.setAlpha(lampPulse)
    }
  }
}
