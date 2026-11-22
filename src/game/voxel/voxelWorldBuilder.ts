import * as THREE from 'three'
import {
  CITY_MAP_CONFIG,
  CITY_PALETTE,
  MIN_TREE_SPACING_GRID,
  NORTH_POLE_LANDMARKS,
  VILLAGE_OFFSET_X,
  VILLAGE_OFFSET_Y,
  WORLD_TILE_SIZE,
} from '../../config/cityMapConfig'
import type { VillagePropDialogue } from '../../types/city'
import {
  CURATED_TREE_PLOTS,
  getMainRiverCenterX,
  isBridgeTile,
  isFrozenPondTile,
  isPierTile,
  isPlazaTile,
  isRiverTile,
  isSnowTrailTile,
  VILLAGE_COTTAGES,
  VILLAGE_DECORATIONS,
} from '../layout/treePlacement'
import {
  createVoxelMesh,
  getEmissiveMaterial,
  getUnitBoxGeometry,
  getVoxelMaterial,
} from './voxelMaterials'
import { buildVoxelChristmasTree } from './voxelTreeBuilder'

export const TILE_WORLD = WORLD_TILE_SIZE

export interface InteractivePropHandle {
  mesh: THREE.Object3D
  dialogue: VillagePropDialogue
}

export interface WildlifeActor {
  mesh: THREE.Group
  kind: 'reindeer' | 'fox' | 'bunny' | 'fish'
  centerX: number
  centerZ: number
  radiusX: number
  radiusZ: number
  speed: number
  phase: number
}

export interface CrystalRotator {
  mesh: THREE.Object3D
  baseY: number
  phase: number
}

export interface MagicParticleItem {
  centerX: number
  baseY: number
  centerZ: number
  radius: number
  speed: number
  bobAmp: number
  size: number
  phase: number
  color: string
}

export interface BuiltVoxelWorld {
  root: THREE.Group
  interactiveProps: InteractivePropHandle[]
  lampGlows: THREE.Mesh[]
  snowParticles: THREE.InstancedMesh
  snowData: Array<{ x: number; y: number; z: number; speed: number; drift: number; size: number }>
  smokePuffs: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>
  auroraBars: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>
  wisps: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }>
  crystalRotators: CrystalRotator[]
  magicParticles: THREE.InstancedMesh
  magicParticleData: MagicParticleItem[]
  riverRipples: Array<{
    mesh: THREE.Mesh
    baseX: number
    baseY: number
    baseZ: number
    phase: number
    isWaterfall?: boolean
  }>
  wildlife: WildlifeActor[]
}

interface BoxInstance {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
}

function addInstancedBucket(
  root: THREE.Group,
  items: BoxInstance[],
  color: string,
  emissive = false,
  opacity = 1,
): void {
  if (items.length === 0) return
  const geom = getUnitBoxGeometry()
  const mat = emissive ? getEmissiveMaterial(color, opacity) : getVoxelMaterial(color, opacity)
  const instanced = new THREE.InstancedMesh(geom, mat, items.length)
  const dummy = new THREE.Object3D()

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    dummy.position.set(item.x, item.y, item.z)
    dummy.scale.set(item.sx, item.sy, item.sz)
    dummy.updateMatrix()
    instanced.setMatrixAt(i, dummy.matrix)
  }

  instanced.instanceMatrix.needsUpdate = true
  root.add(instanced)
}

export function gridToWorld(gridX: number, gridY: number): { x: number; z: number } {
  const { cols, rows } = CITY_MAP_CONFIG
  return {
    x: (gridX - cols / 2 + 0.5) * TILE_WORLD,
    z: (gridY - rows / 2 + 0.5) * TILE_WORLD,
  }
}

/**
 * Smooth multi-octave organic snow drift value in [0, 1] so the terrain
 * reads like natural arctic drifts instead of a hard checkerboard.
 */
function sampleSnowField(gx: number, gy: number): number {
  const waveA = Math.sin(gx * 0.24 + gy * 0.17) * 0.5 + 0.5
  const waveB = Math.cos(gx * 0.13 - gy * 0.29) * 0.5 + 0.5
  const micro = Math.sin(gx * 0.65 + Math.cos(gy * 0.55) * 2.1) * 0.5 + 0.5
  return waveA * 0.48 + waveB * 0.36 + micro * 0.16
}

function isReservedArea(x: number, y: number, includeTallTreeClearance = true): boolean {
  if (
    isRiverTile(x, y) ||
    isBridgeTile(x, y) ||
    isSnowTrailTile(x, y) ||
    isPlazaTile(x, y) ||
    isFrozenPondTile(x, y) ||
    isPierTile(x, y)
  ) {
    return true
  }
  const { santaTreehouse, crystalTower, elvenPavilion, marketStall } = NORTH_POLE_LANDMARKS
  if (
    Math.abs(x - santaTreehouse.centerGridX) <= santaTreehouse.padX &&
    Math.abs(y - santaTreehouse.centerGridY) <= santaTreehouse.padY
  ) {
    return true
  }
  if (
    Math.abs(x - crystalTower.centerGridX) <= crystalTower.padX &&
    Math.abs(y - crystalTower.centerGridY) <= crystalTower.padY
  ) {
    return true
  }
  if (
    Math.abs(x - elvenPavilion.centerGridX) <= elvenPavilion.padX &&
    Math.abs(y - elvenPavilion.centerGridY) <= elvenPavilion.padY
  ) {
    return true
  }
  if (Math.abs(x - marketStall.gridX) <= marketStall.padX && Math.abs(y - marketStall.gridY) <= marketStall.padY) {
    return true
  }
  for (const d of VILLAGE_DECORATIONS) {
    if (d.type === 'market-stall') continue
    const pad =
      d.type === 'sleigh' || d.type === 'igloo'
        ? 1.5
        : d.type === 'mushroom-house'
          ? 1.55
          : 1.05
    if (Math.hypot(x - d.gridX, y - d.gridY) <= pad) return true
  }
  // Keep tall pines cleanly outside tree spacing and keep low floor props clear of all pet/gift zones
  const treeSafeRadius = includeTallTreeClearance ? MIN_TREE_SPACING_GRID * 0.94 : 1.22
  for (const p of CURATED_TREE_PLOTS) {
    if (Math.hypot(x - p.gridX, y - p.gridY) <= treeSafeRadius) return true
  }
  return false
}

export function buildVoxelWorld(): BuiltVoxelWorld {
  const root = new THREE.Group()
  const interactiveProps: InteractivePropHandle[] = []
  const lampGlows: THREE.Mesh[] = []
  const smokePuffs: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = []
  const auroraBars: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = []
  const wisps: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }> =
    []
  const crystalRotators: CrystalRotator[] = []
  const magicSeedPoints: MagicParticleItem[] = []
  const riverRipples: Array<{
    mesh: THREE.Mesh
    baseX: number
    baseY: number
    baseZ: number
    phase: number
    isWaterfall?: boolean
  }> = []
  const wildlife: WildlifeActor[] = []

  buildTerrainAndRivers(root, riverRipples)
  buildMistyMountainsAndRuins(root, riverRipples)
  buildNightSky(root, auroraBars)
  buildEnchantedForestFoliage(root, wisps)
  buildNorthPoleBuildings(root, smokePuffs, lampGlows, crystalRotators, magicSeedPoints, interactiveProps)
  buildNorthPoleDecorations(root, interactiveProps, smokePuffs, lampGlows, magicSeedPoints)
  buildFootprintTrails(root)
  buildLivingWildlife(root, wildlife)
  buildDistantScenicTree(root)

  const { snowParticles, snowData } = buildSnowSystem(root)
  const { magicParticles, magicParticleData } = buildMagicParticleSystem(root, magicSeedPoints)

  return {
    root,
    interactiveProps,
    lampGlows,
    snowParticles,
    snowData,
    smokePuffs,
    auroraBars,
    wisps,
    crystalRotators,
    magicParticles,
    magicParticleData,
    riverRipples,
    wildlife,
  }
}

function buildTerrainAndRivers(
  root: THREE.Group,
  riverRipples: BuiltVoxelWorld['riverRipples'],
): void {
  const { cols, rows, skyRows } = CITY_MAP_CONFIG
  const pad = 6
  const totalCols = cols + pad * 2
  const totalRows = rows - skyRows + pad * 2

  const buckets: Record<string, BoxInstance[]> = {
    snowBright: [],
    snowIce: [],
    snowSoftShadow: [],
    iceShore: [],
    riverCrystal: [],
    snowTrail: [],
    woodPlank: [],
    riverWater: [],
    riverBed: [],
    pondIce: [],
    pier: [],
    bridgeWood: [],
    earthBase: [],
  }

  for (let gy = skyRows - pad; gy < rows + pad; gy += 1) {
    for (let gx = -pad; gx < cols + pad; gx += 1) {
      const { x, z } = gridToWorld(gx, gy)
      const inBounds = gx >= 0 && gx < cols && gy >= skyRows && gy < rows

      if (inBounds && isBridgeTile(gx, gy)) {
        buckets.riverBed.push({ x, y: -0.78, z, sx: TILE_WORLD, sy: 0.4, sz: TILE_WORLD })
        buckets.riverWater.push({ x, y: -0.35, z, sx: TILE_WORLD, sy: 0.35, sz: TILE_WORLD })
        buckets.bridgeWood.push({
          x,
          y: 0.24,
          z,
          sx: TILE_WORLD * 0.96,
          sy: 0.42,
          sz: TILE_WORLD * 0.96,
        })
        addRusticBridgeParapet(root, x, z, gy === 18)
      } else if (inBounds && isRiverTile(gx, gy)) {
        buckets.riverBed.push({ x, y: -0.78, z, sx: TILE_WORLD, sy: 0.4, sz: TILE_WORLD })
        buckets.riverWater.push({ x, y: -0.34, z, sx: TILE_WORLD, sy: 0.38, sz: TILE_WORLD })

        if ((gx + gy) % 2 === 0) {
          const ripple = createVoxelMesh(x, -0.12, z, 1.05, 0.08, 0.48, '#e0f7ff', true, 0.86)
          root.add(ripple)
          riverRipples.push({
            mesh: ripple,
            baseX: x,
            baseY: -0.12,
            baseZ: z,
            phase: gx * 0.6 + gy * 0.4,
          })
        }
      } else if (inBounds && isPierTile(gx, gy)) {
        buckets.pondIce.push({ x, y: -0.36, z, sx: TILE_WORLD, sy: 0.45, sz: TILE_WORLD })
        buckets.pier.push({
          x,
          y: -0.02,
          z,
          sx: TILE_WORLD * 0.92,
          sy: 0.32,
          sz: TILE_WORLD * 0.82,
        })
      } else if (inBounds && isFrozenPondTile(gx, gy)) {
        buckets.pondIce.push({ x, y: -0.36, z, sx: TILE_WORLD, sy: 0.45, sz: TILE_WORLD })
        // Bright frost sheen patches on the pond surface
        if (sampleSnowField(gx * 2, gy * 2) > 0.68) {
          buckets.iceShore.push({
            x,
            y: -0.12,
            z,
            sx: TILE_WORLD * 0.72,
            sy: 0.05,
            sz: TILE_WORLD * 0.72,
          })
        }
      } else if (inBounds && isPlazaTile(gx, gy)) {
        buckets.snowTrail.push({ x, y: -0.22, z, sx: TILE_WORLD, sy: 0.56, sz: TILE_WORLD })
      } else if (inBounds && isSnowTrailTile(gx, gy)) {
        // Subtle packed-snow trail with sparse rustic wooden stepping planks
        buckets.snowTrail.push({ x, y: -0.25, z, sx: TILE_WORLD, sy: 0.52, sz: TILE_WORLD })
        const plankHash = Math.abs(gx * 31 + gy * 17) % 3
        if (plankHash === 0) {
          buckets.woodPlank.push({
            x,
            y: 0.04,
            z,
            sx: TILE_WORLD * 0.56,
            sy: 0.1,
            sz: TILE_WORLD * 0.34,
          })
        }
      } else {
        const nearWater =
          inBounds &&
          (isRiverTile(gx - 1, gy) ||
            isRiverTile(gx + 1, gy) ||
            isRiverTile(gx, gy - 1) ||
            isRiverTile(gx, gy + 1) ||
            isFrozenPondTile(gx - 1, gy) ||
            isFrozenPondTile(gx + 1, gy) ||
            isFrozenPondTile(gx, gy - 1) ||
            isFrozenPondTile(gx, gy + 1))

        const distFromEdge = Math.min(gx, cols - 1 - gx, gy - skyRows, rows - 1 - gy)
        const field = sampleSnowField(gx, gy)

        // Smooth organic elevation mounds along perimeter and select snowy drifts
        let elevation = 0
        if (distFromEdge <= 0) {
          elevation = 0.65 + field * 0.85
        } else if (distFromEdge === 1) {
          elevation = 0.22 + field * 0.35
        } else if (field > 0.78 && !nearWater) {
          elevation = 0.18
        }

        const bucket = nearWater
          ? field > 0.55
            ? 'iceShore'
            : 'snowIce'
          : field > 0.58
            ? 'snowBright'
            : field > 0.28
              ? 'snowIce'
              : 'snowSoftShadow'

        const h = 0.6 + elevation
        buckets[bucket].push({
          x,
          y: h / 2 - 0.55,
          z,
          sx: TILE_WORLD,
          sy: h,
          sz: TILE_WORLD,
        })

        // Sparkling ice crystals & frosted shoreline stones along riverbanks and frozen pond
        if (nearWater && !isSnowTrailTile(gx, gy) && Math.abs(gx * 19 + gy * 31) % 7 === 0) {
          const crystalH = 0.34 + (Math.abs(gx + gy) % 3) * 0.14
          buckets.riverCrystal.push({
            x: x + ((gx % 3) - 1) * 0.45,
            y: h - 0.55 + crystalH * 0.5,
            z: z + ((gy % 3) - 1) * 0.45,
            sx: 0.34,
            sy: crystalH,
            sz: 0.34,
          })
        }
      }
    }
  }

  buckets.earthBase.push({
    x: 0,
    y: -1.4,
    z: 0,
    sx: totalCols * TILE_WORLD,
    sy: 1.8,
    sz: totalRows * TILE_WORLD,
  })

  const palette: Record<keyof typeof buckets, string> = {
    snowBright: CITY_PALETTE.snow,
    snowIce: CITY_PALETTE.snowIce,
    snowSoftShadow: CITY_PALETTE.snowShadow,
    iceShore: '#bae6fd',
    riverCrystal: '#e0f2fe',
    snowTrail: CITY_PALETTE.snowTrail,
    woodPlank: CITY_PALETTE.woodMid,
    riverWater: CITY_PALETTE.waterVivid,
    riverBed: '#0c3b73',
    pondIce: CITY_PALETTE.iceVivid,
    pier: CITY_PALETTE.woodLight,
    bridgeWood: CITY_PALETTE.woodMid,
    earthBase: '#1b2b4d',
  }

  for (const [key, items] of Object.entries(buckets)) {
    const isTranslucentWater = key === 'riverWater' || key === 'pondIce'
    const isIceCrystal = key === 'riverCrystal'
    addInstancedBucket(
      root,
      items,
      palette[key as keyof typeof buckets],
      isIceCrystal,
      isTranslucentWater ? 0.88 : isIceCrystal ? 0.82 : 1,
    )
  }
}

