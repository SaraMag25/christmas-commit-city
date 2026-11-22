import * as THREE from 'three'
import { normalizeGiftSlug } from '../../config/gifts'
import { extractCommitOrnamentEntries } from '../../services/githubSyncService'
import type { GitHubContributionWeek, TreeGiftSummary, TreeLevelId } from '../../types/city'
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
  calendarWeeks?: GitHubContributionWeek[]
  /** World azimuth toward viewer so featured gifts face camera without colliding with companion corner */
  frontYaw?: number
  /** When true, keep random tree rotation on group while counter-rotating directional gifts toward frontYaw */
  preserveFrontOrientation?: boolean
  /** When true, baubles are returned as instance data so City3DCanvas batches all trees into global InstancedMeshes */
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

interface CanopyNode {
  x: number
  y: number
  z: number
  angle: number
  tier: number
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

interface ColoredBox {
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
  deep: string
  mid: string
  bright: string
  snowRate: number // 2: rich, 3: heavy arctic snow
}

/**
 * Deep bluish-spruce / arctic-teal evergreen palettes so official GitHub green
 * commit baubles (#0e4429..#9be9a8) stand out crisply against foliage and white snow.
 */
const THEME_PALETTES: Record<TreeThemeId, ThemePalette> = {
  'classic-pine': {
    label: 'Pinheiro Ártico',
    deep: '#061c24',
    mid: '#0b2d38',
    bright: '#124352',
    snowRate: 2,
  },
  'snowy-pine': {
    label: 'Pinheiro Nevado',
    deep: '#072029',
    mid: '#0d3340',
    bright: '#154b5c',
    snowRate: 3,
  },
  'golden-pine': {
    label: 'Pinheiro Boreal',
    deep: '#071f2b',
    mid: '#0c3042',
    bright: '#13465e',
    snowRate: 2,
  },
  'frosted-blue': {
    label: 'Pinheiro Glacial',
    deep: '#082233',
    mid: '#0f364f',
    bright: '#184e70',
    snowRate: 3,
  },
  'crimson-autumn': {
    label: 'Pinheiro da Tundra',
    deep: '#061a24',
    mid: '#0b2a38',
    bright: '#113f52',
    snowRate: 2,
  },
  'sakura-winter': {
    label: 'Pinheiro Prateado',
    deep: '#0a222b',
    mid: '#123642',
    bright: '#1c4d5c',
    snowRate: 3,
  },
  'arcane-violet': {
    label: 'Pinheiro Polar',
    deep: '#081d2b',
    mid: '#0e2f44',
    bright: '#164460',
    snowRate: 2,
  },
  'grand-elder': {
    label: 'Pinheiro Ancião do Norte',
    deep: '#051a24',
    mid: '#0a2b3b',
    bright: '#124257',
    snowRate: 3,
  },
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

const BARK_PALETTES: readonly { dark: string; mid: string; light: string }[] = [
  { dark: '#4a2914', mid: '#7c4d2b', light: '#a66b41' },
  { dark: '#3b2217', mid: '#633c2a', light: '#8a5840' },
  { dark: '#64748b', mid: '#94a3b8', light: '#cbd5e1' },
]

// Official GitHub Contribution Graph Greens mapped to levels 1..4
const GITHUB_BAUBLE_COLORS = {
  1: ['#0e4429', '#216e39'] as const,
  2: ['#006d32', '#30a14e'] as const,
  3: ['#26a641', '#40c463'] as const,
  4: ['#39d353', '#9be9a8'] as const,
}

const baseBox = new THREE.BoxGeometry(1, 1, 1)
const basePos = baseBox.getAttribute('position') as THREE.BufferAttribute
const baseNorm = baseBox.getAttribute('normal') as THREE.BufferAttribute
const baseIdx = baseBox.getIndex() as THREE.BufferAttribute

const gradientMap = getToonGradientMap()

// Materials for merged-mesh trees (TreePixelCanvas & distant landmark)
const staticMat = new THREE.MeshToonMaterial({
  vertexColors: true,
  gradientMap,
})

const l12MergedMat = new THREE.MeshToonMaterial({
  vertexColors: true,
  gradientMap,
  emissive: new THREE.Color('#0c3b20'),
  emissiveIntensity: 0.28,
})

const l3MergedMat = new THREE.MeshToonMaterial({
  vertexColors: true,
  gradientMap,
  emissive: new THREE.Color('#26a641'),
  emissiveIntensity: 0.55,
})

const l4PhaseAMergedMat = new THREE.MeshBasicMaterial({ vertexColors: true })
const l4PhaseBMergedMat = new THREE.MeshBasicMaterial({ vertexColors: true })

// Shared materials for global InstancedMesh bauble batches in City3DCanvas
export const instancedBaubleMaterials = {
  l12: new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap,
    emissive: new THREE.Color('#0c3b20'),
    emissiveIntensity: 0.28,
  }),
  l3: new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap,
    emissive: new THREE.Color('#26a641'),
    emissiveIntensity: 0.55,
  }),
  l4a: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  l4b: new THREE.MeshBasicMaterial({ color: 0xffffff }),
}

