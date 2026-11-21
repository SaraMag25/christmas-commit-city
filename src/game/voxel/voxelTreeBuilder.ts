import * as THREE from 'three'
import type { GitHubContributionWeek, TreeLevelId } from '../../types/city'

export type TreeThemeId =
  | 'classic-pine'
  | 'snowy-pine'
  | 'golden-pine'
  | 'frosted-blue'
  | 'crimson-autumn'
  | 'sakura-winter'
  | 'arcane-violet'
  | 'grand-elder'

export interface VoxelTreeBuildOptions {
  level: TreeLevelId
  seed: number
  gridX?: number
  gridY?: number
  giftCount?: number
  isScenicLandmark?: boolean
  isCreatorSpecial?: boolean
  contributionCount?: number
  calendarWeeks?: GitHubContributionWeek[]
}

export interface BuiltVoxelTree {
  group: THREE.Group
  phaseAMeshes: THREE.Mesh[]
  phaseBMeshes: THREE.Mesh[]
  starMeshes: THREE.Mesh[]
  auraMesh: THREE.Mesh | null
  height: number
  themeLabel: string
}

interface CanopyNode {
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
  accent: string
  snowRate: number // 0: none, 1: light, 2: heavy
}

const THEME_PALETTES: Record<TreeThemeId, ThemePalette> = {
  'classic-pine': {
    label: 'Pinheiro Tradicional',
    deep: '#052418',
    mid: '#0c3b27',
    bright: '#165b3d',
    accent: '#dc2626',
    snowRate: 1,
  },
  'snowy-pine': {
    label: 'Pinheiro Nevado',
    deep: '#0c2c24',
    mid: '#15473a',
    bright: '#236e58',
    accent: '#f8fafc',
    snowRate: 2,
  },
  'golden-pine': {
    label: 'Pinheiro Esmeralda',
    deep: '#064030',
    mid: '#095c45',
    bright: '#108261',
    accent: '#fbbf24',
    snowRate: 1,
  },
  'frosted-blue': {
    label: 'Pinheiro Azulado',
    deep: '#0a2d33',
    mid: '#114750',
    bright: '#1b6973',
    accent: '#bae6fd',
    snowRate: 2,
  },
  'crimson-autumn': {
    label: 'Pinheiro Floresta',
    deep: '#0e331d',
    mid: '#15522d',
    bright: '#1e733f',
    accent: '#dc2626',
    snowRate: 1,
  },
  'sakura-winter': {
    label: 'Pinheiro Musgo',
    deep: '#1c361c',
    mid: '#2b5226',
    bright: '#3e6e35',
    accent: '#f8fafc',
    snowRate: 1,
  },
  'arcane-violet': {
    label: 'Pinheiro Oliva',
    deep: '#293818',
    mid: '#3b5020',
    bright: '#506b2b',
    accent: '#fde047',
    snowRate: 0,
  },
  'grand-elder': {
    label: 'Árvore Gigante',
    deep: '#063324',
    mid: '#0e4f38',
    bright: '#1d7553',
    accent: '#fbbf24',
    snowRate: 1,
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
  { dark: '#3b2110', mid: '#6b4226', light: '#8c5835' },
  { dark: '#2d1a12', mid: '#523426', light: '#734b38' },
  { dark: '#475569', mid: '#94a3b8', light: '#cbd5e1' }, // Silver birch / Mallorn bark
]

const COMMIT_PALETTE = {
  unlit: '#162032',
  lowA: '#16a34a',
  lowB: '#15803d',
  midA: '#22c55e',
  midB: '#16a34a',
  highA: '#4ade80',
  highB: '#22c55e',
  intenseA: '#bbf7d0',
  intenseB: '#4ade80',
} as const

const baseBox = new THREE.BoxGeometry(1, 1, 1)
const basePos = baseBox.getAttribute('position') as THREE.BufferAttribute
const baseNorm = baseBox.getAttribute('normal') as THREE.BufferAttribute
const baseIdx = baseBox.getIndex() as THREE.BufferAttribute

const staticMat = new THREE.MeshLambertMaterial({ vertexColors: true })
const phaseAMat = new THREE.MeshBasicMaterial({ vertexColors: true })
const phaseBMat = new THREE.MeshBasicMaterial({ vertexColors: true })

export function updateCommitLightsTwinkle(timeSec: number): void {
  const bA = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(timeSec * 2.2))
  const bB = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(timeSec * 2.2 + Math.PI))
  phaseAMat.color.setRGB(bA, bA, bA)
  phaseBMat.color.setRGB(bB, bB, bB)
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
  gridX = 20,
  gridY = 15,
  level: TreeLevelId = 0,
): { themeId: TreeThemeId; label: string; regionName: string } {
  const hTheme = mixSeed(seed, 37) % 100

  let regionName: string
  let themeId: TreeThemeId

  if (gridY <= 7) {
    regionName = 'Montanhas Geladas'
    themeId = hTheme < 45 ? 'snowy-pine' : hTheme < 80 ? 'frosted-blue' : 'classic-pine'
  } else if (gridX <= 12 && gridY >= 20) {
    regionName = 'Lago Congelado'
    themeId = hTheme < 55 ? 'frosted-blue' : hTheme < 85 ? 'snowy-pine' : 'classic-pine'
  } else if (gridX >= 25 && gridY <= 15) {
    regionName = 'Bosque Encantado'
    themeId =
      hTheme < 34
        ? 'arcane-violet'
        : hTheme < 64
          ? 'sakura-winter'
          : hTheme < 84
            ? 'golden-pine'
            : 'classic-pine'
  } else if (gridX >= 22 && gridY >= 17) {
    regionName = 'Jardim Natalino'
    themeId =
      hTheme < 34
        ? 'golden-pine'
        : hTheme < 64
          ? 'crimson-autumn'
          : hTheme < 82
            ? 'classic-pine'
            : 'snowy-pine'
  } else if (Math.abs(gridX - 20) <= 3 || Math.abs(gridY - 15) <= 2) {
    regionName = 'Floresta Iluminada'
    themeId = hTheme < 40 ? 'classic-pine' : hTheme < 70 ? 'golden-pine' : 'snowy-pine'
  } else {
    regionName = 'Floresta Nevada'
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
 * Builds a rich, diversified 3D voxel Christmas tree with regional themes,
 * distinct botanical shapes, gifts, plaques, and GitHub commit green lights.
 */
export function buildVoxelChristmasTree(opts: VoxelTreeBuildOptions): BuiltVoxelTree {
  const {
    level,
    seed,
    gridX = 20,
    gridY = 15,
    giftCount = 0,
    isScenicLandmark = false,
    contributionCount = 0,
    calendarWeeks,
  } = opts

  const group = new THREE.Group()
  const staticBoxes: ColoredBox[] = []
  const phaseABoxes: ColoredBox[] = []
  const phaseBBoxes: ColoredBox[] = []
  const phaseAMeshes: THREE.Mesh[] = []
  const phaseBMeshes: THREE.Mesh[] = []
  const starMeshes: THREE.Mesh[] = []

  const hArch = mixSeed(seed, 11)
  const hDecor = mixSeed(seed, 71)
  const hBark = mixSeed(seed, 97)

  const resolved = isScenicLandmark
    ? { themeId: 'grand-elder' as TreeThemeId, label: 'Árvore Lendária do Vale' }
    : resolveTreeTheme(seed, gridX, gridY, level)

  const palette = THEME_PALETTES[resolved.themeId]
  const archetype: TreeArchetype =
    resolved.themeId === 'grand-elder'
      ? 'voluminous-cedar'
      : ARCHETYPES[hArch % ARCHETYPES.length]

  const isPaleBarkTheme =
    resolved.themeId === 'sakura-winter' || resolved.themeId === 'arcane-violet'
  const bark = isPaleBarkTheme ? BARK_PALETTES[2] : BARK_PALETTES[hBark % 2]
  const snowColor = resolved.themeId === 'frosted-blue' ? '#e0f2fe' : '#f1f5f9'

  // Dark root shadow pad
  const padScale = isScenicLandmark ? 5.2 : 2.7
  staticBoxes.push({ x: 0, y: 0.04, z: 0, sx: padScale, sy: 0.08, sz: padScale, color: '#071710' })

  const scaleBoost = isScenicLandmark ? 1.55 : 1.0
  const widthFactor =
    (archetype === 'alpine-spire'
      ? 0.74
      : archetype === 'broad-nordic'
        ? 1.24
        : archetype === 'voluminous-cedar'
          ? 1.16
          : archetype === 'dense-cypress'
            ? 0.85
            : archetype === 'spaced-tier'
              ? 1.05
              : 1.0) * scaleBoost

  const heightFactor =
    (archetype === 'alpine-spire'
      ? 1.22
      : archetype === 'broad-nordic'
        ? 0.86
        : archetype === 'spaced-tier'
          ? 1.14
          : archetype === 'dense-cypress'
            ? 1.08
            : 1.0) * scaleBoost

  const baseTrunkH = level === 0 ? 0.95 : level <= 2 ? 1.35 : level <= 4 ? 1.75 : 2.15
  const trunkH =
    baseTrunkH *
    (archetype === 'spaced-tier' ? 1.2 : archetype === 'broad-nordic' ? 0.82 : 1.0) *
    scaleBoost
  const trunkW = (level >= 5 ? 0.92 : level >= 3 ? 0.76 : 0.54) * scaleBoost

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
    const rOff = trunkW * 0.65
    staticBoxes.push({ x: rOff, y: 0.2, z: 0, sx: 0.46, sy: 0.4, sz: 0.46, color: bark.dark })
    staticBoxes.push({ x: -rOff, y: 0.2, z: 0, sx: 0.46, sy: 0.4, sz: 0.46, color: bark.dark })
    staticBoxes.push({ x: 0, y: 0.2, z: rOff, sx: 0.46, sy: 0.4, sz: 0.46, color: bark.dark })
    staticBoxes.push({ x: 0, y: 0.2, z: -rOff, sx: 0.46, sy: 0.4, sz: 0.46, color: bark.dark })
  }

  // Small personal GitHub nameplate post beside the developer's trunk
  if (!isScenicLandmark) {
    staticBoxes.push({ x: 1.05, y: 0.35, z: 0.95, sx: 0.16, sy: 0.7, sz: 0.16, color: '#5c371d' })
    staticBoxes.push({ x: 1.05, y: 0.62, z: 0.95, sx: 0.65, sy: 0.32, sz: 0.18, color: '#8c5835' })
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
    0: 1.15,
    1: 1.62,
    2: 2.02,
    3: 2.32,
    4: 2.62,
    5: 2.92,
    6: 3.22,
  }

  const extraSkyHeight = Math.min(2.0, Math.max(0, contributionCount - 300) / 480)
  const tierDelta = archetype === 'spaced-tier' ? -1 : archetype === 'voluminous-cedar' ? 1 : 0
  const tiers = Math.max(2, tiersByLevel[level] + tierDelta + (contributionCount >= 800 ? 1 : 0))
  const maxRadius = radiusByLevel[level] * widthFactor
  const tierStepY =
    ((level === 0 ? 0.78 : 0.94) + extraSkyHeight * 0.12) * heightFactor
  const layersPerTier = archetype === 'voluminous-cedar' ? 3 : archetype === 'spaced-tier' ? 1 : 2
  const voxelSize = (archetype === 'voluminous-cedar' ? 0.7 : 0.64) * (isScenicLandmark ? 1.18 : 1)
  const lobeCount =
    archetype === 'alpine-spire'
      ? 4
      : archetype === 'broad-nordic'
        ? 6
        : archetype === 'dense-cypress'
          ? 8
          : 5

  const canopyNodes: CanopyNode[] = []
  let topY = trunkH

  for (let t = 0; t < tiers; t += 1) {
    const progress = t / Math.max(1, tiers - 1)
    const tierBaseY = trunkH + t * tierStepY
    const profilePower = archetype === 'dense-cypress' ? 0.65 : archetype === 'broad-nordic' ? 0.82 : 0.76
    const tierRadius = Math.max(0.62, maxRadius * (1 - Math.pow(progress, 1.05) * profilePower))

    const leanAmp = archetype === 'irregular-wild' ? 0.34 : 0.1
    const tierOffsetX = Math.sin(t * 2.1 + seed * 0.13) * leanAmp
    const tierOffsetZ = Math.cos(t * 1.7 + seed * 0.19) * leanAmp

    for (let layer = 0; layer < layersPerTier; layer += 1) {
      const y = tierBaseY + layer * (archetype === 'voluminous-cedar' ? 0.42 : 0.48) * scaleBoost
      topY = Math.max(topY, y + 0.42)
      const layerShrink = layersPerTier === 1 ? 0 : layer * (archetype === 'voluminous-cedar' ? 0.16 : 0.28)
      const layerRadius = Math.max(0.45, tierRadius * (1 - layerShrink))
      const gridRange = Math.ceil(layerRadius / voxelSize) + 1

      for (let gx = -gridRange; gx <= gridRange; gx += 1) {
        for (let gz = -gridRange; gz <= gridRange; gz += 1) {
          const lx = gx * voxelSize
          const lz = gz * voxelSize
          const dist = Math.hypot(lx, lz)
          const angle = Math.atan2(lz, lx)

          const waveAmp =
            archetype === 'dense-cypress'
              ? 0.08
              : archetype === 'irregular-wild'
                ? 0.26
                : 0.17
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
              : isOuter && cellHash >= 10
                ? palette.bright
                : palette.mid

          staticBoxes.push({
            x: wx,
            y,
            z: wz,
            sx: voxelSize,
            sy: (archetype === 'voluminous-cedar' ? 0.56 : 0.5) * (isScenicLandmark ? 1.15 : 1),
            sz: voxelSize,
            color,
          })

          // Theme-aware snow accumulation
          if (palette.snowRate > 0 && isOuter && layer === 0) {
            const snowMod = palette.snowRate === 2 ? 2 : 5
            if ((Math.abs(gx + gz + t) + seed) % snowMod === 0) {
              staticBoxes.push({
                x: wx,
                y: y + 0.28,
                z: wz,
                sx: voxelSize * 0.82,
                sy: 0.14,
                sz: voxelSize * 0.82,
                color: snowColor,
              })
            }
          }

          if (isOuter && dist > 0.26) {
            canopyNodes.push({
              x: wx * 1.1,
              y: y + (cellHash % 2 === 0 ? 0.04 : -0.04),
              z: wz * 1.1,
            })
          }
        }
      }
    }
  }

  const crownOffsetX = archetype === 'irregular-wild' ? Math.sin(tiers + seed) * 0.16 : 0
  staticBoxes.push({
    x: crownOffsetX,
    y: topY + 0.24,
    z: 0,
    sx: 0.46 * scaleBoost,
    sy: (archetype === 'alpine-spire' ? 0.78 : 0.56) * scaleBoost,
    sz: 0.46 * scaleBoost,
    color: palette.bright,
  })

  // Theme ornaments & received-gift baubles (distinct from green GitHub commit squares)
  const totalOrnaments = Math.min(10, level + giftCount * 2 + (isScenicLandmark ? 6 : 0))
  if ((level >= 2 || giftCount > 0 || isScenicLandmark) && canopyNodes.length > 0) {
    const colors = [palette.accent, '#dc2626', '#fbbf24', '#f8fafc']
    for (let i = 0; i < totalOrnaments; i += 1) {
      const node = canopyNodes[(seed + i * 23) % canopyNodes.length]
      staticBoxes.push({
        x: node.x * 0.96,
        y: node.y - 0.14,
        z: node.z * 0.96,
        sx: 0.23,
        sy: 0.24,
        sz: 0.23,
        color: colors[(seed + i) % colors.length],
      })
    }
  }

  // Gifts stacked under tree when level >= 5, received community gifts, or scenic landmark
  if (level >= 5 || giftCount > 0 || isScenicLandmark) {
    const giftPalettes = [
      ['#dc2626', '#fbbf24'],
      ['#2563eb', '#f8fafc'],
      ['#9333ea', '#fde047'],
      ['#d97706', '#fef2f2'],
    ]
    const g1 = giftPalettes[seed % giftPalettes.length]
    addGiftBoxes(staticBoxes, -1.0 * scaleBoost, 0, 0.85 * scaleBoost, 0.66, 0.54, 0.66, g1[0], g1[1])
    if (level >= 5 || giftCount >= 2 || isScenicLandmark) {
      const g2 = giftPalettes[(seed + 1) % giftPalettes.length]
      addGiftBoxes(staticBoxes, 0.9 * scaleBoost, 0, -0.75 * scaleBoost, 0.6, 0.46, 0.6, g2[0], g2[1])
    }
  }

  group.add(mergeColoredBoxes(staticBoxes, staticMat))

  // GitHub commit squares (always bright GitHub greens on developer trees!)
  buildOrganicCommitLights({
    seed,
    contributionCount: isScenicLandmark ? 900 : contributionCount,
    calendarWeeks,
    canopyNodes,
    phaseABoxes,
    phaseBBoxes,
    isScenicLandmark,
  })

  if (phaseABoxes.length > 0) {
    const meshA = mergeColoredBoxes(phaseABoxes, phaseAMat)
    group.add(meshA)
    phaseAMeshes.push(meshA)
  }
  if (phaseBBoxes.length > 0) {
    const meshB = mergeColoredBoxes(phaseBBoxes, phaseBMat)
    group.add(meshB)
    phaseBMeshes.push(meshB)
  }

  // Topper star unlocked by level (or magical trees)
  if ((level >= 3 && level <= 4 && hDecor % 2 === 0) || resolved.themeId === 'arcane-violet') {
    const tip = mergeColoredBoxes(
      [{ x: crownOffsetX, y: topY + 0.68, z: 0, sx: 0.3, sy: 0.4, sz: 0.3, color: '#fbbf24' }],
      phaseAMat,
    )
    group.add(tip)
    starMeshes.push(tip)
  } else if (level >= 5 || isScenicLandmark) {
    const starY = topY + (archetype === 'alpine-spire' ? 0.98 : 0.84) * (isScenicLandmark ? 1.15 : 1)
    const starColor = isScenicLandmark ? '#fef08a' : '#fbbf24'
    const sScale = isScenicLandmark ? 1.4 : 1.0
    const starMesh = mergeColoredBoxes(
      [
        { x: crownOffsetX, y: starY, z: 0, sx: 0.48 * sScale, sy: 0.48 * sScale, sz: 0.32 * sScale, color: starColor },
        { x: crownOffsetX, y: starY, z: 0, sx: 0.2 * sScale, sy: 0.98 * sScale, sz: 0.2 * sScale, color: '#fffbeb' },
        { x: crownOffsetX, y: starY, z: 0, sx: 0.98 * sScale, sy: 0.2 * sScale, sz: 0.2 * sScale, color: '#fffbeb' },
      ],
      phaseAMat,
    )
    group.add(starMesh)
    starMeshes.push(starMesh)
  }

  group.rotation.y = ((seed % 8) * Math.PI) / 4

  return {
    group,
    phaseAMeshes,
    phaseBMeshes,
    starMeshes,
    auraMesh: null,
    height: topY + (level >= 5 ? 1.5 : 0.8),
    themeLabel: palette.label,
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
}

function buildOrganicCommitLights(opts: {
  seed: number
  contributionCount: number
  calendarWeeks?: GitHubContributionWeek[]
  canopyNodes: CanopyNode[]
  phaseABoxes: ColoredBox[]
  phaseBBoxes: ColoredBox[]
  isScenicLandmark?: boolean
}): void {
  const {
    seed,
    contributionCount,
    calendarWeeks,
    canopyNodes,
    phaseABoxes,
    phaseBBoxes,
    isScenicLandmark = false,
  } = opts
  if (canopyNodes.length === 0) return

  const activeDays = calendarWeeks
    ? calendarWeeks.flatMap((w) => w.contributionDays).filter((d) => d.contributionCount > 0)
    : []

  const totalNodes = canopyNodes.length
  const ratio =
    contributionCount <= 0
      ? 0
      : Math.min(0.95, 0.1 + Math.log10(contributionCount + 1) * 0.31)

  const targetCount =
    activeDays.length > 0
      ? Math.min(totalNodes, Math.max(2, Math.round((activeDays.length / 365) * totalNodes * 1.45)))
      : Math.round(totalNodes * ratio)

  if (targetCount <= 0) {
    const step = Math.max(6, Math.floor(totalNodes / 6))
    for (let i = 0; i < totalNodes; i += step) {
      const n = canopyNodes[i]
      phaseABoxes.push({
        x: n.x * 1.05,
        y: n.y,
        z: n.z * 1.05,
        sx: 0.18,
        sy: 0.18,
        sz: 0.18,
        color: COMMIT_PALETTE.unlit,
      })
    }
    return
  }

  const litCount = Math.max(2, targetCount)
  const stride = 29
  const start = seed % totalNodes
  const used = new Set<number>()
  const scenicColors = ['#fbbf24', '#f87171', '#38bdf8', '#4ade80']

  for (let i = 0; i < litCount; i += 1) {
    let idx = (start + i * stride) % totalNodes
    while (used.has(idx) && used.size < totalNodes) {
      idx = (idx + 1) % totalNodes
    }
    used.add(idx)

    const node = canopyNodes[idx]
    const dayCount =
      activeDays.length > 0
        ? activeDays[i % activeDays.length].contributionCount
        : Math.max(1, Math.round(contributionCount / Math.max(1, litCount)))

    const isSetA = i % 2 === 0
    const color = isScenicLandmark
      ? scenicColors[i % scenicColors.length]
      : dayCount >= 8
        ? isSetA
          ? COMMIT_PALETTE.intenseA
          : COMMIT_PALETTE.intenseB
        : dayCount >= 4
          ? isSetA
            ? COMMIT_PALETTE.highA
            : COMMIT_PALETTE.highB
          : dayCount >= 2
            ? isSetA
              ? COMMIT_PALETTE.midA
              : COMMIT_PALETTE.midB
            : isSetA
              ? COMMIT_PALETTE.lowA
              : COMMIT_PALETTE.lowB

    const size = dayCount >= 8 ? 0.25 : 0.21
    const box: ColoredBox = {
      x: node.x * 1.06,
      y: node.y + 0.03,
      z: node.z * 1.06,
      sx: size,
      sy: size,
      sz: size,
      color,
    }
    if (isSetA) {
      phaseABoxes.push(box)
    } else {
      phaseBBoxes.push(box)
    }
  }
}
