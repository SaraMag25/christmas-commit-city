import Phaser from 'phaser'
import { CITY_MAP_CONFIG } from '../../config/cityMapConfig'
import { ensureTreeTexture } from '../generators/pixelArtTextures'
import { hashUsername } from '../layout/treePlacement'
import type { CityTree } from '../../types/city'

export class TreeObject {
  private readonly treeData: CityTree
  private readonly sprite: Phaser.GameObjects.Image
  private readonly glowSprite: Phaser.GameObjects.Image | null
  private readonly selectionRing: Phaser.GameObjects.Graphics
  private readonly labelText: Phaser.GameObjects.Text
  private readonly giftDots: Phaser.GameObjects.Graphics
  private readonly texKeyPhase0: string
  private readonly texKeyPhase1: string
  private isSelected = false

  constructor(
    scene: Phaser.Scene,
    treeData: CityTree,
    onSelect: (tree: CityTree) => void,
    onHover: (tree: CityTree | null) => void,
  ) {
    this.treeData = treeData

    const seed = hashUsername(treeData.profile.github_username)
    const baseKey = `tree-${treeData.id}-lv${treeData.tree_level}`
    this.texKeyPhase0 = `${baseKey}-p0`
    this.texKeyPhase1 = `${baseKey}-p1`

    ensureTreeTexture(scene, {
      key: this.texKeyPhase0,
      level: treeData.tree_level,
      seed,
      isCreatorSpecial: treeData.is_creator_special,
      lightsPhase: 0,
    })
    ensureTreeTexture(scene, {
      key: this.texKeyPhase1,
      level: treeData.tree_level,
      seed,
      isCreatorSpecial: treeData.is_creator_special,
      lightsPhase: 1,
    })

    const { tileSize, pixelScale } = CITY_MAP_CONFIG
    const worldX = (treeData.tree_position.gridX + 0.5) * tileSize
    const worldY = (treeData.tree_position.gridY + 0.9) * tileSize

    // Warm festive glow underneath illuminated & special trees
    if (treeData.tree_level >= 4 || treeData.is_creator_special) {
      this.glowSprite = scene.add
        .image(worldX, worldY - 16 * pixelScale, 'deco-glow')
        .setScale(treeData.is_creator_special ? pixelScale * 1.55 : pixelScale * 1.15)
        .setAlpha(treeData.is_creator_special ? 0.8 : 0.55)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(worldY - 2)
    } else {
      this.glowSprite = null
    }

    // Crisp selection/hover ring drawn beneath the trunk
    this.selectionRing = scene.add.graphics().setDepth(worldY - 1).setVisible(false)
    this.drawSelectionRing(treeData.is_creator_special ? 0x38bdf8 : 0xfbbf24)

    this.sprite = scene.add
      .image(worldX, worldY, this.texKeyPhase0)
      .setOrigin(0.5, 1)
      .setScale(pixelScale)
      .setDepth(worldY)
      .setInteractive({ useHandCursor: true })

    // Tiny visual gift indicator dots when the tree received community gifts
    this.giftDots = scene.add.graphics().setDepth(worldY + 1)
    this.drawGiftOrnaments(worldX, worldY, pixelScale)

    const labelPrefix = treeData.is_creator_special ? '★ ' : ''
    this.labelText = scene.add
      .text(worldX, worldY + 6, `${labelPrefix}@${treeData.profile.github_username}`, {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '10px',
        color: treeData.is_creator_special ? '#fde047' : '#f8fafc',
        backgroundColor: 'rgba(7, 13, 31, 0.82)',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setDepth(worldY + 20)
      .setAlpha(treeData.is_creator_special ? 1 : 0.78)

    this.sprite.on('pointerover', () => {
      this.selectionRing.setVisible(true)
      this.labelText.setAlpha(1)
      onHover(this.treeData)
    })

    this.sprite.on('pointerout', () => {
      if (!this.isSelected) {
        this.selectionRing.setVisible(false)
        this.labelText.setAlpha(this.treeData.is_creator_special ? 1 : 0.78)
      }
      onHover(null)
    })

    this.sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const moved = Phaser.Math.Distance.Between(
        pointer.downX,
        pointer.downY,
        pointer.upX,
        pointer.upY,
      )
      if (moved < 10) {
        onSelect(this.treeData)
      }
    })
  }

  private drawSelectionRing(color: number): void {
    this.selectionRing.clear()
    this.selectionRing.lineStyle(2, color, 0.95)
    this.selectionRing.strokeEllipse(this.worldX, this.worldY - 4, 60, 22)
  }

  private drawGiftOrnaments(worldX: number, worldY: number, scale: number): void {
    if (this.treeData.gifts.length === 0) return
    this.giftDots.clear()
    const visibleGifts = this.treeData.gifts.slice(0, 4)
    visibleGifts.forEach((gift, idx) => {
      const offsetX = (idx - (visibleGifts.length - 1) / 2) * 11
      const boxY = worldY - 6
      const color = gift.category === 'special' ? 0xfbbf24 : 0xef4444
      this.giftDots.fillStyle(color, 1)
      this.giftDots.fillRect(worldX + offsetX - 3, boxY, 2 * scale, 2 * scale)
      this.giftDots.fillStyle(0xf8fafc, 1)
      this.giftDots.fillRect(worldX + offsetX - 1, boxY, 2, 2 * scale)
    })
  }

  get id(): string {
    return this.treeData.id
  }

  get worldX(): number {
    return (this.treeData.tree_position.gridX + 0.5) * CITY_MAP_CONFIG.tileSize
  }

  get worldY(): number {
    return (this.treeData.tree_position.gridY + 0.9) * CITY_MAP_CONFIG.tileSize
  }

  setSelected(selected: boolean): void {
    this.isSelected = selected
    this.selectionRing.setVisible(selected)
    this.labelText.setAlpha(selected || this.treeData.is_creator_special ? 1 : 0.78)
  }

  setLightsPhase(phase: 0 | 1): void {
    if (this.treeData.tree_level < 4 && !this.treeData.is_creator_special) return
    this.sprite.setTexture(phase === 0 ? this.texKeyPhase0 : this.texKeyPhase1)
    if (this.glowSprite) {
      const baseAlpha = this.treeData.is_creator_special ? 0.8 : 0.52
      this.glowSprite.setAlpha(phase === 0 ? baseAlpha : baseAlpha * 0.78)
    }
  }

  destroy(): void {
    this.sprite.destroy()
    this.glowSprite?.destroy()
    this.selectionRing.destroy()
    this.labelText.destroy()
    this.giftDots.destroy()
  }
}