export function updateCommitLightsTwinkle(timeSec: number): void {
  // Subtle warm-green pulse for GitHub Level 3 baubles
  const l3Pulse = 0.48 + 0.24 * (0.5 + 0.5 * Math.sin(timeSec * 2.1))
  l3MergedMat.emissiveIntensity = l3Pulse
  instancedBaubleMaterials.l3.emissiveIntensity = l3Pulse

  // Strong alternating twinkle for GitHub Level 4 peak baubles (#39d353 / #9be9a8)
  const bA = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(timeSec * 3.1))
  const bB = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + Math.PI))
  l4PhaseAMergedMat.color.setRGB(bA, bA, bA)
  l4PhaseBMergedMat.color.setRGB(bB, bB, bB)
  instancedBaubleMaterials.l4a.color.setRGB(bA, bA, bA)
  instancedBaubleMaterials.l4b.color.setRGB(bB, bB, bB)
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

function mixSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 2654435761)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 2246822519) >>> 0
  h ^= h >>> 13
  return h >>> 0
}

export function resolveTreeTheme(
  seed: number,
  gridX = 24,
  gridY = 18,
  level: TreeLevelId = 0,
): { themeId: TreeThemeId; label: string; regionName: string } {
  const hTheme = mixSeed(seed, 37) % 100

  let regionName: string
  let themeId: TreeThemeId

  if (gridY <= 8) {
    regionName = 'Montanhas Geladas'
    themeId = hTheme < 48 ? 'snowy-pine' : hTheme < 82 ? 'frosted-blue' : 'classic-pine'
  } else if (gridX <= 13 && gridY >= 24) {
    regionName = 'Lago Congelado'
    themeId = hTheme < 55 ? 'frosted-blue' : hTheme < 85 ? 'snowy-pine' : 'sakura-winter'
  } else if (gridX >= 30 && gridY <= 17) {
    regionName = 'Oficina do Norte'
    themeId =
      hTheme < 36
        ? 'classic-pine'
        : hTheme < 68
          ? 'golden-pine'
          : 'snowy-pine'
  } else if (gridX >= 27 && gridY >= 20) {
    regionName = 'Bosque Boreal'
    themeId =
      hTheme < 34
        ? 'golden-pine'
        : hTheme < 64
          ? 'crimson-autumn'
          : hTheme < 84
            ? 'snowy-pine'
            : 'classic-pine'
  } else if (Math.abs(gridX - 24) <= 4 || Math.abs(gridY - 18) <= 3) {
    regionName = 'Marco do Polo Norte'
    themeId = hTheme < 40 ? 'classic-pine' : hTheme < 72 ? 'golden-pine' : 'snowy-pine'
  } else {
    regionName = 'Floresta Polar'
    themeId = hTheme < 45 ? 'classic-pine' : hTheme < 78 ? 'snowy-pine' : 'frosted-blue'
  }

  if (level >= 6 && hTheme % 3 === 0) {
    themeId = 'grand-elder'
  }

  return {
    themeId,
    label: THEME_PALETTES[themeId].label,
    regionName,
  }
}