function addRusticBridgeParapet(root: THREE.Group, x: number, z: number, horizontal: boolean): void {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const off = TILE_WORLD * 0.44
  if (horizontal) {
    g.add(createVoxelMesh(0, 0.7, -off, TILE_WORLD * 0.96, 0.36, 0.24, '#6b4226'))
    g.add(createVoxelMesh(0, 0.94, -off, TILE_WORLD * 0.96, 0.14, 0.26, '#f4f8ff'))
    g.add(createVoxelMesh(0, 0.7, off, TILE_WORLD * 0.96, 0.36, 0.24, '#6b4226'))
    g.add(createVoxelMesh(0, 0.94, off, TILE_WORLD * 0.96, 0.14, 0.26, '#f4f8ff'))
    g.add(createVoxelMesh(0, 1.18, -off, 0.34, 0.34, 0.34, '#fde047', true))
  } else {
    g.add(createVoxelMesh(-off, 0.7, 0, 0.24, 0.36, TILE_WORLD * 0.96, '#6b4226'))
    g.add(createVoxelMesh(-off, 0.94, 0, 0.26, 0.14, TILE_WORLD * 0.96, '#f4f8ff'))
    g.add(createVoxelMesh(off, 0.7, 0, 0.24, 0.36, TILE_WORLD * 0.96, '#6b4226'))
    g.add(createVoxelMesh(off, 0.94, 0, 0.26, 0.14, TILE_WORLD * 0.96, '#f4f8ff'))
    g.add(createVoxelMesh(-off, 1.18, 0, 0.34, 0.34, 0.34, '#fde047', true))
  }
  root.add(g)
}

function buildMistyMountainsAndRuins(
  root: THREE.Group,
  riverRipples: BuiltVoxelWorld['riverRipples'],
): void {
  const { cols, skyRows } = CITY_MAP_CONFIG

  // Arctic snowy mountain peaks along northern horizon
  const wfCenterX = Math.round(getMainRiverCenterX(skyRows))
  for (let gx = -5; gx < cols + 5; gx += 3) {
    const isWaterfallGap = gx >= wfCenterX - 2 && gx <= wfCenterX + 2
    const hash = Math.abs(gx * 37 + 19) % 10
    const peakH = isWaterfallGap ? 6.5 : 8.5 + hash * 0.85
    const { x, z } = gridToWorld(gx, skyRows - 4)

    const peak = new THREE.Group()
    peak.position.set(x, 0, z)
    peak.add(createVoxelMesh(0, peakH * 0.32, 0, 10.5, peakH * 0.65, 9.5, '#3b4e78'))
    peak.add(createVoxelMesh(0, peakH * 0.72, 0, 7.0, peakH * 0.38, 6.5, '#556c9e'))
    peak.add(createVoxelMesh(0, peakH * 0.95, 0, 4.6, peakH * 0.25, 4.4, '#f4f8ff'))
    root.add(peak)
  }

  // Glacial waterfall cascading from mountains into western river
  const wfPos = gridToWorld(getMainRiverCenterX(skyRows), skyRows - 0.8)
  const wfGroup = new THREE.Group()
  wfGroup.position.set(wfPos.x, 0, wfPos.z)
  wfGroup.add(createVoxelMesh(0, 3.2, -1.2, 3.2, 6.8, 1.4, '#38bdf8', true, 0.88))
  for (let i = 0; i < 6; i += 1) {
    const foam = createVoxelMesh(
      (i % 3 - 1) * 0.9,
      1.2 + i * 0.9,
      -0.4,
      0.68,
      0.88,
      0.68,
      '#f0f9ff',
      true,
      0.92,
    )
    wfGroup.add(foam)
    riverRipples.push({
      mesh: foam,
      baseX: (i % 3 - 1) * 0.9,
      baseY: 0.4,
      baseZ: -0.4,
      phase: i * 0.45,
      isWaterfall: true,
    })
  }
  root.add(wfGroup)

  // Northern lookout tower with warm beacon
  const ruinPos = gridToWorld(33 + VILLAGE_OFFSET_X, skyRows - 2)
  const ruin = new THREE.Group()
  ruin.position.set(ruinPos.x, 0.6, ruinPos.z)
  ruin.add(createVoxelMesh(0, 3.2, 0, 4.2, 6.4, 4.2, '#64749c'))
  ruin.add(createVoxelMesh(-1.5, 6.9, -1.5, 1.1, 1.3, 1.1, '#8598bf'))
  ruin.add(createVoxelMesh(-1.5, 7.62, -1.5, 1.15, 0.16, 1.15, '#f4f8ff'))
  ruin.add(createVoxelMesh(1.5, 6.7, 1.5, 1.1, 0.9, 1.1, '#8598bf'))
  ruin.add(createVoxelMesh(1.5, 7.22, 1.5, 1.15, 0.16, 1.15, '#f4f8ff'))
  ruin.add(createVoxelMesh(0, 3.8, 2.15, 1.0, 1.9, 0.24, CITY_PALETTE.warmGlow, true))
  root.add(ruin)
}

function buildNightSky(
  root: THREE.Group,
  auroraBars: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>,
): void {
  const starGroup = new THREE.Group()
  const geom = getUnitBoxGeometry()
  const starMat = getEmissiveMaterial('#fef9c3', 1, false)
  const count = 240
  const stars = new THREE.InstancedMesh(geom, starMat, count)
  const dummy = new THREE.Object3D()

  for (let i = 0; i < count; i += 1) {
    const angle = (i * 137.5 * Math.PI) / 180
    const radius = 125 + (i % 9) * 10
    const y = 22 + (i % 16) * 2.8
    dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    const s = i % 4 === 0 ? 0.65 : 0.35
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    stars.setMatrixAt(i, dummy.matrix)
  }
  stars.instanceMatrix.needsUpdate = true
  starGroup.add(stars)

  // Aurora Borealis ribbons dancing above the North Pole mountains (exempt from horizon fog)
  const auroraColors = ['#34d399', '#2dd4bf', '#38bdf8', '#a7f3d0']
  for (let i = 0; i < 28; i += 1) {
    const x = -80 + i * 5.9
    const z = -104 + Math.sin(i * 0.42) * 7
    const baseY = 38 + Math.cos(i * 0.48) * 3.8
    const bar = createVoxelMesh(
      x,
      baseY,
      z,
      5.0,
      6.8 + (i % 3) * 1.9,
      1.2,
      auroraColors[i % auroraColors.length],
      true,
      0.18,
      false,
    )
    starGroup.add(bar)
    auroraBars.push({ mesh: bar, baseY, phase: i * 0.45 })
  }

  const moonGroup = new THREE.Group()
  moonGroup.position.set(70, 50, -102)
  moonGroup.add(createVoxelMesh(0, 0, 0, 4.8, 4.8, 1.5, '#fef08a', true, 1, false))
  moonGroup.add(createVoxelMesh(1.7, 1.3, 0.3, 3.4, 3.4, 1.6, CITY_PALETTE.nightBg, true, 1, false))
  starGroup.add(moonGroup)

  root.add(starGroup)
}

function buildEnchantedForestFoliage(
  root: THREE.Group,
  wisps: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }>,
): void {
  const { cols, rows, skyRows } = CITY_MAP_CONFIG

  const buckets = {
    trunkBrown: [] as BoxInstance[],
    pineDeep: [] as BoxInstance[],
    pineMid: [] as BoxInstance[],
    snowCap: [] as BoxInstance[],
    shrubGreen: [] as BoxInstance[],
    berryRed: [] as BoxInstance[],
    snowTuft: [] as BoxInstance[],
    icePebble: [] as BoxInstance[],
  }

  for (let gy = skyRows - 4; gy < rows + 4; gy += 1) {
    for (let gx = -4; gx < cols + 4; gx += 1) {
      const inBounds = gx >= 0 && gx < cols && gy >= skyRows && gy < rows
      const hash = Math.abs((gx * 73856093) ^ (gy * 19349663)) % 100
      const isPerimeter = gx <= 1 || gx >= cols - 2 || gy <= skyRows + 1 || gy >= rows - 2
      const { x, z } = gridToWorld(gx, gy)
      const jitterX = ((hash % 7) - 3) * 0.14
      const jitterZ = (((hash >> 2) % 7) - 3) * 0.14
      const wx = x + jitterX
      const wz = z + jitterZ

      if (!inBounds || !isReservedArea(gx, gy, true)) {
        if ((isPerimeter && hash < 76) || (!isPerimeter && hash < 9)) {
          const scale = 0.85 + (hash % 5) * 0.2
          const trunkH = 1.4 * scale
          buckets.trunkBrown.push({ x: wx, y: trunkH / 2, z: wz, sx: 0.52, sy: trunkH, sz: 0.52 })
          for (let t = 0; t < 4; t += 1) {
            const w = (2.35 - t * 0.45) * scale
            const y = trunkH + t * 1.02 * scale
            const tierTarget = t % 2 === 0 ? buckets.pineDeep : buckets.pineMid
            tierTarget.push({ x: wx, y, z: wz, sx: w, sy: 0.88 * scale, sz: w })
            buckets.snowCap.push({
              x: wx,
              y: y + 0.46 * scale,
              z: wz,
              sx: w * 0.84,
              sy: 0.2,
              sz: w * 0.84,
            })
          }
          continue
        }
      }

      // Low woodland ground details (tufts, frosted stones, holly bushes & tiny ankle-high pine sprigs) in clear gaps
      if (inBounds && !isReservedArea(gx, gy, false)) {
        if (hash >= 18 && hash < 30) {
          // Low holly shrub or miniature knee-high frosted pine sprout (never blocks pets)
          if (hash % 3 === 0) {
            buckets.trunkBrown.push({ x: wx, y: 0.16, z: wz, sx: 0.18, sy: 0.32, sz: 0.18 })
            buckets.pineMid.push({ x: wx, y: 0.42, z: wz, sx: 0.62, sy: 0.34, sz: 0.62 })
            buckets.snowCap.push({ x: wx, y: 0.62, z: wz, sx: 0.46, sy: 0.12, sz: 0.46 })
          } else {
            buckets.shrubGreen.push({ x: wx, y: 0.2, z: wz, sx: 0.72, sy: 0.4, sz: 0.72 })
            buckets.snowCap.push({ x: wx, y: 0.42, z: wz, sx: 0.56, sy: 0.12, sz: 0.56 })
            if (hash % 2 === 0) {
              buckets.berryRed.push({ x: wx + 0.22, y: 0.3, z: wz + 0.22, sx: 0.14, sy: 0.14, sz: 0.14 })
            }
          }
        } else if (hash >= 38 && hash < 54) {
          // Subtle frosted snowdrift mound + icy pebble cluster
          buckets.snowTuft.push({ x: wx, y: 0.09, z: wz, sx: 0.92, sy: 0.18, sz: 0.78 })
          buckets.icePebble.push({ x: wx + 0.34, y: 0.1, z: wz - 0.22, sx: 0.26, sy: 0.18, sz: 0.24 })
          if (hash % 2 === 1) {
            buckets.icePebble.push({ x: wx - 0.28, y: 0.08, z: wz + 0.26, sx: 0.2, sy: 0.14, sz: 0.2 })
          }
        }
      }

      if (inBounds && !isReservedArea(gx, gy, false) && hash >= 91 && wisps.length < 32) {
        const wispColor = hash % 3 === 0 ? '#fde047' : '#7dd3fc'
        const wy = 1.8 + (hash % 5) * 0.5
        const wisp = createVoxelMesh(x, wy, z, 0.2, 0.2, 0.2, wispColor, true, 0.85)
        root.add(wisp)
        wisps.push({ mesh: wisp, baseX: x, baseY: wy, baseZ: z, phase: hash * 0.2 })
      }
    }
  }

  addInstancedBucket(root, buckets.trunkBrown, '#6b4226')
  addInstancedBucket(root, buckets.pineDeep, CITY_PALETTE.pineDark)
  addInstancedBucket(root, buckets.pineMid, CITY_PALETTE.pineMid)
  addInstancedBucket(root, buckets.snowCap, CITY_PALETTE.snow)
  addInstancedBucket(root, buckets.shrubGreen, CITY_PALETTE.pineBright)
  addInstancedBucket(root, buckets.berryRed, '#ef4444', true)
  addInstancedBucket(root, buckets.snowTuft, '#eef6ff')
  addInstancedBucket(root, buckets.icePebble, '#9bb4da')
}

