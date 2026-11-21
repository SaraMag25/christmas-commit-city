import * as THREE from 'three'
import { CITY_MAP_CONFIG } from '../../config/cityMapConfig'
import type { VillagePropDialogue } from '../../types/city'
import {
  CURATED_TREE_PLOTS,
  isBridgeTile,
  isFrozenPondTile,
  isPierTile,
  isPlazaTile,
  isRiverTile,
  isRoadTile,
  VILLAGE_COTTAGES,
  VILLAGE_DECORATIONS,
} from '../layout/treePlacement'
import { createVoxelMesh, getUnitBoxGeometry, getVoxelMaterial } from './voxelMaterials'
import { buildVoxelChristmasTree } from './voxelTreeBuilder'

export const TILE_WORLD = 3.2

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

export interface BuiltVoxelWorld {
  root: THREE.Group
  interactiveProps: InteractivePropHandle[]
  lampGlows: THREE.Mesh[]
  snowParticles: THREE.InstancedMesh
  snowData: Array<{ x: number; y: number; z: number; speed: number; drift: number; size: number }>
  smokePuffs: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>
  auroraBars: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>
  wisps: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }>
  riverRipples: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number; isWaterfall?: boolean }>
  wildlife: WildlifeActor[]
}

export function gridToWorld(gridX: number, gridY: number): { x: number; z: number } {
  const { cols, rows } = CITY_MAP_CONFIG
  return {
    x: (gridX - cols / 2 + 0.5) * TILE_WORLD,
    z: (gridY - rows / 2 + 0.5) * TILE_WORLD,
  }
}

function isReservedArea(x: number, y: number): boolean {
  if (
    isRiverTile(x, y) ||
    isBridgeTile(x, y) ||
    isRoadTile(x, y) ||
    isPlazaTile(x, y) ||
    isFrozenPondTile(x, y) ||
    isPierTile(x, y)
  ) {
    return true
  }
  for (const c of VILLAGE_COTTAGES) {
    if (Math.abs(x - (c.gridX + 1)) <= 2 && Math.abs(y - (c.gridY + 1)) <= 2) return true
  }
  for (const d of VILLAGE_DECORATIONS) {
    if (Math.abs(x - d.gridX) <= 1 && Math.abs(y - d.gridY) <= 1) return true
  }
  for (const p of CURATED_TREE_PLOTS) {
    if (Math.abs(x - p.gridX) <= 1 && Math.abs(y - p.gridY) <= 1) return true
  }
  return false
}