/**
 * Builds a 3D voxel Christmas tree with deep bluish-pine foliage, crisp white
 * snow ledges on branch tips, and official GitHub contribution green baubles.
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
    contributionCount = 0,
    calendarWeeks,
    frontYaw = 0,
    preserveFrontOrientation = false,
    separateBaubles = false,
  } = opts

  const group = new THREE.Group()
  const staticBoxes: ColoredBox[] = []
  const l12Boxes: ColoredBox[] = []
  const l3Boxes: ColoredBox[] = []
  const l4aBoxes: ColoredBox[] = []
  const l4bBoxes: ColoredBox[] = []
  const phaseAMeshes: THREE.Mesh[] = []
  const phaseBMeshes: THREE.Mesh[] = []
  const starMeshes: THREE.Mesh[] = []
  const baubleInstances: BaubleInstanceData[] = []

  const hArch = mixSeed(seed, 11)
  const hDecor = mixSeed(seed, 71)
  const hBark = mixSeed(seed, 97)

  const resolved = isScenicLandmark
    ? { themeId: 'grand-elder' as TreeThemeId, label: 'Árvore Lendária do Polo Norte' }
    : resolveTreeTheme(seed, gridX, gridY, level)

  const palette = THEME_PALETTES[resolved.themeId]
  const archetype: TreeArchetype =
    resolved.themeId === 'grand-elder'
      ? 'voluminous-cedar'
      : ARCHETYPES[hArch % ARCHETYPES.length]

  const isPaleBarkTheme =
    resolved.themeId === 'sakura-winter' || resolved.themeId === 'arcane-violet'
  const bark = isPaleBarkTheme ? BARK_PALETTES[2] : BARK_PALETTES[hBark % 2]
  const snowColor = '#f4f8ff'
  const snowEdgeColor = '#dbeafe'

  // Cool lavender-indigo shadow beneath tree on bright snow
  const padScale = isScenicLandmark ? 5.0 : 2.45
  staticBoxes.push({
    x: 0,
    y: 0.03,
    z: 0,
    sx: padScale,
    sy: 0.06,
    sz: padScale,
    color: '#a3b6dc',
  })

  const scaleBoost = isScenicLandmark ? 1.55 : 1.0
  const organicScale = isScenicLandmark ? 1.0 : 0.94 + (mixSeed(seed, 53) % 13) * 0.01
  const widthFactor =
    (archetype === 'alpine-spire'
      ? 0.74
      : archetype === 'broad-nordic'
        ? 1.08
        : archetype === 'voluminous-cedar'
          ? 1.06
          : archetype === 'dense-cypress'
            ? 0.85
            : archetype === 'spaced-tier'
              ? 1.0
              : 0.96) *
    scaleBoost *
    organicScale

  const heightFactor =
    (archetype === 'alpine-spire'
      ? 1.22
      : archetype === 'broad-nordic'
        ? 0.88
        : archetype === 'spaced-tier'
          ? 1.14
          : archetype === 'dense-cypress'
            ? 1.08
            : 1.0) *
    scaleBoost *
    organicScale

  const baseTrunkH = level === 0 ? 0.95 : level <= 2 ? 1.32 : level <= 4 ? 1.72 : 2.1
  const trunkH =
    baseTrunkH *
    (archetype === 'spaced-tier' ? 1.2 : archetype === 'broad-nordic' ? 0.82 : 1.0) *
    scaleBoost
  const trunkW = (level >= 5 ? 0.9 : level >= 3 ? 0.74 : 0.54) * scaleBoost

  const fullTrunkHeight =
    archetype === 'spaced-tier' ? trunkH + (level + 2) * 0.65 * scaleBoost : trunkH + 0.6
  staticBoxes.push({
    x: 0,
    y: fullTrunkHeight / 2,
    z: 0,
    sx: trunkW,
    sy: fullTrunkHeight,
    sz: trunkW,
    color: bark.mid,
  })
  staticBoxes.push({
    x: -trunkW * 0.25,
    y: trunkH / 2,
    z: trunkW * 0.25,
    sx: trunkW * 0.42,
    sy: trunkH,
    sz: trunkW * 0.42,
    color: bark.light,
  })

  if (level >= 3 || isScenicLandmark) {
    const rOff = trunkW * 0.62
    staticBoxes.push({ x: rOff, y: 0.2, z: 0, sx: 0.42, sy: 0.38, sz: 0.42, color: bark.dark })
    staticBoxes.push({ x: -rOff, y: 0.2, z: 0, sx: 0.42, sy: 0.38, sz: 0.42, color: bark.dark })
    staticBoxes.push({ x: 0, y: 0.2, z: rOff, sx: 0.42, sy: 0.38, sz: 0.42, color: bark.dark })
    staticBoxes.push({ x: 0, y: 0.2, z: -rOff, sx: 0.42, sy: 0.38, sz: 0.42, color: bark.dark })
  }

  // Small wooden nameplate kept close beside trunk (clear of front gift & companion zones)
  if (!isScenicLandmark) {
    staticBoxes.push({ x: -0.74, y: 0.3, z: -0.74, sx: 0.14, sy: 0.6, sz: 0.14, color: '#6b4226' })
    staticBoxes.push({ x: -0.74, y: 0.54, z: -0.74, sx: 0.54, sy: 0.26, sz: 0.14, color: '#a66b41' })
  }

  const tiersByLevel: Record<TreeLevelId, number> = {
    0: 2,
    1: 3,
    2: 4,
    3: 5,
    4: 6,
    5: 7,
    6: 8,
  }
  const radiusByLevel: Record<TreeLevelId, number> = {
    0: 1.02,
    1: 1.42,
    2: 1.72,
    3: 1.98,
    4: 2.22,
    5: 2.46,
    6: 2.66,
  }

  const extraSkyHeight = Math.min(2.0, Math.max(0, contributionCount - 300) / 480)
  const tierDelta = archetype === 'spaced-tier' ? -1 : archetype === 'voluminous-cedar' ? 1 : 0
  const tiers = Math.max(2, tiersByLevel[level] + tierDelta + (contributionCount >= 800 ? 1 : 0))
  const maxRadius = radiusByLevel[level] * widthFactor
  const tierStepY =
    ((level === 0 ? 0.78 : 0.92) + extraSkyHeight * 0.12) * heightFactor
  const layersPerTier = archetype === 'voluminous-cedar' ? 3 : archetype === 'spaced-tier' ? 1 : 2
  const voxelSize = (archetype === 'voluminous-cedar' ? 0.66 : 0.6) * (isScenicLandmark ? 1.18 : 1)
  const boxHeight = (archetype === 'voluminous-cedar' ? 0.54 : 0.48) * (isScenicLandmark ? 1.15 : 1)
  const lobeCount =
    archetype === 'alpine-spire'
      ? 4
      : archetype === 'broad-nordic'
        ? 6
        : archetype === 'dense-cypress'
          ? 8
          : 5

  const canopyNodes: CanopyNode[] = []
  const tierRings: TierPlacementRing[] = []
  let topY = trunkH

  for (let t = 0; t < tiers; t += 1) {
    const progress = t / Math.max(1, tiers - 1)
    const tierBaseY = trunkH + t * tierStepY
    const profilePower =
      archetype === 'dense-cypress' ? 0.65 : archetype === 'broad-nordic' ? 0.82 : 0.76
    const tierRadius = Math.max(0.58, maxRadius * (1 - Math.pow(progress, 1.05) * profilePower))

    const leanAmp = archetype === 'irregular-wild' ? 0.3 : 0.08
    const tierOffsetX = Math.sin(t * 2.1 + seed * 0.13) * leanAmp
    const tierOffsetZ = Math.cos(t * 1.7 + seed * 0.19) * leanAmp
    const waveAmp =
      archetype === 'dense-cypress'
        ? 0.08
        : archetype === 'irregular-wild'
          ? 0.24
          : 0.16

    tierRings.push({
      tier: t,
      y: tierBaseY,
      baseRadius: tierRadius,
      offsetX: tierOffsetX,
      offsetZ: tierOffsetZ,
      lobeCount,
      waveAmp,
      phaseShift: t * 1.25 + seed * 0.03,
    })

    for (let layer = 0; layer < layersPerTier; layer += 1) {
      const y = tierBaseY + layer * (archetype === 'voluminous-cedar' ? 0.4 : 0.46) * scaleBoost
      topY = Math.max(topY, y + 0.4)
      const layerShrink =
        layersPerTier === 1 ? 0 : layer * (archetype === 'voluminous-cedar' ? 0.16 : 0.28)
      const layerRadius = Math.max(0.42, tierRadius * (1 - layerShrink))
      const gridRange = Math.ceil(layerRadius / voxelSize) + 1

      for (let gx = -gridRange; gx <= gridRange; gx += 1) {
        for (let gz = -gridRange; gz <= gridRange; gz += 1) {
          const lx = gx * voxelSize
          const lz = gz * voxelSize
          const dist = Math.hypot(lx, lz)
          const angle = Math.atan2(lz, lx)

          const branchWave = 1 + waveAmp * Math.cos(angle * lobeCount + t * 1.25 + seed * 0.03)
          const effectiveRadius = layerRadius * branchWave

          if (dist > effectiveRadius) continue

          const cellHash = Math.abs(gx * 73 + gz * 139 + t * 31 + layer * 17 + seed) % 16
          if (archetype === 'irregular-wild' && dist > effectiveRadius * 0.78 && cellHash === 0) {
            continue
          }

          const wx = lx + tierOffsetX
          const wz = lz + tierOffsetZ
          const isOuter = dist >= effectiveRadius - voxelSize * 0.95
          const color =
            layer === 0 && !isOuter
              ? palette.deep
              : isOuter && cellHash >= 9
                ? palette.bright
                : palette.mid

          staticBoxes.push({
            x: wx,
            y,
            z: wz,
            sx: voxelSize,
            sy: boxHeight,
            sz: voxelSize,
            color,
          })

          // Distinct fluffy white snow shelves on outer branch layers varying organically per tree
          const isTopLayer = layer === layersPerTier - 1
          const snowBias = (seed + t + layer) % 3
          if (isOuter && (isTopLayer || (layer === 0 && dist >= effectiveRadius - voxelSize * 0.6))) {
            const snowThreshold = palette.snowRate === 3 ? 3 : 2
            if ((Math.abs(gx * 3 + gz * 5 + t) + seed) % 4 < snowThreshold || t === tiers - 1 || t === 0) {
              staticBoxes.push({
                x: wx,
                y: y + boxHeight * 0.5 + 0.08,
                z: wz,
                sx: voxelSize * (0.9 + snowBias * 0.04),
                sy: 0.16 + snowBias * 0.035,
                sz: voxelSize * (0.9 + snowBias * 0.04),
                color: cellHash % 4 === 0 ? snowEdgeColor : snowColor,
              })
            }
          }

          if (isOuter && dist > 0.25) {
            canopyNodes.push({
              x: wx,
              y,
              z: wz,
              angle: Math.atan2(wz, wx),
              tier: t,
            })
          }
        }
      }
    }
  }

  // Crown tip with crisp white snow cap
  const crownOffsetX = archetype === 'irregular-wild' ? Math.sin(tiers + seed) * 0.14 : 0
  staticBoxes.push({
    x: crownOffsetX,
    y: topY + 0.22,
    z: 0,
    sx: 0.46 * scaleBoost,
    sy: (archetype === 'alpine-spire' ? 0.76 : 0.54) * scaleBoost,
    sz: 0.46 * scaleBoost,
    color: palette.bright,
  })
  staticBoxes.push({
    x: crownOffsetX,
    y: topY + (archetype === 'alpine-spire' ? 0.64 : 0.52) * scaleBoost,
    z: 0,
    sx: 0.4 * scaleBoost,
    sy: 0.16 * scaleBoost,
    sz: 0.4 * scaleBoost,
    color: snowColor,
  })

  const outerRadius = canopyNodes.reduce(
    (maxR, node) => Math.max(maxR, Math.hypot(node.x, node.z) + voxelSize * 0.45),
    maxRadius,
  )

  const rotationY = ((seed % 360) * Math.PI) / 180
  const usedGroundSlots = new Set<number>()
  const activeGifts = gifts.filter((g) => Boolean(g && g.gift_slug))

  // Build real GitHub contribution baubles first so community gifts never cover or replace them
  const githubBaublePositions = buildGitHubBaubles({
    level,
    seed,
    contributionCount: isScenicLandmark ? 950 : contributionCount,
    calendarWeeks,
    canopyNodes,
    staticBoxes,
    l12Boxes,
    l3Boxes,
    l4aBoxes,
    l4bBoxes,
    baubleInstances,
    separateBaubles,
  })

  // Build authentic 3D voxel models for every gift received by this tree in 360° without overwriting commits
  if (activeGifts.length > 0) {
    buildCommunityGiftsShowcase({
      gifts: activeGifts,
      seed,
      outerRadius,
      tierRings,
      githubBaublePositions,
      frontYaw,
      rotationY,
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
    // Scenic / veteran evergreen gift boxes placed neatly away from reserved companion corner
    const giftPalettes = [
      ['#dc2626', '#fbbf24'],
      ['#2563eb', '#f8fafc'],
    ]
    const g1 = giftPalettes[seed % giftPalettes.length]
    addGiftBoxes(staticBoxes, -0.92 * scaleBoost, 0, -0.78 * scaleBoost, 0.56, 0.46, 0.56, g1[0], g1[1])
    if (level >= 6 || giftCount >= 2 || isScenicLandmark) {
      const g2 = giftPalettes[(seed + 1) % giftPalettes.length]
      addGiftBoxes(staticBoxes, -1.02 * scaleBoost, 0, 0.62 * scaleBoost, 0.52, 0.44, 0.52, g2[0], g2[1])
    }
  }

  group.add(mergeColoredBoxes(staticBoxes, staticMat))

  if (!separateBaubles) {
    if (l12Boxes.length > 0) {
      group.add(mergeColoredBoxes(l12Boxes, l12MergedMat))
    }
    if (l3Boxes.length > 0) {
      group.add(mergeColoredBoxes(l3Boxes, l3MergedMat))
    }
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
  }

  // Golden topper star unlocked by stage level (or upgraded if gifted golden-star)
  const hasStarGift = activeGifts.some((g) => normalizeGiftSlug(g.gift_slug) === 'golden-star')
  if (hasStarGift) {
    const starY =
      topY + (archetype === 'alpine-spire' ? 1.04 : 0.92) * (isScenicLandmark ? 1.15 : 1)
    const sScale = (level >= 5 || isScenicLandmark ? 1.32 : 1.05) * (isScenicLandmark ? 1.18 : 1)
    const giftStar = mergeColoredBoxes(
      [
        { x: crownOffsetX, y: starY, z: 0, sx: 0.56 * sScale, sy: 0.56 * sScale, sz: 0.56 * sScale, color: '#fde047' },
        { x: crownOffsetX, y: starY, z: 0, sx: 0.24 * sScale, sy: 1.2 * sScale, sz: 0.24 * sScale, color: '#fffbeb' },
        { x: crownOffsetX, y: starY, z: 0, sx: 1.2 * sScale, sy: 0.24 * sScale, sz: 0.24 * sScale, color: '#fffbeb' },
        { x: crownOffsetX, y: starY, z: 0, sx: 0.24 * sScale, sy: 0.24 * sScale, sz: 0.94 * sScale, color: '#fffbeb' },
        { x: crownOffsetX - 0.62 * sScale, y: starY + 0.14, z: 0.2, sx: 0.16, sy: 0.16, sz: 0.16, color: '#fde047' },
        { x: crownOffsetX + 0.62 * sScale, y: starY + 0.14, z: -0.2, sx: 0.16, sy: 0.16, sz: 0.16, color: '#fde047' },
      ],
      l4PhaseAMergedMat,
    )
    group.add(giftStar)
    starMeshes.push(giftStar)
  } else if ((level >= 3 && level <= 4 && hDecor % 2 === 0) || resolved.themeId === 'arcane-violet') {
    const tip = mergeColoredBoxes(
      [{ x: crownOffsetX, y: topY + 0.72, z: 0, sx: 0.34, sy: 0.42, sz: 0.34, color: '#fbbf24' }],
      l4PhaseAMergedMat,
    )
    group.add(tip)
    starMeshes.push(tip)
  } else if (level >= 5 || isScenicLandmark) {
    const starY = topY + (archetype === 'alpine-spire' ? 1.0 : 0.86) * (isScenicLandmark ? 1.15 : 1)
    const starColor = isScenicLandmark ? '#fef08a' : '#fbbf24'
    const sScale = isScenicLandmark ? 1.45 : 1.05
    const starMesh = mergeColoredBoxes(
      [
        { x: crownOffsetX, y: starY, z: 0, sx: 0.5 * sScale, sy: 0.5 * sScale, sz: 0.32 * sScale, color: starColor },
        { x: crownOffsetX, y: starY, z: 0, sx: 0.22 * sScale, sy: 1.04 * sScale, sz: 0.22 * sScale, color: '#fffbeb' },
        { x: crownOffsetX, y: starY, z: 0, sx: 1.04 * sScale, sy: 0.22 * sScale, sz: 0.22 * sScale, color: '#fffbeb' },
      ],
      l4PhaseAMergedMat,
    )
    group.add(starMesh)
    starMeshes.push(starMesh)
  }

  group.rotation.y = rotationY

  return {
    group,
    phaseAMeshes,
    phaseBMeshes,
    starMeshes,
    baubleInstances,
    auraMesh: null,
    height: topY + (level >= 5 || hasStarGift ? 1.65 : 0.85),
    outerRadius,
    themeLabel: palette.label,
    rotationY,
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

function computeTargetBaubleCount(
  level: TreeLevelId,
  contributionCount: number,
  maxSlots: number,
): number {
  if (level === 0 || contributionCount <= 0 || maxSlots <= 0) return 0

  let desired: number
  if (level === 1) {
    desired = Math.min(10, Math.max(1, contributionCount))
  } else if (level === 2) {
    desired = 11 + Math.round(((Math.min(50, contributionCount) - 11) / 39) * 15)
  } else if (level === 3) {
    desired = 27 + Math.round(((Math.min(100, contributionCount) - 51) / 49) * 15)
  } else if (level === 4) {
    desired = 43 + Math.round(((Math.min(300, contributionCount) - 101) / 199) * 23)
  } else if (level === 5) {
    desired = 67 + Math.round(((Math.min(500, contributionCount) - 301) / 199) * 23)
  } else {
    desired = 91 + Math.round(Math.min(1, Math.max(0, contributionCount - 501) / 700) * 37)
  }

  return Math.min(maxSlots, Math.max(1, desired))
}

function angularDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

function buildGitHubBaubles(opts: {
  level: TreeLevelId
  seed: number
  contributionCount: number
  calendarWeeks?: GitHubContributionWeek[]
  canopyNodes: CanopyNode[]
  staticBoxes: ColoredBox[]
  l12Boxes: ColoredBox[]
  l3Boxes: ColoredBox[]
  l4aBoxes: ColoredBox[]
  l4bBoxes: ColoredBox[]
  baubleInstances: BaubleInstanceData[]
  separateBaubles: boolean
}): Point3D[] {
  const {
    level,
    seed,
    contributionCount,
    calendarWeeks,
    canopyNodes,
    staticBoxes,
    l12Boxes,
    l3Boxes,
    l4aBoxes,
    l4bBoxes,
    baubleInstances,
    separateBaubles,
  } = opts

  const placedPositions: Point3D[] = []
  if (canopyNodes.length === 0 || level === 0 || contributionCount <= 0) return placedPositions

  const rawEntries = extractCommitOrnamentEntries({
    contributionCount,
    calendarWeeks,
  })
  if (rawEntries.length === 0) return placedPositions

  const targetCount = computeTargetBaubleCount(level, contributionCount, canopyNodes.length)
  if (targetCount <= 0) return placedPositions

  // Bucket chronologically preserving peak days, or expand burst days to match annual volume
  const sampledEntries = (() => {
    if (rawEntries.length > targetCount) {
      const buckets: typeof rawEntries = []
      for (let i = 0; i < targetCount; i += 1) {
        const start = Math.floor((i * rawEntries.length) / targetCount)
        const end = Math.max(start + 1, Math.floor(((i + 1) * rawEntries.length) / targetCount))
        let best = rawEntries[start]
        for (let k = start + 1; k < end; k += 1) {
          if (rawEntries[k].count > best.count) {
            best = rawEntries[k]
          }
        }
        buckets.push(best)
      }
      return buckets
    }

    if (rawEntries.length < targetCount && contributionCount > rawEntries.length) {
      const expanded = [...rawEntries]
      const cap = Math.min(targetCount, contributionCount)
      let cursor = 0
      while (expanded.length < cap && cursor < expanded.length * 3) {
        const candidate = rawEntries[cursor % rawEntries.length]
        if (candidate.count > 1) {
          expanded.push(candidate)
        }
        cursor += 1
      }
      expanded.sort((a, b) => a.weekIndex - b.weekIndex || a.dayOfWeek - b.dayOfWeek)
      return expanded.slice(0, cap)
    }

    return rawEntries
  })()

  // Group outer branch nodes by height tier for chronological bottom-to-top spiral layout
  const tiersMap = new Map<number, CanopyNode[]>()
  for (const node of canopyNodes) {
    const list = tiersMap.get(node.tier)
    if (list) list.push(node)
    else tiersMap.set(node.tier, [node])
  }
  const tierKeys = Array.from(tiersMap.keys()).sort((a, b) => a - b)
  const usedNodes = new Set<CanopyNode>()

  const goldenAngle = 2.39996323
  const baseTheta = ((seed % 360) * Math.PI) / 180

  for (let i = 0; i < sampledEntries.length; i += 1) {
    const entry = sampledEntries[i]
    const progress = sampledEntries.length === 1 ? 0.5 : i / (sampledEntries.length - 1)
    const idealTierPos = Math.min(tierKeys.length - 1, Math.floor(progress * tierKeys.length))
    const targetTheta = baseTheta + i * goldenAngle

    let chosen: CanopyNode | null = null
    let bestScore = Infinity

    for (let tierOffset = 0; tierOffset < tierKeys.length && !chosen; tierOffset += 1) {
      const candidateTiers =
        tierOffset === 0
          ? [idealTierPos]
          : [idealTierPos - tierOffset, idealTierPos + tierOffset].filter(
              (idx) => idx >= 0 && idx < tierKeys.length,
            )

      for (const tIdx of candidateTiers) {
        const bucket = tiersMap.get(tierKeys[tIdx]) ?? []
        for (const node of bucket) {
          if (usedNodes.has(node)) continue
          const dTheta = angularDelta(node.angle, targetTheta)
          if (dTheta < bestScore) {
            bestScore = dTheta
            chosen = node
          }
        }
      }
    }

    if (!chosen) break
    usedNodes.add(chosen)

    const chosenR = Math.max(0.25, Math.hypot(chosen.x, chosen.z))
    const radialPush = Math.max(chosenR * 1.13, chosenR + 0.26)
    const bx = (chosen.x / chosenR) * radialPush
    const by = chosen.y - 0.14
    const bz = (chosen.z / chosenR) * radialPush
    placedPositions.push({ x: bx, y: by, z: bz })

    const variantHash = mixSeed(seed + i * 17, entry.weekIndex * 7 + entry.dayOfWeek + 1)
    const colors = GITHUB_BAUBLE_COLORS[entry.level]
    const color = colors[variantHash % colors.length]

    // ~28–32% larger GitHub commit baubles so commit activity stands out crisply even alongside gifts
    const size =
      entry.level === 4 ? 0.41 : entry.level === 3 ? 0.35 : entry.level === 2 ? 0.32 : 0.29

    // Bright gold/silver ornament hanger cap merged into static tree mesh for crisp contrast
    staticBoxes.push({
      x: bx,
      y: by + size * 0.54,
      z: bz,
      sx: size * 0.42,
      sy: 0.09,
      sz: size * 0.42,
      color: entry.level >= 3 ? '#fde047' : '#f4f8ff',
    })

    if (entry.level === 4) {
      const bucketKey: BaubleBucket = i % 2 === 0 ? 'l4a' : 'l4b'
      const hx = bx + (bx >= 0 ? 0.1 : -0.1)
      const hy = by + 0.1
      const hz = bz + (bz >= 0 ? 0.1 : -0.1)

      if (separateBaubles) {
        baubleInstances.push({ x: bx, y: by, z: bz, size, color, bucket: bucketKey })
        baubleInstances.push({ x: hx, y: hy, z: hz, size: 0.17, color: '#ecfdf5', bucket: bucketKey })
      } else {
        const target = bucketKey === 'l4a' ? l4aBoxes : l4bBoxes
        target.push({ x: bx, y: by, z: bz, sx: size, sy: size, sz: size, color })
        target.push({ x: hx, y: hy, z: hz, sx: 0.17, sy: 0.17, sz: 0.17, color: '#ecfdf5' })
      }
    } else if (entry.level === 3) {
      if (separateBaubles) {
        baubleInstances.push({ x: bx, y: by, z: bz, size, color, bucket: 'l3' })
      } else {
        l3Boxes.push({ x: bx, y: by, z: bz, sx: size, sy: size, sz: size, color })
      }
    } else {
      const bucketKey: BaubleBucket = entry.level === 2 ? 'l2' : 'l1'
      if (separateBaubles) {
        baubleInstances.push({ x: bx, y: by, z: bz, size, color, bucket: bucketKey })
      } else {
        l12Boxes.push({ x: bx, y: by, z: bz, sx: size, sy: size, sz: size, color })
      }
    }
  }

  return placedPositions
}