function addMiniFrostedPine(g: THREE.Group, x: number, z: number, scale = 1): void {
  const s = scale
  g.add(createVoxelMesh(x, 0.45 * s, z, 0.32 * s, 0.9 * s, 0.32 * s, '#5c371d'))
  g.add(createVoxelMesh(x, 1.05 * s, z, 1.25 * s, 0.65 * s, 1.25 * s, CITY_PALETTE.pineDark))
  g.add(createVoxelMesh(x, 1.42 * s, z, 1.08 * s, 0.16 * s, 1.08 * s, CITY_PALETTE.snow))
  g.add(createVoxelMesh(x, 1.65 * s, z, 0.85 * s, 0.55 * s, 0.85 * s, CITY_PALETTE.pineMid))
  g.add(createVoxelMesh(x, 1.98 * s, z, 0.68 * s, 0.16 * s, 0.68 * s, CITY_PALETTE.snow))
}

function addSnowyFirewoodStack(g: THREE.Group, x: number, z: number): void {
  g.add(createVoxelMesh(x, 0.18, z, 0.92, 0.28, 0.62, '#5c371d'))
  g.add(createVoxelMesh(x, 0.44, z, 0.72, 0.26, 0.58, '#8c5835'))
  g.add(createVoxelMesh(x, 0.62, z, 0.68, 0.12, 0.54, CITY_PALETTE.snow))
}

function addWrappedGiftBox(
  g: THREE.Group,
  x: number,
  y: number,
  z: number,
  s: number,
  boxColor: string,
  ribbonColor: string,
): void {
  g.add(createVoxelMesh(x, y + s * 0.45, z, s, s * 0.9, s, boxColor))
  g.add(createVoxelMesh(x, y + s * 0.47, z, s * 1.05, s * 0.22, s * 0.22, ribbonColor))
  g.add(createVoxelMesh(x, y + s * 0.47, z, s * 0.22, s * 0.22, s * 1.05, ribbonColor))
}

function addSnowyLowFenceSegment(g: THREE.Group, x: number, z: number, lenX: number, lenZ: number): void {
  const isHorizontal = lenX >= lenZ
  g.add(createVoxelMesh(x, 0.42, z, lenX, 0.16, lenZ, '#7c4d2b'))
  g.add(createVoxelMesh(x, 0.54, z, lenX * 0.96, 0.1, lenZ * 0.96, CITY_PALETTE.snow))
  if (isHorizontal) {
    g.add(createVoxelMesh(x - lenX * 0.45, 0.34, z, 0.22, 0.68, 0.22, '#5c371d'))
    g.add(createVoxelMesh(x + lenX * 0.45, 0.34, z, 0.22, 0.68, 0.22, '#5c371d'))
  } else {
    g.add(createVoxelMesh(x, 0.34, z - lenZ * 0.45, 0.22, 0.68, 0.22, '#5c371d'))
    g.add(createVoxelMesh(x, 0.34, z + lenZ * 0.45, 0.22, 0.68, 0.22, '#5c371d'))
  }
}

function addBaseSnowMoundAndRocks(g: THREE.Group, x: number, z: number, w: number, d: number): void {
  g.add(createVoxelMesh(x, 0.14, z, w, 0.28, d, CITY_PALETTE.snowIce))
  g.add(createVoxelMesh(x + 0.25, 0.32, z - 0.15, w * 0.72, 0.16, d * 0.72, CITY_PALETTE.snow))
  g.add(createVoxelMesh(x - w * 0.38, 0.22, z + d * 0.3, 0.42, 0.28, 0.42, '#94a3b8'))
}

function pushMagicRing(
  magicSeedPoints: MagicParticleItem[],
  cx: number,
  cz: number,
  minY: number,
  maxY: number,
  minRadius: number,
  maxRadius: number,
  count: number,
  palette: readonly string[],
): void {
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count)
    const fracA = (Math.sin((i + 1) * 12.9898 + cx * 0.37) * 0.5 + 0.5)
    const fracB = (Math.cos((i + 3) * 78.233 + cz * 0.41) * 0.5 + 0.5)
    magicSeedPoints.push({
      centerX: cx,
      baseY: minY + fracA * (maxY - minY),
      centerZ: cz,
      radius: minRadius + fracB * (maxRadius - minRadius),
      speed: 0.25 + (i % 5) * 0.08,
      bobAmp: 0.45 + (i % 3) * 0.22,
      size: 0.17 + (i % 3) * 0.055,
      phase: t * Math.PI * 2 + cx * 0.1,
      color: palette[i % palette.length],
    })
  }
}

