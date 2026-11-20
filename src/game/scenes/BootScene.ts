import Phaser from 'phaser'
import { generateAllVillageTextures } from '../generators/pixelArtTextures'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  create(): void {
    generateAllVillageTextures(this)
    this.scene.start('CityScene')
  }
}