export function buildVoxelWorld(): BuiltVoxelWorld {
  const root = new THREE.Group()
  const interactiveProps: InteractivePropHandle[] = []
  const lampGlows: THREE.Mesh[] = []
  const smokePuffs: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = []
  const auroraBars: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = []
  const wisps: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }> = []
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
  buildShireAndElvenBuildings(root, smokePuffs)
  buildDecorations(root, interactiveProps, lampGlows)
  buildFootprintTrails(root)
  buildLivingWildlife(root, wildlife)
  buildDistantScenicTree(root)

  const { snowParticles, snowData } = buildSnowSystem(root)

  return {
    root,
    interactiveProps,
    lampGlows,
    snowParticles,
    snowData,
    smokePuffs,
    auroraBars,
    wisps,
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

  const buckets: Record<string, Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }>> = {
    forestMossA: [],
    forestMossB: [],
    snowPatch: [],
    riverBank: [],
    trailStone: [],
    riverWater: [],
    riverBed: [],
    pondIce: [],
    pier: [],
    bridgeStone: [],
    earthBase: [],
  }

  for (let gy = skyRows - pad; gy < rows + pad; gy += 1) {
    for (let gx = -pad; gx < cols + pad; gx += 1) {
      const { x, z } = gridToWorld(gx, gy)
      const inBounds = gx >= 0 && gx < cols && gy >= skyRows && gy < rows

      if (inBounds && isBridgeTile(gx, gy)) {
        // Flowing water beneath the stone arch + arched stone bridge deck above
        buckets.riverBed.push({ x, y: -0.78, z, sx: TILE_WORLD, sy: 0.4, sz: TILE_WORLD })
        buckets.riverWater.push({ x, y: -0.35, z, sx: TILE_WORLD, sy: 0.35, sz: TILE_WORLD })
        buckets.bridgeStone.push({ x, y: 0.25, z, sx: TILE_WORLD * 0.96, sy: 0.45, sz: TILE_WORLD * 0.96 })
        addBridgeParapet(root, x, z, gy === 15)
      } else if (inBounds && isRiverTile(gx, gy)) {
        buckets.riverBed.push({ x, y: -0.78, z, sx: TILE_WORLD, sy: 0.4, sz: TILE_WORLD })
        buckets.riverWater.push({ x, y: -0.35, z, sx: TILE_WORLD, sy: 0.38, sz: TILE_WORLD })

        // Shimmering white/aqua foam ripples flowing along the river
        if ((gx + gy) % 2 === 0) {
          const ripple = createVoxelMesh(x, -0.14, z, 0.95, 0.08, 0.45, '#bae6fd', true, 0.72)
          root.add(ripple)
          riverRipples.push({ mesh: ripple, baseX: x, baseY: -0.14, baseZ: z, phase: gx * 0.6 + gy * 0.4 })
        }
      } else if (inBounds && isPierTile(gx, gy)) {
        buckets.pondIce.push({ x, y: -0.38, z, sx: TILE_WORLD, sy: 0.45, sz: TILE_WORLD })
        buckets.pier.push({ x, y: -0.02, z, sx: TILE_WORLD * 0.92, sy: 0.32, sz: TILE_WORLD * 0.82 })
      } else if (inBounds && isFrozenPondTile(gx, gy)) {
        buckets.pondIce.push({ x, y: -0.38, z, sx: TILE_WORLD, sy: 0.45, sz: TILE_WORLD })
      } else if (inBounds && (isPlazaTile(gx, gy) || isRoadTile(gx, gy))) {
        buckets.trailStone.push({ x, y: -0.22, z, sx: TILE_WORLD, sy: 0.5, sz: TILE_WORLD })
      } else {
        const nearRiver =
          inBounds &&
          (isRiverTile(gx - 1, gy) ||
            isRiverTile(gx + 1, gy) ||
            isRiverTile(gx, gy - 1) ||
            isRiverTile(gx, gy + 1))

        const distFromEdge = Math.min(gx, cols - 1 - gx, gy - skyRows, rows - 1 - gy)
        let elevation = 0
        if (distFromEdge <= 0) {
          elevation = 0.75 + ((Math.abs(gx * 13 + gy * 7) % 3) * 0.45)
        } else if (distFromEdge === 1 && (gx + gy) % 2 === 0) {
          elevation = 0.32
        }

        const hash = Math.abs(gx * 41 + gy * 83) % 10
        const bucket = nearRiver
          ? 'riverBank'
          : elevation > 0.3 || hash <= 1
            ? 'snowPatch'
            : (gx + gy) % 2 === 0
              ? 'forestMossA'
              : 'forestMossB'

        const h = 0.6 + elevation
        buckets[bucket].push({
          x,
          y: h / 2 - 0.55,
          z,
          sx: TILE_WORLD,
          sy: h,
          sz: TILE_WORLD,
        })
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
    forestMossA: '#0b2619',
    forestMossB: '#103322',
    snowPatch: '#cbd5e1',
    riverBank: '#1b4332',
    trailStone: '#475569',
    riverWater: '#0284c7',
    riverBed: '#0c2742',
    pondIce: '#38bdf8',
    pier: '#7c4d2b',
    bridgeStone: '#94a3b8',
    earthBase: '#050b14',
  }

  const geom = getUnitBoxGeometry()
  const dummy = new THREE.Object3D()

  for (const [key, items] of Object.entries(buckets)) {
    if (items.length === 0) continue
    const isTranslucentWater = key === 'riverWater' || key === 'pondIce'
    const mat = getVoxelMaterial(palette[key as keyof typeof buckets], isTranslucentWater ? 0.86 : 1)
    const instanced = new THREE.InstancedMesh(geom, mat, items.length)
    items.forEach((item, idx) => {
      dummy.position.set(item.x, item.y, item.z)
      dummy.scale.set(item.sx, item.sy, item.sz)
      dummy.updateMatrix()
      instanced.setMatrixAt(idx, dummy.matrix)
    })
    instanced.instanceMatrix.needsUpdate = true
    root.add(instanced)
  }
}

function addBridgeParapet(root: THREE.Group, x: number, z: number, horizontal: boolean): void {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const off = TILE_WORLD * 0.44
  if (horizontal) {
    g.add(createVoxelMesh(0, 0.72, -off, TILE_WORLD * 0.96, 0.46, 0.28, '#cbd5e1'))
    g.add(createVoxelMesh(0, 0.72, off, TILE_WORLD * 0.96, 0.46, 0.28, '#cbd5e1'))
    g.add(createVoxelMesh(0, 1.12, -off, 0.35, 0.35, 0.35, '#fbbf24', true))
  } else {
    g.add(createVoxelMesh(-off, 0.72, 0, 0.28, 0.46, TILE_WORLD * 0.96, '#cbd5e1'))
    g.add(createVoxelMesh(off, 0.72, 0, 0.28, 0.46, TILE_WORLD * 0.96, '#cbd5e1'))
    g.add(createVoxelMesh(-off, 1.12, 0, 0.35, 0.35, 0.35, '#fbbf24', true))
  }
  root.add(g)
}

function buildMistyMountainsAndRuins(
  root: THREE.Group,
  riverRipples: BuiltVoxelWorld['riverRipples'],
): void {
  const { cols, skyRows } = CITY_MAP_CONFIG

  // Stepped Misty Mountain peaks along the northern & northwestern ridge
  for (let gx = -5; gx < cols + 5; gx += 3) {
    const isWaterfallGap = gx >= 8 && gx <= 12
    const hash = Math.abs(gx * 37 + 19) % 10
    const peakH = isWaterfallGap ? 6.5 : 8 + hash * 0.8
    const { x, z } = gridToWorld(gx, skyRows - 4)

    const peak = new THREE.Group()
    peak.position.set(x, 0, z)
    peak.add(createVoxelMesh(0, peakH * 0.32, 0, 10.5, peakH * 0.65, 9.5, '#1e293b'))
    peak.add(createVoxelMesh(0, peakH * 0.72, 0, 7.0, peakH * 0.38, 6.5, '#334155'))
    peak.add(createVoxelMesh(0, peakH * 0.94, 0, 4.2, peakH * 0.2, 4.0, '#e2e8f0'))
    root.add(peak)
  }

  // Waterfall cascading from the Misty Mountains into the main river headwaters
  const wfPos = gridToWorld(10.5, skyRows - 0.8)
  const wfGroup = new THREE.Group()
  wfGroup.position.set(wfPos.x, 0, wfPos.z)
  wfGroup.add(createVoxelMesh(0, 3.2, -1.2, 3.2, 6.8, 1.4, '#0ea5e9', true, 0.82))
  for (let i = 0; i < 6; i += 1) {
    const foam = createVoxelMesh(
      (i % 3 - 1) * 0.9,
      1.2 + i * 0.9,
      -0.4,
      0.65,
      0.85,
      0.65,
      '#e0f2fe',
      true,
      0.88,
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

  // Ancient mossy Elven/Numenorean watchtower ruin overlooking the valley
  const ruinPos = gridToWorld(27, skyRows - 2)
  const ruin = new THREE.Group()
  ruin.position.set(ruinPos.x, 0.6, ruinPos.z)
  ruin.add(createVoxelMesh(0, 3.2, 0, 4.2, 6.4, 4.2, '#475569'))
  ruin.add(createVoxelMesh(-1.5, 6.9, -1.5, 1.1, 1.3, 1.1, '#64748b'))
  ruin.add(createVoxelMesh(1.5, 6.7, 1.5, 1.1, 0.9, 1.1, '#64748b'))
  ruin.add(createVoxelMesh(0, 3.8, 2.15, 0.9, 1.8, 0.2, '#fbbf24', true)) // Beacon brazier
  ruin.add(createVoxelMesh(-1.6, 1.2, 2.1, 1.2, 1.8, 0.4, '#14532d')) // Ancient moss
  root.add(ruin)
}

function buildNightSky(
  root: THREE.Group,
  auroraBars: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>,
): void {
  const starGroup = new THREE.Group()
  const geom = getUnitBoxGeometry()
  const starMat = getVoxelMaterial('#fef08a')
  const count = 180
  const stars = new THREE.InstancedMesh(geom, starMat, count)
  const dummy = new THREE.Object3D()

  for (let i = 0; i < count; i += 1) {
    const angle = (i * 137.5 * Math.PI) / 180
    const radius = 95 + (i % 8) * 9
    const y = 20 + (i % 16) * 2.6
    dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    const s = i % 4 === 0 ? 0.65 : 0.35
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    stars.setMatrixAt(i, dummy.matrix)
  }
  stars.instanceMatrix.needsUpdate = true
  starGroup.add(stars)

  // Aurora ribbons over the Misty Mountains
  const auroraColors = ['#22c55e', '#34d399', '#2dd4bf', '#4ade80']
  for (let i = 0; i < 24; i += 1) {
    const x = -60 + i * 5.2
    const z = -84 + Math.sin(i * 0.45) * 6
    const baseY = 34 + Math.cos(i * 0.5) * 3.5
    const bar = createVoxelMesh(
      x,
      baseY,
      z,
      4.4,
      6.5 + (i % 3) * 1.8,
      1.2,
      auroraColors[i % auroraColors.length],
      true,
      0.14,
    )
    starGroup.add(bar)
    auroraBars.push({ mesh: bar, baseY, phase: i * 0.45 })
  }

  const moonGroup = new THREE.Group()
  moonGroup.position.set(56, 44, -82)
  moonGroup.add(createVoxelMesh(0, 0, 0, 4.5, 4.5, 1.5, '#fef08a', true))
  moonGroup.add(createVoxelMesh(1.6, 1.2, 0.3, 3.2, 3.2, 1.6, '#040914', true))
  starGroup.add(moonGroup)

  root.add(starGroup)
}

function buildEnchantedForestFoliage(
  root: THREE.Group,
  wisps: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }>,
): void {
  const { cols, rows, skyRows } = CITY_MAP_CONFIG

  for (let gy = skyRows - 4; gy < rows + 4; gy += 1) {
    for (let gx = -4; gx < cols + 4; gx += 1) {
      const inBounds = gx >= 0 && gx < cols && gy >= skyRows && gy < rows
      if (inBounds && isReservedArea(gx, gy)) continue

      const hash = Math.abs((gx * 73856093) ^ (gy * 19349663)) % 100
      const isPerimeter = gx <= 1 || gx >= cols - 2 || gy <= skyRows + 1 || gy >= rows - 2
      const { x, z } = gridToWorld(gx, gy)
      const jitterX = ((hash % 7) - 3) * 0.14
      const jitterZ = (((hash >> 2) % 7) - 3) * 0.14

      if ((isPerimeter && hash < 76) || (!isPerimeter && hash < 24)) {
        const treeVariant = hash % 3
        const heightScale = 0.85 + (hash % 5) * 0.22
        addBorderMallornOrPine(root, x + jitterX, z + jitterZ, heightScale, treeVariant)
      } else if (inBounds && hash >= 58 && hash < 76) {
        const isEnchantedGrove = gx >= 25 && gy <= 15
        addForestShrubOrFlora(root, x + jitterX, z + jitterZ, hash, isEnchantedGrove)
      }

      if (inBounds && hash >= 88 && wisps.length < 36) {
        const wispColor = hash % 3 === 0 ? '#fde047' : '#4ade80'
        const wy = 1.8 + (hash % 5) * 0.5
        const wisp = createVoxelMesh(x, wy, z, 0.22, 0.22, 0.22, wispColor, true, 0.85)
        root.add(wisp)
        wisps.push({ mesh: wisp, baseX: x, baseY: wy, baseZ: z, phase: hash * 0.2 })
      }
    }
  }
}

function addBorderMallornOrPine(
  root: THREE.Group,
  x: number,
  z: number,
  scale: number,
  variant: number,
): void {
  const tree = new THREE.Group()
  tree.position.set(x, 0, z)

  if (variant === 1) {
    // Lothlórien-inspired Mallorn tree: silver bark + emerald-gold canopy + crystal lantern
    const trunkH = 2.6 * scale
    tree.add(createVoxelMesh(0, trunkH / 2, 0, 0.65, trunkH, 0.65, '#cbd5e1'))
    const crownY = trunkH + 1.1 * scale
    tree.add(createVoxelMesh(0, crownY, 0, 3.0 * scale, 1.5 * scale, 3.0 * scale, '#14532d'))
    tree.add(createVoxelMesh(0.5 * scale, crownY + 0.5 * scale, 0.4 * scale, 2.0 * scale, 1.1 * scale, 2.0 * scale, '#ca8a04'))
    tree.add(createVoxelMesh(0, crownY - 0.6 * scale, 1.1 * scale, 0.26, 0.36, 0.26, '#fef08a', true))
  } else {
    const trunkH = 1.4 * scale
    tree.add(createVoxelMesh(0, trunkH / 2, 0, 0.55, trunkH, 0.55, '#3b2110'))
    for (let t = 0; t < 4; t += 1) {
      const w = (2.4 - t * 0.48) * scale
      const y = trunkH + t * 1.05 * scale
      tree.add(createVoxelMesh(0, y, 0, w, 0.9 * scale, w, t % 2 === 0 ? '#092419' : '#0f3626'))
      if (t >= 2) {
        tree.add(createVoxelMesh(0, y + 0.45 * scale, 0, w * 0.72, 0.18, w * 0.72, '#e2e8f0'))
      }
    }
  }

  root.add(tree)
}

function addForestShrubOrFlora(
  root: THREE.Group,
  x: number,
  z: number,
  hash: number,
  isEnchantedGrove = false,
): void {
  const g = new THREE.Group()
  g.position.set(x, 0, z)

  if (isEnchantedGrove && hash % 2 === 0) {
    // Glowing enchanted mushrooms in the Bosque Encantado
    const capColor = hash % 4 === 0 ? '#a855f7' : '#ec4899'
    g.add(createVoxelMesh(0, 0.25, 0, 0.28, 0.5, 0.28, '#f8fafc'))
    g.add(createVoxelMesh(0, 0.55, 0, 0.72, 0.28, 0.72, capColor, true))
    g.add(createVoxelMesh(0.32, 0.22, 0.28, 0.32, 0.18, 0.32, '#2dd4bf', true))
  } else if (hash % 2 === 0) {
    g.add(createVoxelMesh(0, 0.28, 0, 0.95, 0.56, 0.95, '#0f3626'))
    g.add(createVoxelMesh(0.35, 0.42, 0.35, 0.16, 0.16, 0.16, '#dc2626', true))
  } else {
    g.add(createVoxelMesh(0, 0.2, 0, 0.8, 0.4, 0.8, '#164d36'))
    g.add(createVoxelMesh(0, 0.44, 0, 0.2, 0.2, 0.2, '#4ade80', true))
  }

  root.add(g)
}

function buildShireAndElvenBuildings(
  root: THREE.Group,
  smokePuffs: BuiltVoxelWorld['smokePuffs'],
): void {
  VILLAGE_COTTAGES.forEach((cottage, idx) => {
    const { x, z } = gridToWorld(cottage.gridX + 1, cottage.gridY + 1)
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.scale.setScalar(0.88)

    if (cottage.variant === 'elven-pavilion') {
      // Rivendell-inspired open silver-stone & timber pavilion
      g.add(createVoxelMesh(0, 0.2, 0, 5.2, 0.4, 5.2, '#94a3b8'))
      g.add(createVoxelMesh(-2.0, 1.7, -2.0, 0.45, 2.8, 0.45, '#cbd5e1'))
      g.add(createVoxelMesh(2.0, 1.7, -2.0, 0.45, 2.8, 0.45, '#cbd5e1'))
      g.add(createVoxelMesh(-2.0, 1.7, 2.0, 0.45, 2.8, 0.45, '#cbd5e1'))
      g.add(createVoxelMesh(2.0, 1.7, 2.0, 0.45, 2.8, 0.45, '#cbd5e1'))
      g.add(createVoxelMesh(0, 3.3, 0, 5.6, 0.6, 5.6, '#14532d'))
      g.add(createVoxelMesh(0, 3.9, 0, 3.8, 0.65, 3.8, '#0f766e'))
      g.add(createVoxelMesh(0, 4.4, 0, 2.2, 0.4, 2.2, '#e2e8f0'))
      g.add(createVoxelMesh(0, 2.4, 0, 0.5, 0.7, 0.5, '#fef08a', true))
    } else {
      // Cozy Shire Hobbit-hole burrow tucked into a mossy snowy hillside
      const doorColor = cottage.variant === 'hobbit-emerald' ? '#16a34a' : '#d97706'
      g.add(createVoxelMesh(0, 0.9, -0.3, 5.8, 1.8, 4.6, '#14532d')) // Grassy hillside
      g.add(createVoxelMesh(0, 1.95, -0.3, 4.6, 0.6, 3.8, '#e2e8f0')) // Snow cap on hill
      g.add(createVoxelMesh(0, 1.1, 1.95, 3.4, 1.8, 0.35, '#fef3c7')) // Front facade
      // Signature round Hobbit door + brass knob + Christmas wreath
      g.add(createVoxelMesh(0, 0.95, 2.15, 1.35, 1.35, 0.2, doorColor))
      g.add(createVoxelMesh(0, 1.35, 2.26, 0.48, 0.48, 0.1, '#dc2626', true))
      g.add(createVoxelMesh(-1.15, 1.0, 2.15, 0.7, 0.7, 0.18, '#fbbf24', true))
      g.add(createVoxelMesh(1.15, 1.0, 2.15, 0.7, 0.7, 0.18, '#fbbf24', true))

      // Chimney + smoke
      g.add(createVoxelMesh(1.4, 2.5, -0.8, 0.8, 1.8, 0.8, '#64748b'))
      for (let p = 0; p < 2; p += 1) {
        const smoke = createVoxelMesh(1.4, 3.8 + p * 0.7, -0.8, 0.45, 0.38, 0.45, '#cbd5e1', false, 0.42)
        g.add(smoke)
        smokePuffs.push({ mesh: smoke, baseY: 3.6, phase: idx * 1.3 + p * 1.5 })
      }
    }

    root.add(g)
  })
}

function buildDecorations(
  root: THREE.Group,
  interactiveProps: InteractivePropHandle[],
  lampGlows: THREE.Mesh[],
): void {
  const dialogueByType: Record<'caretaker' | 'signpost' | 'snowman', VillagePropDialogue> = {
    caretaker: {
      title: 'Guardião da Floresta',
      text: 'Cada árvore aqui representa um dev. Quanto mais commits no GitHub, mais luzes verdes brilham na copa!',
    },
    signpost: {
      title: 'Marco de Valfenda',
      text: 'Rios do Vale ao oeste e sul · Tocas do Condado nas colinas · Clique nas árvores para inspecionar commits.',
    },
    snowman: {
      title: 'Boneco de Neve',
      text: 'Boas festas na Terra-Média dos commits! Envie presentes visuais para decorar as árvores.',
    },
  }

  VILLAGE_DECORATIONS.forEach((deco, idx) => {
    const { x, z } = gridToWorld(deco.gridX, deco.gridY)

    if (deco.type === 'lamp') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 1.35, 0, 0.28, 2.7, 0.28, '#cbd5e1'))
      g.add(createVoxelMesh(0, 2.85, 0, 0.6, 0.56, 0.6, '#fbbf24', true))
      g.add(createVoxelMesh(0, 3.25, 0, 0.78, 0.18, 0.78, '#475569'))

      const glowPad = createVoxelMesh(0, 0.08, 0, 2.8, 0.08, 2.8, '#fbbf24', true, 0.16)
      g.add(glowPad)
      lampGlows.push(glowPad)

      if (idx < 3) {
        const light = new THREE.PointLight(0xfbbf24, 7, 16, 1.6)
        light.position.set(0, 2.9, 0)
        g.add(light)
      }

      root.add(g)
      return
    }

    if (deco.type === 'elven-arch') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(-1.4, 1.8, 0, 0.55, 3.6, 0.55, '#94a3b8'))
      g.add(createVoxelMesh(1.4, 1.8, 0, 0.55, 3.6, 0.55, '#94a3b8'))
      g.add(createVoxelMesh(0, 3.65, 0, 3.6, 0.65, 0.65, '#cbd5e1'))
      g.add(createVoxelMesh(0, 3.65, 0.36, 0.75, 0.35, 0.1, '#4ade80', true))
      root.add(g)
      return
    }

    if (deco.type === 'waystone') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.85, 0, 0.75, 1.7, 0.55, '#64748b'))
      g.add(createVoxelMesh(0, 1.85, 0, 0.45, 0.45, 0.45, '#38bdf8', true))
      root.add(g)
      return
    }

    if (deco.type === 'snowman') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.45, 0, 1.15, 0.9, 1.15, '#f8fafc'))
      g.add(createVoxelMesh(0, 1.2, 0, 0.85, 0.72, 0.85, '#f1f5f9'))
      g.add(createVoxelMesh(0, 1.6, 0, 0.92, 0.18, 0.92, '#dc2626'))
      g.add(createVoxelMesh(0, 1.9, 0, 0.65, 0.58, 0.65, '#f8fafc'))
      g.add(createVoxelMesh(0, 1.9, 0.38, 0.14, 0.14, 0.3, '#f97316'))
      g.add(createVoxelMesh(0, 2.35, 0, 0.74, 0.38, 0.74, '#1e293b'))
      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.snowman })
      return
    }

    if (deco.type === 'signpost') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.9, 0, 0.3, 1.8, 0.3, '#5c371d'))
      g.add(createVoxelMesh(0, 1.55, 0, 1.5, 0.52, 0.24, '#8c5835'))
      g.add(createVoxelMesh(0, 1.55, 0.14, 1.0, 0.18, 0.08, '#4ade80', true))
      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.signpost })
      return
    }

    if (deco.type === 'caretaker') {
      // Wizard / Ranger guardian in emerald cloak
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(0, 0.55, 0, 0.72, 1.1, 0.62, '#14532d'))
      g.add(createVoxelMesh(0, 1.32, 0, 0.6, 0.55, 0.6, '#fed7aa'))
      g.add(createVoxelMesh(0, 1.85, 0, 0.85, 0.3, 0.85, '#475569')) // Wizard hat brim
      g.add(createVoxelMesh(0, 2.2, 0, 0.48, 0.55, 0.48, '#334155')) // Pointed hat
      g.add(createVoxelMesh(0.65, 1.0, 0.1, 0.16, 2.0, 0.16, '#7c4d2b')) // Staff
      g.add(createVoxelMesh(0.65, 2.1, 0.1, 0.24, 0.24, 0.24, '#fef08a', true)) // Staff crystal
      root.add(g)
      interactiveProps.push({ mesh: g, dialogue: dialogueByType.caretaker })
      return
    }

    if (deco.type === 'gift-pile') {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.add(createVoxelMesh(-0.4, 0.4, 0.15, 0.8, 0.8, 0.8, '#dc2626'))
      g.add(createVoxelMesh(0.45, 0.32, -0.1, 0.65, 0.64, 0.65, '#2563eb'))
      root.add(g)
    }
  })
}