function buildMonumentalSantaTreehouse(
  root: THREE.Group,
  x: number,
  z: number,
  smokePuffs: BuiltVoxelWorld['smokePuffs'],
  lampGlows: THREE.Mesh[],
  magicSeedPoints: MagicParticleItem[],
  interactiveProps: InteractivePropHandle[],
): void {
  // Colossal Christmas Treehouse (~19u wide x ~27u tall — ~2.3x taller & ~3x wider than Level 6)
  const g = new THREE.Group()
  g.position.set(x, 0, z)

  // 1. Wide snowy stone plaza plinth & cool snow shadow
  g.add(createVoxelMesh(0, 0.08, 0, 12.4, 0.16, 12.4, '#b8cae8'))
  g.add(createVoxelMesh(0, 0.22, 0.2, 9.6, 0.28, 9.2, '#64749c'))
  g.add(createVoxelMesh(0, 0.4, 0.2, 8.2, 0.16, 8.0, '#f4f8ff'))
  // Stepping stones leading into trunk doorway
  g.add(createVoxelMesh(0, 0.18, 4.9, 2.4, 0.18, 1.5, '#7c5334'))
  g.add(createVoxelMesh(0, 0.14, 6.2, 1.9, 0.14, 1.1, '#94a3b8'))

  // 2. Massive gnarled organic roots spreading into snow + giant tapered tree trunk
  const rootAngles = [0.45, 1.15, 2.0, 2.65, 3.6, 4.35, 5.15, 5.85]
  for (let r = 0; r < rootAngles.length; r += 1) {
    const ang = rootAngles[r]
    const rx = Math.cos(ang)
    const rz = Math.sin(ang)
    // Inner flared root buttress
    g.add(createVoxelMesh(rx * 2.55, 1.35, rz * 2.55, 1.45, 2.5, 1.45, '#5c371d'))
    // Mid root claw reaching outward
    g.add(createVoxelMesh(rx * 3.6, 0.72, rz * 3.6, 1.15, 1.28, 1.15, '#7c4d2b'))
    // Outer root tip + snow cap resting in hollow
    g.add(createVoxelMesh(rx * 4.45, 0.36, rz * 4.45, 0.9, 0.56, 0.9, '#4a2a14'))
    g.add(createVoxelMesh(rx * 3.7, 1.42, rz * 3.7, 0.9, 0.18, 0.9, '#f4f8ff'))
  }

  // Towering colossal main trunk rising to canopy core
  g.add(createVoxelMesh(0, 2.5, 0, 4.9, 5.0, 4.9, '#6b4226'))
  g.add(createVoxelMesh(0, 7.0, 0, 4.1, 4.4, 4.1, '#7c4d2b'))
  g.add(createVoxelMesh(0, 11.2, 0, 3.3, 4.2, 3.3, '#5c371d'))
  // Textured lighter bark vertical ribs
  g.add(createVoxelMesh(-2.35, 4.6, 1.2, 0.55, 6.8, 0.95, '#8c5835'))
  g.add(createVoxelMesh(2.35, 4.8, -1.1, 0.55, 7.2, 0.95, '#8c5835'))
  g.add(createVoxelMesh(-0.9, 5.2, -2.35, 1.0, 7.4, 0.55, '#8c5835'))

  // Structural thick wooden boughs supporting the cabin platform & upper turret
  g.add(createVoxelMesh(1.9, 6.8, 1.2, 4.2, 1.0, 3.2, '#5c371d'))
  g.add(createVoxelMesh(-2.4, 11.2, -0.4, 3.6, 0.95, 2.6, '#5c371d'))
  g.add(createVoxelMesh(2.4, 9.8, -1.6, 3.4, 0.9, 2.8, '#6b4226'))

  // 3. Grand Arched Wooden Doorway at Base of Trunk + Flanking Porch Lanterns
  g.add(createVoxelMesh(0, 1.95, 2.52, 2.8, 3.5, 0.48, '#475569'))
  g.add(createVoxelMesh(0, 3.68, 2.56, 2.2, 0.65, 0.5, '#64748b'))
  g.add(createVoxelMesh(0, 3.98, 2.58, 1.5, 0.3, 0.54, '#f4f8ff'))
  // Double oak arched doors + golden hardware + warm transom window
  g.add(createVoxelMesh(0, 1.65, 2.74, 1.9, 2.8, 0.24, '#8c5835'))
  g.add(createVoxelMesh(0, 1.65, 2.85, 0.14, 2.8, 0.1, '#4a2a14'))
  g.add(createVoxelMesh(-0.34, 1.5, 2.88, 0.18, 0.18, 0.08, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(0.34, 1.5, 2.88, 0.18, 0.18, 0.08, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(0, 2.78, 2.88, 0.84, 0.52, 0.1, CITY_PALETTE.warmGlow, true))
  // Festive holiday wreath on trunk archway
  g.add(createVoxelMesh(0, 2.1, 2.9, 0.85, 0.85, 0.16, '#16a34a'))
  g.add(createVoxelMesh(0, 2.1, 2.98, 0.3, 0.3, 0.12, '#ef4444', true))
  // Side glowing portholes on lower trunk
  g.add(createVoxelMesh(-2.5, 2.1, 0.1, 0.22, 0.95, 0.95, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(2.5, 2.2, 0.2, 0.22, 0.95, 0.95, CITY_PALETTE.warmGlow, true))

  // Two candy-striped courtyard lantern posts flanking the trunk doorway
  for (const side of [-1, 1]) {
    const lx = side * 2.25
    const lz = 3.55
    g.add(createVoxelMesh(lx, 1.6, lz, 0.3, 2.9, 0.3, '#5c371d'))
    g.add(createVoxelMesh(lx, 3.25, lz, 0.62, 0.65, 0.62, CITY_PALETTE.warmGlow, true))
    g.add(createVoxelMesh(lx, 3.68, lz, 0.78, 0.2, 0.78, '#b91c1c'))
    g.add(createVoxelMesh(lx, 3.82, lz, 0.62, 0.14, 0.62, '#f4f8ff'))
  }

  // Terrain-blending snow mounds, low snowy courtyard fence, firewood stack, gifts & frosted pines
  addBaseSnowMoundAndRocks(g, -3.9, 2.6, 2.4, 2.0)
  addBaseSnowMoundAndRocks(g, 4.1, 2.5, 2.4, 2.0)
  addSnowyLowFenceSegment(g, -3.5, 4.6, 2.6, 0.24)
  addSnowyLowFenceSegment(g, 3.5, 4.6, 2.6, 0.24)
  addSnowyFirewoodStack(g, 3.6, 3.3)
  addWrappedGiftBox(g, -1.35, 0.2, 3.2, 0.65, '#dc2626', CITY_PALETTE.warmGlow)
  addWrappedGiftBox(g, 1.4, 0.2, 3.25, 0.58, '#2563eb', '#f8fafc')
  addMiniFrostedPine(g, -5.2, -2.8, 1.15)
  addMiniFrostedPine(g, 5.1, -3.2, 1.05)

  // Rustic wooden stairs leading from ground right up to high cabin deck
  for (let st = 0; st < 7; st += 1) {
    g.add(createVoxelMesh(2.7 + st * 0.2, 0.7 + st * 0.95, 2.2 - st * 0.14, 1.25, 0.32, 0.75, '#7c4d2b'))
  }

  // 4. Cozy Treehouse Cabin Embedded High in Branches (y = 7.4..15.4)
  const cabX = 1.45
  const cabZ = 1.35
  // Cantilevered wooden deck & front balcony railing
  g.add(createVoxelMesh(cabX, 7.65, cabZ + 0.45, 7.4, 0.48, 6.2, '#6b4226'))
  g.add(createVoxelMesh(cabX, 8.32, cabZ + 3.4, 7.2, 0.26, 0.2, '#8c5835'))
  // Light cozy timber-framed cabin walls
  g.add(createVoxelMesh(cabX, 9.85, cabZ, 6.1, 3.9, 4.9, '#fef3c7'))
  // Dark corner beams & timber cross-trim
  g.add(createVoxelMesh(cabX - 2.95, 9.85, cabZ + 2.35, 0.46, 4.0, 0.46, '#5c371d'))
  g.add(createVoxelMesh(cabX + 2.95, 9.85, cabZ + 2.35, 0.46, 4.0, 0.46, '#5c371d'))
  g.add(createVoxelMesh(cabX - 2.95, 9.85, cabZ - 2.35, 0.46, 4.0, 0.46, '#5c371d'))
  g.add(createVoxelMesh(cabX + 2.95, 9.85, cabZ - 2.35, 0.46, 4.0, 0.46, '#5c371d'))
  // Cabin glowing windows & warm timber front door (unified warm amber #ffbe55)
  g.add(createVoxelMesh(cabX, 9.25, cabZ + 2.48, 1.35, 2.1, 0.18, '#7c4d2b'))
  g.add(createVoxelMesh(cabX, 9.85, cabZ + 2.58, 0.56, 0.56, 0.1, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(cabX - 1.75, 9.95, cabZ + 2.48, 1.15, 1.15, 0.18, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(cabX + 1.75, 9.95, cabZ + 2.48, 1.15, 1.15, 0.18, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(cabX + 3.08, 9.95, cabZ + 0.1, 0.18, 1.25, 1.35, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(cabX - 3.08, 9.95, cabZ + 0.2, 0.18, 1.15, 1.15, CITY_PALETTE.warmGlow, true))
  // Steep pitched crimson/terracotta cabin gable roof + thick winter snow cover
  g.add(createVoxelMesh(cabX, 12.15, cabZ, 7.2, 0.9, 5.9, '#b91c1c'))
  g.add(createVoxelMesh(cabX, 12.95, cabZ, 5.7, 0.85, 4.7, '#c2410c'))
  g.add(createVoxelMesh(cabX, 13.7, cabZ, 4.0, 0.78, 3.5, '#f4f8ff'))
  g.add(createVoxelMesh(cabX, 14.32, cabZ, 2.4, 0.58, 2.4, '#f4f8ff'))
  g.add(createVoxelMesh(cabX, 12.6, cabZ + 2.95, 7.0, 0.34, 0.3, '#dce8fc'))

  // Cabin stone chimney rising past canopy + 3 animated smoke puffs
  const chimX = cabX + 2.2
  const chimZ = cabZ - 1.4
  g.add(createVoxelMesh(chimX, 13.6, chimZ, 1.15, 4.6, 1.15, '#64749c'))
  g.add(createVoxelMesh(chimX, 15.98, chimZ, 1.32, 0.22, 1.32, '#f4f8ff'))
  for (let p = 0; p < 3; p += 1) {
    const smoke = createVoxelMesh(chimX, 16.4 + p * 0.9, chimZ, 0.65, 0.55, 0.65, '#e2e8f0', false, 0.48)
    g.add(smoke)
    smokePuffs.push({ mesh: smoke, baseY: 16.3, phase: p * 1.15 })
  }

  // 5. Upper-Left Lookout Turret Emerging from Canopy with Conical Spire Roof
  const turX = -3.35
  const turZ = -0.65
  g.add(createVoxelMesh(turX, 14.8, turZ, 2.75, 4.2, 2.75, '#fef3c7'))
  g.add(createVoxelMesh(turX, 14.8, turZ + 1.42, 0.92, 1.25, 0.16, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(turX - 1.42, 14.8, turZ, 0.16, 1.15, 0.92, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(turX, 17.25, turZ, 3.45, 0.75, 3.45, '#b91c1c'))
  g.add(createVoxelMesh(turX, 18.0, turZ, 2.65, 0.78, 2.65, '#dc2626'))
  g.add(createVoxelMesh(turX, 18.75, turZ, 1.9, 0.72, 1.9, '#f4f8ff'))
  g.add(createVoxelMesh(turX, 19.45, turZ, 1.1, 0.68, 1.1, '#f4f8ff'))
  g.add(createVoxelMesh(turX, 20.1, turZ, 0.45, 0.65, 0.45, CITY_PALETTE.warmGlow, true))

  // 6. Monumental Cloud-Like Layered Pine Canopy (~19u wide span) draped in heavy winter snow & festive bulbs
  const foliageLobes: Array<{
    x: number
    y: number
    z: number
    w: number
    h: number
    c: string
    lights?: boolean
  }> = [
    // Massive lower canopy skirt encircling cabin & trunk (radius ~9.4u)
    { x: -5.4, y: 12.2, z: -2.0, w: 6.8, h: 2.8, c: '#061c24', lights: true },
    { x: 5.2, y: 12.4, z: -1.8, w: 6.4, h: 2.7, c: '#0b2d38', lights: true },
    { x: 0.0, y: 12.8, z: -4.8, w: 8.6, h: 3.1, c: '#061c24', lights: true },
    { x: -4.8, y: 12.0, z: 3.6, w: 5.8, h: 2.5, c: '#0b2d38', lights: true },
    { x: 5.0, y: 12.2, z: 3.4, w: 5.2, h: 2.4, c: '#134652', lights: true },
    // Mid billowing fantasy boughs
    { x: 0.0, y: 15.8, z: -1.6, w: 9.8, h: 3.2, c: '#0b2d38', lights: true },
    { x: -4.4, y: 15.6, z: 1.8, w: 6.2, h: 2.8, c: '#134652', lights: true },
    { x: 4.4, y: 15.6, z: 1.6, w: 6.0, h: 2.8, c: '#0b2d38', lights: true },
    { x: 0.4, y: 16.4, z: -4.2, w: 6.6, h: 2.8, c: '#061c24', lights: true },
    // Upper majestic crown layers
    { x: 0.2, y: 18.8, z: -0.6, w: 8.4, h: 2.9, c: '#061c24', lights: true },
    { x: 2.8, y: 19.2, z: 1.4, w: 4.8, h: 2.4, c: '#134652', lights: true },
    { x: -0.2, y: 21.4, z: -0.4, w: 6.0, h: 2.6, c: '#0b2d38', lights: true },
    { x: 0.0, y: 23.5, z: -0.2, w: 3.8, h: 2.2, c: '#134652', lights: true },
    { x: 0.0, y: 25.0, z: -0.1, w: 2.1, h: 1.4, c: '#0b2d38' },
  ]

  const bulbColors = ['#fde047', '#ef4444', '#39d353', '#fb923c'] as const
  foliageLobes.forEach((lobe, idx) => {
    g.add(createVoxelMesh(lobe.x, lobe.y, lobe.z, lobe.w, lobe.h, lobe.w, lobe.c))
    // Sculpted snowy drift cap crowning each canopy cloud
    g.add(
      createVoxelMesh(
        lobe.x,
        lobe.y + lobe.h * 0.5 + 0.16,
        lobe.z,
        lobe.w * 0.88,
        0.38,
        lobe.w * 0.88,
        '#f4f8ff',
      ),
    )
    if (lobe.lights) {
      const half = lobe.w * 0.51
      const cA = bulbColors[idx % bulbColors.length]
      const cB = bulbColors[(idx + 2) % bulbColors.length]
      g.add(createVoxelMesh(lobe.x + half, lobe.y - 0.1, lobe.z + half * 0.35, 0.34, 0.34, 0.34, cA, true))
      g.add(createVoxelMesh(lobe.x - half * 0.4, lobe.y + 0.15, lobe.z + half, 0.34, 0.34, 0.34, cB, true))
      g.add(createVoxelMesh(lobe.x - half, lobe.y - 0.15, lobe.z - half * 0.3, 0.32, 0.32, 0.32, '#fde047', true))
    }
  })

  // Imposing Glowing Golden North Star crowning Santa's Treehouse (~26.5u tall!)
  g.add(createVoxelMesh(0, 26.35, -0.1, 1.35, 1.35, 1.35, '#fde047', true))
  g.add(createVoxelMesh(0, 26.35, -0.1, 2.3, 0.5, 0.5, '#fffbeb', true))
  g.add(createVoxelMesh(0, 26.35, -0.1, 0.5, 2.3, 0.5, '#fffbeb', true))

  // Warm golden reflection pad + 1 warm golden PointLight bathing courtyard & surrounding trees
  const courtyardGlow = createVoxelMesh(0, 0.1, 4.4, 7.6, 0.08, 4.6, CITY_PALETTE.warmGlow, true, 0.34)
  g.add(courtyardGlow)
  lampGlows.push(courtyardGlow)

  const treehouseLight = new THREE.PointLight(0xffbe55, 17, 42, 1.3)
  treehouseLight.position.set(0, 5.2, 4.2)
  g.add(treehouseLight)

  pushMagicRing(magicSeedPoints, x, z, 2.2, 23.0, 4.2, 9.6, 28, [
    CITY_PALETTE.warmGlow,
    CITY_PALETTE.warmHighlight,
    CITY_PALETTE.warmEmber,
  ])

  root.add(g)
  interactiveProps.push({
    mesh: g,
    dialogue: {
      title: 'Casa na Árvore do Papai Noel',
      text: 'Bem-vindo à Grande Casa na Árvore do Polo Norte! Lá no alto os duendes acompanham os commits do Natal em clima de lareira e neve.',
      titleEn: "Santa's Grand Treehouse",
      textEn:
        'Welcome to the Grand North Pole Treehouse! Up in the snowy boughs, elves sync holiday GitHub commits beside the roaring fireplace.',
    },
  })
}

function buildCrystalTower(
  root: THREE.Group,
  x: number,
  z: number,
  lampGlows: THREE.Mesh[],
  crystalRotators: CrystalRotator[],
  magicSeedPoints: MagicParticleItem[],
  interactiveProps: InteractivePropHandle[],
): void {
  // Enchanted Crystal Tower (~22.5u tall — ~2x taller than neighboring pines) overlooking Frozen Pond & River
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.PI * 0.25

  // 1. Elevated rocky cliff mound topped with winter snow ledges
  g.add(createVoxelMesh(0, 0.55, 0, 7.6, 1.1, 7.6, '#475569'))
  g.add(createVoxelMesh(0, 1.3, 0, 6.2, 0.6, 6.2, '#64748b'))
  g.add(createVoxelMesh(0, 1.66, 0, 5.6, 0.2, 5.6, '#f4f8ff'))
  g.add(createVoxelMesh(-2.6, 0.9, 2.5, 2.1, 0.85, 2.0, '#64748b'))
  g.add(createVoxelMesh(2.5, 0.7, -2.4, 2.2, 0.7, 2.2, '#94a3b8'))

  // 2. Stepped circular/octagonal weathered stone masonry drum
  const tiers = [
    { y: 3.4, h: 3.6, w: 4.4, d: 3.2, c: '#64748b' },
    { y: 7.0, h: 3.8, w: 4.0, d: 2.9, c: '#52627a' },
    { y: 10.7, h: 3.8, w: 3.6, d: 2.6, c: '#64748b' },
    { y: 13.6, h: 2.2, w: 4.1, d: 3.0, c: '#475569' },
  ]
  for (const t of tiers) {
    // Cruciform pair of rotated/crossed prisms yields crisp circular voxel tower walls
    g.add(createVoxelMesh(0, t.y, 0, t.w, t.h, t.d, t.c))
    g.add(createVoxelMesh(0, t.y, 0, t.d, t.h, t.w, t.c))
  }
  // Textured stone accent bricks & snowy stone ring ledges
  g.add(createVoxelMesh(0, 5.3, 0, 4.5, 0.28, 3.3, '#f4f8ff'))
  g.add(createVoxelMesh(0, 5.3, 0, 3.3, 0.28, 4.5, '#f4f8ff'))
  g.add(createVoxelMesh(0, 12.6, 0, 4.4, 0.34, 3.2, '#e2efff'))
  g.add(createVoxelMesh(0, 12.6, 0, 3.2, 0.34, 4.4, '#e2efff'))
  g.add(createVoxelMesh(0, 14.8, 0, 4.5, 0.26, 3.3, '#f4f8ff'))
  g.add(createVoxelMesh(0, 14.8, 0, 3.3, 0.26, 4.5, '#f4f8ff'))

  // 3. Arched dark oak doorway at base + glowing warm amber observatory windows
  g.add(createVoxelMesh(0, 2.75, 2.24, 1.85, 2.35, 0.36, '#334155'))
  g.add(createVoxelMesh(0, 2.6, 2.34, 1.3, 1.95, 0.26, '#4a2a14'))
  g.add(createVoxelMesh(0, 2.85, 2.48, 0.42, 0.48, 0.1, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(0, 4.15, 2.24, 0.9, 0.28, 0.4, '#f4f8ff'))

  // Spiraling warm amber windows
  g.add(createVoxelMesh(-1.15, 6.9, 2.04, 0.72, 0.92, 0.2, CITY_PALETTE.warmEmber, true))
  g.add(createVoxelMesh(1.98, 9.8, 0.3, 0.2, 0.95, 0.72, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(-1.98, 10.6, -0.3, 0.2, 0.95, 0.72, CITY_PALETTE.warmEmber, true))
  g.add(createVoxelMesh(0.2, 13.5, 2.1, 0.85, 0.85, 0.22, CITY_PALETTE.warmGlow, true))

  // Ground blending around observatory cliff: snow drifts, frosted pines, firewood & wooden trail rail
  addBaseSnowMoundAndRocks(g, -3.2, 2.9, 2.2, 1.9)
  addBaseSnowMoundAndRocks(g, 3.1, 2.7, 2.1, 1.8)
  addSnowyLowFenceSegment(g, -2.6, 4.1, 2.0, 0.22)
  addSnowyFirewoodStack(g, 2.9, 3.1)
  addMiniFrostedPine(g, -4.1, -2.5, 1.05)
  addMiniFrostedPine(g, 4.1, 2.2, 0.95)

  // 4. Steep Conical Stone Roof + Cradle Spires Holding Top Crystal
  g.add(createVoxelMesh(0, 15.35, 0, 3.7, 1.25, 3.7, '#334155'))
  g.add(createVoxelMesh(0, 16.45, 0, 2.7, 1.15, 2.7, '#475569'))
  g.add(createVoxelMesh(0, 17.35, 0, 1.7, 0.9, 1.7, '#f4f8ff'))
  g.add(createVoxelMesh(-1.35, 16.2, 0, 0.38, 1.5, 0.38, '#94a3b8'))
  g.add(createVoxelMesh(1.35, 16.2, 0, 0.38, 1.5, 0.38, '#94a3b8'))

  // 5. Large Imposing Floating Faceted Lilac / Ice-Blue Crystal Spire (~22.5u apex)
  const crystalGroup = new THREE.Group()
  const crystalBaseY = 19.6
  crystalGroup.position.set(0, crystalBaseY, 0)
  crystalGroup.add(createVoxelMesh(0, 0, 0, 1.35, 2.7, 1.35, '#a855f7', true))
  crystalGroup.add(createVoxelMesh(0, 0, 0, 1.75, 1.6, 1.05, '#c084fc', true))
  crystalGroup.add(createVoxelMesh(0, 0, 0, 1.05, 1.6, 1.75, '#7dd3fc', true))
  crystalGroup.add(createVoxelMesh(0, 1.75, 0, 0.75, 1.15, 0.75, '#e0f2fe', true))
  crystalGroup.add(createVoxelMesh(0, -1.65, 0, 0.7, 0.95, 0.7, '#7dd3fc', true))
  crystalGroup.add(createVoxelMesh(0, 0, 0, 2.15, 2.4, 2.15, '#e9d5ff', true, 0.38))
  g.add(crystalGroup)
  crystalRotators.push({ mesh: crystalGroup, baseY: crystalBaseY, phase: 0.4 })

  // Warm doorstep pad + mystic violet PointLight
  const doorGlow = createVoxelMesh(0, 0.14, 3.2, 3.2, 0.08, 2.2, CITY_PALETTE.warmGlow, true, 0.28)
  g.add(doorGlow)
  lampGlows.push(doorGlow)

  const crystalLight = new THREE.PointLight(0xa855f7, 15, 36, 1.35)
  crystalLight.position.set(0, 18.5, 0)
  g.add(crystalLight)

  pushMagicRing(magicSeedPoints, x, z, 3.5, 22.8, 1.8, 4.6, 24, ['#c084fc', '#7dd3fc', '#e9d5ff'])

  root.add(g)
  interactiveProps.push({
    mesh: g,
    dialogue: {
      title: 'Torre de Cristal — Observatório da Aurora',
      text: 'O cristal lilás no alto desta torre amplifica a aurora boreal canalizando a energia dos commits de toda a comunidade dev.',
      titleEn: 'Crystal Tower — Aurora Observatory',
      textEn:
        'The glowing crystal spire atop this stone observatory channels community GitHub commits to amplify the northern aurora borealis.',
    },
  })
}

function buildNorthPoleBuildings(
  root: THREE.Group,
  smokePuffs: BuiltVoxelWorld['smokePuffs'],
  lampGlows: THREE.Mesh[],
  crystalRotators: CrystalRotator[],
  magicSeedPoints: MagicParticleItem[],
  interactiveProps: InteractivePropHandle[],
): void {
  VILLAGE_COTTAGES.forEach((cottage) => {
    const { x, z } = gridToWorld(cottage.gridX + 1.2, cottage.gridY + 1.2)

    if (cottage.variant === 'santa-treehouse') {
      buildMonumentalSantaTreehouse(root, x, z, smokePuffs, lampGlows, magicSeedPoints, interactiveProps)
      return
    }

    if (cottage.variant === 'crystal-tower') {
      buildCrystalTower(root, x, z, lampGlows, crystalRotators, magicSeedPoints, interactiveProps)
      return
    }

    // Cozy timber elven pavilion in the southeastern woodland
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.scale.setScalar(1.05)
    g.add(createVoxelMesh(0, 0.2, 0, 5.2, 0.4, 5.2, '#9fb0cf'))
    g.add(createVoxelMesh(-2.0, 1.7, -2.0, 0.45, 2.8, 0.45, '#7c4d2b'))
    g.add(createVoxelMesh(2.0, 1.7, -2.0, 0.45, 2.8, 0.45, '#7c4d2b'))
    g.add(createVoxelMesh(-2.0, 1.7, 2.0, 0.45, 2.8, 0.45, '#7c4d2b'))
    g.add(createVoxelMesh(2.0, 1.7, 2.0, 0.45, 2.8, 0.45, '#7c4d2b'))
    g.add(createVoxelMesh(0, 3.3, 0, 5.6, 0.6, 5.6, '#0d3b45'))
    g.add(createVoxelMesh(0, 3.9, 0, 3.8, 0.65, 3.8, '#14505c'))
    g.add(createVoxelMesh(0, 4.45, 0, 2.7, 0.44, 2.7, '#f4f8ff'))
    g.add(createVoxelMesh(0, 2.4, 0, 0.56, 0.78, 0.56, CITY_PALETTE.warmGlow, true))

    addBaseSnowMoundAndRocks(g, -2.7, 2.6, 1.8, 1.5)
    addBaseSnowMoundAndRocks(g, 2.7, -2.5, 1.8, 1.5)
    addSnowyFirewoodStack(g, 2.6, 2.2)
    addMiniFrostedPine(g, -3.2, -2.6, 0.9)

    const warmPad = createVoxelMesh(0, 0.42, 0, 3.4, 0.08, 3.4, CITY_PALETTE.warmGlow, true, 0.26)
    g.add(warmPad)
    lampGlows.push(warmPad)
    root.add(g)
  })
}

function buildNorthPoleMarket(
  root: THREE.Group,
  x: number,
  z: number,
  lampGlows: THREE.Mesh[],
  magicSeedPoints: MagicParticleItem[],
  interactiveProps: InteractivePropHandle[],
): void {
  // Spacious rustic North Pole Bazaar Stall (~9.6u wide x 6.4u deep x 7.6u tall)
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = -0.14

  // 1. Timber floor deck + snow-blending base drifts + warm snow light rug
  g.add(createVoxelMesh(0, 0.16, 0, 8.8, 0.32, 5.6, '#6b4226'))
  g.add(createVoxelMesh(0, 0.36, 0, 8.2, 0.14, 5.0, '#8c5835'))
  addBaseSnowMoundAndRocks(g, -4.6, 2.4, 1.8, 1.6)
  addBaseSnowMoundAndRocks(g, 4.7, -2.1, 1.8, 1.6)
  addSnowyFirewoodStack(g, -4.6, -0.8)
  addWrappedGiftBox(g, -3.6, 0.1, 2.8, 0.62, '#dc2626', CITY_PALETTE.warmGlow)
  addMiniFrostedPine(g, 4.8, -2.4, 0.95)
  const marketGlow = createVoxelMesh(0, 0.08, 3.1, 8.2, 0.08, 3.0, CITY_PALETTE.warmGlow, true, 0.32)
  g.add(marketGlow)
  lampGlows.push(marketGlow)

  // 2. Corner posts, rustic back wall & display shelves stocked with festive jars/crates
  for (const px of [-3.9, 3.9]) {
    g.add(createVoxelMesh(px, 2.15, 2.2, 0.44, 3.7, 0.44, '#5c371d'))
    g.add(createVoxelMesh(px, 2.35, -2.2, 0.44, 4.1, 0.44, '#5c371d'))
  }
  g.add(createVoxelMesh(0, 1.9, -2.2, 7.6, 3.1, 0.32, '#7c4d2b'))
  g.add(createVoxelMesh(0, 2.3, -1.9, 6.8, 0.18, 0.56, '#9c6644'))
  // Shelves items (commit flasks & miniature pine seeds)
  g.add(createVoxelMesh(-2.3, 2.68, -1.9, 0.55, 0.62, 0.45, '#39d353', true))
  g.add(createVoxelMesh(-1.1, 2.64, -1.9, 0.62, 0.54, 0.45, '#ef4444'))
  g.add(createVoxelMesh(0.2, 2.72, -1.9, 0.56, 0.68, 0.45, '#38bdf8', true))
  g.add(createVoxelMesh(1.5, 2.64, -1.9, 0.68, 0.52, 0.45, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(2.7, 2.68, -1.9, 0.55, 0.62, 0.45, '#c084fc', true))

  // Long front shop counter + hanging lantern
  g.add(createVoxelMesh(0, 1.05, 1.55, 7.6, 1.35, 1.05, '#7c4d2b'))
  g.add(createVoxelMesh(0, 1.76, 1.55, 7.9, 0.18, 1.25, '#a66b41'))
  g.add(createVoxelMesh(2.8, 3.35, 1.9, 0.16, 0.65, 0.16, '#4a2a14'))
  g.add(createVoxelMesh(2.8, 2.88, 1.9, 0.54, 0.62, 0.54, CITY_PALETTE.warmGlow, true))

  // 3. Striped Green & White Sloped Awning + Snow Drift Tips
  const stripeCount = 9
  const stripeW = 9.4 / stripeCount
  for (let s = 0; s < stripeCount; s += 1) {
    const sx = -4.7 + stripeW * (s + 0.5)
    const stripeColor = s % 2 === 0 ? '#15803d' : '#f8fafc'
    g.add(createVoxelMesh(sx, 4.7, -1.2, stripeW * 0.98, 0.55, 2.7, stripeColor))
    g.add(createVoxelMesh(sx, 4.2, 0.65, stripeW * 0.98, 0.55, 2.6, stripeColor))
    g.add(createVoxelMesh(sx, 3.72, 2.25, stripeW * 0.98, 0.48, 1.6, stripeColor))
    // Snow ridges on upper awning slope
    g.add(createVoxelMesh(sx, 5.04, -1.2, stripeW * 0.85, 0.2, 2.3, '#f4f8ff'))
  }
  // Scalloped front eaves + glowing warm string-lights garland across front overhang
  for (let b = 0; b < 7; b += 1) {
    const bx = -3.6 + b * 1.2
    const bulbColor = b % 2 === 0 ? CITY_PALETTE.warmGlow : CITY_PALETTE.warmEmber
    g.add(createVoxelMesh(bx, 3.45, 3.05, 0.28, 0.3, 0.28, bulbColor, true))
  }

  // 4. Prominent Top Framed Wooden Signboard (`COMMIT MARKET`)
  g.add(createVoxelMesh(0, 6.25, 1.65, 5.6, 1.55, 0.42, '#4a2a14'))
  g.add(createVoxelMesh(0, 6.25, 1.88, 5.0, 1.1, 0.14, '#8c5835'))
  // Glowing golden-green market pixel emblem + text bars on sign
  g.add(createVoxelMesh(-1.55, 6.25, 2.0, 0.65, 0.65, 0.12, '#39d353', true))
  g.add(createVoxelMesh(0.45, 6.4, 2.0, 2.7, 0.24, 0.1, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(0.45, 6.02, 2.0, 2.1, 0.22, 0.1, CITY_PALETTE.warmHighlight, true))

  // 5. Three Plump Burlap Sacks in Front + Overflowing Item Crate + Decorative Planter Pot
  const sackSpecs = [
    { ox: -2.4, oz: 2.85, h: 1.3, w: 1.05, top: '#39d353' },
    { ox: -1.15, oz: 2.95, h: 1.45, w: 1.1, top: CITY_PALETTE.warmGlow },
    { ox: 0.1, oz: 2.82, h: 1.22, w: 1.0, top: '#38bdf8' },
  ]
  for (const sk of sackSpecs) {
    g.add(createVoxelMesh(sk.ox, sk.h * 0.5 + 0.1, sk.oz, sk.w, sk.h, sk.w, '#c29b61'))
    g.add(createVoxelMesh(sk.ox, sk.h + 0.14, sk.oz, sk.w * 0.68, 0.24, sk.w * 0.68, '#d6b37c'))
    g.add(createVoxelMesh(sk.ox, sk.h + 0.3, sk.oz, sk.w * 0.48, 0.24, sk.w * 0.48, sk.top, true))
  }
  // Wooden produce crate with festive gifts & ornaments
  g.add(createVoxelMesh(1.85, 0.6, 2.85, 1.55, 0.85, 1.25, '#7c4d2b'))
  g.add(createVoxelMesh(1.5, 1.12, 2.85, 0.5, 0.42, 0.5, '#ef4444'))
  g.add(createVoxelMesh(2.05, 1.16, 2.8, 0.46, 0.46, 0.46, '#38bdf8', true))
  g.add(createVoxelMesh(1.85, 1.1, 3.15, 0.42, 0.36, 0.38, CITY_PALETTE.warmGlow))
  // Decorative planter pot beside front post
  g.add(createVoxelMesh(4.45, 0.5, 2.6, 0.88, 0.8, 0.88, '#9a3412'))
  g.add(createVoxelMesh(4.45, 1.18, 2.6, 0.96, 0.72, 0.96, '#15803d'))
  g.add(createVoxelMesh(4.45, 1.62, 2.6, 0.68, 0.24, 0.68, '#f4f8ff'))

  const marketLight = new THREE.PointLight(0xffbe55, 11, 24, 1.4)
  marketLight.position.set(0, 3.6, 3.0)
  g.add(marketLight)

  pushMagicRing(magicSeedPoints, x, z + 1.2, 1.4, 6.2, 2.2, 5.2, 14, [
    CITY_PALETTE.warmGlow,
    CITY_PALETTE.warmHighlight,
  ])

  root.add(g)
  interactiveProps.push({
    mesh: g,
    dialogue: {
      title: 'Mercadinho do Polo Norte',
      text: 'Sementes estelares, guloseimas e acessórios exclusivos para seus companheiros! Clique abaixo para abrir a loja de pets e presentes.',
      titleEn: 'North Pole Market Stall',
      textEn:
        'Pine seeds, starry crates, and cozy gear for your coding companions! Open the Pet Shop or Gift Catalog right from this stall.',
      action: 'open-shop',
    },
  })
}

function buildPixelMushroomHouse(
  root: THREE.Group,
  x: number,
  z: number,
  capTheme: 'spruce' | 'crimson',
  scale: number,
  rotationY: number,
  dialogueKey: 'bento' | 'cocoa' | 'refuge' | 'cafe',
  smokePuffs: BuiltVoxelWorld['smokePuffs'],
  lampGlows: THREE.Mesh[],
  magicSeedPoints: MagicParticleItem[],
  interactiveProps: InteractivePropHandle[],
): void {
  // Cozy Christmas Winter Mushroom House (~8.6u tall up to crooked chimney, ~6.8u snowy cap)
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotationY
  g.scale.setScalar(scale)

  // Warm amber snow glow apron in front of arched doorway + stone steps
  const porchGlow = createVoxelMesh(0, 0.08, 2.55, 4.6, 0.08, 2.6, CITY_PALETTE.warmGlow, true, 0.3)
  g.add(porchGlow)
  lampGlows.push(porchGlow)

  // Stone foundation plinth + soft snow mounds cradling the house into winter ground + 3 stone steps
  g.add(createVoxelMesh(0, 0.22, 0, 5.2, 0.44, 5.2, '#64749c'))
  g.add(createVoxelMesh(0, 0.48, 0, 4.7, 0.2, 4.7, '#94a3b8'))
  g.add(createVoxelMesh(0, 0.38, 2.5, 2.2, 0.24, 0.72, '#64749c'))
  g.add(createVoxelMesh(0, 0.24, 3.02, 2.4, 0.2, 0.68, '#94a3b8'))
  g.add(createVoxelMesh(0, 0.11, 3.5, 2.6, 0.16, 0.62, '#cbd5e1'))
  addBaseSnowMoundAndRocks(g, -2.55, 1.35, 1.9, 1.8)
  addBaseSnowMoundAndRocks(g, 2.65, 0.95, 1.85, 1.8)
  addBaseSnowMoundAndRocks(g, -1.75, -2.35, 2.0, 1.65)
  addBaseSnowMoundAndRocks(g, 1.85, -2.2, 1.8, 1.6)

  // 1. Rounded Cylindrical Cream-Beige House Body
  g.add(createVoxelMesh(0, 2.25, 0, 4.2, 3.4, 3.25, '#f3e5c8'))
  g.add(createVoxelMesh(0, 2.25, 0, 3.25, 3.4, 4.2, '#f3e5c8'))
  g.add(createVoxelMesh(0, 1.0, 0, 4.45, 0.9, 3.45, '#e6d5b8'))
  g.add(createVoxelMesh(0, 1.0, 0, 3.45, 0.9, 4.45, '#e6d5b8'))

  // 2. Central Arched Door + Holiday Evergreen Wreath with Red Bow
  g.add(createVoxelMesh(0, 1.7, 2.1, 1.65, 2.4, 0.28, '#4a2a14'))
  g.add(createVoxelMesh(0, 2.86, 2.1, 1.25, 0.35, 0.3, '#5c371d'))
  const doorColor = capTheme === 'spruce' ? '#0b3944' : '#7c4d2b'
  g.add(createVoxelMesh(0, 1.65, 2.2, 1.2, 2.15, 0.16, doorColor))
  g.add(createVoxelMesh(0.36, 1.55, 2.3, 0.14, 0.16, 0.08, CITY_PALETTE.warmGlow, true))
  // Mini Christmas wreath + bright crimson ribbon bow on the arched door
  g.add(createVoxelMesh(0, 2.22, 2.32, 0.72, 0.72, 0.14, '#15803d'))
  g.add(createVoxelMesh(0, 2.22, 2.39, 0.26, 0.26, 0.1, '#f3e5c8'))
  g.add(createVoxelMesh(0, 2.52, 2.41, 0.32, 0.18, 0.1, '#ef4444', true))

  // 3. Two Strongly Emissive Warm Amber Arched Side Windows (`#ffbe55`) with `+` Wood Grilles
  for (const side of [-1, 1]) {
    const wx = side * 1.48
    const wz = 1.65
    g.add(createVoxelMesh(wx, 2.15, wz, 0.98, 1.15, 0.24, '#4a2a14'))
    g.add(createVoxelMesh(wx, 2.7, wz, 0.72, 0.26, 0.24, '#5c371d'))
    g.add(createVoxelMesh(wx, 2.15, wz + 0.08, 0.72, 0.88, 0.14, CITY_PALETTE.warmGlow, true))
    g.add(createVoxelMesh(wx, 2.15, wz + 0.16, 0.74, 0.1, 0.08, '#4a2a14'))
    g.add(createVoxelMesh(wx, 2.15, wz + 0.16, 0.1, 0.9, 0.08, '#4a2a14'))
    // Tiny snowy window sill box below window
    g.add(createVoxelMesh(wx, 1.56, wz + 0.1, 0.96, 0.14, 0.28, '#f4f8ff'))
  }
  // Back & side warm glowing windows for 360° camera rotation
  g.add(createVoxelMesh(0, 2.25, -2.14, 0.95, 1.0, 0.2, '#4a2a14'))
  g.add(createVoxelMesh(0, 2.25, -2.22, 0.7, 0.76, 0.12, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(-2.14, 2.25, 0, 0.2, 0.92, 0.92, CITY_PALETTE.warmGlow, true))
  g.add(createVoxelMesh(2.14, 2.25, 0, 0.2, 0.92, 0.92, CITY_PALETTE.warmGlow, true))

  // Holiday Doorstep Ground Details: mini frosted pine, gifts, candy cane, firewood stack & lantern
  addMiniFrostedPine(g, -2.15, 2.3, 0.88)
  addWrappedGiftBox(g, -1.15, 0.2, 2.75, 0.48, '#dc2626', CITY_PALETTE.warmGlow)
  addWrappedGiftBox(g, -1.6, 0.16, 2.55, 0.4, '#2563eb', '#f8fafc')
  addSnowyFirewoodStack(g, 2.35, 1.65)
  // Tiny candy cane beside right step
  g.add(createVoxelMesh(1.38, 0.46, 3.05, 0.18, 0.76, 0.18, '#dc2626'))
  g.add(createVoxelMesh(1.38, 0.92, 3.05, 0.18, 0.24, 0.18, '#f8fafc'))
  g.add(createVoxelMesh(1.52, 0.98, 3.05, 0.24, 0.18, 0.18, '#dc2626'))
  // Mini wooden lantern post by front step
  g.add(createVoxelMesh(1.9, 0.95, 2.5, 0.18, 1.35, 0.18, '#4a2a14'))
  g.add(createVoxelMesh(1.9, 1.56, 2.5, 0.42, 0.2, 0.22, '#5c371d'))
  g.add(createVoxelMesh(1.9, 1.24, 2.7, 0.34, 0.4, 0.34, CITY_PALETTE.warmGlow, true))

  // 4. Broad Rounded Winter Mushroom Cap Roof (Deep Holiday Crimson OR Arctic Winter Spruce!)
  const capPalette =
    capTheme === 'spruce'
      ? { base: '#06242c', mid: '#0b3944', top: '#134e5c' }
      : { base: '#7f1d1d', mid: '#991b1b', top: '#b91c1c' }

  // Pale underside gills framing roof overhang
  g.add(createVoxelMesh(0, 3.92, 0, 5.7, 0.32, 5.1, '#d6c3a3'))
  g.add(createVoxelMesh(0, 3.92, 0, 5.1, 0.32, 5.7, '#d6c3a3'))
  // Stepped rounded dome layers
  g.add(createVoxelMesh(0, 4.48, 0, 6.6, 0.95, 5.6, capPalette.base))
  g.add(createVoxelMesh(0, 4.48, 0, 5.6, 0.95, 6.6, capPalette.base))
  g.add(createVoxelMesh(0, 5.38, 0, 5.8, 0.9, 4.8, capPalette.mid))
  g.add(createVoxelMesh(0, 5.38, 0, 4.8, 0.9, 5.8, capPalette.mid))
  g.add(createVoxelMesh(0, 6.2, 0, 4.4, 0.8, 3.7, capPalette.top))
  g.add(createVoxelMesh(0, 6.2, 0, 3.7, 0.8, 4.4, capPalette.top))
  g.add(createVoxelMesh(0, 6.82, 0, 2.7, 0.55, 2.7, capPalette.top))

  // Thick layered snow blanket across top + rim + gleaming icy icicles dangling around cap eaves!
  g.add(createVoxelMesh(0, 7.18, 0, 2.55, 0.3, 2.45, '#f4f8ff'))
  g.add(createVoxelMesh(1.4, 6.5, -0.75, 1.85, 0.28, 1.75, '#f4f8ff'))
  g.add(createVoxelMesh(-1.55, 5.95, 1.15, 1.75, 0.26, 1.55, '#e1ecfe'))
  g.add(createVoxelMesh(-2.65, 5.02, 0.25, 1.35, 0.24, 3.6, '#f4f8ff'))
  g.add(createVoxelMesh(2.65, 5.02, -0.15, 1.35, 0.24, 3.6, '#f4f8ff'))
  g.add(createVoxelMesh(0, 5.02, 2.5, 4.2, 0.24, 1.25, '#f4f8ff'))
  g.add(createVoxelMesh(0, 5.02, -2.5, 4.2, 0.24, 1.25, '#e1ecfe'))

  // Sparkling ice icicles & festive fairy string lights looping all around the cap eaves!
  const eaveNodes = [
    { x: -2.9, z: 1.9 },
    { x: -1.65, z: 2.95 },
    { x: 0.0, z: 3.15 },
    { x: 1.65, z: 2.95 },
    { x: 2.9, z: 1.9 },
    { x: 3.15, z: 0.0 },
    { x: 2.85, z: -1.9 },
    { x: 1.5, z: -2.95 },
    { x: 0.0, z: -3.15 },
    { x: -1.65, z: -2.95 },
    { x: -2.9, z: -1.85 },
    { x: -3.15, z: 0.0 },
  ]
  eaveNodes.forEach((node, idx) => {
    const bulbColor = idx % 2 === 0 ? CITY_PALETTE.warmGlow : '#ef4444'
    g.add(createVoxelMesh(node.x, 4.18, node.z, 0.26, 0.26, 0.26, bulbColor, true))
    const icicleLen = idx % 2 === 0 ? 0.56 : 0.38
    g.add(
      createVoxelMesh(
        node.x * 0.96,
        3.92 - icicleLen * 0.5,
        node.z * 0.96,
        0.16,
        icicleLen,
        0.16,
        '#bae6fd',
        true,
        0.86,
      ),
    )
  })

  // Large Cream / Snow-Contrast Spots around Dome Cap
  const capSpots = [
    { ox: -2.25, oy: 4.55, oz: 2.35, s: 0.72 },
    { ox: 2.1, oy: 4.65, oz: 2.35, s: 0.68 },
    { ox: -0.25, oy: 5.55, oz: 2.85, s: 0.76 },
    { ox: 2.85, oy: 5.35, oz: -0.45, s: 0.66 },
    { ox: -2.85, oy: 5.4, oz: -0.8, s: 0.7 },
    { ox: 1.65, oy: 4.58, oz: -2.45, s: 0.72 },
    { ox: -1.4, oy: 6.25, oz: -1.65, s: 0.6 },
    { ox: 1.15, oy: 6.35, oz: 1.45, s: 0.58 },
  ]
  for (const sp of capSpots) {
    g.add(createVoxelMesh(sp.ox, sp.oy, sp.oz, sp.s, sp.s * 0.72, sp.s, '#fef3c7'))
  }

  // 5. Crooked Cozy Stone Chimney ("chaminé tortinha") with Winter Pine Garlands & Rising Smoke
  const chimneyGroup = new THREE.Group()
  chimneyGroup.position.set(1.55, 5.7, -0.85)
  chimneyGroup.rotation.z = -0.14
  chimneyGroup.add(createVoxelMesh(0, 0.8, 0, 1.05, 1.7, 1.05, '#8598bf'))
  chimneyGroup.add(createVoxelMesh(0.12, 1.75, 0, 0.92, 0.75, 0.92, '#a8a29e'))
  chimneyGroup.add(createVoxelMesh(0.16, 2.22, 0, 1.15, 0.24, 1.15, '#d6cfc2'))
  chimneyGroup.add(createVoxelMesh(0.16, 2.38, 0, 0.98, 0.14, 0.98, '#f4f8ff'))
  // Frosted pine garland & winter berries wrapped cleanly along chimney side
  chimneyGroup.add(createVoxelMesh(-0.52, 0.7, 0.25, 0.22, 0.95, 0.35, CITY_PALETTE.pineMid))
  chimneyGroup.add(createVoxelMesh(-0.46, 1.35, -0.2, 0.22, 0.65, 0.35, CITY_PALETTE.pineBright))
  chimneyGroup.add(createVoxelMesh(-0.56, 1.05, 0.28, 0.14, 0.14, 0.14, '#ef4444', true))
  g.add(chimneyGroup)

  for (let p = 0; p < 3; p += 1) {
    const smoke = createVoxelMesh(1.85, 8.25 + p * 0.7, -0.85, 0.48, 0.42, 0.48, '#e2e8f0', false, 0.5)
    g.add(smoke)
    smokePuffs.push({ mesh: smoke, baseY: 8.15, phase: rotationY + p * 1.15 })
  }

  pushMagicRing(magicSeedPoints, x, z, 1.2, 6.8 * scale, 2.6, 4.8, 7, [
    CITY_PALETTE.warmGlow,
    CITY_PALETTE.warmHighlight,
    '#7dd3fc',
  ])

  root.add(g)

  const dialogues: Record<typeof dialogueKey, VillagePropDialogue> = {
    bento: {
      title: 'Casa Cogumelo do Sapinho Bento',
      text: 'Entre as paredes quentinhas deste cogumelo pinho de inverno mora o sapinho Bento — preparando chocolate quente entre feitiços e `git rebase`!',
      titleEn: "Bento the Frog's Holiday Mushroom Cottage",
      textEn:
        'Bento the apprentice frog lives inside this frosted pine mushroom cottage, sipping hot cocoa between winter spells and clean `git rebase` runs!',
    },
    cocoa: {
      title: 'Casa Cogumelo de Chocolate Quente',
      text: 'Os duendes devs preparam canecas infinitas de chocolate quente nesta casinha natalina perto da Casa na Árvore do Papai Noel.',
      titleEn: 'Elves Hot Cocoa Mushroom House',
      textEn:
        'Dev elves simmer endless mugs of spiced hot cocoa inside this crimson-capped Christmas mushroom home near Santa’s Treehouse!',
    },
    refuge: {
      title: 'Refúgio Cogumelo da Floresta Oeste',
      text: 'Um refúgio natalino iluminado por pisca-piscas e janelinhas âmbar quentes para descansar depois de commits de madrugada.',
      titleEn: 'Western Woods Christmas Refuge',
      textEn:
        'A warm holiday mushroom cottage trimmed with string lights and amber windows—perfect for resting after midnight commits.',
    },
    cafe: {
      title: 'Chalé Cogumelo do Café & Código',
      text: 'Aqui a chaminé nunca para de soltar fumaça enquanto os pinheiros do sul acendem novas bolinhas verdes do GitHub.',
      titleEn: 'Coffee & Code Mushroom Cottage',
      textEn:
        'Smoke drifts lazily from the crooked chimney while southern pines light up with fresh GitHub green baubles.',
    },
  }
  interactiveProps.push({ mesh: g, dialogue: dialogues[dialogueKey] })
}

function buildNorthPoleDecorations(
  root: THREE.Group,
  interactiveProps: InteractivePropHandle[],
  smokePuffs: BuiltVoxelWorld['smokePuffs'],
  lampGlows: THREE.Mesh[],
  magicSeedPoints: MagicParticleItem[],
): void {
  const dialogueByType: Record<
    'north-pole' | 'caretaker' | 'signpost' | 'snowman' | 'sleigh' | 'igloo',
    VillagePropDialogue
  > = {
    'north-pole': {
      title: 'Marco do Polo Norte',
      text: 'Bem-vindo ao Polo Norte dos Commits! Ao redor deste marco crescem árvores iluminadas pelas contribuições reais do GitHub.',
      titleEn: 'North Pole Landmark',
      textEn:
        'Welcome to North Pole Commit City! Every pine around this monument glows with real GitHub commit activity.',
    },
    caretaker: {
      title: 'Duende Guardião',
      text: 'Cada bolinha verde segue a paleta oficial do GitHub — quanto mais intenso o dia de commits, mais forte o brilho!',
      titleEn: 'Guardian Elf',
      textEn:
        'Each green bauble follows the official GitHub contribution palette—brighter commits shine stronger at night!',
    },
    signpost: {
      title: 'Placa da Trilha Polar',
      text: 'Casa na Árvore do Papai Noel a nordeste · Mercadinho ao norte da praça · Torre de Cristal na margem oeste do rio.',
      titleEn: 'Polar Trail Signpost',
      textEn:
        "Santa's Treehouse to the northeast · Market Stall north of the plaza · Crystal Tower overlooking the western pond.",
    },
    snowman: {
      title: 'Boneco de Neve Polar',
      text: 'Explore os agrupamentos da floresta e clique em qualquer pinheiro para ver o calendário de commits!',
      titleEn: 'North Pole Snowman',
      textEn: 'Explore the snowy pine clusters and click any tree to inspect its GitHub commit graph!',
    },
    sleigh: {
      title: 'Trenó do Papai Noel',
      text: 'Pronto para a entrega de Natal com as renas! Os presentes na árvore representam mimos da comunidade.',
      titleEn: "Santa's Sleigh",
      textEn: 'Packed and ready for takeoff with the reindeer! Gifts under trees celebrate community support.',
    },
    igloo: {
      title: 'Iglu do Lago Congelado',
      text: 'Um abrigo quentinho feito de blocos de gelo na margem do lago congelado.',
      titleEn: 'Frozen Pond Igloo',
      textEn: 'A warm glowing ice-block shelter tucked beside the frozen lake.',
    },
  }

  let houseIdx = 0

  VILLAGE_DECORATIONS.forEach((deco, idx) => {
    const { x, z } = gridToWorld(deco.gridX, deco.gridY)

    if (deco.type === 'market-stall') {
      buildNorthPoleMarket(root, x, z, lampGlows, magicSeedPoints, interactiveProps)
      return
    }

    if (deco.type === 'mushroom-house') {
      const cfg =
        NORTH_POLE_LANDMARKS.mushroomHouses[houseIdx] ??
        NORTH_POLE_LANDMARKS.mushroomHouses[0]
      houseIdx += 1
      buildPixelMushroomHouse(
        root,
        x,
        z,
        cfg.capTheme,
        cfg.scale,
        cfg.rotationY,
        cfg.dialogueKey,
        smokePuffs,
        lampGlows,
        magicSeedPoints,
        interactiveProps,
      )
      return
    }

    if (deco.type === 'north-pole') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      // Stepped snowy wood & stone plinth
      g.add(createVoxelMesh(0, 0.2, 0, 2.3, 0.4, 2.3, '#7c5334'))
      g.add(createVoxelMesh(0, 0.48, 0, 1.75, 0.22, 1.75, '#f4f8ff'))
      // Red & white striped North Pole column
      for (let s = 0; s < 8; s += 1) {
        const stripeColor = s % 2 === 0 ? '#dc2626' : '#f8fafc'
        g.add(createVoxelMesh(0, 0.8 + s * 0.44, 0, 0.56, 0.44, 0.56, stripeColor))
      }
      // Wooden directional arms
      g.add(createVoxelMesh(0.7, 3.45, 0, 1.3, 0.28, 0.18, '#8c5835'))
      g.add(createVoxelMesh(-0.65, 2.95, 0, 1.2, 0.28, 0.18, '#7c4d2b'))
      // Glowing golden North Pole sphere/star finial
      g.add(createVoxelMesh(0, 4.45, 0, 0.82, 0.82, 0.82, CITY_PALETTE.warmGlow, true))
      g.add(createVoxelMesh(0, 4.45, 0, 1.15, 0.26, 0.26, '#fffbeb', true))
      g.add(createVoxelMesh(0, 4.45, 0, 0.26, 1.15, 0.26, '#fffbeb', true))

      const poleGlow = createVoxelMesh(0, 0.08, 0, 4.2, 0.08, 4.2, CITY_PALETTE.warmGlow, true, 0.24)
      g.add(poleGlow)
      lampGlows.push(poleGlow)

      const poleLight = new THREE.PointLight(0xffbe55, 10, 22, 1.45)
      poleLight.position.set(0, 4.2, 0)
      g.add(poleLight)

      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType['north-pole'] })
      return
    }

    if (deco.type === 'lamp') {
      // Rustic wooden lantern post with mini holiday wreath & hanging warm amber lantern
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 1.35, 0, 0.3, 2.7, 0.3, '#6b4226'))
      g.add(createVoxelMesh(0.32, 2.55, 0, 0.85, 0.22, 0.24, '#7c4d2b'))
      g.add(createVoxelMesh(0, 2.78, 0, 0.42, 0.14, 0.42, '#f4f8ff'))
      g.add(createVoxelMesh(0.56, 2.18, 0, 0.48, 0.56, 0.48, CITY_PALETTE.warmGlow, true))
      g.add(createVoxelMesh(0.56, 2.5, 0, 0.62, 0.14, 0.62, '#4a2a14'))
      // Mini holiday wreath with glowing red berry on post
      g.add(createVoxelMesh(0, 1.72, 0.18, 0.48, 0.48, 0.12, '#15803d'))
      g.add(createVoxelMesh(0, 1.72, 0.24, 0.18, 0.18, 0.08, '#ef4444', true))

      const glowPad = createVoxelMesh(0.4, 0.08, 0, 3.0, 0.08, 3.0, CITY_PALETTE.warmGlow, true, 0.22)
      g.add(glowPad)
      lampGlows.push(glowPad)

      if (idx < 6) {
        const light = new THREE.PointLight(0xffbe55, 8.5, 18, 1.55)
        light.position.set(0.56, 2.25, 0)
        g.add(light)
      }

      root.add(g)
      return
    }

    if (deco.type === 'campfire') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.18, 0, 1.35, 0.36, 1.35, '#64749c'))
      g.add(createVoxelMesh(0, 0.36, 0, 0.9, 0.22, 0.9, '#5c371d'))
      g.add(createVoxelMesh(0, 0.6, 0, 0.58, 0.5, 0.58, CITY_PALETTE.warmEmber, true))
      g.add(createVoxelMesh(0, 0.88, 0, 0.32, 0.38, 0.32, CITY_PALETTE.warmGlow, true))

      const fireGlow = createVoxelMesh(0, 0.08, 0, 3.2, 0.08, 3.2, CITY_PALETTE.warmEmber, true, 0.26)
      g.add(fireGlow)
      lampGlows.push(fireGlow)

      const fireLight = new THREE.PointLight(0xff9b3d, 8.5, 17, 1.5)
      fireLight.position.set(0, 1.4, 0)
      g.add(fireLight)

      root.add(g)
      return
    }

    if (deco.type === 'sleigh') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = 0.35
      // Golden curved runners
      g.add(createVoxelMesh(-0.75, 0.16, 0, 0.14, 0.18, 2.7, '#fbbf24'))
      g.add(createVoxelMesh(0.75, 0.16, 0, 0.14, 0.18, 2.7, '#fbbf24'))
      g.add(createVoxelMesh(-0.75, 0.36, 1.28, 0.14, 0.32, 0.22, '#fbbf24'))
      g.add(createVoxelMesh(0.75, 0.36, 1.28, 0.14, 0.32, 0.22, '#fbbf24'))
      // Crimson sleigh cabin & gold trim
      g.add(createVoxelMesh(0, 0.56, -0.1, 1.56, 0.62, 2.2, '#dc2626'))
      g.add(createVoxelMesh(0, 1.0, -0.95, 1.56, 0.65, 0.35, '#b91c1c'))
      g.add(createVoxelMesh(0, 0.88, 0.4, 1.35, 0.18, 0.7, '#7c4d2b'))
      // Gifts piled inside the sleigh
      g.add(createVoxelMesh(-0.32, 1.05, -0.35, 0.56, 0.52, 0.56, '#22c55e'))
      g.add(createVoxelMesh(0.32, 1.02, -0.4, 0.52, 0.46, 0.52, '#38bdf8'))
      g.add(createVoxelMesh(0.02, 1.28, -0.55, 0.44, 0.42, 0.44, '#fde047'))

      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.sleigh })
      return
    }

    if (deco.type === 'igloo') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = deco.gridX < 6 + VILLAGE_OFFSET_X ? 0.55 : -0.75
      // Stepped ice dome
      g.add(createVoxelMesh(0, 0.45, 0, 2.8, 0.9, 2.8, '#e2efff'))
      g.add(createVoxelMesh(0, 1.1, 0, 2.2, 0.55, 2.2, '#f4f8ff'))
      g.add(createVoxelMesh(0, 1.55, 0, 1.45, 0.45, 1.45, '#bae6fd'))
      g.add(createVoxelMesh(0, 1.88, 0, 0.78, 0.28, 0.78, '#f4f8ff'))
      // Entrance tunnel & cozy warm interior glow
      g.add(createVoxelMesh(0, 0.52, 1.48, 1.05, 0.95, 0.85, '#dbeafe'))
      g.add(createVoxelMesh(0, 0.38, 1.88, 0.58, 0.62, 0.16, CITY_PALETTE.warmGlow, true))

      const iglooGlow = createVoxelMesh(0, 0.08, 2.2, 1.6, 0.08, 1.2, CITY_PALETTE.warmGlow, true, 0.22)
      g.add(iglooGlow)
      lampGlows.push(iglooGlow)

      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.igloo })
      return
    }

    if (deco.type === 'candy-cane') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      for (let s = 0; s < 5; s += 1) {
        g.add(createVoxelMesh(0, 0.22 + s * 0.4, 0, 0.28, 0.4, 0.28, s % 2 === 0 ? '#dc2626' : '#f8fafc'))
      }
      // Curved candy cane hook
      g.add(createVoxelMesh(0.24, 2.15, 0, 0.34, 0.28, 0.28, '#f8fafc'))
      g.add(createVoxelMesh(0.48, 1.95, 0, 0.26, 0.32, 0.26, '#dc2626'))
      root.add(g)
      return
    }

    if (deco.type === 'snowman') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.45, 0, 1.15, 0.9, 1.15, '#f4f8ff'))
      g.add(createVoxelMesh(0, 1.2, 0, 0.85, 0.72, 0.85, '#e2e8f0'))
      g.add(createVoxelMesh(0, 1.6, 0, 0.92, 0.18, 0.92, '#ef4444'))
      g.add(createVoxelMesh(0, 1.9, 0, 0.65, 0.58, 0.65, '#f4f8ff'))
      g.add(createVoxelMesh(0, 1.9, 0.38, 0.14, 0.14, 0.3, '#f97316'))
      g.add(createVoxelMesh(0, 2.35, 0, 0.74, 0.38, 0.74, '#1e293b'))
      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.snowman })
      return
    }

    if (deco.type === 'signpost') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.9, 0, 0.3, 1.8, 0.3, '#6b4226'))
      g.add(createVoxelMesh(0, 1.55, 0, 1.5, 0.52, 0.24, '#9c6644'))
      g.add(createVoxelMesh(0, 1.55, 0.14, 1.0, 0.18, 0.08, CITY_PALETTE.warmGlow, true))
      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.signpost })
      return
    }

    if (deco.type === 'caretaker') {
      // Cozy Santa's helper elf in red & forest green tunic
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.55, 0, 0.72, 1.1, 0.62, '#15803d'))
      g.add(createVoxelMesh(0, 1.32, 0, 0.6, 0.55, 0.6, '#fed7aa'))
      g.add(createVoxelMesh(0, 1.75, 0, 0.76, 0.24, 0.76, '#f4f8ff'))
      g.add(createVoxelMesh(0, 2.1, 0, 0.48, 0.55, 0.48, '#dc2626'))
      g.add(createVoxelMesh(0.65, 1.0, 0.1, 0.16, 2.0, 0.16, '#7c4d2b'))
      g.add(createVoxelMesh(0.65, 2.1, 0.1, 0.26, 0.26, 0.26, '#fde047', true))
      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.caretaker })
      return
    }

    if (deco.type === 'gift-pile') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(-0.4, 0.4, 0.15, 0.8, 0.8, 0.8, '#dc2626'))
      g.add(createVoxelMesh(-0.4, 0.42, 0.15, 0.84, 0.2, 0.22, '#fbbf24'))
      g.add(createVoxelMesh(0.45, 0.32, -0.1, 0.65, 0.64, 0.65, '#2563eb'))
      g.add(createVoxelMesh(0.45, 0.34, -0.1, 0.68, 0.18, 0.18, '#f8fafc'))
      root.add(g)
    }
  })
}

