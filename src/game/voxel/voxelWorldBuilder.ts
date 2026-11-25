import * as THREE from 'three'
import {
  CITY_MAP_CONFIG,
  CITY_PALETTE,
  NORTH_POLE_LANDMARKS,
  OUTER_IGLOO_VILLAGES,
  OUTER_NEIGHBORHOOD_CHALETS,
  OUTER_WATCHTOWERS,
  OUTER_WOODLAND_PROPS,
  VILLAGE_OFFSET_X,
  VILLAGE_OFFSET_Y,
  WORLD_TILE_SIZE,
} from '../../config/cityMapConfig'
import type { VillagePropDialogue } from '../../types/city'
import {
  CONTINENT_LAKES,
  CONTINENT_REGIONS,
  getBridgeDirectionWorld,
  getContinentElevationFactor,
  isLakeIsletWorld,
  isLakePierWorld,
  isLakeWorld,
  isLandWorld,
  isMajorTrailWorld,
  isRiverWorld,
  WORLD_MAP_BOUNDS,
  worldToGridCoords,
} from '../layout/continentGeography'
import {
  getEastTributaryCenterY,
  getMainRiverCenterX,
  getWestTributaryCenterY,
  isBlockedForTree,
  isFrozenPondTile,
  isPierTile,
  isPlazaTile,
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

export const TILE_WORLD = WORLD_TILE_SIZE

export interface InteractivePropHandle {
  mesh: THREE.Object3D
  dialogue: VillagePropDialogue
}

export interface WildlifeActor {
  mesh: THREE.Group
  kind: 'reindeer' | 'fox' | 'bunny' | 'fish' | 'penguin'
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
  pointLights: THREE.PointLight[]
  snowParticles: THREE.InstancedMesh
  snowData: Array<{ ox: number; y: number; oz: number; speed: number; drift: number; size: number }>
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

const INVISIBLE_HITBOX_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
})

interface BoxInstance {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rotY?: number
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
    dummy.rotation.set(0, item.rotY ?? 0, 0)
    dummy.scale.set(item.sx, item.sy, item.sz)
    dummy.updateMatrix()
    instanced.setMatrixAt(i, dummy.matrix)
  }

  instanced.instanceMatrix.needsUpdate = true
  instanced.frustumCulled = false
  root.add(instanced)
}

