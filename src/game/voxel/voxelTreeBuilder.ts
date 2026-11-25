import * as THREE from 'three'
import { normalizeGiftSlug } from '../../config/gifts'
import {
  classifyGitHubContributionLevel,
  type GitHubContributionLevel,
} from '../../services/githubSyncService'
import type { GitHubContributionWeek, TreeGiftSummary, TreeLevelId } from '../../types/city'
import { getContinentRegionAtWorld, gridToWorldCoords } from '../layout/continentGeography'
import { getToonGradientMap } from './voxelMaterials'

export type TreeThemeId =
  | 'classic-pine'
  | 'snowy-pine'
  | 'golden-pine'
  | 'frosted-blue'
  | 'crimson-autumn'
  | 'sakura-winter'
  | 'arcane-violet'
  | 'grand-elder'

export type BaubleBucket = 'l1' | 'l2' | 'l3' | 'l4a' | 'l4b'

export interface BaubleInstanceData {
  x: number
  y: number
  z: number
  size: number
  color: string
  bucket: BaubleBucket
}

export interface VoxelTreeBuildOptions {
  level: TreeLevelId
  seed: number
  gridX?: number
  gridY?: number
  gifts?: readonly TreeGiftSummary[]
  giftCount?: number
  isScenicLandmark?: boolean
  isCreatorSpecial?: boolean
  contributionCount?: number
  activeDays?: number
  commitLevelCounts?: readonly [number, number, number, number]
  calendarWeeks?: GitHubContributionWeek[]
  /** World azimuth toward viewer so featured gifts face camera without colliding with companion corner */
  frontYaw?: number
  /** When true, keep random tree rotation on group while counter-rotating directional gifts toward frontYaw */
  preserveFrontOrientation?: boolean
  /** Kept for API compatibility */
  separateBaubles?: boolean
}

export interface BuiltVoxelTree {
  group: THREE.Group
  phaseAMeshes: THREE.Mesh[]
  phaseBMeshes: THREE.Mesh[]
  starMeshes: THREE.Mesh[]
  baubleInstances: BaubleInstanceData[]
  auraMesh: THREE.Mesh | null
  height: number
  outerRadius: number
  themeLabel: string
  rotationY: number
}

interface TierPlacementRing {
  tier: number
  y: number
  baseRadius: number
  offsetX: number
  offsetZ: number
  lobeCount: number
  waveAmp: number
  phaseShift: number
}

interface Point3D {
  x: number
  y: number
  z: number
}

export interface ColoredBox {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  color: string
}

type TreeArchetype =
  | 'alpine-spire'
  | 'broad-nordic'
  | 'voluminous-cedar'
  | 'irregular-wild'
  | 'spaced-tier'
  | 'dense-cypress'
  | 'frosted-spruce'

interface ThemePalette {
  label: string
  snowRatio: number
}

/**
 * Rich evergreen pine base shades (fake AO darker underside -> lush mid -> sunlit outer tips).
 */
export const PINE_FOLIAGE_SHADES = {
  deep: '#133c2b',
  mid: '#184a34',
  bright: '#1d543b',
} as const

/**
 * Harmonious luminous GitHub contribution green palette mapped directly onto
 * exterior cubic canopy voxels (levels 1..4).
 */
export const GITHUB_COMMIT_CUBE_COLORS = {
  1: '#1b7a43',
  2: '#26a641',
  3: '#39d353',
  4: '#5ee87a',
} as const

export const GITHUB_BAUBLE_COLORS = {
  1: [GITHUB_COMMIT_CUBE_COLORS[1]] as const,
  2: [GITHUB_COMMIT_CUBE_COLORS[2]] as const,
  3: [GITHUB_COMMIT_CUBE_COLORS[3]] as const,
  4: [GITHUB_COMMIT_CUBE_COLORS[4]] as const,
}

const HOLIDAY_MICRO_LIGHT_COLORS = ['#ffd166', '#ffbe55', '#e63946', '#ffd166'] as const

const WARM_BARK_PALETTE = {
  dark: '#5c371d',
  mid: '#6b4226',
  warm: '#7c4d2b',
  light: '#8c5835',
} as const

const THEME_PALETTES: Record<TreeThemeId, ThemePalette> = {
  'classic-pine': { label: 'Pinheiro Clássico', snowRatio: 0.28 },
  'snowy-pine': { label: 'Pinheiro Nevado', snowRatio: 0.38 },
  'golden-pine': { label: 'Pinheiro Boreal', snowRatio: 0.25 },
  'frosted-blue': { label: 'Pinheiro Glacial', snowRatio: 0.36 },
  'crimson-autumn': { label: 'Pinheiro da Tundra', snowRatio: 0.27 },
  'sakura-winter': { label: 'Pinheiro Prateado', snowRatio: 0.35 },
  'arcane-violet': { label: 'Pinheiro Polar', snowRatio: 0.31 },
  'grand-elder': { label: 'Pinheiro Ancião do Norte', snowRatio: 0.33 },
}

const ARCHETYPES: readonly TreeArchetype[] = [
  'alpine-spire',
  'broad-nordic',
  'voluminous-cedar',
  'irregular-wild',
  'spaced-tier',
  'dense-cypress',
  'frosted-spruce',
]

const baseBox = new THREE.BoxGeometry(1, 1, 1)
const basePos = baseBox.getAttribute('position') as THREE.BufferAttribute
const baseNorm = baseBox.getAttribute('normal') as THREE.BufferAttribute
const baseIdx = baseBox.getIndex() as THREE.BufferAttribute

const gradientMap = getToonGradientMap()

// Subtle pulsing glow uniform shared across all luminous commit cubes, stars, and holiday micro-lights
const commitEmissiveGlowUniform = { value: 0.44 }