function buildFootprintTrails(root: THREE.Group): void {
  const spots = [
    { gx: 6.2 + VILLAGE_OFFSET_X, gy: 23 + VILLAGE_OFFSET_Y },
    { gx: 6.6 + VILLAGE_OFFSET_X, gy: 24 + VILLAGE_OFFSET_Y },
    { gx: 7.0 + VILLAGE_OFFSET_X, gy: 25 + VILLAGE_OFFSET_Y },
    { gx: 7.3 + VILLAGE_OFFSET_X, gy: 26 + VILLAGE_OFFSET_Y },
    { gx: 19 + VILLAGE_OFFSET_X, gy: 12.2 + VILLAGE_OFFSET_Y },
    { gx: 20 + VILLAGE_OFFSET_X, gy: 12.6 + VILLAGE_OFFSET_Y },
    { gx: 21 + VILLAGE_OFFSET_X, gy: 13.0 + VILLAGE_OFFSET_Y },
    { gx: 28 + VILLAGE_OFFSET_X, gy: 15.8 + VILLAGE_OFFSET_Y },
    { gx: 27.2 + VILLAGE_OFFSET_X, gy: 16.4 + VILLAGE_OFFSET_Y },
  ]
  const steps: BoxInstance[] = []
  for (let i = 0; i < spots.length; i += 1) {
    const p = gridToWorld(spots[i].gx, spots[i].gy)
    steps.push({ x: p.x - 0.25, y: 0.08, z: p.z, sx: 0.18, sy: 0.04, sz: 0.28 })
    steps.push({ x: p.x + 0.22, y: 0.08, z: p.z + 0.2, sx: 0.18, sy: 0.04, sz: 0.28 })
  }
  addInstancedBucket(root, steps, CITY_PALETTE.snowIndigo)
}