function pushTransformedBox(
  bucket: BoxInstance[],
  baseX: number,
  baseZ: number,
  rotY: number,
  lx: number,
  ly: number,
  lz: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const cosR = Math.cos(rotY)
  const sinR = Math.sin(rotY)
  bucket.push({
    x: baseX + lx * cosR + lz * sinR,
    y: ly,
    z: baseZ - lx * sinR + lz * cosR,
    sx,
    sy,
    sz,
    rotY,
  })
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

export function buildVoxelWorld(): BuiltVoxelWorld {
  const root = new THREE.Group()
  const interactiveProps: InteractivePropHandle[] = []
  const lampGlows: THREE.Mesh[] = []
  const pointLights: THREE.PointLight[] = []
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
  buildRiverConfluenceAccents(root, riverRipples)
  buildNightSky(root, auroraBars)
  buildEnchantedForestFoliage(root, wisps)
  buildNorthPoleBuildings(
    root,
    smokePuffs,
    lampGlows,
    pointLights,
    crystalRotators,
    magicSeedPoints,
    interactiveProps,
  )
  buildNorthPoleDecorations(
    root,
    interactiveProps,
    smokePuffs,
    lampGlows,
    pointLights,
    magicSeedPoints,
  )
  buildOuterNeighborhoodsAndProps(root, smokePuffs, lampGlows, interactiveProps)
  buildFootprintTrails(root)
  buildLivingWildlife(root, wildlife)

  const { snowParticles, snowData } = buildSnowSystem(root)
  const { magicParticles, magicParticleData } = buildMagicParticleSystem(root, magicSeedPoints)

  return {
    root,
    interactiveProps,
    lampGlows,
    pointLights,
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
  const buckets: Record<string, BoxInstance[]> = {
    snowBright: [],
    snowIce: [],
    snowSoftShadow: [],
    iceShore: [],
    riverCrystal: [],
    icebergBody: [],
    icebergGlow: [],
    snowTrail: [],
    woodPlank: [],
    riverWater: [],
    riverBed: [],
    pondIce: [],
    pier: [],
    bridgeWood: [],
    bridgeRailDark: [],
    bridgeSnowTrim: [],
    bridgeLanternGlow: [],
    earthBase: [],
    arcticOcean: [],
  }

  const pushInstancedBridgeParapet = (
    x: number,
    z: number,
    horizontal: boolean,
    withLantern: boolean,
    isSeaCrossing: boolean,
  ) => {
    const off = TILE_WORLD * 0.44
    if (horizontal) {
      buckets.bridgeRailDark.push({ x, y: 0.72, z: z - off, sx: TILE_WORLD * 0.96, sy: 0.36, sz: 0.24 })
      buckets.bridgeSnowTrim.push({ x, y: 0.96, z: z - off, sx: TILE_WORLD * 0.96, sy: 0.14, sz: 0.26 })
      buckets.bridgeRailDark.push({ x, y: 0.72, z: z + off, sx: TILE_WORLD * 0.96, sy: 0.36, sz: 0.24 })
      buckets.bridgeSnowTrim.push({ x, y: 0.96, z: z + off, sx: TILE_WORLD * 0.96, sy: 0.14, sz: 0.26 })
      if (withLantern) {
        buckets.bridgeLanternGlow.push({ x, y: 1.24, z: z - off, sx: 0.36, sy: 0.36, sz: 0.36 })
      }
      if (isSeaCrossing) {
        buckets.bridgeRailDark.push({ x, y: -0.35, z: z - off, sx: 0.34, sy: 1.4, sz: 0.34 })
        buckets.bridgeRailDark.push({ x, y: -0.35, z: z + off, sx: 0.34, sy: 1.4, sz: 0.34 })
      }
    } else {
      buckets.bridgeRailDark.push({ x: x - off, y: 0.72, z, sx: 0.24, sy: 0.36, sz: TILE_WORLD * 0.96 })
      buckets.bridgeSnowTrim.push({ x: x - off, y: 0.96, z, sx: 0.26, sy: 0.14, sz: TILE_WORLD * 0.96 })
      buckets.bridgeRailDark.push({ x: x + off, y: 0.72, z, sx: 0.24, sy: 0.36, sz: TILE_WORLD * 0.96 })
      buckets.bridgeSnowTrim.push({ x: x + off, y: 0.96, z, sx: 0.26, sy: 0.14, sz: TILE_WORLD * 0.96 })
      if (withLantern) {
        buckets.bridgeLanternGlow.push({ x: x - off, y: 1.24, z, sx: 0.36, sy: 0.36, sz: 0.36 })
      }
      if (isSeaCrossing) {
        buckets.bridgeRailDark.push({ x: x - off, y: -0.35, z, sx: 0.34, sy: 1.4, sz: 0.34 })
        buckets.bridgeRailDark.push({ x: x + off, y: -0.35, z, sx: 0.34, sy: 1.4, sz: 0.34 })
      }
    }
  }

  const macroStep = TILE_WORLD * 3 // 9.6u interior blocks keep GPU instances fast across full continent
  const subStep = TILE_WORLD // 3.2u crisp coastal/river/bridge voxels
  // Snap macro centers to multiples of 3 * TILE_WORLD + 1.6 so sub-offsets {-3.2, 0, +3.2} align cleanly on `gridToWorld` centers
  const minIdxX = Math.floor((WORLD_MAP_BOUNDS.minX - 1.6) / macroStep)
  const maxIdxX = Math.ceil((WORLD_MAP_BOUNDS.maxX - 1.6) / macroStep)
  const minIdxZ = Math.floor((WORLD_MAP_BOUNDS.minZ - 1.6) / macroStep)
  const maxIdxZ = Math.ceil((WORLD_MAP_BOUNDS.maxZ - 1.6) / macroStep)

  for (let iz = minIdxZ; iz <= maxIdxZ; iz += 1) {
    const mz = iz * macroStep + 1.6
    for (let ix = minIdxX; ix <= maxIdxX; ix += 1) {
      const mx = ix * macroStep + 1.6
      const c0Land = isLandWorld(mx - subStep, mz - subStep)
      const c1Land = isLandWorld(mx + subStep, mz - subStep)
      const c2Land = isLandWorld(mx - subStep, mz + subStep)
      const c3Land = isLandWorld(mx + subStep, mz + subStep)
      const centerLand = isLandWorld(mx, mz)

      const nearCoastEdge =
        !isLandWorld(mx - 6.4, mz) ||
        !isLandWorld(mx + 6.4, mz) ||
        !isLandWorld(mx, mz - 6.4) ||
        !isLandWorld(mx, mz + 6.4)

      const hasRiverOrTrail =
        isRiverWorld(mx, mz) ||
        isRiverWorld(mx - 4.8, mz) ||
        isRiverWorld(mx + 4.8, mz) ||
        isRiverWorld(mx, mz - 4.8) ||
        isRiverWorld(mx, mz + 4.8) ||
        isLakeWorld(mx, mz) ||
        isLakeWorld(mx - 6.4, mz) ||
        isLakeWorld(mx + 6.4, mz) ||
        isLakeWorld(mx, mz - 6.4) ||
        isLakeWorld(mx, mz + 6.4) ||
        isLakeIsletWorld(mx, mz) ||
        isLakePierWorld(mx, mz) ||
        isLakePierWorld(mx - 4.8, mz) ||
        isLakePierWorld(mx + 4.8, mz) ||
        isLakePierWorld(mx, mz - 4.8) ||
        isLakePierWorld(mx, mz + 4.8) ||
        getBridgeDirectionWorld(mx, mz) !== null ||
        getBridgeDirectionWorld(mx - 4.0, mz) !== null ||
        getBridgeDirectionWorld(mx + 4.0, mz) !== null ||
        getBridgeDirectionWorld(mx, mz - 4.0) !== null ||
        getBridgeDirectionWorld(mx, mz + 4.0) !== null ||
        isMajorTrailWorld(mx, mz) ||
        isMajorTrailWorld(mx - 4.0, mz) ||
        isMajorTrailWorld(mx + 4.0, mz) ||
        isMajorTrailWorld(mx, mz - 4.0) ||
        isMajorTrailWorld(mx, mz + 4.0) ||
        Math.hypot(mx - 1.6, mz - 1.6) < 46

      // Open Arctic Ocean outside continent & islands -> spawn periodic floating icebergs
      if (!centerLand && !c0Land && !c1Land && !c2Land && !c3Land && !hasRiverOrTrail) {
        const cellHash = Math.abs(Math.imul((ix * 73) ^ (iz * 139), 2654435761)) >>> 0
        if (
          nearCoastEdge === false &&
          cellHash % 23 === 0 &&
          !isLandWorld(mx - 12, mz) &&
          !isLandWorld(mx + 12, mz) &&
          !isLandWorld(mx, mz - 12) &&
          !isLandWorld(mx, mz + 12)
        ) {
          const floeW = 4.2 + (cellHash % 5) * 1.3
          const floeD = 3.6 + ((cellHash >> 3) % 5) * 1.2
          const peakH = 1.0 + ((cellHash >> 7) % 4) * 0.85
          buckets.icebergBody.push({ x: mx, y: -0.38, z: mz, sx: floeW, sy: 0.52, sz: floeD })
          buckets.icebergGlow.push({
            x: mx + 0.35,
            y: -0.02 + peakH * 0.42,
            z: mz - 0.3,
            sx: floeW * 0.56,
            sy: peakH,
            sz: floeD * 0.54,
          })
          buckets.snowBright.push({
            x: mx + 0.35,
            y: 0.02 + peakH * 0.9,
            z: mz - 0.3,
            sx: floeW * 0.42,
            sy: 0.24,
            sz: floeD * 0.4,
          })
        }
        continue
      }

      // Interior pure-snow continent terrain -> single ultra-light 9.6u macro snow plateau
      if (centerLand && c0Land && c1Land && c2Land && c3Land && !nearCoastEdge && !hasRiverOrTrail) {
        const elev = getContinentElevationFactor(mx, mz)
        const field = sampleSnowField(mx * 0.28, mz * 0.28)
        const mound = elev > 0.42 && field > 0.6 ? 0.38 : field > 0.72 ? 0.2 : 0
        const h = 0.76 + mound
        const bucket =
          field > 0.6 ? 'snowBright' : field > 0.28 ? 'snowIce' : 'snowSoftShadow'
        buckets[bucket].push({
          x: mx,
          y: h / 2 - 0.55,
          z: mz,
          sx: macroStep,
          sy: h,
          sz: macroStep,
        })
        continue
      }

      // Shoreline / river / bridge / plaza zone -> crisp 3.2u micro voxel detail (3x3 sub-tiles)
      for (const dz of [-subStep, 0, subStep]) {
        for (const dx of [-subStep, 0, subStep]) {
          const wx = mx + dx
          const wz = mz + dz
          const { gridX, gridY } = worldToGridCoords(wx, wz)
          const gx = Math.round(gridX)
          const gy = Math.round(gridY)

          const bridgeOrient = getBridgeDirectionWorld(wx, wz)
          const onLand = isLandWorld(wx, wz)
          const isRiver = isRiverWorld(wx, wz)
          const isLakeIslet = onLand && isLakeIsletWorld(wx, wz)
          const isLake = onLand && !isLakeIslet && isLakeWorld(wx, wz)
          const isLakePier = onLand && isLakePierWorld(wx, wz)
          const isPond = onLand && isFrozenPondTile(gx, gy)
          const isPier = onLand && (isPierTile(gx, gy) || isLakePier)
          const isPlaza = onLand && isPlazaTile(gx, gy)
          const isTrail =
            bridgeOrient === null &&
            !isRiver &&
            !isLake &&
            !isLakeIslet &&
            onLand &&
            (isSnowTrailTile(gx, gy) || isMajorTrailWorld(wx, wz))

          if (bridgeOrient !== null) {
            const isSeaCrossing = !onLand
            if (!isSeaCrossing) {
              buckets.riverBed.push({ x: wx, y: -0.78, z: wz, sx: subStep, sy: 0.4, sz: subStep })
              buckets.riverWater.push({ x: wx, y: -0.35, z: wz, sx: subStep, sy: 0.35, sz: subStep })
            }
            buckets.bridgeWood.push({
              x: wx,
              y: 0.24,
              z: wz,
              sx: subStep * 0.96,
              sy: 0.42,
              sz: subStep * 0.96,
            })
            const withLantern = ((gx + gy) & 1) === 0
            pushInstancedBridgeParapet(
              wx,
              wz,
              bridgeOrient === 'horizontal',
              withLantern,
              isSeaCrossing,
            )
          } else if (isRiver) {
            buckets.riverBed.push({ x: wx, y: -0.78, z: wz, sx: subStep, sy: 0.4, sz: subStep })
            buckets.riverWater.push({ x: wx, y: -0.34, z: wz, sx: subStep, sy: 0.38, sz: subStep })

            if ((gx + gy) % 5 === 0 && riverRipples.length < 52) {
              const ripple = createVoxelMesh(wx, -0.12, wz, 1.05, 0.08, 0.48, '#e0f7ff', true, 0.86)
              root.add(ripple)
              riverRipples.push({
                mesh: ripple,
                baseX: wx,
                baseY: -0.12,
                baseZ: wz,
                phase: gx * 0.6 + gy * 0.4,
              })
            }
          } else if (isPier) {
            buckets.pondIce.push({ x: wx, y: -0.36, z: wz, sx: subStep, sy: 0.45, sz: subStep })
            buckets.pier.push({
              x: wx,
              y: -0.02,
              z: wz,
              sx: subStep * 0.92,
              sy: 0.32,
              sz: subStep * 0.82,
            })
          } else if (isPond || isLake) {
            if (isLake) {
              buckets.riverBed.push({ x: wx, y: -0.84, z: wz, sx: subStep, sy: 0.4, sz: subStep })
            }
            buckets.pondIce.push({ x: wx, y: -0.36, z: wz, sx: subStep, sy: 0.45, sz: subStep })
            if (sampleSnowField(gx * 2, gy * 2) > 0.68) {
              buckets.iceShore.push({
                x: wx,
                y: -0.12,
                z: wz,
                sx: subStep * 0.72,
                sy: 0.05,
                sz: subStep * 0.72,
              })
            }
          } else if (isPlaza) {
            buckets.snowTrail.push({ x: wx, y: -0.22, z: wz, sx: subStep, sy: 0.56, sz: subStep })
          } else if (isTrail) {
            buckets.snowTrail.push({ x: wx, y: -0.24, z: wz, sx: subStep, sy: 0.5, sz: subStep })
            if (Math.abs(gx * 31 + gy * 17) % 3 === 0) {
              buckets.woodPlank.push({
                x: wx,
                y: 0.04,
                z: wz,
                sx: subStep * 0.56,
                sy: 0.1,
                sz: subStep * 0.34,
              })
            }
          } else if (onLand) {
            const nearOcean =
              !isLandWorld(wx - subStep, wz) ||
              !isLandWorld(wx + subStep, wz) ||
              !isLandWorld(wx, wz - subStep) ||
              !isLandWorld(wx, wz + subStep)
            const nearWater =
              nearOcean ||
              isRiverWorld(wx - subStep, wz) ||
              isRiverWorld(wx + subStep, wz) ||
              isRiverWorld(wx, wz - subStep) ||
              isRiverWorld(wx, wz + subStep) ||
              isLakeWorld(wx - subStep, wz) ||
              isLakeWorld(wx + subStep, wz) ||
              isLakeWorld(wx, wz - subStep) ||
              isLakeWorld(wx, wz + subStep) ||
              isFrozenPondTile(gx - 1, gy) ||
              isFrozenPondTile(gx + 1, gy) ||
              isFrozenPondTile(gx, gy - 1) ||
              isFrozenPondTile(gx, gy + 1)

            const field = sampleSnowField(gx, gy)
            const h = isLakeIslet
              ? 0.88
              : nearOcean
                ? 0.46
                : nearWater
                  ? 0.62
                  : field > 0.78
                    ? 0.8
                    : 0.64
            const bucket = nearWater
              ? field > 0.5
                ? 'iceShore'
                : 'snowIce'
              : field > 0.58
                ? 'snowBright'
                : field > 0.28
                  ? 'snowIce'
                  : 'snowSoftShadow'

            buckets[bucket].push({
              x: wx,
              y: h / 2 - 0.55,
              z: wz,
              sx: subStep,
              sy: h,
              sz: subStep,
            })

            if (nearWater && Math.abs(gx * 19 + gy * 31) % 9 === 0) {
              const crystalH = 0.34 + (Math.abs(gx + gy) % 3) * 0.14
              buckets.riverCrystal.push({
                x: wx + ((gx % 3) - 1) * 0.45,
                y: h - 0.55 + crystalH * 0.5,
                z: wz + ((gy % 3) - 1) * 0.45,
                sx: 0.34,
                sy: crystalH,
                sz: 0.34,
              })
            }
          }
        }
      }
    }
  }

  // Deep Arctic Ocean surrounding the entire continent & islands out past atmospheric fog
  buckets.arcticOcean.push({
    x: 0,
    y: -0.66,
    z: 0,
    sx: 3800,
    sy: 0.52,
    sz: 3800,
  })

  buckets.earthBase.push({
    x: 0,
    y: -1.68,
    z: 0,
    sx: 3800,
    sy: 1.6,
    sz: 3800,
  })

  const palette: Record<keyof typeof buckets, string> = {
    snowBright: CITY_PALETTE.snow,
    snowIce: CITY_PALETTE.snowIce,
    snowSoftShadow: CITY_PALETTE.snowShadow,
    iceShore: '#bae6fd',
    riverCrystal: '#e0f2fe',
    icebergBody: '#93c5fd',
    icebergGlow: '#dbeafe',
    snowTrail: CITY_PALETTE.snowTrail,
    woodPlank: CITY_PALETTE.woodMid,
    riverWater: CITY_PALETTE.waterVivid,
    riverBed: '#0c3b73',
    pondIce: CITY_PALETTE.iceVivid,
    pier: CITY_PALETTE.woodLight,
    bridgeWood: CITY_PALETTE.woodMid,
    bridgeRailDark: '#6b4226',
    bridgeSnowTrim: '#f4f8ff',
    bridgeLanternGlow: '#fde047',
    earthBase: '#061428',
    arcticOcean: '#0b2546',
  }

  for (const [key, items] of Object.entries(buckets)) {
    const isTranslucentWater = key === 'riverWater' || key === 'pondIce'
    const isIceCrystal = key === 'riverCrystal' || key === 'icebergGlow'
    const isBridgeLantern = key === 'bridgeLanternGlow'
    addInstancedBucket(
      root,
      items,
      palette[key as keyof typeof buckets],
      isIceCrystal || isBridgeLantern,
      isTranslucentWater ? 0.88 : isIceCrystal ? 0.86 : 1,
    )
  }
}

function buildRiverConfluenceAccents(
  root: THREE.Group,
  riverRipples: BuiltVoxelWorld['riverRipples'],
): void {
  // Subtle organic frosted river boulders & sparkling crystal outcrops at tributary forks (zero cliff wall!)
  const stoneRocks: BoxInstance[] = []
  const iceTops: BoxInstance[] = []
  const crystalGlows: BoxInstance[] = []

  const confluenceSpots = [
    { gx: getMainRiverCenterX(10) + 1.9, gy: 10.2, seed: 1 },
    { gx: getMainRiverCenterX(28) - 1.9, gy: 27.6, seed: 2 },
    { gx: getMainRiverCenterX(-16) - 2.1, gy: -16, seed: 3 },
    { gx: getMainRiverCenterX(58) + 2.0, gy: 58, seed: 4 },
    { gx: 42, gy: getEastTributaryCenterY(42) - 1.8, seed: 5 },
    { gx: -8, gy: getWestTributaryCenterY(-8) + 1.8, seed: 6 },
  ]

  for (const spot of confluenceSpots) {
    const { x, z } = gridToWorld(spot.gx, spot.gy)
    stoneRocks.push({ x, y: 0.42, z, sx: 1.5, sy: 0.84, sz: 1.35 })
    stoneRocks.push({ x: x + 0.72, y: 0.25, z: z - 0.55, sx: 0.85, sy: 0.5, sz: 0.85 })
    iceTops.push({ x, y: 0.9, z, sx: 1.2, sy: 0.16, sz: 1.08 })
    crystalGlows.push({ x: x - 0.42, y: 0.96, z: z + 0.35, sx: 0.28, sy: 0.65, sz: 0.28 })
  }

  // Animated icy shimmer above the West Tributary junction rock pool
  const springPos = gridToWorld(getMainRiverCenterX(10) - 0.4, 10)
  const springFoam = createVoxelMesh(springPos.x, -0.06, springPos.z, 1.1, 0.12, 1.1, '#e0f7ff', true, 0.85)
  root.add(springFoam)
  riverRipples.push({
    mesh: springFoam,
    baseX: springPos.x,
    baseY: -0.06,
    baseZ: springPos.z,
    phase: 0.8,
  })

  addInstancedBucket(root, stoneRocks, '#64749c')
  addInstancedBucket(root, iceTops, '#f4f8ff')
  addInstancedBucket(root, crystalGlows, '#7dd3fc', true, 0.86)
}

function buildNightSky(
  root: THREE.Group,
  auroraBars: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>,
): void {
  const starGroup = new THREE.Group()
  const geom = getUnitBoxGeometry()
  const starMat = getEmissiveMaterial('#fef9c3', 1, false)
  const count = 260
  const stars = new THREE.InstancedMesh(geom, starMat, count)
  const dummy = new THREE.Object3D()

  for (let i = 0; i < count; i += 1) {
    const angle = (i * 137.5 * Math.PI) / 180
    const radius = 590 + (i % 14) * 22
    const y = 82 + (i % 18) * 4.5
    dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    const s = i % 4 === 0 ? 1.5 : 0.85
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    stars.setMatrixAt(i, dummy.matrix)
  }
  stars.instanceMatrix.needsUpdate = true
  starGroup.add(stars)

  // Aurora Borealis arching high above the Northern Island & arctic ocean (exempt from fog)
  const auroraColors = ['#34d399', '#2dd4bf', '#38bdf8', '#a7f3d0']
  for (let i = 0; i < 40; i += 1) {
    const x = -400 + i * 20.5
    const z = -610 + Math.sin(i * 0.34) * 30
    const baseY = 122 + Math.cos(i * 0.42) * 10.0
    const bar = createVoxelMesh(
      x,
      baseY,
      z,
      19.0,
      15.5 + (i % 3) * 3.5,
      2.8,
      auroraColors[i % auroraColors.length],
      true,
      0.18,
      false,
    )
    starGroup.add(bar)
    auroraBars.push({ mesh: bar, baseY, phase: i * 0.45 })
  }

  const moonGroup = new THREE.Group()
  moonGroup.position.set(290, 168, -595)
  moonGroup.add(createVoxelMesh(0, 0, 0, 16.0, 16.0, 2.8, '#fef08a', true, 1, false))
  moonGroup.add(createVoxelMesh(4.9, 3.6, 0.5, 11.2, 11.2, 2.9, CITY_PALETTE.nightBg, true, 1, false))
  starGroup.add(moonGroup)

  root.add(starGroup)
}

function buildEnchantedForestFoliage(
  root: THREE.Group,
  wisps: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }>,
): void {
  const buckets = {
    trunkBrown: [] as BoxInstance[],
    pineMid: [] as BoxInstance[],
    snowCap: [] as BoxInstance[],
    shrubGreen: [] as BoxInstance[],
    berryRed: [] as BoxInstance[],
    snowTuft: [] as BoxInstance[],
    icePebble: [] as BoxInstance[],
    mushroomStem: [] as BoxInstance[],
    mushroomCapRed: [] as BoxInstance[],
    mushroomSpotWhite: [] as BoxInstance[],
    mushroomGlowSpore: [] as BoxInstance[],
  }

  const pushVoxelMushroom = (mx: number, mz: number, scale: number, glowing = false) => {
    buckets.mushroomStem.push({
      x: mx,
      y: 0.14 * scale,
      z: mz,
      sx: 0.18 * scale,
      sy: 0.28 * scale,
      sz: 0.18 * scale,
    })
    buckets.mushroomCapRed.push({
      x: mx,
      y: 0.34 * scale,
      z: mz,
      sx: 0.48 * scale,
      sy: 0.18 * scale,
      sz: 0.48 * scale,
    })
    buckets.mushroomCapRed.push({
      x: mx,
      y: 0.46 * scale,
      z: mz,
      sx: 0.32 * scale,
      sy: 0.1 * scale,
      sz: 0.32 * scale,
    })
    // Crisp white polka-dot pixel spots on cap top & sides
    buckets.mushroomSpotWhite.push({
      x: mx - 0.11 * scale,
      y: 0.46 * scale,
      z: mz - 0.08 * scale,
      sx: 0.1 * scale,
      sy: 0.08 * scale,
      sz: 0.1 * scale,
    })
    buckets.mushroomSpotWhite.push({
      x: mx + 0.11 * scale,
      y: 0.46 * scale,
      z: mz + 0.09 * scale,
      sx: 0.1 * scale,
      sy: 0.08 * scale,
      sz: 0.1 * scale,
    })
    buckets.mushroomSpotWhite.push({
      x: mx + 0.15 * scale,
      y: 0.36 * scale,
      z: mz - 0.14 * scale,
      sx: 0.09 * scale,
      sy: 0.09 * scale,
      sz: 0.09 * scale,
    })
    if (glowing) {
      buckets.mushroomGlowSpore.push({
        x: mx,
        y: 0.24 * scale,
        z: mz,
        sx: 0.28 * scale,
        sy: 0.07 * scale,
        sz: 0.28 * scale,
      })
    }
  }

  // Spread low holly bushes, polka-dot mushrooms, frosted pebbles & wisps across all 5 regions + Crystal Isle
  const foliageAnchors = [
    ...CONTINENT_REGIONS.map((r) => ({ x: r.x, z: r.z, span: r.id === 'vila-central' ? 96 : 110, step: r.id === 'vila-central' ? 4.2 : 5.4 })),
    { x: -244, z: 286, span: 82, step: 6.0 },
  ]

  let mushroomClustersPlaced = 0
  for (const anchor of foliageAnchors) {
    for (let dz = -anchor.span; dz <= anchor.span; dz += anchor.step) {
      for (let dx = -anchor.span; dx <= anchor.span; dx += anchor.step) {
        if (Math.hypot(dx, dz) > anchor.span) continue
        const wx = anchor.x + dx
        const wz = anchor.z + dz
        if (!isLandWorld(wx, wz) || isRiverWorld(wx, wz) || isLakeWorld(wx, wz)) continue

        const { gridX, gridY } = worldToGridCoords(wx, wz)
        const gx = Math.round(gridX)
        const gy = Math.round(gridY)
        if (isBlockedForTree(gridX, gridY)) continue

        const hash = Math.abs((gx * 73856093) ^ (gy * 19349663)) % 100
        const px = wx + ((hash % 7) - 3) * 0.24
        const pz = wz + (((hash >> 2) % 7) - 3) * 0.24

        if (hash >= 16 && hash < 28) {
          if (hash % 3 === 0) {
            buckets.trunkBrown.push({ x: px, y: 0.16, z: pz, sx: 0.18, sy: 0.32, sz: 0.18 })
            buckets.pineMid.push({ x: px, y: 0.42, z: pz, sx: 0.62, sy: 0.34, sz: 0.62 })
            buckets.snowCap.push({ x: px, y: 0.62, z: pz, sx: 0.46, sy: 0.12, sz: 0.46 })
          } else {
            buckets.shrubGreen.push({ x: px, y: 0.2, z: pz, sx: 0.72, sy: 0.4, sz: 0.72 })
            buckets.snowCap.push({ x: px, y: 0.42, z: pz, sx: 0.56, sy: 0.12, sz: 0.56 })
            if (hash % 2 === 0) {
              buckets.berryRed.push({ x: px + 0.22, y: 0.3, z: pz + 0.22, sx: 0.14, sy: 0.14, sz: 0.14 })
            }
          }
        } else if (hash >= 34 && hash < 46) {
          buckets.snowTuft.push({ x: px, y: 0.09, z: pz, sx: 0.92, sy: 0.18, sz: 0.78 })
          buckets.icePebble.push({ x: px + 0.34, y: 0.1, z: pz - 0.22, sx: 0.26, sy: 0.18, sz: 0.24 })
          if (hash % 2 === 1) {
            buckets.icePebble.push({ x: px - 0.28, y: 0.08, z: pz + 0.26, sx: 0.2, sy: 0.14, sz: 0.2 })
          }
        } else if (hash >= 56 && hash < 63 && mushroomClustersPlaced < 290) {
          mushroomClustersPlaced += 1
          const baseScale = 0.85 + (hash % 3) * 0.22
          pushVoxelMushroom(px, pz, baseScale, hash === 61)
          if (hash % 2 === 0) {
            pushVoxelMushroom(px + 0.46, pz - 0.28, baseScale * 0.68, false)
          }
          if (hash === 58 || hash === 62) {
            pushVoxelMushroom(px - 0.38, pz + 0.34, baseScale * 0.58, false)
          }
        }

        if (hash >= 93 && wisps.length < 96) {
          const wispColor = hash % 3 === 0 ? '#ffd166' : '#7dd3fc'
          const wy = 1.8 + (hash % 5) * 0.5
          const wisp = createVoxelMesh(px, wy, pz, 0.2, 0.2, 0.2, wispColor, true, 0.85)
          root.add(wisp)
          wisps.push({ mesh: wisp, baseX: px, baseY: wy, baseZ: pz, phase: hash * 0.2 })
        }
      }
    }
  }

  // Lakeshore mushroom clusters, cozy pebbles & centerpiece pine saplings on all 5 scenic lake islets
  for (let li = 0; li < CONTINENT_LAKES.length; li += 1) {
    const lake = CONTINENT_LAKES[li]
    // Centerpiece mini frosted pine + white snow stones on each lake's center islet
    const ix = lake.x + lake.isletOffsetX
    const iz = lake.z + lake.isletOffsetZ
    buckets.trunkBrown.push({ x: ix, y: 0.65, z: iz, sx: 0.36, sy: 1.1, sz: 0.36 })
    buckets.pineMid.push({ x: ix, y: 1.45, z: iz, sx: 1.55, sy: 0.72, sz: 1.55 })
    buckets.snowCap.push({ x: ix, y: 1.86, z: iz, sx: 1.25, sy: 0.18, sz: 1.25 })
    buckets.pineMid.push({ x: ix, y: 2.24, z: iz, sx: 1.05, sy: 0.62, sz: 1.05 })
    buckets.snowCap.push({ x: ix, y: 2.6, z: iz, sx: 0.82, sy: 0.18, sz: 0.82 })
    buckets.icePebble.push({ x: ix + 1.1, y: 0.45, z: iz + 0.8, sx: 0.55, sy: 0.38, sz: 0.48 })

    // Lush lakeside polka-dot toadstools ringing every shore
    for (let k = 0; k < 10; k += 1) {
      const ang = (k / 10) * Math.PI * 2 + li * 0.5
      const sx = lake.x + Math.cos(ang) * (lake.rx + 4.8)
      const sz = lake.z + Math.sin(ang) * (lake.rz + 4.8)
      if (!isLandWorld(sx, sz) || isRiverWorld(sx, sz) || isLakeWorld(sx, sz)) continue
      if (isLakePierWorld(sx, sz)) continue
      const isToadstool = k % 5 === 0
      pushVoxelMushroom(sx, sz, isToadstool ? 1.85 : 0.92 + (k % 3) * 0.16, isToadstool)
      if (k % 2 === 0) {
        pushVoxelMushroom(sx + 0.52, sz + 0.36, 0.72, false)
      }
    }
  }

  addInstancedBucket(root, buckets.trunkBrown, '#6b4226')
  addInstancedBucket(root, buckets.pineMid, '#184a34')
  addInstancedBucket(root, buckets.snowCap, CITY_PALETTE.snow)
  addInstancedBucket(root, buckets.shrubGreen, '#1d543b')
  addInstancedBucket(root, buckets.berryRed, '#ef4444', true)
  addInstancedBucket(root, buckets.snowTuft, '#eef6ff')
  addInstancedBucket(root, buckets.icePebble, '#9bb4da')
  addInstancedBucket(root, buckets.mushroomStem, '#f5e6cf')
  addInstancedBucket(root, buckets.mushroomCapRed, '#dc2626')
  addInstancedBucket(root, buckets.mushroomSpotWhite, '#f8fafc')
  addInstancedBucket(root, buckets.mushroomGlowSpore, '#fde047', true)
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
  pointLights: THREE.PointLight[],
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
  pointLights.push(treehouseLight)

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
  pointLights: THREE.PointLight[],
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
  pointLights.push(crystalLight)

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
  pointLights: THREE.PointLight[],
  crystalRotators: CrystalRotator[],
  magicSeedPoints: MagicParticleItem[],
  interactiveProps: InteractivePropHandle[],
): void {
  VILLAGE_COTTAGES.forEach((cottage) => {
    const { x, z } = gridToWorld(cottage.gridX + 1.2, cottage.gridY + 1.2)

    if (cottage.variant === 'santa-treehouse') {
      buildMonumentalSantaTreehouse(
        root,
        x,
        z,
        smokePuffs,
        lampGlows,
        pointLights,
        magicSeedPoints,
        interactiveProps,
      )
      return
    }

    if (cottage.variant === 'crystal-tower') {
      buildCrystalTower(
        root,
        x,
        z,
        lampGlows,
        pointLights,
        crystalRotators,
        magicSeedPoints,
        interactiveProps,
      )
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
  pointLights: THREE.PointLight[],
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
  pointLights.push(marketLight)

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
  pointLights: THREE.PointLight[],
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
      buildNorthPoleMarket(root, x, z, lampGlows, pointLights, magicSeedPoints, interactiveProps)
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
      pointLights.push(poleLight)

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
        pointLights.push(light)
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
      pointLights.push(fireLight)

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

function buildOuterNeighborhoodsAndProps(
  root: THREE.Group,
  smokePuffs: BuiltVoxelWorld['smokePuffs'],
  lampGlows: THREE.Mesh[],
  interactiveProps: InteractivePropHandle[],
): void {
  const stoneBoxes: BoxInstance[] = []
  const woodDarkBoxes: BoxInstance[] = []
  const woodMidBoxes: BoxInstance[] = []
  const timberLightBoxes: BoxInstance[] = []
  const wallCreamBoxes: BoxInstance[] = []
  const roofSpruceBoxes: BoxInstance[] = []
  const roofCrimsonBoxes: BoxInstance[] = []
  const snowWhiteBoxes: BoxInstance[] = []
  const iceGlowBoxes: BoxInstance[] = []
  const wreathGreenBoxes: BoxInstance[] = []
  const berryRedBoxes: BoxInstance[] = []
  const snowSlateBoxes: BoxInstance[] = []
  const orangeBoxes: BoxInstance[] = []
  const warmAmberGlowBoxes: BoxInstance[] = []
  const emberGlowBoxes: BoxInstance[] = []
  const emeraldBeaconBoxes: BoxInstance[] = []
  const cyanBeaconBoxes: BoxInstance[] = []
  const warmGroundPads: BoxInstance[] = []

  // 1. Cozy Timber Chalets, Lakeside Fisherman Huts & Woodland Market Kiosks
  OUTER_NEIGHBORHOOD_CHALETS.forEach((chalet, idx) => {
    const { x, z } = gridToWorld(chalet.gridX, chalet.gridY)
    const r = chalet.rotationY
    const variant = chalet.variant ?? 'chalet'
    const roofBucket = chalet.roofTheme === 'spruce' ? roofSpruceBoxes : roofCrimsonBoxes

    if (variant === 'stall') {
      // Open festive timber woodland stall with striped canopy & steaming hot cocoa mugs
      pushTransformedBox(woodDarkBoxes, x, z, r, -1.35, 1.35, -0.95, 0.26, 2.7, 0.26)
      pushTransformedBox(woodDarkBoxes, x, z, r, 1.35, 1.35, -0.95, 0.26, 2.7, 0.26)
      pushTransformedBox(woodDarkBoxes, x, z, r, -1.35, 1.35, 0.95, 0.26, 2.7, 0.26)
      pushTransformedBox(woodDarkBoxes, x, z, r, 1.35, 1.35, 0.95, 0.26, 2.7, 0.26)
      pushTransformedBox(woodMidBoxes, x, z, r, 0, 0.72, 0.75, 2.8, 0.95, 0.72)
      pushTransformedBox(timberLightBoxes, x, z, r, 0, 1.24, 0.78, 3.0, 0.14, 0.84)
      pushTransformedBox(woodDarkBoxes, x, z, r, 0, 0.68, -0.88, 2.7, 1.36, 0.24)
      for (const sIdx of [-1.05, -0.35, 0.35, 1.05]) {
        const stripeBucket = Math.abs(Math.round(sIdx * 10)) % 2 === 1 ? roofCrimsonBoxes : snowWhiteBoxes
        pushTransformedBox(stripeBucket, x, z, r, sIdx, 2.68, 0.05, 0.72, 0.36, 2.65)
      }
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 2.94, 0.05, 2.95, 0.16, 2.45)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, -0.9, 2.38, 0.98, 0.34, 0.38, 0.34)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, 0.9, 2.38, 0.98, 0.34, 0.38, 0.34)
      pushTransformedBox(berryRedBoxes, x, z, r, -0.55, 1.44, 0.78, 0.3, 0.26, 0.3)
      pushTransformedBox(wallCreamBoxes, x, z, r, 0.48, 1.44, 0.76, 0.26, 0.28, 0.26)
      pushTransformedBox(warmGroundPads, x, z, r, 0, 0.08, 1.65, 3.2, 0.08, 2.0)

      const collider = new THREE.Mesh(getUnitBoxGeometry(), INVISIBLE_HITBOX_MATERIAL)
      collider.position.set(x, 1.6, z)
      collider.scale.set(3.4, 3.2, 3.2)
      collider.rotation.y = r
      root.add(collider)
      interactiveProps.push({
        mesh: collider,
        dialogue: {
          title: chalet.title,
          text: chalet.text,
          titleEn: chalet.titleEn,
          textEn: chalet.textEn,
        },
      })
      return
    }

    if (variant === 'fisherman') {
      // Compact rustic fisherman hut with timber deck apron, supply barrels, net rack & chimney
      pushTransformedBox(stoneBoxes, x, z, r, 0, 0.2, 0, 4.4, 0.4, 4.0)
      pushTransformedBox(timberLightBoxes, x, z, r, 0, 0.28, 2.1, 4.2, 0.26, 1.4)
      pushTransformedBox(woodMidBoxes, x, z, r, 0, 1.52, -0.1, 3.6, 2.3, 3.2)
      pushTransformedBox(woodDarkBoxes, x, z, r, -1.72, 1.52, 1.42, 0.32, 2.3, 0.32)
      pushTransformedBox(woodDarkBoxes, x, z, r, 1.72, 1.52, 1.42, 0.32, 2.3, 0.32)
      pushTransformedBox(woodDarkBoxes, x, z, r, 0, 1.25, 1.52, 0.96, 1.75, 0.16)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, -1.05, 1.75, 1.54, 0.58, 0.58, 0.12)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, 1.05, 1.75, 1.54, 0.58, 0.58, 0.12)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, 0, 1.75, -1.72, 0.62, 0.58, 0.12)
      // Slanted fisherman roof with snow trim
      pushTransformedBox(roofBucket, x, z, r, 0, 2.9, -0.1, 4.4, 0.58, 3.9)
      pushTransformedBox(roofBucket, x, z, r, 0, 3.45, -0.1, 3.2, 0.52, 2.9)
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 3.78, -0.1, 2.95, 0.2, 2.65)
      // Crates, barrel & dock lantern on the timber porch
      pushTransformedBox(timberLightBoxes, x, z, r, 1.55, 0.62, 2.15, 0.65, 0.55, 0.65)
      pushTransformedBox(woodDarkBoxes, x, z, r, -1.52, 0.72, 2.1, 0.52, 0.72, 0.52)
      pushTransformedBox(berryRedBoxes, x, z, r, 0.72, 1.76, 1.62, 0.28, 0.28, 0.28)
      pushTransformedBox(stoneBoxes, x, z, r, -1.15, 3.6, -0.9, 0.72, 1.7, 0.72)
      pushTransformedBox(warmGroundPads, x, z, r, 0, 0.08, 2.4, 3.8, 0.08, 2.0)

      const cosR = Math.cos(r)
      const sinR = Math.sin(r)
      const smokeX = x + -1.15 * cosR + -0.9 * sinR
      const smokeZ = z - -1.15 * sinR + -0.9 * cosR
      const puff = createVoxelMesh(smokeX, 4.75, smokeZ, 0.36, 0.32, 0.36, '#e2e8f0', false, 0.44)
      root.add(puff)
      smokePuffs.push({ mesh: puff, baseY: 4.7, phase: idx * 0.85 })

      const collider = new THREE.Mesh(getUnitBoxGeometry(), INVISIBLE_HITBOX_MATERIAL)
      collider.position.set(x, 2.0, z)
      collider.scale.set(4.4, 4.0, 4.6)
      collider.rotation.y = r
      root.add(collider)
      interactiveProps.push({
        mesh: collider,
        dialogue: {
          title: chalet.title,
          text: chalet.text,
          titleEn: chalet.titleEn,
          textEn: chalet.textEn,
        },
      })
      return
    }

    // Standard full alpine neighborhood chalet
    pushTransformedBox(stoneBoxes, x, z, r, 0, 0.22, 0, 5.4, 0.44, 4.8)
    pushTransformedBox(snowSlateBoxes, x, z, r, 0, 0.46, 0, 4.9, 0.14, 4.3)
    // Cozy cabin timber & warm log walls
    pushTransformedBox(woodMidBoxes, x, z, r, 0, 1.85, 0, 4.4, 2.7, 3.8)
    pushTransformedBox(woodDarkBoxes, x, z, r, -2.05, 1.85, 1.75, 0.38, 2.7, 0.38)
    pushTransformedBox(woodDarkBoxes, x, z, r, 2.05, 1.85, 1.75, 0.38, 2.7, 0.38)
    pushTransformedBox(woodDarkBoxes, x, z, r, -2.05, 1.85, -1.75, 0.38, 2.7, 0.38)
    pushTransformedBox(woodDarkBoxes, x, z, r, 2.05, 1.85, -1.75, 0.38, 2.7, 0.38)
    // Front door & festive holiday wreath
    pushTransformedBox(woodDarkBoxes, x, z, r, 0, 1.48, 1.94, 1.15, 2.05, 0.18)
    pushTransformedBox(roofCrimsonBoxes, x, z, r, 0, 1.44, 2.02, 0.92, 1.85, 0.1)
    pushTransformedBox(wreathGreenBoxes, x, z, r, 0, 1.95, 2.1, 0.56, 0.56, 0.12)
    pushTransformedBox(berryRedBoxes, x, z, r, 0, 2.16, 2.16, 0.24, 0.16, 0.08)

    // Warm yellow lit windows on front, sides, and back
    for (const side of [-1.25, 1.25]) {
      pushTransformedBox(woodDarkBoxes, x, z, r, side, 2.05, 1.93, 0.9, 0.92, 0.16)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, side, 2.05, 2.01, 0.68, 0.72, 0.08)
      pushTransformedBox(snowWhiteBoxes, x, z, r, side, 1.56, 2.0, 0.92, 0.14, 0.22)
    }
    for (const sSide of [-2.22, 2.22]) {
      pushTransformedBox(woodDarkBoxes, x, z, r, sSide, 2.05, 0, 0.16, 0.92, 0.96)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, sSide * 1.04, 2.05, 0, 0.08, 0.72, 0.74)
    }
    pushTransformedBox(warmAmberGlowBoxes, x, z, r, 0, 2.05, -1.96, 0.74, 0.74, 0.12)

    // Pitched layered winter roof + thick snow cap
    pushTransformedBox(roofBucket, x, z, r, 0, 3.45, 0, 5.4, 0.65, 4.8)
    pushTransformedBox(roofBucket, x, z, r, 0, 4.08, 0, 4.2, 0.65, 3.7)
    pushTransformedBox(roofBucket, x, z, r, 0, 4.68, 0, 2.6, 0.58, 2.5)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 5.05, 0, 2.35, 0.24, 2.25)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 3.82, 1.85, 5.1, 0.2, 1.25)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 3.82, -1.85, 5.1, 0.2, 1.25)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 1.9, 4.44, 0, 1.0, 0.2, 3.2)

    // Stone chimney + firewood stack + warm light pad in front snow
    pushTransformedBox(stoneBoxes, x, z, r, -1.45, 4.6, -0.95, 0.88, 2.2, 0.88)
    pushTransformedBox(snowWhiteBoxes, x, z, r, -1.45, 5.76, -0.95, 1.02, 0.16, 1.02)
    pushTransformedBox(timberLightBoxes, x, z, r, 2.45, 0.35, 0.8, 0.65, 0.55, 0.95)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 2.45, 0.66, 0.8, 0.6, 0.12, 0.9)
    pushTransformedBox(warmGroundPads, x, z, r, 0, 0.08, 2.7, 4.6, 0.08, 2.4)

    // Rising chimney smoke puff
    const cosR = Math.cos(r)
    const sinR = Math.sin(r)
    const smokeX = x + -1.45 * cosR + -0.95 * sinR
    const smokeZ = z - -1.45 * sinR + -0.95 * cosR
    const puff = createVoxelMesh(smokeX, 6.2, smokeZ, 0.44, 0.38, 0.44, '#e2e8f0', false, 0.46)
    root.add(puff)
    smokePuffs.push({ mesh: puff, baseY: 6.1, phase: idx * 0.9 })

    // Lightweight collider mesh for clicking chalet landmark
    const collider = new THREE.Mesh(getUnitBoxGeometry(), INVISIBLE_HITBOX_MATERIAL)
    collider.position.set(x, 2.6, z)
    collider.scale.set(5.2, 5.0, 4.8)
    collider.rotation.y = r
    root.add(collider)
    interactiveProps.push({
      mesh: collider,
      dialogue: {
        title: chalet.title,
        text: chalet.text,
        titleEn: chalet.titleEn,
        textEn: chalet.textEn,
      },
    })
  })

  // 2. Outer Winter Beacon Watchtowers acting as glowing exploration landmarks
  OUTER_WATCHTOWERS.forEach((tower) => {
    const { x, z } = gridToWorld(tower.gridX, tower.gridY)
    const r = tower.rotationY
    const beaconBucket =
      tower.beaconColor === '#39d353'
        ? emeraldBeaconBoxes
        : tower.beaconColor === '#7dd3fc'
          ? cyanBeaconBoxes
          : warmAmberGlowBoxes

    // Stone base plinth & 4 tall timber stilts
    pushTransformedBox(stoneBoxes, x, z, r, 0, 0.35, 0, 4.0, 0.7, 4.0)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 0.74, 0, 3.6, 0.14, 3.6)
    for (const px of [-1.25, 1.25]) {
      for (const pz of [-1.25, 1.25]) {
        pushTransformedBox(woodDarkBoxes, x, z, r, px, 3.4, pz, 0.46, 5.8, 0.46)
      }
    }
    // Diagonal timber bracing + watch deck
    pushTransformedBox(woodMidBoxes, x, z, r, 0, 3.2, 0, 2.8, 0.35, 2.8)
    pushTransformedBox(woodMidBoxes, x, z, r, 0, 6.1, 0, 4.2, 0.42, 4.2)
    pushTransformedBox(woodDarkBoxes, x, z, r, 0, 6.6, -1.95, 4.1, 0.55, 0.24)
    pushTransformedBox(woodDarkBoxes, x, z, r, 0, 6.6, 1.95, 4.1, 0.55, 0.24)
    pushTransformedBox(woodDarkBoxes, x, z, r, -1.95, 6.6, 0, 0.24, 0.55, 3.8)
    pushTransformedBox(woodDarkBoxes, x, z, r, 1.95, 6.6, 0, 0.24, 0.55, 3.8)
    // Beacon lantern cage + bright top light
    for (const cx of [-0.95, 0.95]) {
      for (const cz of [-0.95, 0.95]) {
        pushTransformedBox(woodDarkBoxes, x, z, r, cx, 7.65, cz, 0.26, 2.1, 0.26)
      }
    }
    pushTransformedBox(beaconBucket, x, z, r, 0, 7.55, 0, 1.25, 1.45, 1.25)
    pushTransformedBox(roofSpruceBoxes, x, z, r, 0, 8.95, 0, 3.6, 0.55, 3.6)
    pushTransformedBox(roofSpruceBoxes, x, z, r, 0, 9.5, 0, 2.2, 0.55, 2.2)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 9.88, 0, 2.0, 0.22, 2.0)
    pushTransformedBox(beaconBucket, x, z, r, 0, 10.25, 0, 0.42, 0.52, 0.42)
    pushTransformedBox(warmGroundPads, x, z, r, 0, 0.08, 0, 4.6, 0.08, 4.6)

    const collider = new THREE.Mesh(getUnitBoxGeometry(), INVISIBLE_HITBOX_MATERIAL)
    collider.position.set(x, 5.0, z)
    collider.scale.set(4.2, 10.2, 4.2)
    collider.rotation.y = r
    root.add(collider)
    interactiveProps.push({
      mesh: collider,
      dialogue: {
        title: tower.title,
        text: tower.text,
        titleEn: tower.titleEn,
        textEn: tower.textEn,
      },
    })
  })

  // 3. Outer sector rustic lanterns, campfires, snowmen, igloos & signposts (pooled InstancedMesh)
  OUTER_WOODLAND_PROPS.forEach((prop, i) => {
    const { x, z } = gridToWorld(prop.gridX, prop.gridY)
    const r = ((i * 73) % 4) * (Math.PI * 0.5)

    if (prop.type === 'lamp') {
      pushTransformedBox(woodDarkBoxes, x, z, r, 0, 1.35, 0, 0.3, 2.7, 0.3)
      pushTransformedBox(woodMidBoxes, x, z, r, 0.32, 2.55, 0, 0.85, 0.22, 0.24)
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 2.78, 0, 0.42, 0.14, 0.42)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, 0.56, 2.18, 0, 0.48, 0.56, 0.48)
      pushTransformedBox(woodDarkBoxes, x, z, r, 0.56, 2.5, 0, 0.62, 0.14, 0.62)
      pushTransformedBox(wreathGreenBoxes, x, z, r, 0, 1.72, 0.18, 0.48, 0.48, 0.12)
      pushTransformedBox(berryRedBoxes, x, z, r, 0, 1.72, 0.24, 0.18, 0.18, 0.08)
      pushTransformedBox(warmGroundPads, x, z, r, 0.4, 0.08, 0, 3.0, 0.08, 3.0)
      return
    }

    if (prop.type === 'campfire') {
      stoneBoxes.push({ x, y: 0.18, z, sx: 1.35, sy: 0.36, sz: 1.35 })
      woodDarkBoxes.push({ x, y: 0.36, z, sx: 0.9, sy: 0.22, sz: 0.9 })
      emberGlowBoxes.push({ x, y: 0.6, z, sx: 0.58, sy: 0.5, sz: 0.58 })
      warmAmberGlowBoxes.push({ x, y: 0.88, z, sx: 0.32, sy: 0.38, sz: 0.32 })
      warmGroundPads.push({ x, y: 0.08, z, sx: 3.2, sy: 0.08, sz: 3.2 })
      return
    }

    if (prop.type === 'snowman') {
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 0.45, 0, 1.15, 0.9, 1.15)
      pushTransformedBox(snowSlateBoxes, x, z, r, 0, 1.2, 0, 0.85, 0.72, 0.85)
      pushTransformedBox(berryRedBoxes, x, z, r, 0, 1.6, 0, 0.92, 0.18, 0.92)
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 1.9, 0, 0.65, 0.58, 0.65)
      pushTransformedBox(orangeBoxes, x, z, r, 0, 1.9, 0.38, 0.14, 0.14, 0.3)
      pushTransformedBox(woodDarkBoxes, x, z, r, 0, 2.35, 0, 0.74, 0.38, 0.74)
      return
    }

    if (prop.type === 'signpost') {
      pushTransformedBox(woodDarkBoxes, x, z, r, 0, 0.9, 0, 0.3, 1.8, 0.3)
      pushTransformedBox(timberLightBoxes, x, z, r, 0, 1.55, 0, 1.5, 0.52, 0.24)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, 0, 1.55, 0.14, 1.0, 0.18, 0.08)
      return
    }

    if (prop.type === 'igloo') {
      pushTransformedBox(snowSlateBoxes, x, z, r, 0, 0.3, 0, 3.2, 0.6, 3.2)
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 0.82, 0, 2.7, 0.5, 2.7)
      pushTransformedBox(iceGlowBoxes, x, z, r, 0, 1.24, 0, 2.05, 0.4, 2.05)
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 1.6, 0, 1.32, 0.32, 1.32)
      pushTransformedBox(iceGlowBoxes, x, z, r, 0, 1.84, 0, 0.72, 0.18, 0.72)
      pushTransformedBox(snowSlateBoxes, x, z, r, 0, 0.52, 1.68, 1.36, 1.0, 1.25)
      pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 1.08, 1.66, 1.44, 0.22, 1.15)
      pushTransformedBox(iceGlowBoxes, x, z, r, 0, 0.94, 2.26, 1.4, 0.2, 0.24)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, 0, 0.42, 2.22, 0.76, 0.68, 0.24)
      pushTransformedBox(emberGlowBoxes, x, z, r, 0, 0.32, 1.88, 0.52, 0.48, 0.38)
      pushTransformedBox(warmGroundPads, x, z, r, 0, 0.08, 2.55, 2.2, 0.08, 1.7)
    }
  })

  // 3b. 40 Charming Voxel Snow & Ice Igloos (lakeside camps, igloo villages & glades)
  const pushDetailedIgloo = (
    x: number,
    z: number,
    r: number,
    accent: 'lantern' | 'campfire' | 'snowman' | 'snowpile' = 'snowpile',
  ) => {
    // Sculpted ice-brick domed hemisphere (#f1f5f9 white snow + #dce8fc / #bae6fd ice courses)
    pushTransformedBox(snowSlateBoxes, x, z, r, 0, 0.32, 0, 3.35, 0.64, 3.35)
    pushTransformedBox(iceGlowBoxes, x, z, r, 0, 0.54, 0, 3.44, 0.18, 2.55)
    pushTransformedBox(iceGlowBoxes, x, z, r, 0, 0.54, 0, 2.55, 0.18, 3.44)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 0.9, 0, 2.82, 0.54, 2.82)
    pushTransformedBox(snowSlateBoxes, x, z, r, 0, 1.34, 0, 2.15, 0.44, 2.15)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 1.7, 0, 1.42, 0.32, 1.42)
    pushTransformedBox(iceGlowBoxes, x, z, r, 0, 1.94, 0, 0.78, 0.2, 0.78)
    // Protruding snow-block entrance tunnel with warm amber/gold doorway glow
    pushTransformedBox(snowSlateBoxes, x, z, r, 0, 0.52, 1.82, 1.42, 1.04, 1.35)
    pushTransformedBox(snowWhiteBoxes, x, z, r, 0, 1.1, 1.8, 1.5, 0.22, 1.24)
    pushTransformedBox(iceGlowBoxes, x, z, r, 0, 0.96, 2.46, 1.46, 0.18, 0.22)
    pushTransformedBox(warmAmberGlowBoxes, x, z, r, 0, 0.44, 2.42, 0.78, 0.72, 0.24)
    pushTransformedBox(emberGlowBoxes, x, z, r, 0, 0.34, 2.02, 0.55, 0.52, 0.4)
    pushTransformedBox(warmGroundPads, x, z, r, 0, 0.08, 2.75, 2.4, 0.08, 1.9)

    if (accent === 'lantern') {
      pushTransformedBox(woodDarkBoxes, x, z, r, 1.28, 0.65, 2.15, 0.22, 1.3, 0.22)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, 1.28, 1.38, 2.15, 0.36, 0.38, 0.36)
    } else if (accent === 'campfire') {
      pushTransformedBox(stoneBoxes, x, z, r, -1.45, 0.16, 2.55, 1.05, 0.32, 1.05)
      pushTransformedBox(woodDarkBoxes, x, z, r, -1.45, 0.32, 2.55, 0.68, 0.18, 0.68)
      pushTransformedBox(emberGlowBoxes, x, z, r, -1.45, 0.52, 2.55, 0.44, 0.38, 0.44)
      pushTransformedBox(warmAmberGlowBoxes, x, z, r, -1.45, 0.74, 2.55, 0.24, 0.28, 0.24)
    } else if (accent === 'snowman') {
      pushTransformedBox(snowWhiteBoxes, x, z, r, 1.55, 0.36, 2.05, 0.85, 0.72, 0.85)
      pushTransformedBox(berryRedBoxes, x, z, r, 1.55, 0.78, 2.05, 0.66, 0.14, 0.66)
      pushTransformedBox(snowWhiteBoxes, x, z, r, 1.55, 1.02, 2.05, 0.52, 0.46, 0.52)
      pushTransformedBox(orangeBoxes, x, z, r, 1.55, 1.02, 2.34, 0.12, 0.12, 0.24)
    } else {
      pushTransformedBox(snowWhiteBoxes, x, z, r, 1.48, 0.24, 1.92, 0.82, 0.48, 0.74)
      pushTransformedBox(iceGlowBoxes, x, z, r, -1.48, 0.2, 1.85, 0.56, 0.4, 0.56)
    }
  }

  for (const igloo of OUTER_IGLOO_VILLAGES) {
    const { x, z } = gridToWorld(igloo.gridX, igloo.gridY)
    pushDetailedIgloo(x, z, igloo.rotationY, igloo.accent ?? 'snowpile')
    const collider = new THREE.Mesh(getUnitBoxGeometry(), INVISIBLE_HITBOX_MATERIAL)
    collider.position.set(x, 1.2, z)
    collider.scale.set(3.8, 2.6, 4.2)
    collider.rotation.y = igloo.rotationY
    root.add(collider)
    interactiveProps.push({
      mesh: collider,
      dialogue: {
        title: igloo.title,
        text: igloo.text,
        titleEn: igloo.titleEn,
        textEn: igloo.textEn,
      },
    })
  }

  // 4. Scenic Lakeside Pier Lanterns on all 6 continent lakes
  for (const lake of CONTINENT_LAKES) {
    const signX = lake.pierDir === 'west' ? -1 : lake.pierDir === 'east' ? 1 : 0
    const signZ = lake.pierDir === 'north' ? -1 : lake.pierDir === 'south' ? 1 : 0
    const tipX = lake.pierX + signX * 9.5
    const tipZ = lake.pierZ + signZ * 9.5
    woodDarkBoxes.push({ x: tipX, y: 0.9, z: tipZ, sx: 0.28, sy: 1.85, sz: 0.28 })
    warmAmberGlowBoxes.push({ x: tipX, y: 1.95, z: tipZ, sx: 0.44, sy: 0.46, sz: 0.44 })
    warmGroundPads.push({ x: tipX, y: 0.2, z: tipZ, sx: 3.2, sy: 0.08, sz: 3.2 })
  }

  // 5. Porto Glacial Frozen Harbor Pier & Arctic Wooden Sailboats along balanced SE coast
  const harborPierZ = 272
  for (let px = 326; px <= 356; px += 3) {
    woodMidBoxes.push({ x: px, y: 0.14, z: harborPierZ, sx: 2.9, sy: 0.32, sz: 3.6 })
    woodDarkBoxes.push({ x: px, y: -0.35, z: harborPierZ - 1.55, sx: 0.36, sy: 1.25, sz: 0.36 })
    woodDarkBoxes.push({ x: px, y: -0.35, z: harborPierZ + 1.55, sx: 0.36, sy: 1.25, sz: 0.36 })
  }
  pushTransformedBox(woodDarkBoxes, 356, harborPierZ - 1.55, 0, 0, 1.3, 0, 0.3, 2.4, 0.3)
  pushTransformedBox(warmAmberGlowBoxes, 356, harborPierZ - 1.55, 0, 0, 2.55, 0, 0.55, 0.55, 0.55)
  pushTransformedBox(warmGroundPads, 354, harborPierZ, 0, 0, 0.34, 0, 3.8, 0.08, 3.8)

  const harborBoats = [
    { x: 362, z: 258, rotY: 0.45, trim: roofCrimsonBoxes },
    { x: 368, z: 282, rotY: -0.62, trim: wreathGreenBoxes },
    { x: 350, z: 294, rotY: 0.85, trim: roofSpruceBoxes },
  ]
  for (const boat of harborBoats) {
    const r = boat.rotY
    pushTransformedBox(woodDarkBoxes, boat.x, boat.z, r, 0, -0.15, 0, 2.2, 0.55, 4.6)
    pushTransformedBox(woodMidBoxes, boat.x, boat.z, r, 0, 0.16, 0, 1.85, 0.22, 3.8)
    pushTransformedBox(boat.trim, boat.x, boat.z, r, 0, 0.65, -0.9, 1.4, 0.85, 1.4)
    pushTransformedBox(snowWhiteBoxes, boat.x, boat.z, r, 0, 1.15, -0.9, 1.5, 0.16, 1.5)
    pushTransformedBox(warmAmberGlowBoxes, boat.x, boat.z, r, 0, 0.72, -0.15, 0.55, 0.42, 0.14)
    pushTransformedBox(timberLightBoxes, boat.x, boat.z, r, 0, 2.1, 0.7, 0.24, 3.6, 0.24)
    pushTransformedBox(wallCreamBoxes, boat.x, boat.z, r, 0.42, 2.35, 0.7, 1.35, 1.85, 0.14)
  }

  // Soft pulsing glow pads mesh registered once
  if (warmGroundPads.length > 0) {
    addInstancedBucket(root, warmGroundPads, CITY_PALETTE.warmGlow, true, 0.22)
  }

  addInstancedBucket(root, stoneBoxes, '#64749c')
  addInstancedBucket(root, woodDarkBoxes, '#4a2a14')
  addInstancedBucket(root, woodMidBoxes, '#7c4d2b')
  addInstancedBucket(root, timberLightBoxes, '#9c6644')
  addInstancedBucket(root, wallCreamBoxes, '#f3e5c8')
  addInstancedBucket(root, roofSpruceBoxes, '#11404f')
  addInstancedBucket(root, roofCrimsonBoxes, '#991b1b')
  addInstancedBucket(root, snowWhiteBoxes, '#f4f8ff')
  addInstancedBucket(root, snowSlateBoxes, '#dce8fc')
  addInstancedBucket(root, iceGlowBoxes, '#bae6fd')
  addInstancedBucket(root, wreathGreenBoxes, '#15803d')
  addInstancedBucket(root, orangeBoxes, '#f97316')
  addInstancedBucket(root, berryRedBoxes, '#ef4444', true)
  addInstancedBucket(root, warmAmberGlowBoxes, CITY_PALETTE.warmGlow, true)
  addInstancedBucket(root, emberGlowBoxes, CITY_PALETTE.warmEmber, true)
  addInstancedBucket(root, emeraldBeaconBoxes, '#39d353', true)
  addInstancedBucket(root, cyanBeaconBoxes, '#7dd3fc', true)

  void lampGlows
}