function createFoliageStandardMaterial(vertexColors: boolean): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    vertexColors,
  })
  mat.customProgramCacheKey = () => `voxel-pine-foliage-v1-${vertexColors ? 'vc' : 'inst'}`
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float commitGreenBoost = smoothstep(0.08, 0.28, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
       totalEmissiveRadiance += diffuseColor.rgb * (commitGreenBoost * 0.20);`,
    )
  }
  return mat
}

function createLuminousStandardMaterial(vertexColors: boolean): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    vertexColors,
  })
  mat.customProgramCacheKey = () => `voxel-pine-emissive-v1-${vertexColors ? 'vc' : 'inst'}`
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCommitGlow = commitEmissiveGlowUniform
    shader.fragmentShader = `uniform float uCommitGlow;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance += diffuseColor.rgb * uCommitGlow;`,
    )
  }
  return mat
}

/**
 * Shared crisp matte PBR materials for global InstancedMesh layers in City3DCanvas.
 */
export const sharedTreeInstancedMaterials = {
  shadowPad: new THREE.MeshStandardMaterial({
    color: '#a3b6dc',
    roughness: 0.96,
    metalness: 0.0,
  }),
  trunk: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
  }),
  foliage: createFoliageStandardMaterial(false),
  emissive: createLuminousStandardMaterial(false),
  snow: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
  }),
}

// Merged-mesh materials for single-tree TreePixelCanvas previews and gift overlays
const trunkMergedMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  metalness: 0.0,
})
const foliageMergedMat = createFoliageStandardMaterial(true)
const emissiveMergedMat = createLuminousStandardMaterial(true)
const snowMergedMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.9,
  metalness: 0.0,
})

// Community gift showcase materials (preserved for crisp retro PC / baubles / bells animations)
const staticMat = new THREE.MeshToonMaterial({
  vertexColors: true,
  gradientMap,
})
const l4PhaseAMergedMat = new THREE.MeshBasicMaterial({ vertexColors: true })
const l4PhaseBMergedMat = new THREE.MeshBasicMaterial({ vertexColors: true })

export const instancedBaubleMaterials = {
  l12: sharedTreeInstancedMaterials.foliage,
  l3: sharedTreeInstancedMaterials.emissive,
  l4a: l4PhaseAMergedMat,
  l4b: l4PhaseBMergedMat,
}

export function updateCommitLightsTwinkle(timeSec: number, animate = true): void {
  if (!animate) {
    commitEmissiveGlowUniform.value = 0.44
    l4PhaseAMergedMat.color.setRGB(0.95, 0.95, 0.95)
    l4PhaseBMergedMat.color.setRGB(0.95, 0.95, 0.95)
    return
  }

  // Smooth breathing glow across Level 3/4 commit cubes, star, and warm holiday micro-lights
  commitEmissiveGlowUniform.value = 0.39 + 0.13 * (0.5 + 0.5 * Math.sin(timeSec * 2.1))

  const bA = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(timeSec * 3.1))
  const bB = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + Math.PI))
  l4PhaseAMergedMat.color.setRGB(bA, bA, bA)
  l4PhaseBMergedMat.color.setRGB(bB, bB, bB)
}

function mergeColoredBoxes(boxes: ColoredBox[], material: THREE.Material): THREE.Mesh {
  const vCount = basePos.count
  const iCount = baseIdx.count
  const totalV = boxes.length * vCount
  const totalI = boxes.length * iCount

  const positions = new Float32Array(totalV * 3)
  const normals = new Float32Array(totalV * 3)
  const colors = new Float32Array(totalV * 3)
  const indices = new Uint32Array(totalI)
  const c = new THREE.Color()

  for (let b = 0; b < boxes.length; b += 1) {
    const box = boxes[b]
    c.set(box.color)
    const vOffset = b * vCount
    const iOffset = b * iCount

    for (let v = 0; v < vCount; v += 1) {
      const pIdx = (vOffset + v) * 3
      positions[pIdx] = basePos.getX(v) * box.sx + box.x
      positions[pIdx + 1] = basePos.getY(v) * box.sy + box.y
      positions[pIdx + 2] = basePos.getZ(v) * box.sz + box.z

      normals[pIdx] = baseNorm.getX(v)
      normals[pIdx + 1] = baseNorm.getY(v)
      normals[pIdx + 2] = baseNorm.getZ(v)

      colors[pIdx] = c.r
      colors[pIdx + 1] = c.g
      colors[pIdx + 2] = c.b
    }

    for (let i = 0; i < iCount; i += 1) {
      indices[iOffset + i] = baseIdx.getX(i) + vOffset
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geom.setIndex(new THREE.BufferAttribute(indices, 1))
  geom.computeBoundingSphere()

  return new THREE.Mesh(geom, material)
}

export function mixSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 2654435761)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 2246822519) >>> 0
  h ^= h >>> 13
  return h >>> 0
}

export interface TreeVisualSpec {
  themeId: TreeThemeId
  themeLabel: string
  palette: ThemePalette
  archetype: TreeArchetype
  hDecor: number
  scaleBoost: number
  organicScale: number
  voxelSize: number
  trunkExposedVoxels: number
  trunkW: number
  tierRadii: number[]
  spireY: number
  tierRings: TierPlacementRing[]
  topY: number
  starY: number
  starScale: number
  outerRadius: number
  rotationY: number
}

const TIER_RADII_BY_LEVEL: Record<TreeLevelId, readonly number[]> = {
  0: [2.0, 1.3],
  1: [2.5, 1.8, 1.1],
  2: [2.9, 2.2, 1.4],
  3: [3.3, 2.6, 1.9, 1.2],
  4: [3.7, 3.0, 2.3, 1.7, 1.1],
  5: [4.0, 3.4, 2.8, 2.2, 1.6, 1.0],
  6: [4.3, 3.7, 3.1, 2.5, 2.0, 1.5, 1.0],
}

export function computeTreeVisualSpec(opts: {
  level: TreeLevelId
  seed: number
  gridX?: number
  gridY?: number
  isScenicLandmark?: boolean
  isCreatorSpecial?: boolean
  contributionCount?: number
}): TreeVisualSpec {
  const {
    level,
    seed,
    gridX = 24,
    gridY = 18,
    isScenicLandmark = false,
    isCreatorSpecial = false,
    contributionCount = 0,
  } = opts

  const hArch = mixSeed(seed, 11)
  const hDecor = mixSeed(seed, 71)

  const resolved = isScenicLandmark
    ? { themeId: 'grand-elder' as TreeThemeId, label: 'Árvore Lendária do Polo Norte' }
    : resolveTreeTheme(seed, gridX, gridY, level)

  const palette = THEME_PALETTES[resolved.themeId]
  const archetype: TreeArchetype =
    resolved.themeId === 'grand-elder'
      ? 'voluminous-cedar'
      : ARCHETYPES[hArch % ARCHETYPES.length]

  const scaleBoost = isScenicLandmark ? 1.45 : 1.0
  const organicScale = isScenicLandmark ? 1.0 : 0.9 + (mixSeed(seed, 53) % 20) * 0.01
  const voxelSize = Number((0.43 * scaleBoost * organicScale).toFixed(4))

  const widthFactor =
    archetype === 'alpine-spire'
      ? 0.9
      : archetype === 'broad-nordic'
        ? 1.05
        : archetype === 'voluminous-cedar'
          ? 1.04
          : archetype === 'dense-cypress'
            ? 0.93
            : 1.0

  const trunkExposedVoxels = level <= 1 ? 2 : 3
  const baseRadii = [...TIER_RADII_BY_LEVEL[level]]
  if ((contributionCount >= 800 || isScenicLandmark) && level >= 5) {
    baseRadii.unshift(4.5)
  }

  const tierRadii = baseRadii.map((r, idx) =>
    idx === 0 || r > 1.5 ? Number((r * widthFactor).toFixed(3)) : r,
  )

  const trunkW =
    (level <= 1 ? 1.08 : level <= 3 ? 1.24 : 1.42) * voxelSize

  const tierRings: TierPlacementRing[] = []
  let maxRingReach = 1.0

  for (let t = 0; t < tierRadii.length; t += 1) {
    const r = tierRadii[t]
    const yIdx = trunkExposedVoxels + t * 2
    const phase = (t + (seed % 2)) % 2 === 0 ? 0 : Math.PI
    const amp = r >= 2.8 ? 0.22 : r >= 1.8 ? 0.19 : 0.12
    const baseRadiusWorld = r * 0.84 * voxelSize
    const maxTierReach = r * (0.84 + amp) * voxelSize + voxelSize * 0.55
    if (maxTierReach > maxRingReach) maxRingReach = maxTierReach

    tierRings.push({
      tier: t,
      y: (yIdx + 0.5) * voxelSize,
      baseRadius: baseRadiusWorld,
      offsetX: 0,
      offsetZ: 0,
      lobeCount: 4,
      waveAmp: amp,
      phaseShift: phase,
    })
  }

  const spireY = trunkExposedVoxels + tierRadii.length * 2
  const topY = (spireY + 1) * voxelSize
  const starScale =
    isCreatorSpecial || isScenicLandmark
      ? 1.3
      : level >= 5
        ? 1.12
        : level >= 3
          ? 0.96
          : 0.8
  const starY = topY + 0.62 * voxelSize * starScale

  return {
    themeId: resolved.themeId,
    themeLabel: resolved.label,
    palette,
    archetype,
    hDecor,
    scaleBoost,
    organicScale,
    voxelSize,
    trunkExposedVoxels,
    trunkW,
    tierRadii,
    spireY,
    tierRings,
    topY,
    starY,
    starScale,
    outerRadius: Math.max(1.05, Math.min(2.38 * scaleBoost, maxRingReach)),
    rotationY:
      (mixSeed(seed, 31) % 4) * (Math.PI * 0.5) +
      (((mixSeed(seed, 97) % 11) - 5) / 5) * 0.28,
  }
}

interface GridCellMeta {
  ix: number
  iy: number
  iz: number
  tier: number
  rNorm: number
}

interface CandidateCommitSlot {
  ix: number
  iy: number
  iz: number
  tier: number
  angle: number
  rNorm: number
  hasAbove: boolean
  hasBelow: boolean
  exposedSides: number
  exposedDirs: Array<[number, number]>
}

export interface VoxelTreeGeometryData {
  spec: TreeVisualSpec
  shadowPad: { sx: number; sy: number; sz: number }
  trunkBoxes: ColoredBox[]
  foliageBoxes: ColoredBox[]
  emissiveBoxes: ColoredBox[]
  snowBoxes: ColoredBox[]
  height: number
  outerRadius: number
}

function cellKey(ix: number, iy: number, iz: number): string {
  return `${ix},${iy},${iz}`
}

function buildGoldenStarVoxels(
  cx: number,
  starY: number,
  cz: number,
  u: number,
  starScale: number,
  isGrand: boolean,
  target: ColoredBox[],
): void {
  const s = u * starScale
  // Stem collar connecting crown tip to star
  target.push({
    x: cx,
    y: starY - 0.44 * s,
    z: cz,
    sx: 0.24 * s,
    sy: 0.34 * s,
    sz: 0.24 * s,
    color: '#ffd166',
  })
  // Warm bright star core
  target.push({
    x: cx,
    y: starY,
    z: cz,
    sx: 0.56 * s,
    sy: 0.56 * s,
    sz: 0.38 * s,
    color: '#fffbeb',
  })
  // Crisp sculpted 4-point rays (vertical, horizontal, depth)
  target.push({
    x: cx,
    y: starY + 0.42 * s,
    z: cz,
    sx: 0.26 * s,
    sy: 0.42 * s,
    sz: 0.26 * s,
    color: '#ffd166',
  })
  target.push({
    x: cx - 0.42 * s,
    y: starY,
    z: cz,
    sx: 0.42 * s,
    sy: 0.26 * s,
    sz: 0.26 * s,
    color: '#ffd166',
  })
  target.push({
    x: cx + 0.42 * s,
    y: starY,
    z: cz,
    sx: 0.42 * s,
    sy: 0.26 * s,
    sz: 0.26 * s,
    color: '#ffd166',
  })
  target.push({
    x: cx,
    y: starY,
    z: cz,
    sx: 0.26 * s,
    sy: 0.26 * s,
    sz: 0.72 * s,
    color: '#ffbe55',
  })

  // Subtle diagonal shoulder voxels & discrete warm halo glints
  if (isGrand) {
    target.push(
      {
        x: cx - 0.26 * s,
        y: starY + 0.24 * s,
        z: cz,
        sx: 0.18 * s,
        sy: 0.18 * s,
        sz: 0.18 * s,
        color: '#ffbe55',
      },
      {
        x: cx + 0.26 * s,
        y: starY + 0.24 * s,
        z: cz,
        sx: 0.18 * s,
        sy: 0.18 * s,
        sz: 0.18 * s,
        color: '#ffbe55',
      },
      {
        x: cx - 0.68 * s,
        y: starY + 0.26 * s,
        z: cz + 0.18 * s,
        sx: 0.15 * s,
        sy: 0.15 * s,
        sz: 0.15 * s,
        color: '#ffd166',
      },
      {
        x: cx + 0.68 * s,
        y: starY + 0.26 * s,
        z: cz - 0.18 * s,
        sx: 0.15 * s,
        sy: 0.15 * s,
        sz: 0.15 * s,
        color: '#ffd166',
      },
    )
  } else {
    target.push(
      {
        x: cx - 0.56 * s,
        y: starY + 0.24 * s,
        z: cz + 0.14 * s,
        sx: 0.14 * s,
        sy: 0.14 * s,
        sz: 0.14 * s,
        color: '#ffbe55',
      },
      {
        x: cx + 0.56 * s,
        y: starY + 0.24 * s,
        z: cz - 0.14 * s,
        sx: 0.14 * s,
        sy: 0.14 * s,
        sz: 0.14 * s,
        color: '#ffbe55',
      },
    )
  }
}

/**
 * Generates the unified 3D cubic-grid voxel pine tree shared by both the
 * global `InstancedMesh` city layer and single-tree `TreePixelCanvas` previews.
 */
export function generateVoxelTreeGeometryData(opts: {
  level: TreeLevelId
  seed: number
  gridX?: number
  gridY?: number
  isScenicLandmark?: boolean
  isCreatorSpecial?: boolean
  contributionCount?: number
  activeDays?: number
  commitLevelCounts?: readonly [number, number, number, number]
  calendarWeeks?: GitHubContributionWeek[]
  skipBaseStar?: boolean
}): VoxelTreeGeometryData {
  const {
    level,
    seed,
    gridX = 24,
    gridY = 18,
    isScenicLandmark = false,
    isCreatorSpecial = false,
    contributionCount = 0,
    activeDays,
    commitLevelCounts,
    calendarWeeks,
    skipBaseStar = false,
  } = opts

  const spec = computeTreeVisualSpec({
    level,
    seed,
    gridX,
    gridY,
    isScenicLandmark,
    isCreatorSpecial,
    contributionCount,
  })
  const u = spec.voxelSize

  const trunkBoxes: ColoredBox[] = []
  const foliageBoxes: ColoredBox[] = []
  const emissiveBoxes: ColoredBox[] = []
  const snowBoxes: ColoredBox[] = []

  // 1. Visible warm brown trunk (2–3 voxels tall) + sculpted wooden roots + base snow cushion
  const trunkW = spec.trunkW
  for (let iy = 0; iy < spec.trunkExposedVoxels; iy += 1) {
    const color =
      iy === 0
        ? WARM_BARK_PALETTE.mid
        : iy % 2 === 1
          ? WARM_BARK_PALETTE.warm
          : WARM_BARK_PALETTE.mid
    trunkBoxes.push({
      x: 0,
      y: (iy + 0.5) * u,
      z: 0,
      sx: trunkW,
      sy: u,
      sz: trunkW,
      color,
    })
  }
  // Subtle sunlit bark edge highlight on lower exposed trunk
  trunkBoxes.push({
    x: -trunkW * 0.24,
    y: spec.trunkExposedVoxels * u * 0.48,
    z: trunkW * 0.24,
    sx: trunkW * 0.44,
    sy: spec.trunkExposedVoxels * u * 0.92,
    sz: trunkW * 0.44,
    color: WARM_BARK_PALETTE.light,
  })
  // Internal trunk core spine rising partway inside canopy so no gaps show from below
  const innerSpineVoxels = Math.max(2, Math.floor(spec.tierRadii.length * 1.1))
  trunkBoxes.push({
    x: 0,
    y: (spec.trunkExposedVoxels + innerSpineVoxels * 0.5) * u,
    z: 0,
    sx: trunkW * 0.86,
    sy: innerSpineVoxels * u,
    sz: trunkW * 0.86,
    color: WARM_BARK_PALETTE.dark,
  })

  // Sculpted wooden root flares & compact snow pillows at the base
  const rootDist = trunkW * 0.52
  const rootH = u * 0.52
  const rootS = u * 0.5
  const rootDirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (let r = 0; r < rootDirs.length; r += 1) {
    const [dx, dz] = rootDirs[r]
    trunkBoxes.push({
      x: dx * rootDist,
      y: rootH * 0.5,
      z: dz * rootDist,
      sx: rootS,
      sy: rootH,
      sz: rootS,
      color: r % 2 === 0 ? WARM_BARK_PALETTE.dark : WARM_BARK_PALETTE.mid,
    })
  }

  // Compact snow drift tufts nestled in root corners
  const baseSnowOffset = trunkW * 0.62
  const baseSnowDirs: Array<[number, number]> = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]
  for (let b = 0; b < baseSnowDirs.length; b += 1) {
    if ((seed + b) % 3 === 0 && b > 1) continue
    const [dx, dz] = baseSnowDirs[b]
    snowBoxes.push({
      x: dx * baseSnowOffset,
      y: u * 0.14,
      z: dz * baseSnowOffset,
      sx: u * 0.72,
      sy: u * 0.28,
      sz: u * 0.72,
      color: b % 2 === 0 ? '#f4f8ff' : '#e1ecfe',
    })
  }

  // 2. Sculpted 3D cubic-grid pine canopy (octagonal / cruciform alternating boughs)
  const occupied = new Set<string>()
  const cellMeta = new Map<string, GridCellMeta>()

  const putCell = (ix: number, iy: number, iz: number, tier: number, rNorm: number) => {
    const k = cellKey(ix, iy, iz)
    occupied.add(k)
    const prev = cellMeta.get(k)
    if (!prev || rNorm > prev.rNorm) {
      cellMeta.set(k, { ix, iy, iz, tier, rNorm })
    }
  }

  for (let t = 0; t < spec.tierRadii.length; t += 1) {
    const r = spec.tierRadii[t]
    const y0 = spec.trunkExposedVoxels + t * 2
    const phase0 = (t + (seed % 2)) % 2 === 0 ? 0 : Math.PI
    const phase1 = phase0 === 0 ? Math.PI : 0

    const addBoughLayer = (
      iy: number,
      rad: number,
      phase: number,
      ampFactor: number,
      allowDroop: boolean,
    ) => {
      const bound = Math.ceil(rad + 1)
      for (let ix = -bound; ix <= bound; ix += 1) {
        for (let iz = -bound; iz <= bound; iz += 1) {
          const d = Math.hypot(ix, iz)
          if (d === 0) {
            putCell(ix, iy, iz, t, 0)
            continue
          }
          const theta = Math.atan2(iz, ix)
          const jitter =
            ((mixSeed(seed + ix * 41 + iz * 83, iy * 13 + t) % 100) / 100 - 0.5) * 0.13
          const amp = (rad >= 2.8 ? 0.22 : rad >= 1.8 ? 0.19 : 0.12) * ampFactor
          const effR =
            rad <= 1.25
              ? rad
              : rad * (0.83 + amp * Math.cos(4 * theta + phase) + jitter * (d > 1.4 ? 1 : 0))

          if (d <= effR + 0.13) {
            const rNorm = Math.min(1, d / Math.max(0.8, effR))
            putCell(ix, iy, iz, t, rNorm)
            if (allowDroop && rad >= 2.6 && d >= effR - 0.42 && iy - 1 >= spec.trunkExposedVoxels) {
              if (mixSeed(seed + ix * 31 + iz * 97, t + 1) % 3 !== 0) {
                putCell(ix, iy - 1, iz, t, 1)
              }
            }
          }
        }
      }
    }

    // Main sculpted tier skirt
    addBoughLayer(y0, r, phase0, 1.0, t > 0)
    // Tucked upper neck layer for clear layered branch separation
    const rNeck = r >= 2.2 ? r * 0.6 : Math.max(0.85, r * 0.58)
    addBoughLayer(y0 + 1, rNeck, phase1, 0.72, false)
  }

  // Sharp crown spire tip voxel
  putCell(0, spec.spireY, 0, spec.tierRadii.length, 1)

  // 3. Cull fully interior voxels & collect exterior surface slots + snow tips
  const surfaceCells: Array<{
    meta: GridCellMeta
    hasAbove: boolean
    hasBelow: boolean
    exposedSides: number
    exposedDirs: Array<[number, number]>
    slotIndex: number
  }> = []
  const candidateSlots: CandidateCommitSlot[] = []
  const candidateSnowTips: GridCellMeta[] = []
  let maxGridReach = 0

  for (const meta of cellMeta.values()) {
    const { ix, iy, iz } = meta
    const hasAbove = occupied.has(cellKey(ix, iy + 1, iz))
    const hasBelow = occupied.has(cellKey(ix, iy - 1, iz))
    const exposedDirs: Array<[number, number]> = []
    if (!occupied.has(cellKey(ix + 1, iy, iz))) exposedDirs.push([1, 0])
    if (!occupied.has(cellKey(ix - 1, iy, iz))) exposedDirs.push([-1, 0])
    if (!occupied.has(cellKey(ix, iy, iz + 1))) exposedDirs.push([0, 1])
    if (!occupied.has(cellKey(ix, iy, iz - 1))) exposedDirs.push([0, -1])

    const exposedSides = exposedDirs.length
    if (exposedSides === 0 && hasAbove && hasBelow) continue

    const reach = (Math.hypot(ix, iz) + 0.5) * u
    if (reach > maxGridReach) maxGridReach = reach

    let slotIndex = -1
    if (exposedSides > 0) {
      slotIndex = candidateSlots.length
      candidateSlots.push({
        ix,
        iy,
        iz,
        tier: meta.tier,
        angle: Math.atan2(iz, ix),
        rNorm: meta.rNorm,
        hasAbove,
        hasBelow,
        exposedSides,
        exposedDirs,
      })

      if (!hasAbove && exposedSides >= 2 && iy < spec.spireY) {
        candidateSnowTips.push(meta)
      }
    }

    surfaceCells.push({
      meta,
      hasAbove,
      hasBelow,
      exposedSides,
      exposedDirs,
      slotIndex,
    })
  }

  // Sort slot indices bottom-to-top along a spiral so calendar slices wrap naturally around the tree
  const spiralSlotOrder = candidateSlots
    .map((slot, idx) => ({
      idx,
      iy: slot.iy,
      wrappedAngle: ((slot.angle + slot.tier * 1.15) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2),
    }))
    .sort((a, b) => a.iy - b.iy || a.wrappedAngle - b.wrappedAngle)
    .map((item) => item.idx)

  // 4. Map real contribution calendar / activeDays strictly onto exterior foliage voxels
  const slotCommitLevel = new Map<number, GitHubContributionLevel>()
  const effectiveContrib = isScenicLandmark ? Math.max(950, contributionCount) : contributionCount
  if (
    spiralSlotOrder.length > 0 &&
    (effectiveContrib > 0 || (typeof activeDays === 'number' && activeDays > 0) || Boolean(calendarWeeks?.length))
  ) {
    assignProportionalCommitLevels({
      seed,
      contributionCount: effectiveContrib,
      activeDays,
      commitLevelCounts,
      calendarWeeks,
      candidateSlots,
      spiralSlotOrder,
      outLevels: slotCommitLevel,
    })
  }

  // 5. Emit foliage & commit cubes (all on exact uniform u x u x u cubic grid)
  for (let s = 0; s < surfaceCells.length; s += 1) {
    const cell = surfaceCells[s]
    const { ix, iy, iz } = cell.meta
    const wx = ix * u
    const wy = (iy + 0.5) * u
    const wz = iz * u

    const commitLvl = cell.slotIndex >= 0 ? slotCommitLevel.get(cell.slotIndex) : undefined
    if (commitLvl) {
      const color = GITHUB_COMMIT_CUBE_COLORS[commitLvl]
      const target = commitLvl >= 3 ? emissiveBoxes : foliageBoxes
      target.push({ x: wx, y: wy, z: wz, sx: u, sy: u, sz: u, color })
      continue
    }

    // Fake AO shading across rich evergreen pine shades (#133c2b, #184a34, #1d543b)
    const isUnderside = cell.hasAbove && !cell.hasBelow
    const isSunlitTip = !cell.hasAbove && cell.exposedSides >= 2
    const pineColor =
      isUnderside || (cell.hasAbove && cell.exposedSides <= 1)
        ? PINE_FOLIAGE_SHADES.deep
        : isSunlitTip || iy >= spec.spireY - 2
          ? PINE_FOLIAGE_SHADES.bright
          : PINE_FOLIAGE_SHADES.mid

    foliageBoxes.push({ x: wx, y: wy, z: wz, sx: u, sy: u, sz: u, color: pineColor })
  }

  // 6. Asymmetric delicate snow touches on selected outer upper branch tips (no white rings!)
  const snowThreshold = Math.round(spec.palette.snowRatio * 100)
  const snowH = u * 0.34
  const snowS = u * 0.94
  for (let i = 0; i < candidateSnowTips.length; i += 1) {
    const tip = candidateSnowTips[i]
    const roll = mixSeed(seed + tip.ix * 19 + tip.iz * 53, tip.iy + 7) % 100
    if (roll >= snowThreshold) continue
    snowBoxes.push({
      x: tip.ix * u,
      y: (tip.iy + 1) * u + snowH * 0.5,
      z: tip.iz * u,
      sx: snowS,
      sy: snowH,
      sz: snowS,
      color: roll % 4 === 0 ? '#e1ecfe' : '#f4f8ff',
    })
  }

  // 7. Add 4..8 subtle warm Christmas micro-lights embedded flush on exterior faces
  const targetLights = level <= 1 ? 4 : level <= 3 ? 6 : 8
  const unlitMicroCandidates: number[] = []
  const fallbackMicroCandidates: number[] = []
  for (let i = 0; i < spiralSlotOrder.length; i += 1) {
    const slotIdx = spiralSlotOrder[i]
    const slot = candidateSlots[slotIdx]
    if (slot.exposedDirs.length === 0 || slot.iy >= spec.spireY) continue
    if (!slotCommitLevel.has(slotIdx)) {
      unlitMicroCandidates.push(slotIdx)
    } else {
      fallbackMicroCandidates.push(slotIdx)
    }
  }

  const lightPool =
    unlitMicroCandidates.length >= targetLights
      ? unlitMicroCandidates
      : [...unlitMicroCandidates, ...fallbackMicroCandidates]

  if (lightPool.length > 0) {
    const pickedLightIndices: number[] = []
    const goldenAngle = 2.39996323
    const baseTheta = ((seed % 360) * Math.PI) / 180
    const lightSize = u * 0.34
    const lightCount = Math.min(targetLights, lightPool.length)

    for (let l = 0; l < lightCount; l += 1) {
      const targetTierFrac = (l + 0.5) / lightCount
      const targetTheta = baseTheta + l * goldenAngle
      let bestIdx = -1
      let bestScore = -Infinity

      for (let p = 0; p < lightPool.length; p += 1) {
        const slotIdx = lightPool[p]
        if (pickedLightIndices.includes(slotIdx)) continue
        const slot = candidateSlots[slotIdx]
        const tierFrac = (slot.iy - spec.trunkExposedVoxels) / Math.max(1, spec.spireY - spec.trunkExposedVoxels)
        let dTheta = Math.abs((slot.angle - targetTheta) % (Math.PI * 2))
        if (dTheta > Math.PI) dTheta = Math.PI * 2 - dTheta

        // Prefer spacing well apart from already placed lights
        let minNeighborDist = 99
        for (let q = 0; q < pickedLightIndices.length; q += 1) {
          const prev = candidateSlots[pickedLightIndices[q]]
          const dist = Math.hypot(slot.ix - prev.ix, slot.iy - prev.iy, slot.iz - prev.iz)
          if (dist < minNeighborDist) minNeighborDist = dist
        }
        const spacingBonus = Math.min(2.5, minNeighborDist * 0.7)
        const unlitBonus = slotCommitLevel.has(slotIdx) ? 0 : 1.5
        const score =
          unlitBonus + spacingBonus - Math.abs(tierFrac - targetTierFrac) * 2.2 - dTheta * 0.45

        if (score > bestScore) {
          bestScore = score
          bestIdx = slotIdx
        }
      }

      if (bestIdx < 0) break
      pickedLightIndices.push(bestIdx)
      const slot = candidateSlots[bestIdx]
      const dir = slot.exposedDirs[(seed + l) % slot.exposedDirs.length]
      emissiveBoxes.push({
        x: (slot.ix + dir[0] * 0.53) * u,
        y: (slot.iy + 0.52) * u,
        z: (slot.iz + dir[1] * 0.53) * u,
        sx: lightSize,
        sy: lightSize,
        sz: lightSize,
        color: HOLIDAY_MICRO_LIGHT_COLORS[(seed + l) % HOLIDAY_MICRO_LIGHT_COLORS.length],
      })
    }
  }

  // 8. Sculpted golden voxel star with subtle warm halo on top
  if (!skipBaseStar) {
    buildGoldenStarVoxels(
      0,
      spec.starY,
      0,
      u,
      spec.starScale,
      level >= 5 || isCreatorSpecial || isScenicLandmark,
      emissiveBoxes,
    )
  }

  const finalOuterRadius = Math.max(spec.outerRadius, maxGridReach)
  const padSpan = Math.min(3.4 * spec.scaleBoost, Math.max(1.75, finalOuterRadius * 1.32))
  const totalHeight = spec.starY + 0.75 * u * spec.starScale

  return {
    spec: { ...spec, outerRadius: finalOuterRadius },
    shadowPad: { sx: padSpan, sy: 0.06, sz: padSpan },
    trunkBoxes,
    foliageBoxes,
    emissiveBoxes,
    snowBoxes,
    height: totalHeight,
    outerRadius: finalOuterRadius,
  }
}

function assignProportionalCommitLevels(opts: {
  seed: number
  contributionCount: number
  activeDays?: number
  commitLevelCounts?: readonly [number, number, number, number]
  calendarWeeks?: GitHubContributionWeek[]
  candidateSlots: readonly CandidateCommitSlot[]
  spiralSlotOrder: readonly number[]
  outLevels: Map<number, GitHubContributionLevel>
}): void {
  const {
    seed,
    contributionCount,
    activeDays,
    commitLevelCounts,
    calendarWeeks,
    candidateSlots,
    spiralSlotOrder,
    outLevels,
  } = opts
  const totalSlots = spiralSlotOrder.length
  if (totalSlots === 0) return

  // Path A: Full GitHub contribution_calendar available
  if (Array.isArray(calendarWeeks) && calendarWeeks.length > 0) {
    const dayCounts: number[] = []
    let maxDayCount = 0
    let activeDayCount = 0

    for (let w = 0; w < calendarWeeks.length; w += 1) {
      const days = calendarWeeks[w]?.contributionDays
      if (!Array.isArray(days)) continue
      for (let d = 0; d < days.length; d += 1) {
        const count = Math.max(0, Math.floor(Number(days[d]?.contributionCount ?? 0)))
        dayCounts.push(count)
        if (count > 0) {
          activeDayCount += 1
          if (count > maxDayCount) maxDayCount = count
        }
      }
    }

    const totalDays = dayCounts.length
    if (totalDays > 0) {
      if (activeDayCount === 0) return

      const dayLevels: Array<0 | GitHubContributionLevel> = new Array(totalDays)
      const allActiveLevels: GitHubContributionLevel[] = []
      for (let d = 0; d < totalDays; d += 1) {
        const c = dayCounts[d]
        if (c <= 0) {
          dayLevels[d] = 0
        } else {
          const lvl = classifyGitHubContributionLevel(c, maxDayCount)
          dayLevels[d] = lvl
          allActiveLevels.push(lvl)
        }
      }

      const targetLit = Math.min(
        totalSlots,
        Math.max(1, Math.round((activeDayCount / totalDays) * totalSlots)),
      )

      const windowDensities: number[] = new Array(totalSlots)
      const windowLevels: GitHubContributionLevel[][] = new Array(totalSlots)
      for (let pos = 0; pos < totalSlots; pos += 1) {
        const startD = Math.floor((pos * totalDays) / totalSlots)
        const endD = Math.max(startD + 1, Math.floor(((pos + 1) * totalDays) / totalSlots))
        const levelsHere: GitHubContributionLevel[] = []
        for (let d = startD; d < endD; d += 1) {
          const lvl = dayLevels[d]
          if (lvl !== 0) levelsHere.push(lvl)
        }
        windowLevels[pos] = levelsHere
        windowDensities[pos] = levelsHere.length / (endD - startD)
      }

      const ranked: Array<{ pos: number; slotIdx: number; score: number }> = new Array(totalSlots)
      for (let pos = 0; pos < totalSlots; pos += 1) {
        const slotIdx = spiralSlotOrder[pos]
        const slot = candidateSlots[slotIdx]
        const dHere = windowDensities[pos]
        const prevD = pos > 0 ? windowDensities[pos - 1] : 0
        const nextD = pos + 1 < totalSlots ? windowDensities[pos + 1] : 0
        const neighborDensity = (prevD + nextD) * 0.5
        const jitter = (mixSeed(seed + pos * 29, totalDays + totalSlots) % 1000) / 1000
        // Slight outer/sunlit preference keeps deep under-bough crevices pine-shaded on busy trees
        const visualSurfaceBias = slot.rNorm * 0.16 + (slot.hasAbove ? 0 : 0.12)
        const score =
          (dHere > 0 ? 10 + dHere + jitter * 0.35 : neighborDensity * 2 + jitter * 0.5) +
          visualSurfaceBias
        ranked[pos] = { pos, slotIdx, score }
      }
      ranked.sort((a, b) => b.score - a.score)

      for (let r = 0; r < targetLit; r += 1) {
        const { pos, slotIdx } = ranked[r]
        const levelsHere = windowLevels[pos]
        const level =
          levelsHere.length > 0
            ? levelsHere[mixSeed(seed + pos * 41, totalSlots) % levelsHere.length]
            : allActiveLevels[mixSeed(seed + pos * 43, totalSlots) % allActiveLevels.length]
        outLevels.set(slotIdx, level)
      }
      return
    }
  }

  // Path B: Summary metadata (`activeDays / 365` & `commitLevelCounts`) or fallback contribution count
  const commits = Math.max(0, contributionCount)
  const resolvedActiveDays =
    typeof activeDays === 'number' && activeDays >= 0
      ? Math.min(365, activeDays)
      : commits > 0
        ? Math.min(365, Math.round(Math.pow(commits, 0.65) * 1.6))
        : 0

  if (resolvedActiveDays <= 0) return

  const activeRatio = THREE.MathUtils.clamp(resolvedActiveDays / 365, 0, 1)
  const targetLit = Math.min(totalSlots, Math.max(1, Math.round(activeRatio * totalSlots)))

  let w1 = commitLevelCounts?.[0] ?? 0
  let w2 = commitLevelCounts?.[1] ?? 0
  let w3 = commitLevelCounts?.[2] ?? 0
  let w4 = commitLevelCounts?.[3] ?? 0
  const rawTotal = w1 + w2 + w3 + w4

  if (rawTotal <= 0) {
    w1 = 0.42
    w2 = 0.32
    w3 = 0.17
    w4 = 0.09
  } else {
    w1 /= rawTotal
    w2 /= rawTotal
    w3 /= rawTotal
    w4 /= rawTotal
  }

  const norm = w1 + w2 + w3 + w4 || 1
  const c1 = w1 / norm
  const c2 = c1 + w2 / norm
  const c3 = c2 + w3 / norm

  const ranked: Array<{ pos: number; slotIdx: number; score: number }> = new Array(totalSlots)
  for (let pos = 0; pos < totalSlots; pos += 1) {
    const slotIdx = spiralSlotOrder[pos]
    const slot = candidateSlots[slotIdx]
    const patchWave =
      0.5 + 0.5 * Math.sin(slot.tier * 1.85 + slot.angle * 2.1 + (seed % 97) * 0.19)
    const jitter = (mixSeed(seed + pos * 31, totalSlots + 17) % 1000) / 1000
    const visualSurfaceBias = slot.rNorm * 0.16 + (slot.hasAbove ? 0 : 0.12)
    ranked[pos] = {
      pos,
      slotIdx,
      score: patchWave * 0.55 + jitter * 0.45 + visualSurfaceBias,
    }
  }
  ranked.sort((a, b) => b.score - a.score)

  for (let r = 0; r < targetLit; r += 1) {
    const { pos, slotIdx } = ranked[r]
    const colorRoll = (mixSeed(seed + pos * 47, totalSlots + 73) % 1000) / 1000
    const level: GitHubContributionLevel =
      colorRoll < c1 ? 1 : colorRoll < c2 ? 2 : colorRoll < c3 ? 3 : 4
    outLevels.set(slotIdx, level)
  }
}

/**
 * Builds ONLY the community gifts & gifted golden-star upgrade for a tree whose
 * base trunk/canopy/snow/commits/star are already rendered in InstancedMesh layers.
 */
export function buildTreeGiftsAndStarOverlay(opts: {
  level: TreeLevelId
  seed: number
  gridX?: number
  gridY?: number
  gifts: readonly TreeGiftSummary[]
  contributionCount?: number
  frontYaw?: number
  preserveFrontOrientation?: boolean
}): { group: THREE.Group; height: number; outerRadius: number } {
  const {
    level,
    seed,
    gridX = 24,
    gridY = 18,
    gifts,
    contributionCount = 0,
    frontYaw = 0,
    preserveFrontOrientation = true,
  } = opts

  const spec = computeTreeVisualSpec({
    level,
    seed,
    gridX,
    gridY,
    contributionCount,
  })

  const group = new THREE.Group()
  const activeGifts = gifts.filter((g) => Boolean(g && g.gift_slug))
  const staticBoxes: ColoredBox[] = []
  const l4aBoxes: ColoredBox[] = []
  const l4bBoxes: ColoredBox[] = []
  const phaseAMeshes: THREE.Mesh[] = []
  const phaseBMeshes: THREE.Mesh[] = []
  const usedGroundSlots = new Set<number>()

  if (activeGifts.length > 0) {
    buildCommunityGiftsShowcase({
      gifts: activeGifts,
      seed,
      outerRadius: spec.outerRadius,
      tierRings: spec.tierRings,
      githubBaublePositions: [],
      frontYaw,
      rotationY: spec.rotationY,
      preserveFrontOrientation,
      parentGroup: group,
      staticBoxes,
      l4aBoxes,
      l4bBoxes,
      phaseAMeshes,
      phaseBMeshes,
      usedGroundSlots,
    })
  }

  if (staticBoxes.length > 0) group.add(mergeColoredBoxes(staticBoxes, staticMat))
  if (l4aBoxes.length > 0) group.add(mergeColoredBoxes(l4aBoxes, l4PhaseAMergedMat))
  if (l4bBoxes.length > 0) group.add(mergeColoredBoxes(l4bBoxes, l4PhaseBMergedMat))

  const hasStarGift = activeGifts.some((g) => normalizeGiftSlug(g.gift_slug) === 'golden-star')
  if (hasStarGift) {
    const s = spec.voxelSize * Math.max(1.22, spec.starScale)
    group.add(
      mergeColoredBoxes(
        [
          { x: 0, y: spec.starY, z: 0, sx: 0.28 * s, sy: 1.12 * s, sz: 0.28 * s, color: '#fffbeb' },
          { x: 0, y: spec.starY, z: 0, sx: 1.12 * s, sy: 0.28 * s, sz: 0.28 * s, color: '#fde047' },
          { x: 0, y: spec.starY, z: 0, sx: 0.28 * s, sy: 0.28 * s, sz: 0.94 * s, color: '#fde047' },
          { x: -0.64 * s, y: spec.starY + 0.26 * s, z: 0.16 * s, sx: 0.16 * s, sy: 0.16 * s, sz: 0.16 * s, color: '#ffd166' },
          { x: 0.64 * s, y: spec.starY + 0.26 * s, z: -0.16 * s, sx: 0.16 * s, sy: 0.16 * s, sz: 0.16 * s, color: '#ffd166' },
        ],
        l4PhaseAMergedMat,
      ),
    )
  }

  group.rotation.y = spec.rotationY
  return {
    group,
    height: spec.starY + 0.85 * spec.voxelSize * spec.starScale,
    outerRadius: spec.outerRadius,
  }
}

export function resolveTreeTheme(
  seed: number,
  gridX = 24,
  gridY = 18,
  level: TreeLevelId = 0,
): { themeId: TreeThemeId; label: string; regionName: string; regionNameEn: string } {
  const hTheme = mixSeed(seed, 37) % 100
  const world = gridToWorldCoords(gridX, gridY)
  const region = getContinentRegionAtWorld(world.x, world.z)

  let themeId: TreeThemeId
  if (region.id === 'ilha-norte') {
    themeId =
      hTheme < 45
        ? 'frosted-blue'
        : hTheme < 78
          ? 'snowy-pine'
          : hTheme < 92
            ? 'classic-pine'
            : 'arcane-violet'
  } else if (region.id === 'bosque-aurora') {
    themeId =
      hTheme < 40
        ? 'snowy-pine'
        : hTheme < 74
          ? 'classic-pine'
          : hTheme < 90
            ? 'frosted-blue'
            : 'sakura-winter'
  } else if (region.id === 'vale-commits') {
    themeId =
      hTheme < 36
        ? 'golden-pine'
        : hTheme < 68
          ? 'classic-pine'
          : hTheme < 86
            ? 'crimson-autumn'
            : 'snowy-pine'
  } else if (region.id === 'porto-glacial') {
    themeId = hTheme < 48 ? 'frosted-blue' : hTheme < 82 ? 'snowy-pine' : 'classic-pine'
  } else {
    themeId =
      hTheme < 42
        ? 'classic-pine'
        : hTheme < 72
          ? 'golden-pine'
          : hTheme < 90
            ? 'snowy-pine'
            : 'crimson-autumn'
  }

  if (level >= 6 && hTheme % 3 === 0) {
    themeId = 'grand-elder'
  }

  return {
    themeId,
    label: THEME_PALETTES[themeId].label,
    regionName: region.namePt,
    regionNameEn: region.nameEn,
  }
}

/**
 * Builds a complete single 3D voxel Christmas tree (for TreePixelCanvas / profile views)
 * using the exact same cubic-grid voxel geometry and palette as the city InstancedMesh layer.
 */
export function buildVoxelChristmasTree(opts: VoxelTreeBuildOptions): BuiltVoxelTree {
  const {
    level,
    seed,
    gridX = 24,
    gridY = 18,
    gifts = [],
    giftCount = 0,
    isScenicLandmark = false,
    isCreatorSpecial = false,
    contributionCount = 0,
    activeDays,
    commitLevelCounts,
    calendarWeeks,
    frontYaw = 0,
    preserveFrontOrientation = false,
  } = opts

  const activeGifts = gifts.filter((g) => Boolean(g && g.gift_slug))
  const hasStarGift = activeGifts.some((g) => normalizeGiftSlug(g.gift_slug) === 'golden-star')

  const data = generateVoxelTreeGeometryData({
    level,
    seed,
    gridX,
    gridY,
    isScenicLandmark,
    isCreatorSpecial,
    contributionCount,
    activeDays,
    commitLevelCounts,
    calendarWeeks,
    skipBaseStar: hasStarGift,
  })

  const group = new THREE.Group()
  const staticBoxes: ColoredBox[] = []
  const l4aBoxes: ColoredBox[] = []
  const l4bBoxes: ColoredBox[] = []
  const phaseAMeshes: THREE.Mesh[] = []
  const phaseBMeshes: THREE.Mesh[] = []
  const starMeshes: THREE.Mesh[] = []
  const usedGroundSlots = new Set<number>()

  // Ground shadow pad under tree
  const shadowBox: ColoredBox = {
    x: 0,
    y: 0.03,
    z: 0,
    sx: data.shadowPad.sx,
    sy: data.shadowPad.sy,
    sz: data.shadowPad.sz,
    color: '#a3b6dc',
  }

  if (data.trunkBoxes.length > 0) {
    group.add(mergeColoredBoxes(data.trunkBoxes, trunkMergedMat))
  }
  if (data.foliageBoxes.length > 0) {
    group.add(mergeColoredBoxes(data.foliageBoxes, foliageMergedMat))
  }
  if (data.emissiveBoxes.length > 0) {
    group.add(mergeColoredBoxes(data.emissiveBoxes, emissiveMergedMat))
  }
  group.add(mergeColoredBoxes([shadowBox, ...data.snowBoxes], snowMergedMat))

  // Community gifts showcase (without replacing commit cubes)
  if (activeGifts.length > 0) {
    buildCommunityGiftsShowcase({
      gifts: activeGifts,
      seed,
      outerRadius: data.outerRadius,
      tierRings: data.spec.tierRings,
      githubBaublePositions: [],
      frontYaw,
      rotationY: data.spec.rotationY,
      preserveFrontOrientation,
      parentGroup: group,
      staticBoxes,
      l4aBoxes,
      l4bBoxes,
      phaseAMeshes,
      phaseBMeshes,
      usedGroundSlots,
    })
  } else if (level >= 5 || giftCount > 0 || isScenicLandmark) {
    const giftPalettes = [
      ['#dc2626', '#fbbf24'],
      ['#2563eb', '#f8fafc'],
    ]
    const g1 = giftPalettes[seed % giftPalettes.length]
    const sBoost = data.spec.scaleBoost
    addGiftBoxes(staticBoxes, -0.92 * sBoost, 0, -0.78 * sBoost, 0.56, 0.46, 0.56, g1[0], g1[1])
    if (level >= 6 || giftCount >= 2 || isScenicLandmark) {
      const g2 = giftPalettes[(seed + 1) % giftPalettes.length]
      addGiftBoxes(staticBoxes, -1.02 * sBoost, 0, 0.62 * sBoost, 0.52, 0.44, 0.52, g2[0], g2[1])
    }
  }

  if (staticBoxes.length > 0) group.add(mergeColoredBoxes(staticBoxes, staticMat))
  if (l4aBoxes.length > 0) {
    const meshA = mergeColoredBoxes(l4aBoxes, l4PhaseAMergedMat)
    group.add(meshA)
    phaseAMeshes.push(meshA)
  }
  if (l4bBoxes.length > 0) {
    const meshB = mergeColoredBoxes(l4bBoxes, l4PhaseBMergedMat)
    group.add(meshB)
    phaseBMeshes.push(meshB)
  }

  if (hasStarGift) {
    const upgradedStarBoxes: ColoredBox[] = []
    buildGoldenStarVoxels(
      0,
      data.spec.starY,
      0,
      data.spec.voxelSize,
      Math.max(1.32, data.spec.starScale * 1.15),
      true,
      upgradedStarBoxes,
    )
    const giftStarMesh = mergeColoredBoxes(upgradedStarBoxes, emissiveMergedMat)
    group.add(giftStarMesh)
    starMeshes.push(giftStarMesh)
  }

  group.rotation.y = data.spec.rotationY

  return {
    group,
    phaseAMeshes,
    phaseBMeshes,
    starMeshes,
    baubleInstances: [],
    auraMesh: null,
    height: data.height,
    outerRadius: data.outerRadius,
    themeLabel: data.spec.themeLabel,
    rotationY: data.spec.rotationY,
  }
}

function addGiftBoxes(
  boxes: ColoredBox[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  boxColor: string,
  ribbonColor: string,
): void {
  const cy = y + h / 2
  boxes.push({ x, y: cy, z, sx: w, sy: h, sz: d, color: boxColor })
  boxes.push({ x, y: cy, z, sx: w * 0.24, sy: h + 0.04, sz: d + 0.04, color: ribbonColor })
  boxes.push({ x, y: cy, z, sx: w + 0.04, sy: h + 0.04, sz: d * 0.24, color: ribbonColor })
  // Festive bow loops atop lid
  boxes.push({ x: x - w * 0.16, y: y + h + 0.07, z, sx: w * 0.22, sy: 0.1, sz: d * 0.16, color: ribbonColor })
  boxes.push({ x: x + w * 0.16, y: y + h + 0.07, z, sx: w * 0.22, sy: 0.1, sz: d * 0.16, color: ribbonColor })
  boxes.push({ x, y: y + h + 0.09, z, sx: w * 0.14, sy: 0.1, sz: d * 0.14, color: ribbonColor })
}

function addTeddyBearGift(boxes: ColoredBox[], x: number, z: number): void {
  // Cozy crimson-bordered snow cushion pad so the teddy stands out cleanly against forest snow
  boxes.push({ x, y: 0.03, z, sx: 0.94, sy: 0.06, sz: 0.88, color: '#fef2f2' })
  boxes.push({ x, y: 0.065, z, sx: 0.78, sy: 0.03, sz: 0.72, color: '#b91c1c' })

  // Seated caramel body + soft cream tummy
  boxes.push({ x, y: 0.29, z, sx: 0.56, sy: 0.44, sz: 0.46, color: '#b45309' })
  boxes.push({ x, y: 0.28, z: z + 0.22, sx: 0.34, sy: 0.3, sz: 0.08, color: '#fde68a' })

  // Chubby forward legs & pale paw pads
  boxes.push({ x: x - 0.19, y: 0.16, z: z + 0.22, sx: 0.18, sy: 0.17, sz: 0.26, color: '#92400e' })
  boxes.push({ x: x + 0.19, y: 0.16, z: z + 0.22, sx: 0.18, sy: 0.17, sz: 0.26, color: '#92400e' })
  boxes.push({ x: x - 0.19, y: 0.16, z: z + 0.35, sx: 0.12, sy: 0.11, sz: 0.04, color: '#fef3c7' })
  boxes.push({ x: x + 0.19, y: 0.16, z: z + 0.35, sx: 0.12, sy: 0.11, sz: 0.04, color: '#fef3c7' })

  // Hugging winter paws
  boxes.push({ x: x - 0.31, y: 0.35, z: z + 0.1, sx: 0.15, sy: 0.22, sz: 0.2, color: '#b45309' })
  boxes.push({ x: x + 0.31, y: 0.35, z: z + 0.1, sx: 0.15, sy: 0.22, sz: 0.2, color: '#b45309' })

  // Scarlet & white Christmas scarf around neck
  boxes.push({ x, y: 0.53, z: z + 0.02, sx: 0.52, sy: 0.11, sz: 0.46, color: '#dc2626' })
  boxes.push({ x: x + 0.12, y: 0.41, z: z + 0.25, sx: 0.13, sy: 0.2, sz: 0.08, color: '#ef4444' })
  boxes.push({ x: x + 0.12, y: 0.32, z: z + 0.25, sx: 0.13, sy: 0.06, sz: 0.08, color: '#ffffff' })

  // Round teddy head + ears + muzzle + nose + expressive eyes
  boxes.push({ x, y: 0.74, z, sx: 0.52, sy: 0.4, sz: 0.44, color: '#c26a1b' })
  boxes.push({ x: x - 0.22, y: 0.96, z: z - 0.02, sx: 0.17, sy: 0.16, sz: 0.12, color: '#92400e' })
  boxes.push({ x: x + 0.22, y: 0.96, z: z - 0.02, sx: 0.17, sy: 0.16, sz: 0.12, color: '#92400e' })
  boxes.push({ x: x - 0.22, y: 0.96, z: z + 0.04, sx: 0.09, sy: 0.09, sz: 0.04, color: '#fde68a' })
  boxes.push({ x: x + 0.22, y: 0.96, z: z + 0.04, sx: 0.09, sy: 0.09, sz: 0.04, color: '#fde68a' })
  boxes.push({ x, y: 0.69, z: z + 0.23, sx: 0.24, sy: 0.15, sz: 0.12, color: '#fef3c7' })
  boxes.push({ x, y: 0.74, z: z + 0.3, sx: 0.09, sy: 0.07, sz: 0.05, color: '#1e1b18' })
  boxes.push({ x: x - 0.12, y: 0.8, z: z + 0.23, sx: 0.07, sy: 0.08, sz: 0.04, color: '#0f172a' })
  boxes.push({ x: x + 0.12, y: 0.8, z: z + 0.23, sx: 0.07, sy: 0.08, sz: 0.04, color: '#0f172a' })

  // Tilted Santa knit cap
  boxes.push({ x, y: 0.97, z, sx: 0.36, sy: 0.08, sz: 0.34, color: '#ffffff' })
  boxes.push({ x: x - 0.02, y: 1.07, z: z - 0.02, sx: 0.26, sy: 0.14, sz: 0.26, color: '#dc2626' })
  boxes.push({ x: x - 0.08, y: 1.15, z: z - 0.06, sx: 0.12, sy: 0.1, sz: 0.12, color: '#ffffff' })
}

function addBellOrnament(boxes: ColoredBox[], glowBoxes: ColoredBox[], x: number, y: number, z: number): void {
  // Holly bow + leaves top mount
  boxes.push({ x: x - 0.1, y: y + 0.18, z, sx: 0.12, sy: 0.08, sz: 0.12, color: '#16a34a' })
  boxes.push({ x: x + 0.1, y: y + 0.18, z, sx: 0.12, sy: 0.08, sz: 0.12, color: '#16a34a' })
  boxes.push({ x, y: y + 0.2, z, sx: 0.24, sy: 0.1, sz: 0.24, color: '#dc2626' })
  // Golden flared Christmas bell
  boxes.push({ x, y: y + 0.08, z, sx: 0.24, sy: 0.16, sz: 0.24, color: '#fbbf24' })
  boxes.push({ x, y: y - 0.07, z, sx: 0.36, sy: 0.14, sz: 0.36, color: '#f59e0b' })
  boxes.push({ x, y: y - 0.13, z, sx: 0.4, sy: 0.06, sz: 0.4, color: '#fde047' })
  glowBoxes.push({ x, y: y - 0.2, z, sx: 0.12, sy: 0.12, sz: 0.12, color: '#fffbeb' })
}

function addSnowflakeOrnament(glowBoxes: ColoredBox[], x: number, y: number, z: number): void {
  // Luminous 6-point crystal star visible cleanly in 360° from front, sides & back
  glowBoxes.push({ x, y, z, sx: 0.16, sy: 0.16, sz: 0.16, color: '#ffffff' })
  glowBoxes.push({ x, y, z, sx: 0.44, sy: 0.09, sz: 0.09, color: '#bae6fd' })
  glowBoxes.push({ x, y, z, sx: 0.09, sy: 0.44, sz: 0.09, color: '#bae6fd' })
  glowBoxes.push({ x, y, z, sx: 0.09, sy: 0.09, sz: 0.44, color: '#7dd3fc' })
  glowBoxes.push({ x: x + 0.14, y: y + 0.14, z, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
  glowBoxes.push({ x: x - 0.14, y: y + 0.14, z, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
  glowBoxes.push({ x: x + 0.14, y: y - 0.14, z, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
  glowBoxes.push({ x: x - 0.14, y: y - 0.14, z, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
  glowBoxes.push({ x, y: y + 0.14, z: z + 0.14, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
  glowBoxes.push({ x, y: y + 0.14, z: z - 0.14, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
  glowBoxes.push({ x, y: y - 0.14, z: z + 0.14, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
  glowBoxes.push({ x, y: y - 0.14, z: z - 0.14, sx: 0.09, sy: 0.09, sz: 0.09, color: '#e0f2fe' })
}

function addRetroPcGift(boxes: ColoredBox[], glowBoxes: ColoredBox[], x: number, z: number): void {
  // Subtle cool snow shadow pad anchoring the 90s setup cleanly above tree ground shadow
  boxes.push({ x, y: 0.035, z: z + 0.06, sx: 1.04, sy: 0.065, sz: 0.98, color: '#b8c7e0' })

  // Horizontal desktop tower / chassis (warm 90s beige with crisp rim highlights & shadows)
  boxes.push({ x: x - 0.04, y: 0.19, z: z - 0.06, sx: 0.84, sy: 0.26, sz: 0.58, color: '#d8cfb4' })
  boxes.push({ x: x - 0.04, y: 0.325, z: z - 0.06, sx: 0.84, sy: 0.03, sz: 0.58, color: '#ede7d3' })
  boxes.push({ x: x - 0.04, y: 0.19, z: z - 0.36, sx: 0.86, sy: 0.26, sz: 0.03, color: '#9c9278' })
  boxes.push({ x: x - 0.465, y: 0.19, z: z - 0.06, sx: 0.025, sy: 0.18, sz: 0.42, color: '#a89f86' })
  boxes.push({ x: x + 0.385, y: 0.19, z: z - 0.06, sx: 0.025, sy: 0.18, sz: 0.42, color: '#a89f86' })

  // Desktop front panel: 3.5" floppy bay, lower drive contour, power button & status LEDs
  boxes.push({ x: x - 0.2, y: 0.22, z: z + 0.235, sx: 0.3, sy: 0.075, sz: 0.03, color: '#475569' })
  boxes.push({ x: x - 0.2, y: 0.225, z: z + 0.248, sx: 0.22, sy: 0.025, sz: 0.02, color: '#0f172a' })
  boxes.push({ x: x - 0.2, y: 0.125, z: z + 0.235, sx: 0.3, sy: 0.055, sz: 0.03, color: '#b5ab90' })
  boxes.push({ x: x + 0.22, y: 0.19, z: z + 0.238, sx: 0.09, sy: 0.09, sz: 0.035, color: '#94a3b8' })
  glowBoxes.push({ x: x + 0.11, y: 0.225, z: z + 0.245, sx: 0.045, sy: 0.045, sz: 0.025, color: '#4ade80' })
  glowBoxes.push({ x: x + 0.11, y: 0.15, z: z + 0.245, sx: 0.04, sy: 0.04, sz: 0.025, color: '#fbbf24' })

  // Boxy 90s CRT monitor atop swivel stand + deep tube housing + terminal screen
  boxes.push({ x: x - 0.04, y: 0.365, z: z - 0.07, sx: 0.44, sy: 0.06, sz: 0.34, color: '#a39980' })
  boxes.push({ x: x - 0.04, y: 0.67, z: z - 0.03, sx: 0.74, sy: 0.56, sz: 0.42, color: '#e6dfc9' })
  boxes.push({ x: x - 0.04, y: 0.955, z: z - 0.03, sx: 0.72, sy: 0.03, sz: 0.4, color: '#f2ecdb' })
  boxes.push({ x: x - 0.04, y: 0.65, z: z - 0.29, sx: 0.52, sy: 0.4, sz: 0.22, color: '#c8bfa3' })
  boxes.push({ x: x - 0.04, y: 0.74, z: z - 0.405, sx: 0.36, sy: 0.14, sz: 0.025, color: '#8f856d' })
  boxes.push({ x: x - 0.04, y: 0.68, z: z + 0.185, sx: 0.62, sy: 0.44, sz: 0.03, color: '#8f856d' })
  boxes.push({ x: x - 0.04, y: 0.68, z: z + 0.205, sx: 0.54, sy: 0.36, sz: 0.025, color: '#07172b' })

  // Emissive neon-green terminal code lines & monitor power LED
  glowBoxes.push({ x: x - 0.14, y: 0.78, z: z + 0.222, sx: 0.19, sy: 0.04, sz: 0.02, color: '#4ade80' })
  glowBoxes.push({ x: x - 0.05, y: 0.7, z: z + 0.222, sx: 0.31, sy: 0.04, sz: 0.02, color: '#39d353' })
  glowBoxes.push({ x: x - 0.11, y: 0.62, z: z + 0.222, sx: 0.23, sy: 0.04, sz: 0.02, color: '#86efac' })
  glowBoxes.push({ x: x + 0.07, y: 0.55, z: z + 0.222, sx: 0.06, sy: 0.04, sz: 0.02, color: '#4ade80' })
  glowBoxes.push({ x: x + 0.21, y: 0.425, z: z + 0.195, sx: 0.04, sy: 0.04, sz: 0.025, color: '#4ade80' })

  // Sloped mechanical retro keyboard + keycaps + dark cord to tower
  boxes.push({ x: x - 0.09, y: 0.11, z: z + 0.39, sx: 0.64, sy: 0.075, sz: 0.12, color: '#d8cfb4' })
  boxes.push({ x: x - 0.09, y: 0.08, z: z + 0.49, sx: 0.64, sy: 0.055, sz: 0.11, color: '#e6dfc9' })
  boxes.push({ x: x - 0.14, y: 0.152, z: z + 0.39, sx: 0.42, sy: 0.025, sz: 0.08, color: '#9c9278' })
  boxes.push({ x: x - 0.14, y: 0.112, z: z + 0.48, sx: 0.42, sy: 0.025, sz: 0.07, color: '#b5ab90' })
  boxes.push({ x: x - 0.14, y: 0.115, z: z + 0.52, sx: 0.22, sy: 0.025, sz: 0.03, color: '#f2ecdb' })
  boxes.push({ x: x + 0.15, y: 0.135, z: z + 0.43, sx: 0.11, sy: 0.025, sz: 0.12, color: '#78716c' })
  boxes.push({ x: x - 0.09, y: 0.08, z: z + 0.28, sx: 0.035, sy: 0.03, sz: 0.12, color: '#334155' })

  // Classic two-button beige mouse beside keyboard + dark cord linking to tower
  boxes.push({ x: x + 0.35, y: 0.085, z: z + 0.45, sx: 0.13, sy: 0.06, sz: 0.17, color: '#e6dfc9' })
  boxes.push({ x: x + 0.32, y: 0.118, z: z + 0.4, sx: 0.048, sy: 0.018, sz: 0.06, color: '#b5ab90' })
  boxes.push({ x: x + 0.38, y: 0.118, z: z + 0.4, sx: 0.048, sy: 0.018, sz: 0.06, color: '#b5ab90' })
  boxes.push({ x: x + 0.35, y: 0.075, z: z + 0.32, sx: 0.028, sy: 0.025, sz: 0.11, color: '#334155' })
  boxes.push({ x: x + 0.28, y: 0.075, z: z + 0.26, sx: 0.15, sy: 0.025, sz: 0.028, color: '#334155' })
}

function sampleRingPoint(
  ring: TierPlacementRing,
  angle: number,
  radialOffset: number,
  yOffset: number,
): Point3D {
  const wave = 1 + ring.waveAmp * Math.cos(angle * ring.lobeCount + ring.phaseShift)
  const r = ring.baseRadius * wave + radialOffset
  return {
    x: ring.offsetX + Math.cos(angle) * r,
    y: ring.y + yOffset,
    z: ring.offsetZ + Math.sin(angle) * r,
  }
}

function minDistanceSqToOccupied(point: Point3D, occupied: readonly Point3D[]): number {
  let minSq = Infinity
  for (let i = 0; i < occupied.length; i += 1) {
    const p = occupied[i]
    const dx = point.x - p.x
    const dy = point.y - p.y
    const dz = point.z - p.z
    const dSq = dx * dx + dy * dy + dz * dz
    if (dSq < minSq) minSq = dSq
  }
  return minSq
}

function allocateNonCollidingRingPoint(
  tierRings: readonly TierPlacementRing[],
  preferredTierIdx: number,
  preferredAngle: number,
  radialOffset: number,
  yOffset: number,
  minClearance: number,
  occupied: Point3D[],
): Point3D | null {
  if (tierRings.length === 0) return null
  const minClearSq = minClearance * minClearance
  const angleNudges = [0, 0.22, -0.22, 0.44, -0.44, 0.68, -0.68, 0.96, -0.96, 1.32, -1.32]
  const clampedTier = Math.max(0, Math.min(tierRings.length - 1, preferredTierIdx))
  const tierCandidates = [clampedTier]
  if (clampedTier + 1 < tierRings.length) tierCandidates.push(clampedTier + 1)
  if (clampedTier - 1 >= 0) tierCandidates.push(clampedTier - 1)

  let bestFallback: Point3D | null = null
  let bestFallbackDistSq = -1

  for (const tIdx of tierCandidates) {
    const ring = tierRings[tIdx]
    for (const dTheta of angleNudges) {
      const cand = sampleRingPoint(ring, preferredAngle + dTheta, radialOffset, yOffset)
      const distSq = minDistanceSqToOccupied(cand, occupied)
      if (distSq >= minClearSq) {
        occupied.push(cand)
        return cand
      }
      if (distSq > bestFallbackDistSq) {
        bestFallbackDistSq = distSq
        bestFallback = cand
      }
    }
  }

  if (bestFallback) {
    occupied.push(bestFallback)
  }
  return bestFallback
}

function buildCommunityGiftsShowcase(opts: {
  gifts: readonly TreeGiftSummary[]
  seed: number
  outerRadius: number
  tierRings: readonly TierPlacementRing[]
  githubBaublePositions: readonly Point3D[]
  frontYaw: number
  rotationY: number
  preserveFrontOrientation: boolean
  parentGroup: THREE.Group
  staticBoxes: ColoredBox[]
  l4aBoxes: ColoredBox[]
  l4bBoxes: ColoredBox[]
  phaseAMeshes: THREE.Mesh[]
  phaseBMeshes: THREE.Mesh[]
  usedGroundSlots: Set<number>
}): void {
  const {
    gifts,
    seed,
    outerRadius,
    tierRings,
    githubBaublePositions,
    frontYaw,
    rotationY,
    preserveFrontOrientation,
    parentGroup,
    staticBoxes,
    l4aBoxes,
    l4bBoxes,
    phaseAMeshes,
    phaseBMeshes,
    usedGroundSlots,
  } = opts

  const giftFrontGroup = new THREE.Group()
  giftFrontGroup.rotation.y = preserveFrontOrientation ? frontYaw - rotationY : 0

  const frontBoxes: ColoredBox[] = []
  const frontGlowA: ColoredBox[] = []
  const frontGlowB: ColoredBox[] = []

  // Dedicated non-overlapping ground base slots clear of the companion corner (+X, +Z)
  const groundDist = Math.min(2.42, Math.max(1.58, outerRadius * 0.92))
  const groundSlots: Array<{ x: number; z: number }> = [
    { x: -0.92 * groundDist, z: 0.39 * groundDist }, // Slot 0: primary cozy-teddy (front-left)
    { x: -0.36 * groundDist, z: 0.93 * groundDist }, // Slot 1: primary gift-box (front-center-left)
    { x: 0.98 * groundDist, z: -0.1 * groundDist }, // Slot 2: primary retro-pc (right showcase, behind companion arc)
    { x: -0.76 * groundDist, z: -0.65 * groundDist }, // Slot 3: overflow rear-left
    { x: 0.58 * groundDist, z: -0.81 * groundDist }, // Slot 4: overflow rear-right
    { x: -0.12 * groundDist, z: -0.99 * groundDist }, // Slot 5: overflow rear-center
  ]

  // Reserve Slots 0..2 exclusively for primary ground gifts regardless of gift arrival order
  const RESERVED_PRIMARY_SLOTS = 3

  const allocPrimaryGroundSlot = (primarySlotIdx: number): { x: number; z: number } => {
    if (!usedGroundSlots.has(primarySlotIdx)) {
      usedGroundSlots.add(primarySlotIdx)
      return groundSlots[primarySlotIdx]
    }
    return allocOverflowGroundSlot()
  }

  const allocOverflowGroundSlot = (): { x: number; z: number } => {
    for (let s = RESERVED_PRIMARY_SLOTS; s < groundSlots.length; s += 1) {
      if (!usedGroundSlots.has(s)) {
        usedGroundSlots.add(s)
        return groundSlots[s]
      }
    }
    const overflowIdx = usedGroundSlots.size
    usedGroundSlots.add(overflowIdx)
    const step = overflowIdx - groundSlots.length
    const fallbackAngle = Math.PI * (0.78 + step * 0.28)
    const fallbackR = groundDist + 0.65
    return {
      x: Math.cos(fallbackAngle) * fallbackR,
      z: Math.sin(fallbackAngle) * fallbackR,
    }
  }

  // Track all occupied 3D points starting with GitHub commit baubles so gifts never cover commits or each other
  const occupiedOrnaments: Point3D[] = [...githubBaublePositions]
  const baseSeedAngle = ((seed % 360) * Math.PI) / 180
  const goldenAngle = 2.39996323

  const boxPalettes = [
    ['#16a34a', '#dc2626'],
    ['#dc2626', '#fbbf24'],
    ['#2563eb', '#f8fafc'],
    ['#9333ea', '#fde047'],
  ]

  let teddyCount = 0
  let boxCount = 0
  let retroPcCount = 0
  const branchPassCount: Record<string, number> = {}

  for (let i = 0; i < gifts.length; i += 1) {
    const slug = normalizeGiftSlug(gifts[i].gift_slug)

    if (slug === 'cozy-teddy') {
      if (teddyCount >= 2) continue
      const slot = teddyCount === 0 ? allocPrimaryGroundSlot(0) : allocOverflowGroundSlot()
      addTeddyBearGift(frontBoxes, slot.x, slot.z)
      teddyCount += 1
      continue
    }

    if (slug === 'gift-box') {
      if (boxCount >= 4) continue
      const slot = boxCount === 0 ? allocPrimaryGroundSlot(1) : allocOverflowGroundSlot()
      const pal = boxPalettes[(seed + boxCount) % boxPalettes.length]
      addGiftBoxes(frontBoxes, slot.x, 0, slot.z, 0.66, 0.54, 0.66, pal[0], pal[1])
      boxCount += 1
      continue
    }

    if (slug === 'retro-pc') {
      if (retroPcCount >= 2) continue
      const slot = retroPcCount === 0 ? allocPrimaryGroundSlot(2) : allocOverflowGroundSlot()
      addRetroPcGift(frontBoxes, frontGlowA, slot.x, slot.z)
      retroPcCount += 1
      continue
    }

    if (slug === 'golden-star') {
      // Handled prominently in topper star stage
      continue
    }

    const pass = branchPassCount[slug] ?? 0
    if (pass >= 2) continue
    branchPassCount[slug] = pass + 1
    const passAngleShift = pass * 0.42

    if (slug === 'colorful-lights') {
      const count = pass === 0 ? Math.max(12, tierRings.length * 4) : Math.max(6, tierRings.length * 2)
      const turns = Math.max(1.8, tierRings.length * 0.65)
      const lightColors = ['#38bdf8', '#f43f5e', '#fde047', '#a855f7', '#22d3ee', '#fb7185']
      for (let k = 0; k < count; k += 1) {
        const progress = count === 1 ? 0.5 : k / (count - 1)
        const tierIdx = Math.min(tierRings.length - 1, Math.floor(progress * tierRings.length))
        const theta = baseSeedAngle + passAngleShift + progress * Math.PI * 2 * turns
        const pt = allocateNonCollidingRingPoint(
          tierRings,
          tierIdx,
          theta,
          0.34,
          0.16,
          0.44,
          occupiedOrnaments,
        )
        if (!pt) continue
        const target = k % 2 === 0 ? l4aBoxes : l4bBoxes
        target.push({
          x: pt.x,
          y: pt.y,
          z: pt.z,
          sx: 0.22,
          sy: 0.22,
          sz: 0.22,
          color: lightColors[(k + seed + pass) % lightColors.length],
        })
      }
      continue
    }

    if (slug === 'ornament-baubles') {
      const count = pass === 0 ? Math.max(8, tierRings.length * 3) : Math.max(4, tierRings.length + 1)
      const baubleColors = ['#ef4444', '#fbbf24', '#dc2626', '#f59e0b']
      for (let k = 0; k < count; k += 1) {
        const tierIdx = k % tierRings.length
        const theta = baseSeedAngle + 0.35 + passAngleShift + k * goldenAngle
        const pt = allocateNonCollidingRingPoint(
          tierRings,
          tierIdx,
          theta,
          0.32,
          -0.16,
          0.48,
          occupiedOrnaments,
        )
        if (!pt) continue
        const color = baubleColors[(k + seed + pass) % baubleColors.length]
        staticBoxes.push({
          x: pt.x,
          y: pt.y + 0.2,
          z: pt.z,
          sx: 0.14,
          sy: 0.08,
          sz: 0.14,
          color: '#fde047',
        })
        staticBoxes.push({ x: pt.x, y: pt.y, z: pt.z, sx: 0.34, sy: 0.34, sz: 0.34, color })
        l4aBoxes.push({
          x: pt.x + (pt.x >= 0 ? 0.07 : -0.07),
          y: pt.y + 0.08,
          z: pt.z + (pt.z >= 0 ? 0.07 : -0.07),
          sx: 0.12,
          sy: 0.12,
          sz: 0.12,
          color: '#fffbeb',
        })
      }
      continue
    }

    if (slug === 'festive-bell') {
      const count = pass === 0 ? Math.max(4, Math.min(10, tierRings.length + 2)) : 3
      for (let k = 0; k < count; k += 1) {
        const tierIdx = k % tierRings.length
        const theta = baseSeedAngle + 0.52 + passAngleShift + (k * Math.PI * 2) / count
        const pt = allocateNonCollidingRingPoint(
          tierRings,
          tierIdx,
          theta,
          0.38,
          -0.22,
          0.58,
          occupiedOrnaments,
        )
        if (!pt) continue
        addBellOrnament(staticBoxes, l4aBoxes, pt.x, pt.y, pt.z)
      }
      continue
    }

    if (slug === 'crystal-snowflake') {
      const count = pass === 0 ? Math.max(4, Math.min(10, tierRings.length + 2)) : 3
      for (let k = 0; k < count; k += 1) {
        const tierIdx = (k + 1) % tierRings.length
        const theta = baseSeedAngle + 2.09 + passAngleShift + (k * Math.PI * 2) / count
        const pt = allocateNonCollidingRingPoint(
          tierRings,
          tierIdx,
          theta,
          0.38,
          0.26,
          0.58,
          occupiedOrnaments,
        )
        if (!pt) continue
        addSnowflakeOrnament(l4bBoxes, pt.x, pt.y, pt.z)
      }
    }
  }

  if (frontBoxes.length > 0) {
    giftFrontGroup.add(mergeColoredBoxes(frontBoxes, staticMat))
  }
  if (frontGlowA.length > 0) {
    const mA = mergeColoredBoxes(frontGlowA, l4PhaseAMergedMat)
    giftFrontGroup.add(mA)
    phaseAMeshes.push(mA)
  }
  if (frontGlowB.length > 0) {
    const mB = mergeColoredBoxes(frontGlowB, l4PhaseBMergedMat)
    giftFrontGroup.add(mB)
    phaseBMeshes.push(mB)
  }
  if (giftFrontGroup.children.length > 0) {
    parentGroup.add(giftFrontGroup)
  }
}