function buildLivingWildlife(root: THREE.Group, wildlife: WildlifeActor[]): void {
  const reindeerSpots = [
    { gx: 19.8 + VILLAGE_OFFSET_X, gy: 11.2 + VILLAGE_OFFSET_Y, rx: 2.2, rz: 1.6, speed: 0.44 }, // Near Santa's sleigh
    { gx: 15.5 + VILLAGE_OFFSET_X, gy: 9.5 + VILLAGE_OFFSET_Y, rx: 3.4, rz: 2.2, speed: 0.4 },
    { gx: 36.5 + VILLAGE_OFFSET_X, gy: 9.2 + VILLAGE_OFFSET_Y, rx: 3.2, rz: 2.4, speed: 0.36 },
    { gx: 15 + VILLAGE_OFFSET_X, gy: 29 + VILLAGE_OFFSET_Y, rx: 2.8, rz: 2.2, speed: 0.38 },
    { gx: 36 + VILLAGE_OFFSET_X, gy: 22 + VILLAGE_OFFSET_Y, rx: 3.4, rz: 2.4, speed: 0.42 },
  ]
  reindeerSpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.65, 0, 0.55, 0.52, 1.05, '#8c5835'))
    g.add(createVoxelMesh(-0.18, 0.22, 0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0.18, 0.22, 0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(-0.18, 0.22, -0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0.18, 0.22, -0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0, 1.02, 0.42, 0.32, 0.48, 0.32, '#9c6644'))
    g.add(createVoxelMesh(0, 1.25, 0.56, 0.34, 0.3, 0.44, '#b07a57'))
    g.add(createVoxelMesh(0, 1.24, 0.8, 0.14, 0.14, 0.14, idx === 0 ? '#ef4444' : '#1e293b', idx === 0))
    g.add(createVoxelMesh(-0.22, 1.56, 0.46, 0.1, 0.42, 0.1, '#e6c9a2'))
    g.add(createVoxelMesh(0.22, 1.56, 0.46, 0.1, 0.42, 0.1, '#e6c9a2'))
    g.position.set(p.x, 0, p.z)
    root.add(g)
    wildlife.push({
      mesh: g,
      kind: 'reindeer',
      centerX: p.x,
      centerZ: p.z,
      radiusX: s.rx,
      radiusZ: s.rz,
      speed: s.speed,
      phase: idx * 1.7,
    })
  })

  const foxSpots = [
    { gx: 8 + VILLAGE_OFFSET_X, gy: 13 + VILLAGE_OFFSET_Y },
    { gx: 26 + VILLAGE_OFFSET_X, gy: 8 + VILLAGE_OFFSET_Y },
    { gx: 33 + VILLAGE_OFFSET_X, gy: 28 + VILLAGE_OFFSET_Y },
    { gx: 18 + VILLAGE_OFFSET_X, gy: 31 + VILLAGE_OFFSET_Y },
  ]
  foxSpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.32, 0, 0.36, 0.32, 0.65, '#ea580c'))
    g.add(createVoxelMesh(0, 0.48, 0.36, 0.32, 0.28, 0.32, '#f97316'))
    g.add(createVoxelMesh(0, 0.36, -0.45, 0.2, 0.2, 0.36, '#f8fafc'))
    g.position.set(p.x, 0, p.z)
    root.add(g)
    wildlife.push({
      mesh: g,
      kind: 'fox',
      centerX: p.x,
      centerZ: p.z,
      radiusX: 2.4,
      radiusZ: 1.8,
      speed: 0.72,
      phase: idx * 2.1,
    })
  })

  const bunnySpots = [
    { gx: 9 + VILLAGE_OFFSET_X, gy: 23 + VILLAGE_OFFSET_Y },
    { gx: 21 + VILLAGE_OFFSET_X, gy: 15 + VILLAGE_OFFSET_Y },
    { gx: 27 + VILLAGE_OFFSET_X, gy: 19 + VILLAGE_OFFSET_Y },
    { gx: 37 + VILLAGE_OFFSET_X, gy: 15 + VILLAGE_OFFSET_Y },
    { gx: 13 + VILLAGE_OFFSET_X, gy: 8 + VILLAGE_OFFSET_Y },
  ]
  bunnySpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.22, 0, 0.28, 0.26, 0.36, '#ffffff'))
    g.add(createVoxelMesh(-0.08, 0.44, 0.1, 0.08, 0.22, 0.08, '#fbcfe8'))
    g.add(createVoxelMesh(0.08, 0.44, 0.1, 0.08, 0.22, 0.08, '#fbcfe8'))
    g.position.set(p.x, 0, p.z)
    root.add(g)
    wildlife.push({
      mesh: g,
      kind: 'bunny',
      centerX: p.x,
      centerZ: p.z,
      radiusX: 1.4,
      radiusZ: 1.4,
      speed: 1.1,
      phase: idx * 1.4,
    })
  })

  const fishSpots = [
    { gx: 5.5 + VILLAGE_OFFSET_X, gy: 28.5 + VILLAGE_OFFSET_Y, rx: 1.8, rz: 1.2 },
    { gx: 6.2 + VILLAGE_OFFSET_X, gy: 29.8 + VILLAGE_OFFSET_Y, rx: 1.5, rz: 1.0 },
    { gx: 11.5 + VILLAGE_OFFSET_X, gy: 12 + VILLAGE_OFFSET_Y, rx: 0.8, rz: 2.0 },
    { gx: 11.2 + VILLAGE_OFFSET_X, gy: 20 + VILLAGE_OFFSET_Y, rx: 0.8, rz: 2.0 },
    { gx: 19 + VILLAGE_OFFSET_X, gy: 24 + VILLAGE_OFFSET_Y, rx: 2.2, rz: 0.7 },
    { gx: 29 + VILLAGE_OFFSET_X, gy: 24 + VILLAGE_OFFSET_Y, rx: 2.2, rz: 0.7 },
  ]
  fishSpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    const color = idx % 2 === 0 ? '#fb923c' : '#e0f2fe'
    g.add(createVoxelMesh(0, -0.25, 0, 0.22, 0.14, 0.46, color, true))
    g.add(createVoxelMesh(0, -0.25, -0.28, 0.14, 0.18, 0.14, '#fef08a', true))
    g.position.set(p.x, 0, p.z)
    root.add(g)
    wildlife.push({
      mesh: g,
      kind: 'fish',
      centerX: p.x,
      centerZ: p.z,
      radiusX: s.rx,
      radiusZ: s.rz,
      speed: 0.9,
      phase: idx * 1.3,
    })
  })
}