function buildFootprintTrails(root: THREE.Group): void {
  // Subtle footprint tracks pressed into snow near the cabins & pond
  const spots = [
    { gx: 5, gy: 20 },
    { gx: 5.4, gy: 21 },
    { gx: 5.8, gy: 22 },
    { gx: 6.1, gy: 23 },
    { gx: 16, gy: 15.3 },
    { gx: 17, gy: 15.1 },
    { gx: 18, gy: 15.3 },
    { gx: 31, gy: 9 },
    { gx: 30.5, gy: 10 },
  ]
  for (let i = 0; i < spots.length; i += 1) {
    const p = gridToWorld(spots[i].gx, spots[i].gy)
    root.add(createVoxelMesh(p.x - 0.25, 0.08, p.z, 0.18, 0.04, 0.28, '#64748b'))
    root.add(createVoxelMesh(p.x + 0.22, 0.08, p.z + 0.2, 0.18, 0.04, 0.28, '#64748b'))
  }
}

function buildLivingWildlife(root: THREE.Group, wildlife: WildlifeActor[]): void {
  // 4 Reindeer wandering snowy clearings
  const reindeerSpots = [
    { gx: 15, gy: 9, rx: 3.6, rz: 2.2, speed: 0.42 },
    { gx: 26, gy: 11, rx: 3.2, rz: 2.8, speed: 0.36 },
    { gx: 13, gy: 24, rx: 2.8, rz: 2.2, speed: 0.38 },
    { gx: 31, gy: 20, rx: 3.4, rz: 2.4, speed: 0.44 },
  ]
  reindeerSpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    // Body, legs, neck, head, antlers, red/dark nose
    g.add(createVoxelMesh(0, 0.65, 0, 0.55, 0.52, 1.05, '#7c4d2b'))
    g.add(createVoxelMesh(-0.18, 0.22, 0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0.18, 0.22, 0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(-0.18, 0.22, -0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0.18, 0.22, -0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0, 1.02, 0.42, 0.32, 0.48, 0.32, '#8c5835'))
    g.add(createVoxelMesh(0, 1.25, 0.56, 0.34, 0.3, 0.44, '#9c6644'))
    g.add(createVoxelMesh(0, 1.24, 0.8, 0.14, 0.14, 0.14, idx === 0 ? '#ef4444' : '#1e293b', idx === 0))
    // Antlers
    g.add(createVoxelMesh(-0.22, 1.56, 0.46, 0.1, 0.42, 0.1, '#d6b68c'))
    g.add(createVoxelMesh(0.22, 1.56, 0.46, 0.1, 0.42, 0.1, '#d6b68c'))
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

  // 4 Snow Foxes trotting along clearings
  const foxSpots = [
    { gx: 7, gy: 12 },
    { gx: 23, gy: 8 },
    { gx: 28, gy: 24 },
    { gx: 16, gy: 26 },
  ]
  foxSpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.32, 0, 0.36, 0.32, 0.65, '#ea580c'))
    g.add(createVoxelMesh(0, 0.48, 0.36, 0.32, 0.28, 0.32, '#f97316'))
    g.add(createVoxelMesh(0, 0.36, -0.45, 0.2, 0.2, 0.36, '#f8fafc')) // White tail tip
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

  // 5 Snow Bunnies hopping in the snow
  const bunnySpots = [
    { gx: 8, gy: 20 },
    { gx: 19, gy: 12 },
    { gx: 24, gy: 17 },
    { gx: 31, gy: 13 },
    { gx: 11, gy: 7 },
  ]
  bunnySpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.22, 0, 0.28, 0.26, 0.36, '#f8fafc'))
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

  // 8 Fish swimming in the frozen pond & river channels
  const fishSpots = [
    { gx: 4.5, gy: 25.5, rx: 1.8, rz: 1.2 },
    { gx: 4.0, gy: 26.2, rx: 1.5, rz: 1.0 },
    { gx: 9.5, gy: 11, rx: 0.8, rz: 2.0 },
    { gx: 9.2, gy: 17, rx: 0.8, rz: 2.0 },
    { gx: 16, gy: 20.5, rx: 2.2, rz: 0.7 },
    { gx: 24, gy: 20.5, rx: 2.2, rz: 0.7 },
  ]
  fishSpots.forEach((s, idx) => {
    const p = gridToWorld(s.gx, s.gy)
    const g = new THREE.Group()
    const color = idx % 2 === 0 ? '#fb923c' : '#cbd5e1'
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
  // Decorative giant scenic Christmas tree on the distant northeastern overlook (non-user landmark)
  const pos = gridToWorld(38.5, 2.5)
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
  const count = 380
  const geom = getUnitBoxGeometry()
  const mat = getVoxelMaterial('#f8fafc', 0.84)
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
    const x = ((i * 73) % 154) - 77
    const y = (i % 36) + 1
    const z = ((i * 131) % 124) - 62
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