function buildLivingWildlife(root: THREE.Group, wildlife: WildlifeActor[]): void {
  const spawnReindeer = (gx: number, gy: number, rx: number, rz: number, speed: number, idx: number, rudolph = false) => {
    const p = gridToWorld(gx, gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.65, 0, 0.55, 0.52, 1.05, '#8c5835'))
    g.add(createVoxelMesh(-0.18, 0.22, 0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0.18, 0.22, 0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(-0.18, 0.22, -0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0.18, 0.22, -0.35, 0.14, 0.44, 0.14, '#5c371d'))
    g.add(createVoxelMesh(0, 1.02, 0.42, 0.32, 0.48, 0.32, '#9c6644'))
    g.add(createVoxelMesh(0, 1.25, 0.56, 0.34, 0.3, 0.44, '#b07a57'))
    g.add(createVoxelMesh(0, 1.24, 0.8, 0.14, 0.14, 0.14, rudolph ? '#ef4444' : '#1e293b', rudolph))
    g.add(createVoxelMesh(-0.22, 1.56, 0.46, 0.1, 0.42, 0.1, '#e6c9a2'))
    g.add(createVoxelMesh(0.22, 1.56, 0.46, 0.1, 0.42, 0.1, '#e6c9a2'))
    g.position.set(p.x, 0, p.z)
    root.add(g)
    wildlife.push({
      mesh: g,
      kind: 'reindeer',
      centerX: p.x,
      centerZ: p.z,
      radiusX: rx,
      radiusZ: rz,
      speed,
      phase: idx * 1.7,
    })
  }

  const spawnFox = (gx: number, gy: number, arctic: boolean, idx: number) => {
    const p = gridToWorld(gx, gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.32, 0, 0.36, 0.32, 0.65, arctic ? '#e2e8f0' : '#ea580c'))
    g.add(createVoxelMesh(0, 0.48, 0.36, 0.32, 0.28, 0.32, arctic ? '#f8fafc' : '#f97316'))
    g.add(createVoxelMesh(0, 0.36, -0.45, 0.2, 0.2, 0.36, '#f8fafc'))
    g.position.set(p.x, 0, p.z)
    root.add(g)
    wildlife.push({
      mesh: g,
      kind: 'fox',
      centerX: p.x,
      centerZ: p.z,
      radiusX: 2.3,
      radiusZ: 1.7,
      speed: 0.72,
      phase: idx * 2.1,
    })
  }

  const spawnPenguin = (gx: number, gy: number, rx: number, rz: number, idx: number) => {
    const p = gridToWorld(gx, gy)
    const g = new THREE.Group()
    g.add(createVoxelMesh(0, 0.44, 0, 0.38, 0.62, 0.34, '#0f172a'))
    g.add(createVoxelMesh(0, 0.42, 0.15, 0.26, 0.48, 0.1, '#f8fafc'))
    g.add(createVoxelMesh(0, 0.64, 0.22, 0.14, 0.08, 0.16, '#fb923c'))
    g.add(createVoxelMesh(-0.22, 0.42, 0, 0.08, 0.32, 0.14, '#1e293b'))
    g.add(createVoxelMesh(0.22, 0.42, 0, 0.08, 0.32, 0.14, '#1e293b'))
    g.add(createVoxelMesh(-0.1, 0.08, 0.08, 0.12, 0.1, 0.18, '#f97316'))
    g.add(createVoxelMesh(0.1, 0.08, 0.08, 0.12, 0.1, 0.18, '#f97316'))
    g.position.set(p.x, 0, p.z)
    root.add(g)
    wildlife.push({
      mesh: g,
      kind: 'penguin',
      centerX: p.x,
      centerZ: p.z,
      radiusX: rx,
      radiusZ: rz,
      speed: 0.58,
      phase: idx * 1.45,
    })
  }

  const spawnBunny = (gx: number, gy: number, idx: number) => {
    const p = gridToWorld(gx, gy)
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
  }

  // Central meadow + all 5 continent district & island reindeer herds
  const reindeerSpots = [
    { gx: 19.8 + VILLAGE_OFFSET_X, gy: 11.2 + VILLAGE_OFFSET_Y, rx: 2.2, rz: 1.6, speed: 0.44, r: true },
    { gx: 15.5 + VILLAGE_OFFSET_X, gy: 9.5 + VILLAGE_OFFSET_Y, rx: 3.4, rz: 2.2, speed: 0.4 },
    { gx: 36.5 + VILLAGE_OFFSET_X, gy: 9.2 + VILLAGE_OFFSET_Y, rx: 3.2, rz: 2.4, speed: 0.36 },
    { gx: 15 + VILLAGE_OFFSET_X, gy: 29 + VILLAGE_OFFSET_Y, rx: 2.8, rz: 2.2, speed: 0.38 },
    { gx: 36 + VILLAGE_OFFSET_X, gy: 22 + VILLAGE_OFFSET_Y, rx: 3.4, rz: 2.4, speed: 0.42 },
    { gx: -34, gy: -24, rx: 3.2, rz: 2.2, speed: 0.38 },
    { gx: -30, gy: -25, rx: 2.9, rz: 2.1, speed: 0.36 },
    { gx: 95, gy: -10, rx: 3.2, rz: 2.2, speed: 0.37 },
    { gx: 118, gy: -2, rx: 3.0, rz: 2.1, speed: 0.39 },
    { gx: 98, gy: 82, rx: 2.8, rz: 2.0, speed: 0.39 },
    { gx: 22, gy: -92, rx: 2.7, rz: 1.9, speed: 0.41 },
    { gx: -40, gy: 105, rx: 2.9, rz: 2.0, speed: 0.37 },
    { gx: -22, gy: 52, rx: 2.6, rz: 2.0, speed: 0.4 },
    { gx: 60, gy: 58, rx: 2.8, rz: 1.9, speed: 0.39 },
  ]
  reindeerSpots.forEach((s, idx) => spawnReindeer(s.gx, s.gy, s.rx, s.rz, s.speed, idx, s.r))

  // Tundra & white Arctic foxes across central woods, Bosque Aurora, Vale dos Commits, lakes & islands
  const foxSpots = [
    { gx: 8 + VILLAGE_OFFSET_X, gy: 13 + VILLAGE_OFFSET_Y, arctic: false },
    { gx: 26 + VILLAGE_OFFSET_X, gy: 8 + VILLAGE_OFFSET_Y, arctic: true },
    { gx: 33 + VILLAGE_OFFSET_X, gy: 28 + VILLAGE_OFFSET_Y, arctic: false },
    { gx: 18 + VILLAGE_OFFSET_X, gy: 31 + VILLAGE_OFFSET_Y, arctic: true },
    { gx: 16, gy: 39, arctic: false },
    { gx: -36, gy: -25, arctic: true },
    { gx: -55, gy: 4, arctic: true },
    { gx: 101, gy: -9, arctic: false },
    { gx: 120, gy: 6, arctic: true },
    { gx: 104, gy: 90, arctic: false },
    { gx: 20, gy: -90, arctic: true },
    { gx: -44, gy: 104, arctic: true },
    { gx: -26, gy: 57, arctic: false },
  ]
  foxSpots.forEach((s, idx) => spawnFox(s.gx, s.gy, s.arctic, idx))

  // Playful voxel penguins along all 6 scenic lakeshores, igloo villages & Porto Glacial docks
  const penguinSpots = [
    // Vila pond & Lago da Vila
    { gx: 9.8, gy: 31.2, rx: 1.1, rz: 0.9 },
    { gx: 10.6, gy: 32.0, rx: 1.0, rz: 0.8 },
    { gx: 13.5, gy: 35.5, rx: 1.1, rz: 0.9 },
    { gx: 14.0, gy: 40.5, rx: 1.0, rz: 0.8 },
    // Lago da Aurora
    { gx: -38.5, gy: -11.5, rx: 1.1, rz: 0.9 },
    { gx: -39.0, gy: -17.5, rx: 1.0, rz: 0.8 },
    { gx: -58.5, gy: -10.0, rx: 1.2, rz: 0.9 },
    // Lago Esmeralda
    { gx: 102.5, gy: -15.0, rx: 1.1, rz: 0.9 },
    { gx: 102.5, gy: -21.5, rx: 1.0, rz: 0.8 },
    { gx: 120.5, gy: -14.0, rx: 1.1, rz: 0.9 },
    // Lagoa do Porto, Porto Glacial harbor docks & coastal igloo village
    { gx: 68.0, gy: 70.5, rx: 1.1, rz: 0.9 },
    { gx: 68.5, gy: 76.5, rx: 1.0, rz: 0.8 },
    { gx: 124.5, gy: 105.0, rx: 1.4, rz: 1.0 },
    { gx: 126.0, gy: 107.0, rx: 1.2, rz: 0.9 },
    { gx: 123.5, gy: 108.5, rx: 1.2, rz: 0.9 },
    { gx: 91.0, gy: 97.5, rx: 1.2, rz: 0.9 },
    { gx: 95.5, gy: 98.0, rx: 1.1, rz: 0.9 },
    // Lago Boreal & Ilha Norte Igloo Village
    { gx: 10.5, gy: -96.5, rx: 1.2, rz: 1.0 },
    { gx: 10.5, gy: -101.5, rx: 1.0, rz: 0.8 },
    { gx: 26.5, gy: -101.0, rx: 1.2, rz: 0.9 },
    { gx: 32.0, gy: -97.5, rx: 1.1, rz: 0.9 },
    // Lago Cristalino & Ilha Cristalina Igloo Village
    { gx: -49.5, gy: 110.5, rx: 1.2, rz: 0.9 },
    { gx: -50.0, gy: 115.5, rx: 1.0, rz: 0.8 },
    { gx: -37.0, gy: 117.0, rx: 1.1, rz: 0.9 },
  ]
  penguinSpots.forEach((s, idx) => spawnPenguin(s.gx, s.gy, s.rx, s.rz, idx))

  // Snow bunnies near chalets, igloo glades and mushroom groves across all regions
  const bunnySpots = [
    { gx: 9 + VILLAGE_OFFSET_X, gy: 23 + VILLAGE_OFFSET_Y },
    { gx: 21 + VILLAGE_OFFSET_X, gy: 15 + VILLAGE_OFFSET_Y },
    { gx: 27 + VILLAGE_OFFSET_X, gy: 19 + VILLAGE_OFFSET_Y },
    { gx: 37 + VILLAGE_OFFSET_X, gy: 15 + VILLAGE_OFFSET_Y },
    { gx: 13 + VILLAGE_OFFSET_X, gy: 8 + VILLAGE_OFFSET_Y },
    { gx: 16.5, gy: 40.5 },
    { gx: -31.0, gy: -20.0 },
    { gx: -38.5, gy: -23.0 },
    { gx: 97.5, gy: -4.0 },
    { gx: 107.0, gy: -11.0 },
    { gx: 123.5, gy: 0.5 },
    { gx: 102.5, gy: 89.0 },
    { gx: 23.0, gy: -92.5 },
    { gx: 13.5, gy: -100.5 },
    { gx: -45.5, gy: 111.0 },
    { gx: -25.5, gy: 56.5 },
    { gx: 62.0, gy: 56.5 },
  ]
  bunnySpots.forEach((s, idx) => spawnBunny(s.gx, s.gy, idx))

  // Glowing fish swimming along the frozen pond, main river, tributaries & all 6 scenic lakes
  const fishSpots = [
    { gx: 5.5 + VILLAGE_OFFSET_X, gy: 28.5 + VILLAGE_OFFSET_Y, rx: 1.8, rz: 1.2 },
    { gx: 6.2 + VILLAGE_OFFSET_X, gy: 29.8 + VILLAGE_OFFSET_Y, rx: 1.5, rz: 1.0 },
    { gx: getMainRiverCenterX(12 + VILLAGE_OFFSET_Y), gy: 12 + VILLAGE_OFFSET_Y, rx: 0.8, rz: 2.0 },
    { gx: getMainRiverCenterX(20 + VILLAGE_OFFSET_Y), gy: 20 + VILLAGE_OFFSET_Y, rx: 0.8, rz: 2.0 },
    { gx: 19 + VILLAGE_OFFSET_X, gy: getEastTributaryCenterY(19 + VILLAGE_OFFSET_X), rx: 2.2, rz: 0.7 },
    { gx: 29 + VILLAGE_OFFSET_X, gy: getEastTributaryCenterY(29 + VILLAGE_OFFSET_X), rx: 2.2, rz: 0.7 },
    { gx: getMainRiverCenterX(-12), gy: -12, rx: 0.8, rz: 2.0 },
    { gx: getMainRiverCenterX(49), gy: 49, rx: 0.8, rz: 2.0 },
    { gx: 56, gy: getEastTributaryCenterY(56), rx: 2.0, rz: 0.7 },
    { gx: -2, gy: getWestTributaryCenterY(-2), rx: 2.0, rz: 0.7 },
    // Two glowing fish inside every one of the 5 scenic continent lakes
    ...CONTINENT_LAKES.flatMap((lake, li) => {
      const g1 = worldToGridCoords(lake.x + lake.rx * 0.42, lake.z - lake.rz * 0.25)
      const g2 = worldToGridCoords(lake.x - lake.rx * 0.42, lake.z + lake.rz * 0.28)
      return [
        { gx: g1.gridX, gy: g1.gridY, rx: 2.2 + (li % 2) * 0.5, rz: 1.5 },
        { gx: g2.gridX, gy: g2.gridY, rx: 1.9, rz: 1.7 + (li % 2) * 0.4 },
      ]
    }),
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

function buildSnowSystem(root: THREE.Group): {
  snowParticles: THREE.InstancedMesh
  snowData: Array<{ ox: number; y: number; oz: number; speed: number; drift: number; size: number }>
} {
  const count = 560
  const geom = getUnitBoxGeometry()
  const mat = getEmissiveMaterial('#f4f8ff', 0.88)
  const snowParticles = new THREE.InstancedMesh(geom, mat, count)
  snowParticles.frustumCulled = false
  const snowData: Array<{
    ox: number
    y: number
    oz: number
    speed: number
    drift: number
    size: number
  }> = []
  const dummy = new THREE.Object3D()

  for (let i = 0; i < count; i += 1) {
    const ox = ((i * 73) % 240) - 120
    const y = (i % 38) + 1
    const oz = ((i * 131) % 200) - 100
    const speedLayer = i % 3
    const speed = speedLayer === 0 ? 1.5 : speedLayer === 1 ? 2.6 : 3.9
    const size = speedLayer === 0 ? 0.16 : speedLayer === 1 ? 0.22 : 0.28
    snowData.push({
      ox,
      y,
      oz,
      speed,
      drift: (i % 7) * 0.4,
      size,
    })
    dummy.position.set(ox, y, oz)
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