function buildDistantScenicTree(root: THREE.Group): void {
  const pos = gridToWorld(CITY_MAP_CONFIG.cols - 3.5, CITY_MAP_CONFIG.skyRows + 1.0)
  const scenic = buildVoxelChristmasTree({
    level: 6,
    seed: 777,
    isScenicLandmark: true,
    contributionCount: 950,
  })
  scenic.group.position.set(pos.x, 0.8, pos.z)
  root.add(scenic.group)
}

function buildSnowSystem(root: THREE.Group): {
  snowParticles: THREE.InstancedMesh
  snowData: Array<{ x: number; y: number; z: number; speed: number; drift: number; size: number }>
} {
  const count = 560
  const geom = getUnitBoxGeometry()
  const mat = getEmissiveMaterial('#f4f8ff', 0.88)
  const snowParticles = new THREE.InstancedMesh(geom, mat, count)
  const snowData: Array<{
    x: number
    y: number
    z: number
    speed: number
    drift: number
    size: number
  }> = []
  const dummy = new THREE.Object3D()

  for (let i = 0; i < count; i += 1) {
    const x = ((i * 73) % 212) - 106
    const y = (i % 38) + 1
    const z = ((i * 131) % 160) - 80
    const speedLayer = i % 3
    const speed = speedLayer === 0 ? 1.5 : speedLayer === 1 ? 2.6 : 3.9
    const size = speedLayer === 0 ? 0.16 : speedLayer === 1 ? 0.22 : 0.28
    snowData.push({
      x,
      y,
      z,
      speed,
      drift: (i % 7) * 0.4,
      size,
    })
    dummy.position.set(x, y, z)
    dummy.scale.set(size, size, size)
    dummy.updateMatrix()
    snowParticles.setMatrixAt(i, dummy.matrix)
  }
  snowParticles.instanceMatrix.needsUpdate = true
  root.add(snowParticles)

  return { snowParticles, snowData }
}

function buildMagicParticleSystem(
  root: THREE.Group,
  magicSeedPoints: MagicParticleItem[],
): {
  magicParticles: THREE.InstancedMesh
  magicParticleData: MagicParticleItem[]
} {
  const geom = getUnitBoxGeometry()
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const count = Math.max(1, magicSeedPoints.length)
  const magicParticles = new THREE.InstancedMesh(geom, mat, count)
  const dummy = new THREE.Object3D()
  const c = new THREE.Color()

  for (let i = 0; i < magicSeedPoints.length; i += 1) {
    const p = magicSeedPoints[i]
    dummy.position.set(p.centerX + p.radius, p.baseY, p.centerZ)
    dummy.scale.set(p.size, p.size, p.size)
    dummy.updateMatrix()
    magicParticles.setMatrixAt(i, dummy.matrix)
    c.set(p.color)
    magicParticles.setColorAt(i, c)
  }

  magicParticles.instanceMatrix.needsUpdate = true
  if (magicParticles.instanceColor) magicParticles.instanceColor.needsUpdate = true
  root.add(magicParticles)

  return {
    magicParticles,
    magicParticleData: magicSeedPoints,
  }
}
