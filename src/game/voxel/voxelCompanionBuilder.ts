import * as THREE from 'three'
import type {
  BodyAccessoryId,
  CompanionSpeciesId,
  EquippedAccessories,
  HandAccessoryId,
  HeadAccessoryId,
} from '../../types/companion'
import { getToonGradientMap, getUnitBoxGeometry, getVoxelMaterial } from './voxelMaterials'

interface ColoredBox {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  color: string
}

interface AnchorPoint {
  x: number
  y: number
  z: number
  scale: number
}

interface HeadAnchorPoint extends AnchorPoint {
  width: number
  depth: number
  /**
   * Y where wrap-around headwear (helmets) physically rests: the measured skull crown, or the
   * species' `headwearRestY` when facial features (e.g. Bento's bulging frog eyes) stick out above it.
   */
  skullTopY: number
}

/**
 * Per companion + HEAD slot fine-tuning applied on top of the generic Box3 anchor.
 * The transform pivots around the head-top anchor (x, y, z), so `scale`/`rotation` never
 * drift the accessory off the head. Shared by the shop LIVE_PREVIEW and the city/tree scenes
 * because every renderer goes through `buildVoxelCompanion`.
 */
export interface HeadAccessoryFit {
  /** Extra translation [x, y, z] in companion-local units. */
  position?: readonly [number, number, number]
  /** Uniform scale multiplier around the head-top pivot. */
  scale?: number
  /** Euler rotation [x, y, z] in radians around the head-top pivot. */
  rotation?: readonly [number, number, number]
}

const HEAD_ACCESSORY_FITS: Partial<
  Record<CompanionSpeciesId, Partial<Record<HeadAccessoryId, HeadAccessoryFit>>>
> = {
  frog: {
    // Bento: shell rests on top of the bulging eyes (headwearRestY) — nudge slightly forward so the
    // helmet is centred over eyes + skull instead of the back of the head, with a tiny forward tilt.
    astronaut_helmet: { position: [0, 0, 0.03], scale: 1, rotation: [0.05, 0, 0] },
  },
}

export function getHeadAccessoryFit(
  species: CompanionSpeciesId,
  id: HeadAccessoryId,
): HeadAccessoryFit | undefined {
  return HEAD_ACCESSORY_FITS[species]?.[id]
}

interface FaceAnchorPoint extends AnchorPoint {
  eyeSpan: number
  headHalfW: number
}

export interface DynamicCompanionAnchors {
  anchorHeadTop: HeadAnchorPoint
  anchorFaceFront: FaceAnchorPoint
  anchorTorsoCenter: { x: number; y: number; z: number; sx: number; sy: number; sz: number }
  anchorTorsoWidth: number
  anchorSideHand: AnchorPoint
  modelBounds: THREE.Box3
}

interface SpeciesRigProfile {
  headMinY: number
  headMaxY: number
  headHalfSpanX?: number
  faceCenterY: number
  eyeSpan: number
  crownClearance?: number
  /** Minimum Y for headwear when features (frog eyes) protrude above the skull crown. */
  headwearRestY?: number
  torsoMinY: number
  torsoMaxY: number
  torsoHalfSpanX?: number
  torsoMarginXZ?: number
  torsoMarginY?: number
  hoodYRatio?: number
  hoodZOffset?: number
  handHeightRatio?: number
  handClearanceX?: number
  handZOffset?: number
  handScale?: number
  backAnchorZMargin?: number
  modelHeight: number
}

const SPECIES_RIG_PROFILES: Record<CompanionSpeciesId, SpeciesRigProfile> = {
  frog: {
    headMinY: 0.44,
    headMaxY: 0.74,
    faceCenterY: 0.65,
    eyeSpan: 0.42,
    crownClearance: 0.025,
    // Bulging eyes top out at y≈0.81 (skull crown is 0.73): hats/helmets rest on them instead of burying them
    headwearRestY: 0.8,
    torsoMinY: 0.14,
    torsoMaxY: 0.46,
    torsoMarginXZ: 0.045,
    torsoMarginY: 0.02,
    handHeightRatio: 0.56,
    handClearanceX: 0.14,
    handZOffset: 0.2,
    handScale: 0.94,
    modelHeight: 1.05,
  },
  otter: {
    headMinY: 0.66,
    headMaxY: 1.06,
    faceCenterY: 0.87,
    eyeSpan: 0.28,
    crownClearance: 0.01,
    torsoMinY: 0.14,
    torsoMaxY: 0.64,
    torsoMarginXZ: 0.05,
    torsoMarginY: 0.02,
    handHeightRatio: 0.56,
    handClearanceX: 0.15,
    handZOffset: 0.22,
    handScale: 0.92,
    modelHeight: 1.25,
  },
  snake: {
    headMinY: 0.65,
    headMaxY: 0.96,
    headHalfSpanX: 0.26,
    faceCenterY: 0.81,
    eyeSpan: 0.28,
    crownClearance: 0.015,
    torsoMinY: 0.37,
    torsoMaxY: 0.64,
    torsoHalfSpanX: 0.2,
    torsoMarginXZ: 0.06,
    torsoMarginY: 0.015,
    handHeightRatio: 0.48,
    handClearanceX: 0.13,
    handZOffset: 0.18,
    handScale: 0.88,
    modelHeight: 1.18,
  },
  capybara: {
    headMinY: 0.58,
    headMaxY: 0.94,
    faceCenterY: 0.78,
    eyeSpan: 0.32,
    crownClearance: 0.025,
    torsoMinY: 0.2,
    torsoMaxY: 0.64,
    torsoMarginXZ: 0.045,
    torsoMarginY: 0.02,
    hoodYRatio: 0.52,
    hoodZOffset: 0.14,
    handHeightRatio: 0.45,
    handClearanceX: 0.16,
    handZOffset: 0.28,
    handScale: 0.96,
    modelHeight: 1.15,
  },
  mouse: {
    headMinY: 0.55,
    headMaxY: 0.9,
    headHalfSpanX: 0.24,
    faceCenterY: 0.72,
    eyeSpan: 0.26,
    crownClearance: 0.065,
    torsoMinY: 0.15,
    torsoMaxY: 0.54,
    torsoMarginXZ: 0.045,
    torsoMarginY: 0.02,
    handHeightRatio: 0.52,
    handClearanceX: 0.13,
    handZOffset: 0.2,
    handScale: 0.88,
    modelHeight: 1.12,
  },
  cat: {
    headMinY: 0.6,
    headMaxY: 0.96,
    headHalfSpanX: 0.25,
    faceCenterY: 0.79,
    eyeSpan: 0.28,
    crownClearance: 0.045,
    torsoMinY: 0.14,
    torsoMaxY: 0.56,
    torsoHalfSpanX: 0.27,
    torsoMarginXZ: 0.05,
    torsoMarginY: 0.02,
    handHeightRatio: 0.52,
    handClearanceX: 0.15,
    handZOffset: 0.2,
    handScale: 0.9,
    modelHeight: 1.2,
  },
  clawd_cafe: {
    headMinY: 0.24,
    headMaxY: 0.75,
    headHalfSpanX: 0.44,
    faceCenterY: 0.5,
    eyeSpan: 0.42,
    crownClearance: 0.008,
    torsoMinY: 0.18,
    torsoMaxY: 0.355,
    torsoHalfSpanX: 0.44,
    torsoMarginXZ: 0.036,
    torsoMarginY: 0.01,
    handHeightRatio: 0.55,
    handClearanceX: 0.17,
    handZOffset: 0.14,
    handScale: 0.8,
    modelHeight: 0.98,
  },
  leaf_kitty: {
    headMinY: 0.6,
    headMaxY: 0.96,
    headHalfSpanX: 0.25,
    faceCenterY: 0.78,
    eyeSpan: 0.28,
    crownClearance: 0.055,
    torsoMinY: 0.14,
    torsoMaxY: 0.56,
    torsoHalfSpanX: 0.27,
    torsoMarginXZ: 0.05,
    torsoMarginY: 0.02,
    handHeightRatio: 0.52,
    handClearanceX: 0.15,
    handZOffset: 0.2,
    handScale: 0.9,
    modelHeight: 1.28,
  },
}

export interface SteamPuffHandle {
  mesh: THREE.Mesh
  baseX: number
  baseY: number
  baseZ: number
  phase: number
}

export interface ButterflyHandle {
  group: THREE.Group
  baseX: number
  baseY: number
  baseZ: number
}

export interface SnowFlakeHandle {
  mesh: THREE.Mesh
  baseX: number
  baseZ: number
  topY: number
  fallRange: number
  speed: number
  driftAmp: number
  phase: number
}

export interface BuiltCompanion {
  group: THREE.Group
  bodyGroup: THREE.Group
  lanternMesh: THREE.Mesh | null
  butterfly: ButterflyHandle | null
  snowFlakes: SnowFlakeHandle[]
  steamPuffs: SteamPuffHandle[]
  antennaeGroup?: THREE.Group | null
  tailGroup?: THREE.Group | null
  armGroups?: { left: THREE.Group; right: THREE.Group } | null
  anchors: DynamicCompanionAnchors
  height: number
}

const tempBoxMin = new THREE.Vector3()
const tempBoxMax = new THREE.Vector3()
const tempObjBox = new THREE.Box3()

function expandBox3FromVoxelBox(target: THREE.Box3, box: ColoredBox): void {
  tempBoxMin.set(box.x - box.sx * 0.5, box.y - box.sy * 0.5, box.z - box.sz * 0.5)
  tempBoxMax.set(box.x + box.sx * 0.5, box.y + box.sy * 0.5, box.z + box.sz * 0.5)
  target.expandByPoint(tempBoxMin)
  target.expandByPoint(tempBoxMax)
}

function computeDynamicCompanionAnchors(
  species: CompanionSpeciesId,
  boxes: readonly ColoredBox[],
  extras: SpeciesBuildExtras,
): { anchors: DynamicCompanionAnchors; torsoFit: TorsoFitSpec } {
  const profile = SPECIES_RIG_PROFILES[species]

  const modelBounds = new THREE.Box3()
  const headSkullBox = new THREE.Box3()
  const eyeBoundsBox = new THREE.Box3()
  const torsoBox = new THREE.Box3()
  let minEyeX = Infinity
  let maxEyeX = -Infinity

  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]
    const bottomY = b.y - b.sy * 0.5
    if (bottomY >= 0.045) {
      expandBox3FromVoxelBox(modelBounds, b)
    }

    // Use structural skull blocks (sx >= 0.30, sz >= 0.26) so protruding eyeballs/ears/tongues never distort crown/width
    const halfSpanOkHead =
      profile.headHalfSpanX === undefined || Math.abs(b.x) <= profile.headHalfSpanX
    if (
      halfSpanOkHead &&
      b.sx >= 0.3 &&
      b.sz >= 0.26 &&
      b.y >= profile.headMinY &&
      b.y <= profile.headMaxY
    ) {
      expandBox3FromVoxelBox(headSkullBox, b)
    }

    // Measure true eye Box3 bounds & span so glasses and visors sit flush over both eyes without floating over noses/snouts
    if (
      (b.color === '#0f172a' || b.color === '#090d16') &&
      b.sx <= 0.15 &&
      b.y >= profile.faceCenterY - 0.15 &&
      b.y <= profile.faceCenterY + 0.15
    ) {
      expandBox3FromVoxelBox(eyeBoundsBox, b)
      if (b.x < minEyeX) minEyeX = b.x
      if (b.x > maxEyeX) maxEyeX = b.x
    }

    const halfSpanOkTorso =
      profile.torsoHalfSpanX === undefined || Math.abs(b.x) <= profile.torsoHalfSpanX
    if (halfSpanOkTorso && b.y >= profile.torsoMinY && b.y <= profile.torsoMaxY) {
      expandBox3FromVoxelBox(torsoBox, b)
    }
  }

  for (const subGroup of [extras.armGroups?.left, extras.armGroups?.right, extras.tailGroup, extras.antennaeGroup]) {
    if (!subGroup) continue
    subGroup.updateMatrixWorld(true)
    tempObjBox.setFromObject(subGroup)
    if (!tempObjBox.isEmpty()) {
      modelBounds.union(tempObjBox)
    }
  }

  const headSize = new THREE.Vector3()
  const headCenter = new THREE.Vector3()
  if (headSkullBox.isEmpty()) {
    headSkullBox.copy(modelBounds)
  }
  headSkullBox.getSize(headSize)
  headSkullBox.getCenter(headCenter)

  const torsoSize = new THREE.Vector3()
  const torsoCenter = new THREE.Vector3()
  if (torsoBox.isEmpty()) {
    torsoBox.copy(modelBounds)
  }
  torsoBox.getSize(torsoSize)
  torsoBox.getCenter(torsoCenter)

  const headWidth = Math.max(0.42, headSize.x)
  const headDepth = Math.max(0.38, headSize.z)
  const headScale = THREE.MathUtils.clamp(headWidth / 0.54, 0.85, 1.24)
  const restY = profile.headwearRestY ?? -Infinity
  const anchorHeadTop: HeadAnchorPoint = {
    x: headCenter.x,
    y: Math.max(headSkullBox.max.y + (profile.crownClearance ?? 0.015), restY),
    z: headCenter.z,
    width: headWidth,
    depth: headDepth,
    scale: headScale,
    skullTopY: Math.max(headSkullBox.max.y, restY),
  }

  const eyeCenterY = eyeBoundsBox.isEmpty()
    ? profile.faceCenterY
    : (eyeBoundsBox.min.y + eyeBoundsBox.max.y) * 0.5
  const eyeFrontZ = eyeBoundsBox.isEmpty() ? headSkullBox.max.z : eyeBoundsBox.max.z
  const computedEyeSpan =
    Number.isFinite(minEyeX) && Number.isFinite(maxEyeX) && maxEyeX - minEyeX >= 0.16
      ? maxEyeX - minEyeX
      : profile.eyeSpan
  const faceScale = THREE.MathUtils.clamp(headWidth / 0.54, 0.85, 1.06)
  const anchorFaceFront: FaceAnchorPoint = {
    x: headCenter.x,
    y: eyeCenterY,
    z: eyeFrontZ + 0.022,
    eyeSpan: computedEyeSpan,
    headHalfW: headWidth * 0.5,
    scale: faceScale,
  }

  const marginXZ = profile.torsoMarginXZ ?? 0.045
  const marginY = profile.torsoMarginY ?? 0.02
  const fittedTorso = {
    x: torsoCenter.x,
    y: torsoCenter.y,
    z: torsoCenter.z,
    sx: torsoSize.x + marginXZ,
    sy: Math.max(0.17, torsoSize.y + marginY),
    sz: torsoSize.z + marginXZ,
  }
  const hoodW = Math.min(headWidth * 0.96, fittedTorso.sx * 0.84)
  const hoodZ =
    fittedTorso.z -
    fittedTorso.sz * 0.5 -
    0.045 +
    (profile.hoodZOffset ?? 0)
  const torsoFit: TorsoFitSpec = {
    body: fittedTorso,
    hood: {
      x: fittedTorso.x,
      y: fittedTorso.y + fittedTorso.sy * (profile.hoodYRatio ?? 0.44),
      z: hoodZ,
      sx: hoodW,
      sy: 0.13,
      sz: 0.14,
    },
    allowSideSleeves: species !== 'clawd_cafe',
  }

  const sideRightEdge = Math.max(modelBounds.max.x, torsoCenter.x + fittedTorso.sx * 0.5)
  const modelSize = new THREE.Vector3()
  modelBounds.getSize(modelSize)
  const anchorSideHand: AnchorPoint = {
    x: sideRightEdge + (profile.handClearanceX ?? 0.15),
    y: modelBounds.min.y + modelSize.y * (profile.handHeightRatio ?? 0.5),
    z: torsoCenter.z + (profile.handZOffset ?? 0.2),
    scale: profile.handScale ?? 0.9,
  }

  return {
    anchors: {
      anchorHeadTop,
      anchorFaceFront,
      anchorTorsoCenter: fittedTorso,
      anchorTorsoWidth: fittedTorso.sx,
      anchorSideHand,
      modelBounds,
    },
    torsoFit,
  }
}

const baseBox = new THREE.BoxGeometry(1, 1, 1)
const basePos = baseBox.getAttribute('position') as THREE.BufferAttribute
const baseNorm = baseBox.getAttribute('normal') as THREE.BufferAttribute
const baseIdx = baseBox.getIndex() as THREE.BufferAttribute

const companionStaticMat = new THREE.MeshToonMaterial({
  vertexColors: true,
  gradientMap: getToonGradientMap(),
})

const companionEmissiveMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
})

const snowGlobeGlassMat = new THREE.MeshToonMaterial({
  color: '#bae6fd',
  emissive: '#38bdf8',
  emissiveIntensity: 0.18,
  gradientMap: getToonGradientMap(),
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
})

const snowGlobeEdgeMat = new THREE.MeshBasicMaterial({
  color: '#e0f2fe',
  transparent: true,
  opacity: 0.48,
  depthWrite: false,
})

const snowGlobeFlakeMat = new THREE.MeshBasicMaterial({
  color: '#ffffff',
})

const codeVisorGlassMat = new THREE.MeshBasicMaterial({
  color: '#06b6d4',
  transparent: true,
  opacity: 0.54,
  depthWrite: false,
})

const steamGeom = new THREE.BoxGeometry(0.11, 0.11, 0.11)

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

interface SpeciesBuildExtras {
  steamAnchors: Array<{ x: number; y: number; z: number }>
  groundedStaticBoxes: ColoredBox[]
  groundedEmissiveBoxes: ColoredBox[]
  antennaeGroup: THREE.Group | null
  tailGroup: THREE.Group | null
  armGroups: { left: THREE.Group; right: THREE.Group } | null
}

function buildSpeciesBoxes(
  species: CompanionSpeciesId,
  boxes: ColoredBox[],
): SpeciesBuildExtras {
  const steamAnchors: Array<{ x: number; y: number; z: number }> = []
  const groundedStaticBoxes: ColoredBox[] = []
  const groundedEmissiveBoxes: ColoredBox[] = []
  let antennaeGroup: THREE.Group | null = null
  let tailGroup: THREE.Group | null = null
  let armGroups: { left: THREE.Group; right: THREE.Group } | null = null

  const extras = (): SpeciesBuildExtras => ({
    steamAnchors,
    groundedStaticBoxes,
    groundedEmissiveBoxes,
    antennaeGroup,
    tailGroup,
    armGroups,
  })
  if (species === 'frog') {
    boxes.push({ x: 0, y: 0.03, z: 0, sx: 0.88, sy: 0.05, sz: 0.88, color: '#9eb3db' })
    boxes.push({ x: -0.28, y: 0.09, z: 0.16, sx: 0.24, sy: 0.14, sz: 0.34, color: '#15803d' })
    boxes.push({ x: 0.28, y: 0.09, z: 0.16, sx: 0.24, sy: 0.14, sz: 0.34, color: '#15803d' })
    boxes.push({ x: 0, y: 0.32, z: 0, sx: 0.68, sy: 0.44, sz: 0.62, color: '#16a34a' })
    boxes.push({ x: 0, y: 0.28, z: 0.26, sx: 0.5, sy: 0.3, sz: 0.16, color: '#bbf7d0' })
    boxes.push({ x: 0, y: 0.56, z: 0.04, sx: 0.64, sy: 0.34, sz: 0.58, color: '#22c55e' })
    boxes.push({ x: -0.21, y: 0.72, z: 0.24, sx: 0.18, sy: 0.18, sz: 0.18, color: '#f8fafc' })
    boxes.push({ x: 0.21, y: 0.72, z: 0.24, sx: 0.18, sy: 0.18, sz: 0.18, color: '#f8fafc' })
    boxes.push({ x: -0.21, y: 0.72, z: 0.33, sx: 0.09, sy: 0.1, sz: 0.06, color: '#0f172a' })
    boxes.push({ x: 0.21, y: 0.72, z: 0.33, sx: 0.09, sy: 0.1, sz: 0.06, color: '#0f172a' })
    boxes.push({ x: -0.25, y: 0.54, z: 0.33, sx: 0.11, sy: 0.08, sz: 0.05, color: '#fb7185' })
    boxes.push({ x: 0.25, y: 0.54, z: 0.33, sx: 0.11, sy: 0.08, sz: 0.05, color: '#fb7185' })
    boxes.push({ x: 0, y: 0.5, z: 0.34, sx: 0.28, sy: 0.05, sz: 0.04, color: '#064e3b' })
    return extras()
  }

  if (species === 'otter') {
    boxes.push({ x: 0, y: 0.03, z: -0.04, sx: 0.82, sy: 0.05, sz: 0.92, color: '#9eb3db' })
    boxes.push({ x: -0.18, y: 0.1, z: 0.16, sx: 0.2, sy: 0.16, sz: 0.28, color: '#5c371d' })
    boxes.push({ x: 0.18, y: 0.1, z: 0.16, sx: 0.2, sy: 0.16, sz: 0.28, color: '#5c371d' })
    boxes.push({ x: 0, y: 0.38, z: 0, sx: 0.56, sy: 0.54, sz: 0.5, color: '#7c4d2b' })
    boxes.push({ x: 0, y: 0.38, z: 0.21, sx: 0.38, sy: 0.42, sz: 0.14, color: '#fef3c7' })
    boxes.push({ x: 0, y: 0.18, z: -0.38, sx: 0.24, sy: 0.2, sz: 0.42, color: '#6b4226' })
    boxes.push({ x: -0.26, y: 0.44, z: 0.18, sx: 0.14, sy: 0.14, sz: 0.18, color: '#5c371d' })
    boxes.push({ x: 0.26, y: 0.44, z: 0.18, sx: 0.14, sy: 0.14, sz: 0.18, color: '#5c371d' })
    boxes.push({ x: 0, y: 0.84, z: 0.04, sx: 0.52, sy: 0.44, sz: 0.48, color: '#8c5835' })
    boxes.push({ x: -0.24, y: 0.98, z: 0.02, sx: 0.14, sy: 0.14, sz: 0.12, color: '#5c371d' })
    boxes.push({ x: 0.24, y: 0.98, z: 0.02, sx: 0.14, sy: 0.14, sz: 0.12, color: '#5c371d' })
    boxes.push({ x: 0, y: 0.78, z: 0.27, sx: 0.34, sy: 0.2, sz: 0.14, color: '#fde68a' })
    boxes.push({ x: 0, y: 0.83, z: 0.35, sx: 0.12, sy: 0.08, sz: 0.06, color: '#1e293b' })
    boxes.push({ x: -0.14, y: 0.88, z: 0.28, sx: 0.08, sy: 0.09, sz: 0.05, color: '#0f172a' })
    boxes.push({ x: 0.14, y: 0.88, z: 0.28, sx: 0.08, sy: 0.09, sz: 0.05, color: '#0f172a' })
    return extras()
  }

  if (species === 'snake') {
    // Cool snow shadow base
    boxes.push({ x: 0, y: 0.03, z: 0, sx: 0.9, sy: 0.05, sz: 0.9, color: '#9eb3db' })
    // Coiled Python-blue body rings + golden-yellow belly & stripes
    boxes.push({ x: 0, y: 0.14, z: 0.02, sx: 0.72, sy: 0.18, sz: 0.68, color: '#2b5b84' })
    boxes.push({ x: 0, y: 0.13, z: 0.34, sx: 0.44, sy: 0.14, sz: 0.08, color: '#ffd43b' })
    boxes.push({ x: -0.02, y: 0.3, z: 0, sx: 0.56, sy: 0.17, sz: 0.52, color: '#3776ab' })
    boxes.push({ x: 0, y: 0.29, z: 0.25, sx: 0.34, sy: 0.14, sz: 0.08, color: '#ffd43b' })
    // Upright curved neck & yellow chest belly
    boxes.push({ x: 0, y: 0.52, z: 0.02, sx: 0.34, sy: 0.32, sz: 0.32, color: '#3776ab' })
    boxes.push({ x: 0, y: 0.5, z: 0.16, sx: 0.24, sy: 0.28, sz: 0.1, color: '#ffd43b' })
    // Raised tail tip curving beside body to hold hand accessories
    boxes.push({ x: 0.35, y: 0.2, z: 0.06, sx: 0.14, sy: 0.16, sz: 0.22, color: '#2b5b84' })
    boxes.push({ x: 0.4, y: 0.34, z: 0.14, sx: 0.12, sy: 0.2, sz: 0.14, color: '#3776ab' })
    boxes.push({ x: 0.42, y: 0.45, z: 0.18, sx: 0.1, sy: 0.12, sz: 0.1, color: '#ffd43b' })
    // Friendly mascot Python head, golden chin, cute eyes, rosy cheeks & tiny forked tongue
    boxes.push({ x: 0, y: 0.78, z: 0.08, sx: 0.48, sy: 0.34, sz: 0.46, color: '#3776ab' })
    boxes.push({ x: 0, y: 0.94, z: 0.06, sx: 0.34, sy: 0.04, sz: 0.32, color: '#2b5b84' })
    boxes.push({ x: 0, y: 0.74, z: 0.28, sx: 0.38, sy: 0.22, sz: 0.18, color: '#3776ab' })
    boxes.push({ x: 0, y: 0.65, z: 0.24, sx: 0.32, sy: 0.08, sz: 0.22, color: '#ffd43b' })
    boxes.push({ x: -0.19, y: 0.73, z: 0.33, sx: 0.09, sy: 0.07, sz: 0.05, color: '#fb7185' })
    boxes.push({ x: 0.19, y: 0.73, z: 0.33, sx: 0.09, sy: 0.07, sz: 0.05, color: '#fb7185' })
    boxes.push({ x: -0.14, y: 0.81, z: 0.34, sx: 0.09, sy: 0.1, sz: 0.05, color: '#0f172a' })
    boxes.push({ x: 0.14, y: 0.81, z: 0.34, sx: 0.09, sy: 0.1, sz: 0.05, color: '#0f172a' })
    boxes.push({ x: -0.125, y: 0.835, z: 0.368, sx: 0.035, sy: 0.035, sz: 0.02, color: '#f8fafc' })
    boxes.push({ x: 0.155, y: 0.835, z: 0.368, sx: 0.035, sy: 0.035, sz: 0.02, color: '#f8fafc' })
    boxes.push({ x: 0, y: 0.68, z: 0.39, sx: 0.05, sy: 0.03, sz: 0.1, color: '#f43f5e' })
    boxes.push({ x: -0.035, y: 0.67, z: 0.44, sx: 0.035, sy: 0.028, sz: 0.05, color: '#fb7185' })
    boxes.push({ x: 0.035, y: 0.67, z: 0.44, sx: 0.035, sy: 0.028, sz: 0.05, color: '#fb7185' })
    return extras()
  }

  if (species === 'capybara') {
    boxes.push({ x: 0, y: 0.03, z: 0.04, sx: 0.9, sy: 0.05, sz: 1.05, color: '#9eb3db' })
    boxes.push({ x: -0.22, y: 0.12, z: 0.26, sx: 0.18, sy: 0.2, sz: 0.18, color: '#5c371d' })
    boxes.push({ x: 0.22, y: 0.12, z: 0.26, sx: 0.18, sy: 0.2, sz: 0.18, color: '#5c371d' })
    boxes.push({ x: -0.22, y: 0.12, z: -0.24, sx: 0.18, sy: 0.2, sz: 0.18, color: '#5c371d' })
    boxes.push({ x: 0.22, y: 0.12, z: -0.24, sx: 0.18, sy: 0.2, sz: 0.18, color: '#5c371d' })
    boxes.push({ x: 0, y: 0.42, z: 0, sx: 0.68, sy: 0.48, sz: 0.8, color: '#8c5835' })
    boxes.push({ x: 0, y: 0.74, z: 0.24, sx: 0.56, sy: 0.4, sz: 0.56, color: '#9c6644' })
    boxes.push({ x: 0, y: 0.7, z: 0.46, sx: 0.44, sy: 0.28, sz: 0.2, color: '#7c4d2b' })
    boxes.push({ x: 0, y: 0.76, z: 0.56, sx: 0.18, sy: 0.1, sz: 0.06, color: '#3b2110' })
    boxes.push({ x: -0.22, y: 0.94, z: 0.06, sx: 0.14, sy: 0.14, sz: 0.12, color: '#5c371d' })
    boxes.push({ x: 0.22, y: 0.94, z: 0.06, sx: 0.14, sy: 0.14, sz: 0.12, color: '#5c371d' })
    boxes.push({ x: -0.16, y: 0.78, z: 0.51, sx: 0.11, sy: 0.05, sz: 0.05, color: '#0f172a' })
    boxes.push({ x: 0.16, y: 0.78, z: 0.51, sx: 0.11, sy: 0.05, sz: 0.05, color: '#0f172a' })
    return extras()
  }

  if (species === 'mouse') {
    boxes.push({ x: 0, y: 0.03, z: -0.02, sx: 0.78, sy: 0.05, sz: 0.88, color: '#9eb3db' })
    boxes.push({ x: -0.16, y: 0.09, z: 0.14, sx: 0.16, sy: 0.12, sz: 0.22, color: '#0f766e' })
    boxes.push({ x: 0.16, y: 0.09, z: 0.14, sx: 0.16, sy: 0.12, sz: 0.22, color: '#0f766e' })
    boxes.push({ x: 0, y: 0.34, z: 0, sx: 0.52, sy: 0.44, sz: 0.46, color: '#0d9488' })
    boxes.push({ x: 0, y: 0.32, z: 0.19, sx: 0.34, sy: 0.32, sz: 0.12, color: '#99f6e4' })
    boxes.push({ x: 0, y: 0.16, z: -0.34, sx: 0.1, sy: 0.1, sz: 0.34, color: '#f9a8d4' })
    boxes.push({ x: 0.1, y: 0.24, z: -0.48, sx: 0.1, sy: 0.14, sz: 0.12, color: '#f9a8d4' })
    boxes.push({ x: 0, y: 0.7, z: 0.06, sx: 0.46, sy: 0.38, sz: 0.44, color: '#14b8a6' })
    boxes.push({ x: 0, y: 0.65, z: 0.29, sx: 0.26, sy: 0.2, sz: 0.16, color: '#5eead4' })
    boxes.push({ x: 0, y: 0.68, z: 0.38, sx: 0.1, sy: 0.08, sz: 0.06, color: '#fb7185' })
    boxes.push({ x: -0.26, y: 0.92, z: 0.02, sx: 0.28, sy: 0.28, sz: 0.1, color: '#0f766e' })
    boxes.push({ x: 0.26, y: 0.92, z: 0.02, sx: 0.28, sy: 0.28, sz: 0.1, color: '#0f766e' })
    boxes.push({ x: -0.26, y: 0.92, z: 0.07, sx: 0.16, sy: 0.16, sz: 0.04, color: '#fda4af' })
    boxes.push({ x: 0.26, y: 0.92, z: 0.07, sx: 0.16, sy: 0.16, sz: 0.04, color: '#fda4af' })
    boxes.push({ x: -0.13, y: 0.74, z: 0.28, sx: 0.08, sy: 0.09, sz: 0.05, color: '#0f172a' })
    boxes.push({ x: 0.13, y: 0.74, z: 0.28, sx: 0.08, sy: 0.09, sz: 0.05, color: '#0f172a' })
    return extras()
  }

  if (species === 'clawd_cafe') {
    // Original Claude / Clawd mascot: classic coral-orange pixel-art rectangular block with
    // two square black eyes, short side arms, and four stubby legs along the bottom.
    groundedStaticBoxes.push({ x: 0, y: 0.03, z: 0.02, sx: 0.98, sy: 0.05, sz: 0.72, color: '#9eb3db' })

    // 4 short stubby bottom legs cleanly visible under the rectangular coral block
    boxes.push({ x: -0.31, y: 0.1, z: 0.02, sx: 0.12, sy: 0.18, sz: 0.22, color: '#cc6144' })
    boxes.push({ x: -0.11, y: 0.1, z: 0.02, sx: 0.12, sy: 0.18, sz: 0.22, color: '#c4583b' })
    boxes.push({ x: 0.11, y: 0.1, z: 0.02, sx: 0.12, sy: 0.18, sz: 0.22, color: '#c4583b' })
    boxes.push({ x: 0.31, y: 0.1, z: 0.02, sx: 0.12, sy: 0.18, sz: 0.22, color: '#cc6144' })

    // Iconic horizontal rectangular coral-orange body block (single classic silhouette, flat top, no hat)
    boxes.push({ x: 0, y: 0.45, z: 0, sx: 0.86, sy: 0.54, sz: 0.42, color: '#de7356' })
    boxes.push({ x: 0, y: 0.725, z: 0, sx: 0.82, sy: 0.03, sz: 0.38, color: '#eb866a' })
    boxes.push({ x: 0, y: 0.21, z: 0, sx: 0.84, sy: 0.06, sz: 0.4, color: '#c96245' })

    // Two solid black square pixel eyes on upper-center front face
    boxes.push({ x: -0.21, y: 0.5, z: 0.22, sx: 0.12, sy: 0.14, sz: 0.045, color: '#090d16' })
    boxes.push({ x: 0.21, y: 0.5, z: 0.22, sx: 0.12, sy: 0.14, sz: 0.045, color: '#090d16' })

    // Two short side arms sticking out from left & right sides (animated cheerfully)
    const leftArmGroup = new THREE.Group()
    leftArmGroup.position.set(-0.44, 0.44, 0)
    leftArmGroup.add(
      mergeColoredBoxes(
        [{ x: -0.06, y: 0, z: 0, sx: 0.14, sy: 0.16, sz: 0.22, color: '#de7356' }],
        companionStaticMat,
      ),
    )
    const rightArmGroup = new THREE.Group()
    rightArmGroup.position.set(0.44, 0.44, 0)
    rightArmGroup.add(
      mergeColoredBoxes(
        [{ x: 0.06, y: 0, z: 0, sx: 0.14, sy: 0.16, sz: 0.22, color: '#de7356' }],
        companionStaticMat,
      ),
    )
    armGroups = { left: leftArmGroup, right: rightArmGroup }
    return extras()
  }

  if (species === 'leaf_kitty') {
    // Gato Alien: green alien kitty companion with animated antennae, wagging tail, pointed ears, whiskers & freckles
    groundedStaticBoxes.push({ x: 0, y: 0.03, z: -0.02, sx: 0.8, sy: 0.05, sz: 0.9, color: '#9eb3db' })
    // Seated dark-green paws
    boxes.push({ x: -0.15, y: 0.1, z: 0.18, sx: 0.14, sy: 0.16, sz: 0.2, color: '#15803d' })
    boxes.push({ x: 0.15, y: 0.1, z: 0.18, sx: 0.14, sy: 0.16, sz: 0.2, color: '#15803d' })
    // Vibrant green body + soft mint belly + animated tail
    boxes.push({ x: 0, y: 0.34, z: 0, sx: 0.5, sy: 0.48, sz: 0.44, color: '#22c55e' })
    boxes.push({ x: 0, y: 0.35, z: 0.19, sx: 0.3, sy: 0.34, sz: 0.1, color: '#bbf7d0' })
    boxes.push({ x: -0.15, y: 0.34, z: -0.02, sx: 0.18, sy: 0.12, sz: 0.34, color: '#16a34a' })
    boxes.push({ x: 0.15, y: 0.38, z: -0.02, sx: 0.18, sy: 0.12, sz: 0.34, color: '#4ade80' })
    const alienTailGroup = new THREE.Group()
    alienTailGroup.position.set(0, 0.22, -0.22)
    alienTailGroup.add(
      mergeColoredBoxes(
        [
          { x: 0, y: 0, z: -0.08, sx: 0.12, sy: 0.12, sz: 0.22, color: '#16a34a' },
          { x: 0.04, y: 0.24, z: -0.14, sx: 0.12, sy: 0.42, sz: 0.12, color: '#22c55e' },
          { x: 0.08, y: 0.48, z: -0.1, sx: 0.11, sy: 0.11, sz: 0.12, color: '#4ade80' },
        ],
        companionStaticMat,
      ),
    )
    tailGroup = alienTailGroup

    // Green alien feline head & soft muzzle
    boxes.push({ x: 0, y: 0.76, z: 0.06, sx: 0.48, sy: 0.4, sz: 0.44, color: '#22c55e' })
    boxes.push({ x: 0, y: 0.67, z: 0.25, sx: 0.28, sy: 0.15, sz: 0.1, color: '#dcfce7' })
    // Pointed cat ears with pastel pink interior
    boxes.push({ x: -0.19, y: 1.01, z: 0.06, sx: 0.13, sy: 0.17, sz: 0.1, color: '#16a34a' })
    boxes.push({ x: 0.19, y: 1.01, z: 0.06, sx: 0.13, sy: 0.17, sz: 0.1, color: '#16a34a' })
    boxes.push({ x: -0.19, y: 0.99, z: 0.1, sx: 0.07, sy: 0.1, sz: 0.04, color: '#fda4af' })
    boxes.push({ x: 0.19, y: 0.99, z: 0.1, sx: 0.07, sy: 0.1, sz: 0.04, color: '#fda4af' })
    // Animated twin green antennae atop head crowned with glowing yellow tips
    const kittyAntennaeGroup = new THREE.Group()
    kittyAntennaeGroup.position.set(0, 0.95, 0.07)
    kittyAntennaeGroup.add(
      mergeColoredBoxes(
        [
          { x: -0.09, y: 0.11, z: 0, sx: 0.045, sy: 0.2, sz: 0.045, color: '#15803d' },
          { x: 0.09, y: 0.11, z: 0, sx: 0.045, sy: 0.2, sz: 0.045, color: '#15803d' },
        ],
        companionStaticMat,
      ),
    )
    kittyAntennaeGroup.add(
      mergeColoredBoxes(
        [
          { x: -0.1, y: 0.23, z: 0.01, sx: 0.095, sy: 0.095, sz: 0.095, color: '#fef08a' },
          { x: 0.1, y: 0.23, z: 0.01, sx: 0.095, sy: 0.095, sz: 0.095, color: '#fef08a' },
        ],
        companionEmissiveMat,
      ),
    )
    antennaeGroup = kittyAntennaeGroup

    // Expressive eyes + catchlights + pink nose + freckles + white whiskers
    boxes.push({ x: -0.13, y: 0.79, z: 0.29, sx: 0.095, sy: 0.11, sz: 0.05, color: '#0f172a' })
    boxes.push({ x: 0.13, y: 0.79, z: 0.29, sx: 0.095, sy: 0.11, sz: 0.05, color: '#0f172a' })
    boxes.push({ x: -0.115, y: 0.815, z: 0.315, sx: 0.036, sy: 0.042, sz: 0.02, color: '#ffffff' })
    boxes.push({ x: 0.145, y: 0.815, z: 0.315, sx: 0.036, sy: 0.042, sz: 0.02, color: '#ffffff' })
    boxes.push({ x: 0, y: 0.7, z: 0.3, sx: 0.08, sy: 0.055, sz: 0.045, color: '#fb7185' })
    boxes.push({ x: -0.2, y: 0.71, z: 0.295, sx: 0.032, sy: 0.032, sz: 0.025, color: '#fde68a' })
    boxes.push({ x: -0.16, y: 0.68, z: 0.295, sx: 0.032, sy: 0.032, sz: 0.025, color: '#fde68a' })
    boxes.push({ x: 0.2, y: 0.71, z: 0.295, sx: 0.032, sy: 0.032, sz: 0.025, color: '#fde68a' })
    boxes.push({ x: 0.16, y: 0.68, z: 0.295, sx: 0.032, sy: 0.032, sz: 0.025, color: '#fde68a' })
    boxes.push({ x: -0.23, y: 0.69, z: 0.3, sx: 0.17, sy: 0.024, sz: 0.024, color: '#f8fafc' })
    boxes.push({ x: 0.23, y: 0.69, z: 0.3, sx: 0.17, sy: 0.024, sz: 0.024, color: '#f8fafc' })
    boxes.push({ x: -0.22, y: 0.64, z: 0.3, sx: 0.15, sy: 0.024, sz: 0.024, color: '#dcfce7' })
    boxes.push({ x: 0.22, y: 0.64, z: 0.3, sx: 0.15, sy: 0.024, sz: 0.024, color: '#dcfce7' })
    return extras()
  }

  // 'cat' (Maria): Multi-tone mottled grey tabby (silver, dove grey, pewter & charcoal stripes) with white whiskers
  boxes.push({ x: 0, y: 0.03, z: -0.02, sx: 0.8, sy: 0.05, sz: 0.9, color: '#9eb3db' })
  // Silver & dove-grey paws with subtle slate toe tips
  boxes.push({ x: -0.15, y: 0.1, z: 0.18, sx: 0.14, sy: 0.16, sz: 0.2, color: '#cbd5e1' })
  boxes.push({ x: 0.15, y: 0.1, z: 0.18, sx: 0.14, sy: 0.16, sz: 0.2, color: '#94a3b8' })
  boxes.push({ x: -0.15, y: 0.08, z: 0.27, sx: 0.12, sy: 0.06, sz: 0.05, color: '#64748b' })
  boxes.push({ x: 0.15, y: 0.08, z: 0.27, sx: 0.12, sy: 0.06, sz: 0.05, color: '#475569' })
  // Slender sitting body: layered pewter, ash-grey, dove-grey & charcoal tabby markings
  boxes.push({ x: 0, y: 0.34, z: 0, sx: 0.5, sy: 0.48, sz: 0.44, color: '#64748b' })
  boxes.push({ x: 0, y: 0.35, z: 0.19, sx: 0.28, sy: 0.34, sz: 0.1, color: '#e2e8f0' })
  boxes.push({ x: 0, y: 0.46, z: 0.195, sx: 0.2, sy: 0.08, sz: 0.1, color: '#cbd5e1' })
  boxes.push({ x: -0.16, y: 0.42, z: -0.04, sx: 0.2, sy: 0.11, sz: 0.36, color: '#334155' })
  boxes.push({ x: 0.16, y: 0.31, z: -0.04, sx: 0.2, sy: 0.12, sz: 0.36, color: '#475569' })
  boxes.push({ x: -0.15, y: 0.26, z: 0.06, sx: 0.18, sy: 0.16, sz: 0.24, color: '#94a3b8' })
  boxes.push({ x: 0.14, y: 0.44, z: 0.04, sx: 0.18, sy: 0.14, sz: 0.22, color: '#9ca3af' })
  boxes.push({ x: 0, y: 0.48, z: -0.16, sx: 0.34, sy: 0.12, sz: 0.12, color: '#334155' })
  // Long ringed grey-and-charcoal tail curling UP behind the body
  boxes.push({ x: 0, y: 0.2, z: -0.28, sx: 0.12, sy: 0.12, sz: 0.24, color: '#475569' })
  boxes.push({ x: 0.04, y: 0.44, z: -0.36, sx: 0.12, sy: 0.42, sz: 0.12, color: '#94a3b8' })
  boxes.push({ x: 0.05, y: 0.44, z: -0.36, sx: 0.13, sy: 0.1, sz: 0.13, color: '#334155' })
  boxes.push({ x: 0.06, y: 0.58, z: -0.35, sx: 0.13, sy: 0.09, sz: 0.13, color: '#64748b' })
  boxes.push({ x: 0.08, y: 0.7, z: -0.34, sx: 0.12, sy: 0.16, sz: 0.12, color: '#334155' })
  boxes.push({ x: 0.12, y: 0.82, z: -0.28, sx: 0.11, sy: 0.11, sz: 0.12, color: '#cbd5e1' })
  // Head with layered cool greys, silver muzzle & charcoal tabby forehead stripes
  boxes.push({ x: 0, y: 0.76, z: 0.06, sx: 0.48, sy: 0.4, sz: 0.44, color: '#717d8e' })
  boxes.push({ x: 0, y: 0.9, z: 0.25, sx: 0.07, sy: 0.12, sz: 0.06, color: '#1e293b' })
  boxes.push({ x: -0.1, y: 0.92, z: 0.25, sx: 0.06, sy: 0.1, sz: 0.06, color: '#334155' })
  boxes.push({ x: 0.1, y: 0.92, z: 0.25, sx: 0.06, sy: 0.1, sz: 0.06, color: '#334155' })
  boxes.push({ x: -0.17, y: 0.74, z: 0.1, sx: 0.16, sy: 0.16, sz: 0.26, color: '#94a3b8' })
  boxes.push({ x: 0.16, y: 0.75, z: 0.12, sx: 0.18, sy: 0.17, sz: 0.24, color: '#9ca3af' })
  boxes.push({ x: 0, y: 0.67, z: 0.25, sx: 0.28, sy: 0.16, sz: 0.1, color: '#e2e8f0' })
  // Pointed multi-grey ears with charcoal tips & soft pink interior
  boxes.push({ x: -0.18, y: 1.02, z: 0.06, sx: 0.14, sy: 0.18, sz: 0.1, color: '#475569' })
  boxes.push({ x: 0.18, y: 1.02, z: 0.06, sx: 0.14, sy: 0.18, sz: 0.1, color: '#64748b' })
  boxes.push({ x: -0.18, y: 1.09, z: 0.06, sx: 0.1, sy: 0.05, sz: 0.08, color: '#334155' })
  boxes.push({ x: 0.18, y: 1.09, z: 0.06, sx: 0.1, sy: 0.05, sz: 0.08, color: '#334155' })
  boxes.push({ x: -0.18, y: 1.0, z: 0.1, sx: 0.07, sy: 0.1, sz: 0.04, color: '#fda4af' })
  boxes.push({ x: 0.18, y: 1.0, z: 0.1, sx: 0.07, sy: 0.1, sz: 0.04, color: '#fda4af' })
  // Dark expressive eyes with golden-amber glint, small pink nose & subtle white whiskers
  boxes.push({ x: -0.13, y: 0.79, z: 0.29, sx: 0.1, sy: 0.1, sz: 0.05, color: '#0f172a' })
  boxes.push({ x: 0.13, y: 0.79, z: 0.29, sx: 0.1, sy: 0.1, sz: 0.05, color: '#0f172a' })
  boxes.push({ x: -0.11, y: 0.81, z: 0.315, sx: 0.04, sy: 0.05, sz: 0.02, color: '#fbbf24' })
  boxes.push({ x: 0.15, y: 0.81, z: 0.315, sx: 0.04, sy: 0.05, sz: 0.02, color: '#fbbf24' })
  boxes.push({ x: 0, y: 0.7, z: 0.3, sx: 0.09, sy: 0.06, sz: 0.05, color: '#fb7185' })
  boxes.push({ x: -0.22, y: 0.69, z: 0.3, sx: 0.18, sy: 0.025, sz: 0.025, color: '#f8fafc' })
  boxes.push({ x: 0.22, y: 0.69, z: 0.3, sx: 0.18, sy: 0.025, sz: 0.025, color: '#f8fafc' })
  boxes.push({ x: -0.21, y: 0.64, z: 0.3, sx: 0.16, sy: 0.025, sz: 0.025, color: '#e2e8f0' })
  boxes.push({ x: 0.21, y: 0.64, z: 0.3, sx: 0.16, sy: 0.025, sz: 0.025, color: '#e2e8f0' })
  return extras()
}

interface HeadAccessoryResult {
  butterfly: ButterflyHandle | null
  snowDomeGroup: THREE.Group | null
  snowFlakes: SnowFlakeHandle[]
}

function addGlassBox(
  target: THREE.Group,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  material: THREE.Material,
): void {
  const mesh = new THREE.Mesh(baseBox, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  target.add(mesh)
}

function buildHeadAccessory(
  id: HeadAccessoryId,
  anchor: HeadAnchorPoint,
  faceAnchor: FaceAnchorPoint,
  boxes: ColoredBox[],
  staticEmissiveBoxes: ColoredBox[],
): HeadAccessoryResult {
  const { x, y, z, width, depth, scale } = anchor
  const emptyResult: HeadAccessoryResult = { butterfly: null, snowDomeGroup: null, snowFlakes: [] }

  if (id === 'dev_headset') {
    // Over-ear band dynamically scaled to actual head Box3 width & cheek height
    const earHalfW = Math.max(width * 0.5, faceAnchor.headHalfW) + 0.048
    const bandWidth = earHalfW * 2 + 0.05
    // Band hugs the crown anchor (face-height term made it float ~0.14 above Bento's top-mounted eyes)
    const bandTopY = y + 0.045
    const cupY = Math.max(faceAnchor.y + 0.01, bandTopY - 0.21 * scale)
    const cupZ = z + Math.min(0.06, depth * 0.14)
    const strutHeight = Math.max(0.14, bandTopY - cupY + 0.02)
    const strutY = (bandTopY + cupY) * 0.5

    // Top padded headband arch clear above skull crown & ears
    boxes.push({ x, y: bandTopY, z, sx: bandWidth, sy: 0.058 * scale, sz: 0.11 * scale, color: '#1e293b' })
    boxes.push({ x, y: bandTopY + 0.024 * scale, z, sx: bandWidth * 0.55, sy: 0.036 * scale, sz: 0.09 * scale, color: '#334155' })
    // Side vertical arch struts connecting down to earcups
    boxes.push({ x: x - earHalfW, y: strutY, z: cupZ, sx: 0.052 * scale, sy: strutHeight, sz: 0.075 * scale, color: '#1e293b' })
    boxes.push({ x: x + earHalfW, y: strutY, z: cupZ, sx: 0.052 * scale, sy: strutHeight, sz: 0.075 * scale, color: '#1e293b' })
    // Left & right over-ear cushions + outer shells outside the head walls
    boxes.push({ x: x - earHalfW, y: cupY, z: cupZ, sx: 0.09 * scale, sy: 0.18 * scale, sz: 0.18 * scale, color: '#0f172a' })
    boxes.push({ x: x + earHalfW, y: cupY, z: cupZ, sx: 0.09 * scale, sy: 0.18 * scale, sz: 0.18 * scale, color: '#0f172a' })
    boxes.push({ x: x - (earHalfW + 0.024 * scale), y: cupY, z: cupZ, sx: 0.05 * scale, sy: 0.135 * scale, sz: 0.135 * scale, color: '#1e293b' })
    boxes.push({ x: x + (earHalfW + 0.024 * scale), y: cupY, z: cupZ, sx: 0.05 * scale, sy: 0.135 * scale, sz: 0.135 * scale, color: '#1e293b' })
    // Glowing neon RGB LED rings (cyan left, neon-green right)
    staticEmissiveBoxes.push({
      x: x - (earHalfW + 0.048 * scale),
      y: cupY,
      z: cupZ,
      sx: 0.024 * scale,
      sy: 0.09 * scale,
      sz: 0.09 * scale,
      color: '#38bdf8',
    })
    staticEmissiveBoxes.push({
      x: x + (earHalfW + 0.048 * scale),
      y: cupY,
      z: cupZ,
      sx: 0.024 * scale,
      sy: 0.09 * scale,
      sz: 0.09 * scale,
      color: '#39d353',
    })
    // Adjustable boom mic arm extending cleanly toward mouth/front Z
    const micExtendZ = Math.max(0.16 * scale, faceAnchor.z - cupZ - 0.02)
    boxes.push({
      x: x + earHalfW,
      y: cupY - 0.045 * scale,
      z: cupZ + micExtendZ * 0.5,
      sx: 0.028 * scale,
      sy: 0.028 * scale,
      sz: micExtendZ,
      color: '#334155',
    })
    boxes.push({
      x: x + earHalfW - 0.065 * scale,
      y: cupY - 0.055 * scale,
      z: cupZ + micExtendZ,
      sx: 0.13 * scale,
      sy: 0.028 * scale,
      sz: 0.028 * scale,
      color: '#1e293b',
    })
    staticEmissiveBoxes.push({
      x: x + earHalfW - 0.13 * scale,
      y: cupY - 0.055 * scale,
      z: cupZ + micExtendZ,
      sx: 0.04 * scale,
      sy: 0.04 * scale,
      sz: 0.04 * scale,
      color: '#38bdf8',
    })
    return emptyResult
  }

  if (id === 'reindeer_antlers') {
    const bandHalfW = Math.max(width * 0.48, faceAnchor.headHalfW) + 0.025
    const baseY = y + 0.025 * scale
    // Festive headband & holly clasp
    boxes.push({ x, y: baseY + 0.02 * scale, z, sx: bandHalfW * 2, sy: 0.055 * scale, sz: 0.1 * scale, color: '#991b1b' })
    boxes.push({ x: x - bandHalfW, y: baseY - 0.04 * scale, z, sx: 0.045 * scale, sy: 0.11 * scale, sz: 0.085 * scale, color: '#991b1b' })
    boxes.push({ x: x + bandHalfW, y: baseY - 0.04 * scale, z, sx: 0.045 * scale, sy: 0.11 * scale, sz: 0.085 * scale, color: '#991b1b' })
    boxes.push({ x, y: baseY + 0.04 * scale, z: z + 0.055 * scale, sx: 0.1 * scale, sy: 0.06 * scale, sz: 0.04 * scale, color: '#16a34a' })
    boxes.push({ x, y: baseY + 0.04 * scale, z: z + 0.078 * scale, sx: 0.05 * scale, sy: 0.05 * scale, sz: 0.03 * scale, color: '#ef4444' })
    // Left & right chocolate voxel antlers with outward branches & gold jingle bells
    for (const side of [-1, 1] as const) {
      const rootX = x + side * Math.max(0.13 * scale, bandHalfW * 0.42)
      boxes.push({ x: rootX, y: baseY + 0.12 * scale, z, sx: 0.065 * scale, sy: 0.17 * scale, sz: 0.065 * scale, color: '#78350f' })
      boxes.push({ x: rootX + side * 0.06 * scale, y: baseY + 0.24 * scale, z, sx: 0.06 * scale, sy: 0.14 * scale, sz: 0.06 * scale, color: '#92400e' })
      boxes.push({ x: rootX - side * 0.04 * scale, y: baseY + 0.2 * scale, z: z + 0.04 * scale, sx: 0.05 * scale, sy: 0.1 * scale, sz: 0.05 * scale, color: '#92400e' })
      boxes.push({ x: rootX + side * 0.11 * scale, y: baseY + 0.16 * scale, z, sx: 0.08 * scale, sy: 0.05 * scale, sz: 0.05 * scale, color: '#78350f' })
      staticEmissiveBoxes.push({ x: rootX, y: baseY + 0.055 * scale, z: z + 0.05 * scale, sx: 0.055 * scale, sy: 0.055 * scale, sz: 0.055 * scale, color: '#fbbf24' })
    }
    return emptyResult
  }

  if (id === 'halo_crown') {
    const crownW = Math.max(width * 0.72, 0.48 * scale)
    const crownD = Math.min(depth * 0.88, 0.48 * scale)
    const baseY = y + 0.045 * scale
    // Golden band + crimson velvet cap + 6 crown points + pixel gems
    boxes.push({ x, y: baseY, z, sx: crownW, sy: 0.095 * scale, sz: crownD, color: '#eab308' })
    boxes.push({ x, y: baseY + 0.03 * scale, z, sx: crownW * 0.78, sy: 0.075 * scale, sz: crownD * 0.78, color: '#991b1b' })
    const pointOffsets = [-0.38, 0, 0.38]
    for (const px of pointOffsets) {
      boxes.push({ x: x + px * crownW, y: baseY + 0.09 * scale, z: z + crownD * 0.4, sx: 0.09 * scale, sy: 0.095 * scale, sz: 0.07 * scale, color: '#facc15' })
      boxes.push({ x: x + px * crownW, y: baseY + 0.09 * scale, z: z - crownD * 0.4, sx: 0.09 * scale, sy: 0.095 * scale, sz: 0.07 * scale, color: '#facc15' })
    }
    staticEmissiveBoxes.push({ x, y: baseY + 0.005 * scale, z: z + crownD * 0.5 + 0.014, sx: 0.075 * scale, sy: 0.065 * scale, sz: 0.03, color: '#ef4444' })
    staticEmissiveBoxes.push({ x: x - crownW * 0.3, y: baseY + 0.005 * scale, z: z + crownD * 0.5 + 0.014, sx: 0.06 * scale, sy: 0.055 * scale, sz: 0.03, color: '#38bdf8' })
    staticEmissiveBoxes.push({ x: x + crownW * 0.3, y: baseY + 0.005 * scale, z: z + crownD * 0.5 + 0.014, sx: 0.06 * scale, sy: 0.055 * scale, sz: 0.03, color: '#22c55e' })
    return emptyResult
  }

  if (id === 'astronaut_helmet') {
    // Shell is sized from the measured skull Box3 and its underside rests on `skullTopY`
    // (sinking ~1cm so it never floats). The old face-height term lifted it ~0.15 above Bento's head.
    const shellH = 0.12 * scale
    const shellThickness = 0.09 * scale
    const earHalfW = Math.max(width * 0.5, faceAnchor.headHalfW) + shellThickness * 0.5 + 0.008
    const helmetW = earHalfW * 2 + 0.04
    const helmetD = depth * 0.92 + 0.08 * scale
    const shellZ = z - 0.02 * scale
    const shellFrontZ = shellZ + helmetD * 0.5
    const shellBottomY = anchor.skullTopY - 0.012
    const domeY = shellBottomY + shellH * 0.5
    // Side cheek guards run from the dome top down along the skull walls (capped so they clear Claude's arms)
    const sideTopY = domeY + shellH * 0.5
    const sideH = shellH + Math.min(0.2 * scale, 0.2)
    const sideCenterY = sideTopY - sideH * 0.5
    const sideBottomY = sideTopY - sideH

    // White EVA outer shell + upper crest + side cheek guards
    boxes.push({ x, y: domeY, z: shellZ, sx: helmetW, sy: shellH, sz: helmetD, color: '#f8fafc' })
    boxes.push({ x, y: domeY + 0.09 * scale, z: shellZ - 0.01 * scale, sx: helmetW * 0.78, sy: 0.07 * scale, sz: helmetD * 0.78, color: '#e2e8f0' })
    boxes.push({ x: x - earHalfW, y: sideCenterY, z: shellZ - 0.01 * scale, sx: shellThickness, sy: sideH, sz: helmetD * 0.78, color: '#f1f5f9' })
    boxes.push({ x: x + earHalfW, y: sideCenterY, z: shellZ - 0.01 * scale, sx: shellThickness, sy: sideH, sz: helmetD * 0.78, color: '#f1f5f9' })
    // Cyan side thrusters/comms near the lower edge of the cheek guards
    staticEmissiveBoxes.push({ x: x - (earHalfW + 0.048 * scale), y: sideBottomY + 0.07 * scale, z: shellZ, sx: 0.03 * scale, sy: 0.1 * scale, sz: 0.1 * scale, color: '#38bdf8' })
    staticEmissiveBoxes.push({ x: x + (earHalfW + 0.048 * scale), y: sideBottomY + 0.07 * scale, z: shellZ, sx: 0.03 * scale, sy: 0.1 * scale, sz: 0.1 * scale, color: '#38bdf8' })
    // Side comms antenna + cyan beacon tip
    boxes.push({ x: x - (earHalfW + 0.03 * scale), y: domeY + 0.11 * scale, z: shellZ - 0.01 * scale, sx: 0.032 * scale, sy: 0.2 * scale, sz: 0.032 * scale, color: '#94a3b8' })
    staticEmissiveBoxes.push({ x: x - (earHalfW + 0.03 * scale), y: domeY + 0.22 * scale, z: shellZ - 0.01 * scale, sx: 0.05 * scale, sy: 0.05 * scale, sz: 0.05 * scale, color: '#38bdf8' })
    // Glowing brow rim along the shell's lower front edge (sits just above the eyes)
    staticEmissiveBoxes.push({ x, y: shellBottomY + 0.016 * scale, z: shellFrontZ + 0.008, sx: helmetW * 0.62, sy: 0.032 * scale, sz: 0.025, color: '#38bdf8' })
    // Translucent cyan shield mounted on the shell front, never over the face/eyes
    const helmetVisorGroup = new THREE.Group()
    addGlassBox(
      helmetVisorGroup,
      x,
      domeY + 0.012 * scale,
      shellFrontZ + 0.022,
      helmetW * 0.66,
      0.07 * scale,
      0.04,
      codeVisorGlassMat,
    )
    return { butterfly: null, snowDomeGroup: helmetVisorGroup, snowFlakes: [] }
  }

  if (id === 'rubber_duck') {
    // Classic bright yellow rubber debugging duck sitting atop the companion's head
    const baseY = y + 0.02 * scale
    // Subtle dark base pad / plump yellow body
    boxes.push({ x, y: baseY + 0.08 * scale, z, sx: 0.3 * scale, sy: 0.16 * scale, sz: 0.34 * scale, color: '#facc15' })
    boxes.push({ x: x - 0.15 * scale, y: baseY + 0.09 * scale, z: z + 0.01 * scale, sx: 0.05 * scale, sy: 0.1 * scale, sz: 0.2 * scale, color: '#eab308' })
    boxes.push({ x: x + 0.15 * scale, y: baseY + 0.09 * scale, z: z + 0.01 * scale, sx: 0.05 * scale, sy: 0.1 * scale, sz: 0.2 * scale, color: '#eab308' })
    // Upturned rubber duck tail at back
    boxes.push({ x, y: baseY + 0.16 * scale, z: z - 0.16 * scale, sx: 0.14 * scale, sy: 0.1 * scale, sz: 0.09 * scale, color: '#fde047' })
    // Plump round duck head + orange bill + cute black eyes
    boxes.push({ x, y: baseY + 0.23 * scale, z: z + 0.06 * scale, sx: 0.22 * scale, sy: 0.18 * scale, sz: 0.22 * scale, color: '#fde047' })
    boxes.push({ x, y: baseY + 0.2 * scale, z: z + 0.2 * scale, sx: 0.13 * scale, sy: 0.06 * scale, sz: 0.1 * scale, color: '#f97316' })
    boxes.push({ x: x - 0.075 * scale, y: baseY + 0.25 * scale, z: z + 0.165 * scale, sx: 0.036 * scale, sy: 0.04 * scale, sz: 0.025 * scale, color: '#0f172a' })
    boxes.push({ x: x + 0.075 * scale, y: baseY + 0.25 * scale, z: z + 0.165 * scale, sx: 0.036 * scale, sy: 0.04 * scale, sz: 0.025 * scale, color: '#0f172a' })
    return emptyResult
  }

  if (id === 'snow_globe') {
    // Dark wood pedestal + gold front nameplate + snow bed inside dome
    const baseY = y + 0.05 * scale
    boxes.push({ x, y: baseY, z, sx: 0.5 * scale, sy: 0.08 * scale, sz: 0.5 * scale, color: '#4a2a14' })
    boxes.push({
      x,
      y: baseY + 0.055 * scale,
      z,
      sx: 0.44 * scale,
      sy: 0.04 * scale,
      sz: 0.44 * scale,
      color: '#7c4d2b',
    })
    boxes.push({
      x,
      y: baseY,
      z: z + 0.255 * scale,
      sx: 0.18 * scale,
      sy: 0.048 * scale,
      sz: 0.025 * scale,
      color: '#fbbf24',
    })
    const floorY = baseY + 0.085 * scale
    boxes.push({
      x,
      y: floorY,
      z,
      sx: 0.38 * scale,
      sy: 0.03 * scale,
      sz: 0.38 * scale,
      color: '#f4f8ff',
    })

    // Mini red-scarf snowman inside the glass dome
    const smX = x - 0.03 * scale
    const smBaseY = floorY + 0.015 * scale
    boxes.push({
      x: smX,
      y: smBaseY + 0.055 * scale,
      z,
      sx: 0.14 * scale,
      sy: 0.11 * scale,
      sz: 0.14 * scale,
      color: '#ffffff',
    })
    boxes.push({
      x: smX,
      y: smBaseY + 0.12 * scale,
      z,
      sx: 0.125 * scale,
      sy: 0.032 * scale,
      sz: 0.125 * scale,
      color: '#dc2626',
    })
    boxes.push({
      x: smX + 0.04 * scale,
      y: smBaseY + 0.092 * scale,
      z: z + 0.065 * scale,
      sx: 0.03 * scale,
      sy: 0.06 * scale,
      sz: 0.02 * scale,
      color: '#ef4444',
    })
    boxes.push({
      x: smX,
      y: smBaseY + 0.175 * scale,
      z,
      sx: 0.1 * scale,
      sy: 0.095 * scale,
      sz: 0.1 * scale,
      color: '#f8fafc',
    })
    boxes.push({
      x: smX - 0.024 * scale,
      y: smBaseY + 0.185 * scale,
      z: z + 0.052 * scale,
      sx: 0.02 * scale,
      sy: 0.02 * scale,
      sz: 0.02 * scale,
      color: '#0f172a',
    })
    boxes.push({
      x: smX + 0.024 * scale,
      y: smBaseY + 0.185 * scale,
      z: z + 0.052 * scale,
      sx: 0.02 * scale,
      sy: 0.02 * scale,
      sz: 0.02 * scale,
      color: '#0f172a',
    })
    boxes.push({
      x: smX,
      y: smBaseY + 0.165 * scale,
      z: z + 0.062 * scale,
      sx: 0.022 * scale,
      sy: 0.022 * scale,
      sz: 0.038 * scale,
      color: '#f97316',
    })
    boxes.push({
      x: smX,
      y: smBaseY + 0.232 * scale,
      z,
      sx: 0.09 * scale,
      sy: 0.026 * scale,
      sz: 0.09 * scale,
      color: '#1e293b',
    })

    // Animated falling snowflakes + translucent icy-blue voxel glass dome
    const snowDomeGroup = new THREE.Group()
    const snowFlakes: SnowFlakeHandle[] = []
    const flakeOffsets = [
      { ox: 0.1, oz: 0.08, speed: 0.55, phase: 0.08 },
      { ox: -0.11, oz: 0.06, speed: 0.48, phase: 0.34 },
      { ox: 0.06, oz: -0.1, speed: 0.62, phase: 0.59 },
      { ox: -0.09, oz: -0.09, speed: 0.52, phase: 0.81 },
      { ox: 0.13, oz: -0.02, speed: 0.45, phase: 0.22 },
      { ox: -0.02, oz: 0.12, speed: 0.58, phase: 0.47 },
      { ox: 0.03, oz: -0.04, speed: 0.5, phase: 0.72 },
      { ox: -0.13, oz: 0.01, speed: 0.6, phase: 0.93 },
    ]
    const topY = smBaseY + 0.29 * scale
    const fallRange = 0.25 * scale
    for (const f of flakeOffsets) {
      const mesh = new THREE.Mesh(baseBox, snowGlobeFlakeMat)
      const flakeSize = 0.028 * scale
      mesh.scale.set(flakeSize, flakeSize, flakeSize)
      const baseX = x + f.ox * scale
      const baseZ = z + f.oz * scale
      mesh.position.set(baseX, topY - f.phase * fallRange, baseZ)
      snowDomeGroup.add(mesh)
      snowFlakes.push({
        mesh,
        baseX,
        baseZ,
        topY,
        fallRange,
        speed: f.speed,
        driftAmp: 0.014 * scale,
        phase: f.phase,
      })
    }

    // Stepped voxel translucent glass dome + crisp icy highlight edges
    addGlassBox(
      snowDomeGroup,
      x,
      smBaseY + 0.16 * scale,
      z,
      0.42 * scale,
      0.32 * scale,
      0.42 * scale,
      snowGlobeGlassMat,
    )
    addGlassBox(
      snowDomeGroup,
      x,
      smBaseY + 0.345 * scale,
      z,
      0.32 * scale,
      0.06 * scale,
      0.32 * scale,
      snowGlobeGlassMat,
    )
    addGlassBox(
      snowDomeGroup,
      x - 0.195 * scale,
      smBaseY + 0.18 * scale,
      z + 0.195 * scale,
      0.024 * scale,
      0.24 * scale,
      0.024 * scale,
      snowGlobeEdgeMat,
    )
    addGlassBox(
      snowDomeGroup,
      x - 0.05 * scale,
      smBaseY + 0.36 * scale,
      z + 0.145 * scale,
      0.18 * scale,
      0.022 * scale,
      0.022 * scale,
      snowGlobeEdgeMat,
    )

    return { butterfly: null, snowDomeGroup, snowFlakes }
  }

  if (id === 'golden-butterfly') {
    const butterflyGroup = new THREE.Group()
    const bx = x + Math.max(width * 0.5 + 0.12, 0.34 * scale)
    const by = y + 0.18 * scale
    const bz = z + 0.08 * scale
    butterflyGroup.position.set(bx, by, bz)

    const emissiveParts: ColoredBox[] = [
      // Tiny dark thorax + glowing golden-amber voxel wings
      { x: 0, y: 0, z: 0, sx: 0.05, sy: 0.12, sz: 0.05, color: '#78350f' },
      { x: -0.11, y: 0.04, z: 0, sx: 0.16, sy: 0.14, sz: 0.04, color: '#fde047' },
      { x: 0.11, y: 0.04, z: 0, sx: 0.16, sy: 0.14, sz: 0.04, color: '#fde047' },
      { x: -0.08, y: -0.06, z: 0, sx: 0.11, sy: 0.1, sz: 0.04, color: '#f59e0b' },
      { x: 0.08, y: -0.06, z: 0, sx: 0.11, sy: 0.1, sz: 0.04, color: '#f59e0b' },
    ]
    butterflyGroup.add(mergeColoredBoxes(emissiveParts, companionEmissiveMat))
    return {
      butterfly: {
        group: butterflyGroup,
        baseX: bx,
        baseY: by,
        baseZ: bz,
      },
      snowDomeGroup: null,
      snowFlakes: [],
    }
  }

  const brimD = Math.min(depth * 1.15, 0.68 * scale)

  if (id === 'wizard-hat') {
    const brimW = Math.max(width * 0.94, 0.68 * scale)
    boxes.push({ x, y: y + 0.045 * scale, z, sx: brimW, sy: 0.085 * scale, sz: brimD, color: '#6d28d9' })
    boxes.push({ x, y: y + 0.14 * scale, z, sx: brimW * 0.65, sy: 0.11 * scale, sz: brimD * 0.66, color: '#fbbf24' })
    boxes.push({ x, y: y + 0.14 * scale, z: z + brimD * 0.35, sx: 0.15 * scale, sy: 0.11 * scale, sz: 0.05 * scale, color: '#fde047' })
    boxes.push({ x, y: y + 0.28 * scale, z: z - 0.02 * scale, sx: brimW * 0.56, sy: 0.19 * scale, sz: brimD * 0.58, color: '#7c3aed' })
    boxes.push({ x: x + 0.04 * scale, y: y + 0.45 * scale, z: z - 0.06 * scale, sx: 0.26 * scale, sy: 0.18 * scale, sz: 0.26 * scale, color: '#6d28d9' })
    boxes.push({ x: x + 0.1 * scale, y: y + 0.58 * scale, z: z - 0.11 * scale, sx: 0.14 * scale, sy: 0.14 * scale, sz: 0.14 * scale, color: '#8b5cf6' })
    return emptyResult
  }

  if (id === 'strawberry-hat') {
    const capW = Math.max(width * 0.84, 0.52 * scale)
    const capD = Math.min(depth * 1.02, capW)
    boxes.push({ x, y: y + 0.075 * scale, z, sx: capW, sy: 0.15 * scale, sz: capD, color: '#ef4444' })
    boxes.push({ x, y: y + 0.21 * scale, z, sx: capW * 0.78, sy: 0.13 * scale, sz: capD * 0.78, color: '#dc2626' })
    boxes.push({ x: x - capW * 0.28, y: y + 0.08 * scale, z: z + capD * 0.5 + 0.01, sx: 0.07 * scale, sy: 0.07 * scale, sz: 0.04 * scale, color: '#fef3c7' })
    boxes.push({ x: x + capW * 0.25, y: y + 0.12 * scale, z: z + capD * 0.5 + 0.01, sx: 0.07 * scale, sy: 0.07 * scale, sz: 0.04 * scale, color: '#fef3c7' })
    boxes.push({ x, y: y + 0.3 * scale, z, sx: capW * 0.6, sy: 0.075 * scale, sz: capD * 0.6, color: '#22c55e' })
    boxes.push({ x, y: y + 0.37 * scale, z, sx: 0.1 * scale, sy: 0.11 * scale, sz: 0.1 * scale, color: '#15803d' })
    return emptyResult
  }

  if (id === 'leaf-umbrella') {
    boxes.push({ x: x + 0.12 * scale, y: y + 0.17 * scale, z: z - 0.04 * scale, sx: 0.08 * scale, sy: 0.34 * scale, sz: 0.08 * scale, color: '#7c4d2b' })
    boxes.push({ x, y: y + 0.36 * scale, z, sx: Math.max(width * 1.05, 0.82 * scale), sy: 0.1 * scale, sz: Math.max(depth * 1.15, 0.72 * scale), color: '#16a34a' })
    boxes.push({ x, y: y + 0.42 * scale, z, sx: Math.max(width * 0.82, 0.6 * scale), sy: 0.06 * scale, sz: Math.max(depth * 0.88, 0.54 * scale), color: '#22c55e' })
    boxes.push({ x, y: y + 0.46 * scale, z, sx: 0.1 * scale, sy: 0.04 * scale, sz: Math.max(depth * 0.92, 0.58 * scale), color: '#4ade80' })
    return emptyResult
  }

  // 'santa-hat'
  const hatBaseW = Math.max(width * 0.86, 0.56 * scale)
  const hatBaseD = Math.min(depth * 1.04, 0.58 * scale)
  boxes.push({ x, y: y + 0.055 * scale, z, sx: hatBaseW, sy: 0.11 * scale, sz: hatBaseD, color: '#f4f8ff' })
  boxes.push({ x, y: y + 0.19 * scale, z, sx: hatBaseW * 0.78, sy: 0.16 * scale, sz: hatBaseD * 0.8, color: '#dc2626' })
  boxes.push({ x: x + 0.08 * scale, y: y + 0.33 * scale, z: z - 0.04 * scale, sx: hatBaseW * 0.54, sy: 0.15 * scale, sz: hatBaseD * 0.58, color: '#ef4444' })
  boxes.push({ x: x + 0.2 * scale, y: y + 0.39 * scale, z: z - 0.09 * scale, sx: 0.16 * scale, sy: 0.16 * scale, sz: 0.16 * scale, color: '#ffffff' })
  return emptyResult
}

interface TorsoFitSpec {
  body: { x: number; y: number; z: number; sx: number; sy: number; sz: number }
  hood: { x: number; y: number; z: number; sx: number; sy: number; sz: number }
  allowSideSleeves: boolean
}

function buildBodyAccessory(
  id: BodyAccessoryId,
  fit: TorsoFitSpec,
  anchors: DynamicCompanionAnchors,
  boxes: ColoredBox[],
  staticEmissiveBoxes: ColoredBox[],
): THREE.Group | null {
  const face = anchors.anchorFaceFront

  if (id === 'code_visor') {
    const { x, y, z, scale, eyeSpan, headHalfW } = face
    const visorWidth = Math.max(eyeSpan + 0.22 * scale, 0.46 * scale)
    const sideOffset = Math.max(visorWidth * 0.5, headHalfW + 0.028)
    const templeBackZ = Math.max(0.24, z - 0.04)

    // Sleek dark top frame & side temple straps clearing head walls cleanly
    boxes.push({
      x,
      y: y + 0.092 * scale,
      z: z + 0.025,
      sx: visorWidth + 0.04,
      sy: 0.042 * scale,
      sz: 0.065,
      color: '#0f172a',
    })
    if (sideOffset > visorWidth * 0.5) {
      const bridgeSpan = sideOffset - visorWidth * 0.5 + 0.02
      boxes.push({ x: x - (visorWidth * 0.5 + bridgeSpan * 0.5), y: y + 0.02 * scale, z: z + 0.02, sx: bridgeSpan, sy: 0.05 * scale, sz: 0.04, color: '#1e293b' })
      boxes.push({ x: x + (visorWidth * 0.5 + bridgeSpan * 0.5), y: y + 0.02 * scale, z: z + 0.02, sx: bridgeSpan, sy: 0.05 * scale, sz: 0.04, color: '#1e293b' })
    }
    boxes.push({
      x: x - sideOffset,
      y: y + 0.02 * scale,
      z: z - templeBackZ * 0.45,
      sx: 0.04 * scale,
      sy: 0.055 * scale,
      sz: templeBackZ,
      color: '#1e293b',
    })
    boxes.push({
      x: x + sideOffset,
      y: y + 0.02 * scale,
      z: z - templeBackZ * 0.45,
      sx: 0.04 * scale,
      sy: 0.055 * scale,
      sz: templeBackZ,
      color: '#1e293b',
    })

    // Micro glowing neon-green simulated log/code lines projected onto visor
    const lineZ = z + 0.058
    staticEmissiveBoxes.push({ x: x - 0.11 * scale, y: y + 0.03 * scale, z: lineZ, sx: 0.12 * scale, sy: 0.024 * scale, sz: 0.015, color: '#39d353' })
    staticEmissiveBoxes.push({ x: x + 0.08 * scale, y: y + 0.03 * scale, z: lineZ, sx: 0.07 * scale, sy: 0.024 * scale, sz: 0.015, color: '#a7f3d0' })
    staticEmissiveBoxes.push({ x: x - 0.05 * scale, y: y - 0.015 * scale, z: lineZ, sx: 0.16 * scale, sy: 0.024 * scale, sz: 0.015, color: '#38bdf8' })
    staticEmissiveBoxes.push({ x: x + 0.12 * scale, y: y - 0.015 * scale, z: lineZ, sx: 0.05 * scale, sy: 0.024 * scale, sz: 0.015, color: '#39d353' })
    staticEmissiveBoxes.push({ x: x - 0.09 * scale, y: y - 0.055 * scale, z: lineZ, sx: 0.09 * scale, sy: 0.024 * scale, sz: 0.015, color: '#39d353' })

    const visorGlassGroup = new THREE.Group()
    addGlassBox(
      visorGlassGroup,
      x,
      y,
      z + 0.03,
      visorWidth,
      0.165 * scale,
      0.052,
      codeVisorGlassMat,
    )
    return visorGlassGroup
  }

  if (id === 'pixel_sunglasses') {
    const { x, y, z, scale, eyeSpan, headHalfW } = face
    const halfSpan = eyeSpan * 0.5
    const lensW = Math.max(0.18 * scale, halfSpan * 0.88)
    const lensH = 0.11 * scale
    const outerBridge = Math.max(halfSpan + lensW * 0.5 + 0.02, headHalfW + 0.025)
    const templeBackZ = Math.max(0.24, z - 0.04)

    // Iconic dark pixel shades + stepped bottom corners + white glare pixels
    boxes.push({ x, y: y + 0.045 * scale, z: z + 0.032, sx: outerBridge * 2, sy: 0.042 * scale, sz: 0.05, color: '#090d16' })
    boxes.push({ x: x - halfSpan, y: y - 0.01 * scale, z: z + 0.032, sx: lensW, sy: lensH, sz: 0.052, color: '#090d16' })
    boxes.push({ x: x + halfSpan, y: y - 0.01 * scale, z: z + 0.032, sx: lensW, sy: lensH, sz: 0.052, color: '#090d16' })
    boxes.push({ x: x - halfSpan + 0.02 * scale, y: y - 0.065 * scale, z: z + 0.032, sx: lensW * 0.68, sy: 0.035 * scale, sz: 0.052, color: '#090d16' })
    boxes.push({ x: x + halfSpan - 0.02 * scale, y: y - 0.065 * scale, z: z + 0.032, sx: lensW * 0.68, sy: 0.035 * scale, sz: 0.052, color: '#090d16' })
    // Crisp white pixel glare blocks
    boxes.push({ x: x - halfSpan - 0.03 * scale, y: y + 0.01 * scale, z: z + 0.058, sx: 0.045 * scale, sy: 0.04 * scale, sz: 0.016, color: '#f8fafc' })
    boxes.push({ x: x + halfSpan - 0.03 * scale, y: y + 0.01 * scale, z: z + 0.058, sx: 0.045 * scale, sy: 0.04 * scale, sz: 0.016, color: '#f8fafc' })
    // Temple arms wrapping safely outside skull sides
    boxes.push({ x: x - outerBridge, y: y + 0.035 * scale, z: z - templeBackZ * 0.42, sx: 0.038 * scale, sy: 0.042 * scale, sz: templeBackZ, color: '#0f172a' })
    boxes.push({ x: x + outerBridge, y: y + 0.035 * scale, z: z - templeBackZ * 0.42, sx: 0.038 * scale, sy: 0.042 * scale, sz: templeBackZ, color: '#0f172a' })
    return null
  }

  const b = fit.body
  const chestZ = b.z + b.sz * 0.5 + 0.014
  const backZ = b.z - b.sz * 0.5 - 0.014
  const chestScaleX = Math.min(1, b.sx / 0.56)

  if (id === 'binary_sweater') {
    // Cozy deep-navy holiday knit sweater + festive crimson collar & ribbed hem trim
    boxes.push({ ...b, color: '#1e3a8a' })
    boxes.push({
      x: b.x,
      y: b.y - b.sy * 0.42,
      z: b.z,
      sx: b.sx + 0.025,
      sy: Math.min(0.065, b.sy * 0.24),
      sz: b.sz + 0.025,
      color: '#b91c1c',
    })
    boxes.push({
      x: b.x,
      y: b.y + b.sy * 0.41,
      z: b.z,
      sx: b.sx * 0.92,
      sy: Math.min(0.06, b.sy * 0.22),
      sz: b.sz * 0.94,
      color: '#dc2626',
    })

    // Binary pixel `0` (left) and `1` (right) in glowing gold & emerald centered inside front face
    const cy = b.y + 0.01
    const bz = chestZ + 0.005
    const digitYScale = Math.min(1, b.sy / 0.28)
    const zeroCx = b.x - 0.11 * chestScaleX
    staticEmissiveBoxes.push({ x: zeroCx - 0.035 * chestScaleX, y: cy, z: bz, sx: 0.022 * chestScaleX, sy: 0.08 * digitYScale, sz: 0.018, color: '#fbbf24' })
    staticEmissiveBoxes.push({ x: zeroCx + 0.035 * chestScaleX, y: cy, z: bz, sx: 0.022 * chestScaleX, sy: 0.08 * digitYScale, sz: 0.018, color: '#fbbf24' })
    staticEmissiveBoxes.push({ x: zeroCx, y: cy + 0.034 * digitYScale, z: bz, sx: 0.065 * chestScaleX, sy: 0.02 * digitYScale, sz: 0.018, color: '#fbbf24' })
    staticEmissiveBoxes.push({ x: zeroCx, y: cy - 0.034 * digitYScale, z: bz, sx: 0.065 * chestScaleX, sy: 0.02 * digitYScale, sz: 0.018, color: '#fbbf24' })

    const oneCx = b.x + 0.005
    staticEmissiveBoxes.push({ x: oneCx, y: cy, z: bz, sx: 0.024 * chestScaleX, sy: 0.085 * digitYScale, sz: 0.018, color: '#4ade80' })
    staticEmissiveBoxes.push({ x: oneCx - 0.016 * chestScaleX, y: cy + 0.028 * digitYScale, z: bz, sx: 0.03 * chestScaleX, sy: 0.02 * digitYScale, sz: 0.018, color: '#4ade80' })

    // Mini conference lanyard & white tech badge fitted safely inside chest width
    const bx = b.x + Math.min(0.145, b.sx * 0.24)
    const by = b.y - 0.01 * digitYScale
    boxes.push({ x: bx - 0.03 * chestScaleX, y: b.y + b.sy * 0.23, z: chestZ, sx: 0.018, sy: b.sy * 0.34, sz: 0.018, color: '#38bdf8' })
    boxes.push({ x: bx + 0.03 * chestScaleX, y: b.y + b.sy * 0.23, z: chestZ, sx: 0.018, sy: b.sy * 0.34, sz: 0.018, color: '#38bdf8' })
    boxes.push({ x: bx, y: by, z: chestZ + 0.012, sx: 0.105 * chestScaleX, sy: 0.115 * digitYScale, sz: 0.024, color: '#f8fafc' })
    boxes.push({ x: bx, y: by + 0.042 * digitYScale, z: chestZ + 0.016, sx: 0.105 * chestScaleX, sy: 0.026 * digitYScale, sz: 0.024, color: '#ef4444' })
    boxes.push({ x: bx, y: by - 0.01 * digitYScale, z: chestZ + 0.026, sx: 0.07 * chestScaleX, sy: 0.02 * digitYScale, sz: 0.012, color: '#0f172a' })
    return null
  }

  if (id === 'dev_hoodie') {
    const h = fit.hood

    // GitHub Dark fleece torso, ribbed hem trim, kangaroo pocket & folded hood
    boxes.push({ ...b, color: '#161b22' })
    boxes.push({
      x: b.x,
      y: b.y - b.sy * 0.43,
      z: b.z,
      sx: b.sx + 0.02,
      sy: Math.min(0.06, b.sy * 0.22),
      sz: b.sz + 0.02,
      color: '#30363d',
    })
    boxes.push({
      x: b.x,
      y: b.y - b.sy * 0.2,
      z: chestZ,
      sx: b.sx * 0.56,
      sy: b.sy * 0.28,
      sz: 0.028,
      color: '#21262d',
    })
    // Subtle hoodie drawstring cords on front neckline
    boxes.push({
      x: b.x - 0.08 * chestScaleX,
      y: b.y + b.sy * 0.34,
      z: chestZ + 0.004,
      sx: 0.024,
      sy: Math.min(0.09, b.sy * 0.3),
      sz: 0.02,
      color: '#cbd5e1',
    })
    boxes.push({
      x: b.x + 0.08 * chestScaleX,
      y: b.y + b.sy * 0.34,
      z: chestZ + 0.004,
      sx: 0.024,
      sy: Math.min(0.09, b.sy * 0.3),
      sz: 0.02,
      color: '#cbd5e1',
    })
    // Folded cozy hood collar tucked cleanly behind torso
    boxes.push({ ...h, color: '#161b22' })
    boxes.push({
      x: h.x,
      y: h.y + h.sy * 0.35,
      z: h.z + 0.01,
      sx: h.sx * 0.86,
      sy: 0.048,
      sz: h.sz * 0.82,
      color: '#21262d',
    })

    // Glowing GitHub neon-green pixel terminal emblem `>_` on the front chest
    const cy = b.y + b.sy * 0.14
    const cz = chestZ + 0.008
    staticEmissiveBoxes.push({ x: -0.075 * chestScaleX, y: cy + 0.024, z: cz, sx: 0.03, sy: 0.022, sz: 0.02, color: '#39d353' })
    staticEmissiveBoxes.push({ x: -0.045 * chestScaleX, y: cy, z: cz, sx: 0.03, sy: 0.022, sz: 0.02, color: '#39d353' })
    staticEmissiveBoxes.push({ x: -0.075 * chestScaleX, y: cy - 0.024, z: cz, sx: 0.03, sy: 0.022, sz: 0.02, color: '#39d353' })
    staticEmissiveBoxes.push({ x: 0.048 * chestScaleX, y: cy - 0.026, z: cz, sx: 0.084 * chestScaleX, sy: 0.022, sz: 0.02, color: '#39d353' })
    return null
  }

  if (id === 'programmer_tshirt') {
    const h = fit.hood

    // Stylish Cyber-Neon Bomber Jacket in obsidian black, electric purple, emerald green & gold trim
    boxes.push({ ...b, color: '#111827' })
    if (fit.allowSideSleeves) {
      boxes.push({ x: b.x - b.sx * 0.5 - 0.042, y: b.y + b.sy * 0.13, z: b.z, sx: 0.092, sy: b.sy * 0.48, sz: b.sz * 0.44, color: '#1f2937' })
      boxes.push({ x: b.x + b.sx * 0.5 + 0.042, y: b.y + b.sy * 0.13, z: b.z, sx: 0.092, sy: b.sy * 0.48, sz: b.sz * 0.44, color: '#1f2937' })
      boxes.push({ x: b.x - b.sx * 0.5 - 0.045, y: b.y + b.sy * 0.29, z: b.z, sx: 0.098, sy: 0.06, sz: b.sz * 0.45, color: '#9333ea' })
      boxes.push({ x: b.x + b.sx * 0.5 + 0.045, y: b.y + b.sy * 0.29, z: b.z, sx: 0.098, sy: 0.06, sz: b.sz * 0.45, color: '#9333ea' })
      boxes.push({ x: b.x - b.sx * 0.5 - 0.046, y: b.y - b.sy * 0.06, z: b.z, sx: 0.096, sy: 0.042, sz: b.sz * 0.45, color: '#10b981' })
      boxes.push({ x: b.x + b.sx * 0.5 + 0.046, y: b.y - b.sy * 0.06, z: b.z, sx: 0.096, sy: 0.042, sz: b.sz * 0.45, color: '#10b981' })
    } else {
      // Sleeveless cyber vest accents along wide shoulders so Claude's articulated coral arms stay free
      boxes.push({ x: b.x - b.sx * 0.44, y: b.y + b.sy * 0.34, z: b.z, sx: 0.12, sy: 0.05, sz: b.sz + 0.015, color: '#9333ea' })
      boxes.push({ x: b.x + b.sx * 0.44, y: b.y + b.sy * 0.34, z: b.z, sx: 0.12, sy: 0.05, sz: b.sz + 0.015, color: '#9333ea' })
    }

    // Purple collar trim + folded cyber hood behind neck
    boxes.push({ x: b.x, y: b.y + b.sy * 0.42, z: b.z, sx: b.sx * 0.88, sy: Math.min(0.056, b.sy * 0.22), sz: b.sz * 0.9, color: '#7e22ce' })
    boxes.push({ ...h, color: '#18181b' })
    boxes.push({
      x: h.x,
      y: h.y + h.sy * 0.35,
      z: h.z + 0.01,
      sx: h.sx * 0.88,
      sy: 0.048,
      sz: h.sz * 0.82,
      color: '#a855f7',
    })

    // Metallic gold waistband trim & center zipper
    boxes.push({ x: b.x, y: b.y - b.sy * 0.43, z: b.z, sx: b.sx + 0.025, sy: Math.min(0.052, b.sy * 0.22), sz: b.sz + 0.025, color: '#f59e0b' })
    boxes.push({ x: b.x, y: b.y - 0.005, z: chestZ + 0.004, sx: 0.032, sy: b.sy * 0.82, sz: 0.016, color: '#fbbf24' })

    // Glowing cyber emerald/purple `</>` crest on left chest & emerald badge on right chest
    const cx = b.x - b.sx * 0.2
    const cy = b.y + b.sy * 0.06
    const badgeScaleY = Math.min(1, b.sy / 0.24)
    boxes.push({ x: cx, y: cy, z: chestZ + 0.005, sx: 0.135 * chestScaleX, sy: 0.095 * badgeScaleY, sz: 0.016, color: '#1e1b4b' })
    staticEmissiveBoxes.push({ x: cx - 0.036 * chestScaleX, y: cy + 0.008, z: chestZ + 0.016, sx: 0.024, sy: 0.04 * badgeScaleY, sz: 0.012, color: '#34d399' })
    staticEmissiveBoxes.push({ x: cx + 0.036 * chestScaleX, y: cy + 0.008, z: chestZ + 0.016, sx: 0.024, sy: 0.04 * badgeScaleY, sz: 0.012, color: '#c084fc' })
    staticEmissiveBoxes.push({ x: cx, y: cy + 0.008, z: chestZ + 0.016, sx: 0.018, sy: 0.05 * badgeScaleY, sz: 0.012, color: '#fde047' })

    staticEmissiveBoxes.push({ x: b.x + b.sx * 0.2, y: cy + 0.008, z: chestZ + 0.012, sx: 0.072 * chestScaleX, sy: 0.024 * badgeScaleY, sz: 0.012, color: '#10b981' })
    staticEmissiveBoxes.push({ x: b.x, y: b.y + 0.02, z: backZ, sx: Math.min(0.32, b.sx * 0.48), sy: 0.04, sz: 0.016, color: '#a855f7' })
    staticEmissiveBoxes.push({ x: b.x, y: b.y - 0.032, z: backZ, sx: Math.min(0.22, b.sx * 0.34), sy: 0.026, sz: 0.016, color: '#34d399' })
    return null
  }

  if (id === 'round-glasses') {
    const { x, y, z, scale, eyeSpan, headHalfW } = face
    const halfSpan = eyeSpan * 0.5
    const rimSize = 0.2 * scale
    const lensSize = 0.13 * scale
    const outerBridge = Math.max(halfSpan + rimSize * 0.5, headHalfW + 0.022)
    const templeBackZ = Math.max(0.22, z - 0.04)

    boxes.push({ x: x - halfSpan, y, z: z + 0.015, sx: rimSize, sy: rimSize, sz: 0.055, color: '#1e293b' })
    boxes.push({ x: x + halfSpan, y, z: z + 0.015, sx: rimSize, sy: rimSize, sz: 0.055, color: '#1e293b' })
    boxes.push({ x: x - halfSpan, y, z: z + 0.03, sx: lensSize, sy: lensSize, sz: 0.048, color: '#bae6fd' })
    boxes.push({ x: x + halfSpan, y, z: z + 0.03, sx: lensSize, sy: lensSize, sz: 0.048, color: '#bae6fd' })
    boxes.push({ x, y: y + 0.02, z: z + 0.02, sx: Math.max(0.08, eyeSpan - rimSize), sy: 0.045, sz: 0.048, color: '#fbbf24' })
    // Subtle temple ear arms wrapping cleanly around head sides without piercing skull
    if (outerBridge > halfSpan + rimSize * 0.5) {
      const armBridge = outerBridge - (halfSpan + rimSize * 0.5) + 0.02
      boxes.push({ x: x - (halfSpan + rimSize * 0.5 + armBridge * 0.5), y: y + 0.015, z: z + 0.015, sx: armBridge, sy: 0.035, sz: 0.04, color: '#1e293b' })
      boxes.push({ x: x + (halfSpan + rimSize * 0.5 + armBridge * 0.5), y: y + 0.015, z: z + 0.015, sx: armBridge, sy: 0.035, sz: 0.04, color: '#1e293b' })
    }
    boxes.push({ x: x - outerBridge, y: y + 0.015, z: z - templeBackZ * 0.42, sx: 0.035, sy: 0.038, sz: templeBackZ, color: '#1e293b' })
    boxes.push({ x: x + outerBridge, y: y + 0.015, z: z - templeBackZ * 0.42, sx: 0.035, sy: 0.038, sz: templeBackZ, color: '#1e293b' })
    return null
  }

  if (id === 'santa_coat') {
    // Festive crimson coat, snowy fur trim & placket, black belt with glowing gold buckle
    boxes.push({ ...b, color: '#dc2626' })
    if (fit.allowSideSleeves) {
      boxes.push({ x: b.x - b.sx * 0.5 - 0.042, y: b.y + b.sy * 0.12, z: b.z, sx: 0.09, sy: b.sy * 0.48, sz: b.sz * 0.44, color: '#dc2626' })
      boxes.push({ x: b.x + b.sx * 0.5 + 0.042, y: b.y + b.sy * 0.12, z: b.z, sx: 0.09, sy: b.sy * 0.48, sz: b.sz * 0.44, color: '#dc2626' })
      boxes.push({ x: b.x - b.sx * 0.5 - 0.044, y: b.y - b.sy * 0.09, z: b.z, sx: 0.096, sy: 0.055, sz: b.sz * 0.46, color: '#f8fafc' })
      boxes.push({ x: b.x + b.sx * 0.5 + 0.044, y: b.y - b.sy * 0.09, z: b.z, sx: 0.096, sy: 0.055, sz: b.sz * 0.46, color: '#f8fafc' })
    }
    boxes.push({ x: b.x, y: b.y + b.sy * 0.42, z: b.z, sx: b.sx + 0.025, sy: Math.min(0.068, b.sy * 0.24), sz: b.sz + 0.025, color: '#f8fafc' })
    boxes.push({ x: b.x, y: b.y - b.sy * 0.43, z: b.z, sx: b.sx + 0.03, sy: Math.min(0.068, b.sy * 0.24), sz: b.sz + 0.03, color: '#f8fafc' })
    boxes.push({ x: b.x, y: b.y, z: chestZ + 0.003, sx: 0.09 * chestScaleX, sy: b.sy * 0.86, sz: 0.022, color: '#f8fafc' })
    // Black leather belt & bright gold buckle
    boxes.push({ x: b.x, y: b.y - b.sy * 0.16, z: b.z, sx: b.sx + 0.032, sy: Math.min(0.072, b.sy * 0.25), sz: b.sz + 0.032, color: '#0f172a' })
    boxes.push({ x: b.x, y: b.y - b.sy * 0.16, z: chestZ + 0.015, sx: 0.125 * chestScaleX, sy: Math.min(0.095, b.sy * 0.34), sz: 0.024, color: '#fbbf24' })
    boxes.push({ x: b.x, y: b.y - b.sy * 0.16, z: chestZ + 0.022, sx: 0.06 * chestScaleX, sy: Math.min(0.05, b.sy * 0.18), sz: 0.018, color: '#0f172a' })
    return null
  }

  if (id === 'angel_wings') {
    const backWingZ = backZ - 0.035
    const collarY = b.y + b.sy * 0.38
    // Golden ribbon collar tie + wide feathered snow-white angel wings with emissive gold tips
    boxes.push({ x: b.x, y: collarY, z: b.z, sx: b.sx + 0.04, sy: 0.065, sz: b.sz + 0.04, color: '#fde047' })
    for (const side of [-1, 1] as const) {
      const innerX = b.x + side * (b.sx * 0.32 + 0.08)
      const midX = b.x + side * (b.sx * 0.48 + 0.17)
      const tipX = b.x + side * (b.sx * 0.56 + 0.27)
      boxes.push({ x: innerX, y: b.y + 0.05, z: backWingZ, sx: 0.18, sy: Math.max(0.24, b.sy * 0.85), sz: 0.07, color: '#f8fafc' })
      boxes.push({ x: midX, y: b.y + 0.12, z: backWingZ - 0.035, sx: 0.16, sy: Math.max(0.26, b.sy * 0.9), sz: 0.065, color: '#e2e8f0' })
      boxes.push({ x: tipX, y: b.y + 0.19, z: backWingZ - 0.06, sx: 0.12, sy: Math.max(0.2, b.sy * 0.65), sz: 0.055, color: '#ffffff' })
      staticEmissiveBoxes.push({ x: tipX + side * 0.03, y: b.y + 0.25, z: backWingZ - 0.06, sx: 0.075, sy: 0.12, sz: 0.045, color: '#fde047' })
    }
    return null
  }

  // Collar & Cape / Scarf dimensions driven dynamically by real Box3 torso dimensions
  const collarW = b.sx + 0.045
  const collarD = b.sz + 0.045
  const collarY = b.y + b.sy * 0.4
  const frontCollarZ = b.z + collarD * 0.5 + 0.018
  const backCollarZ = b.z - collarD * 0.5 - 0.045

  if (id === 'wizard-cloak') {
    boxes.push({ x: b.x, y: collarY, z: b.z, sx: collarW, sy: 0.1, sz: collarD, color: '#7c3aed' })
    boxes.push({ x: b.x, y: collarY - 0.02, z: frontCollarZ, sx: 0.14, sy: 0.11, sz: 0.055, color: '#fde047' })
    boxes.push({ x: b.x, y: b.y, z: backCollarZ, sx: Math.min(0.76, b.sx + 0.06), sy: Math.max(0.22, b.sy + 0.08), sz: 0.1, color: '#6d28d9' })
    boxes.push({ x: b.x, y: b.y - b.sy * 0.35, z: backCollarZ - 0.04, sx: Math.min(0.84, b.sx + 0.12), sy: Math.max(0.14, b.sy * 0.42), sz: 0.09, color: '#5b21b6' })
    boxes.push({ x: b.x - 0.15, y: b.y - 0.02, z: backCollarZ - 0.055, sx: 0.065, sy: 0.065, sz: 0.035, color: '#fde047' })
    boxes.push({ x: b.x + 0.16, y: b.y + 0.06, z: backCollarZ - 0.055, sx: 0.065, sy: 0.065, sz: 0.035, color: '#fde047' })
    return null
  }

  // 'leaf-scarf': Deep spruce-evergreen collar band wrapping cleanly outside torso Box3
  boxes.push({ x: b.x, y: collarY, z: b.z, sx: collarW, sy: 0.12, sz: collarD, color: '#064e3b' })
  boxes.push({ x: b.x, y: collarY + 0.04, z: b.z, sx: collarW + 0.02, sy: 0.055, sz: collarD + 0.02, color: '#15803d' })
  boxes.push({ x: b.x + Math.min(0.14, b.sx * 0.22), y: collarY - 0.12, z: frontCollarZ + 0.015, sx: 0.15, sy: Math.min(0.22, b.sy * 0.72), sz: 0.08, color: '#064e3b' })
  boxes.push({ x: b.x + Math.min(0.15, b.sx * 0.24), y: collarY - 0.17, z: frontCollarZ + 0.03, sx: 0.11, sy: Math.min(0.13, b.sy * 0.45), sz: 0.07, color: '#4ade80' })
  boxes.push({ x: b.x - Math.min(0.1, b.sx * 0.16), y: collarY - 0.07, z: frontCollarZ + 0.015, sx: 0.13, sy: Math.min(0.15, b.sy * 0.5), sz: 0.075, color: '#15803d' })
  boxes.push({ x: b.x + 0.04, y: collarY, z: frontCollarZ + 0.035, sx: 0.1, sy: 0.095, sz: 0.055, color: '#fbbf24' })
  boxes.push({ x: b.x + 0.04, y: collarY + 0.03, z: frontCollarZ + 0.05, sx: 0.055, sy: 0.055, sz: 0.035, color: '#ef4444' })
  return null
}

function buildHandAccessory(
  id: HandAccessoryId,
  anchor: AnchorPoint,
  staticBoxes: ColoredBox[],
  emissiveBoxes: ColoredBox[],
  staticEmissiveBoxes: ColoredBox[],
): { hasLantern: boolean; steamAnchor: { x: number; y: number; z: number } | null } {
  const { x, y, z, scale } = anchor

  if (id === 'mini_laptop') {
    // Brushed slate laptop base + tiny dark keys + angled backlit display with glowing neon code lines
    staticBoxes.push({ x, y: y - 0.04 * scale, z: z + 0.04 * scale, sx: 0.32 * scale, sy: 0.045 * scale, sz: 0.24 * scale, color: '#64748b' })
    staticBoxes.push({ x, y: y - 0.015 * scale, z: z + 0.06 * scale, sx: 0.25 * scale, sy: 0.02 * scale, sz: 0.14 * scale, color: '#0f172a' })
    staticBoxes.push({ x, y: y + 0.095 * scale, z: z - 0.075 * scale, sx: 0.32 * scale, sy: 0.23 * scale, sz: 0.035 * scale, color: '#1e293b' })
    staticBoxes.push({ x, y: y + 0.095 * scale, z: z - 0.056 * scale, sx: 0.27 * scale, sy: 0.18 * scale, sz: 0.02 * scale, color: '#0d1117' })
    // Neon green & sky-blue syntax code bars on screen
    staticEmissiveBoxes.push({ x: x - 0.05 * scale, y: y + 0.14 * scale, z: z - 0.042 * scale, sx: 0.12 * scale, sy: 0.024 * scale, sz: 0.016, color: '#39d353' })
    staticEmissiveBoxes.push({ x: x + 0.055 * scale, y: y + 0.14 * scale, z: z - 0.042 * scale, sx: 0.05 * scale, sy: 0.024 * scale, sz: 0.016, color: '#38bdf8' })
    staticEmissiveBoxes.push({ x: x - 0.02 * scale, y: y + 0.095 * scale, z: z - 0.042 * scale, sx: 0.16 * scale, sy: 0.024 * scale, sz: 0.016, color: '#fbbf24' })
    staticEmissiveBoxes.push({ x: x - 0.045 * scale, y: y + 0.05 * scale, z: z - 0.042 * scale, sx: 0.1 * scale, sy: 0.024 * scale, sz: 0.016, color: '#39d353' })
    return { hasLantern: false, steamAnchor: null }
  }

  if (id === 'mechanical_keyboard') {
    // Compact 60% mechanical keyboard with graphite case, keycap clusters, coral ESC key & RGB underglow strip
    staticBoxes.push({ x, y: y - 0.02 * scale, z: z + 0.04 * scale, sx: 0.38 * scale, sy: 0.055 * scale, sz: 0.2 * scale, color: '#1e293b' })
    staticBoxes.push({ x, y: y + 0.02 * scale, z: z + 0.02 * scale, sx: 0.33 * scale, sy: 0.032 * scale, sz: 0.055 * scale, color: '#f8fafc' })
    staticBoxes.push({ x, y: y + 0.02 * scale, z: z + 0.08 * scale, sx: 0.29 * scale, sy: 0.032 * scale, sz: 0.05 * scale, color: '#cbd5e1' })
    // Glowing RGB bottom strip & artisan red ESC + neon cyan spacebar
    staticEmissiveBoxes.push({ x: x - 0.1 * scale, y: y - 0.045 * scale, z: z + 0.14 * scale, sx: 0.12 * scale, sy: 0.022 * scale, sz: 0.022, color: '#38bdf8' })
    staticEmissiveBoxes.push({ x, y: y - 0.045 * scale, z: z + 0.14 * scale, sx: 0.12 * scale, sy: 0.022 * scale, sz: 0.022, color: '#a855f7' })
    staticEmissiveBoxes.push({ x: x + 0.1 * scale, y: y - 0.045 * scale, z: z + 0.14 * scale, sx: 0.12 * scale, sy: 0.022 * scale, sz: 0.022, color: '#39d353' })
    staticEmissiveBoxes.push({ x: x - 0.135 * scale, y: y + 0.03 * scale, z: z + 0.015 * scale, sx: 0.048 * scale, sy: 0.035 * scale, sz: 0.048 * scale, color: '#ef4444' })
    staticEmissiveBoxes.push({ x, y: y + 0.026 * scale, z: z + 0.115 * scale, sx: 0.14 * scale, sy: 0.03 * scale, sz: 0.04 * scale, color: '#38bdf8' })
    return { hasLantern: false, steamAnchor: null }
  }

  if (id === 'glow-lantern') {
    staticBoxes.push({ x, y: y + 0.16 * scale, z, sx: 0.08, sy: 0.22, sz: 0.08, color: '#475569' })
    staticBoxes.push({ x, y: y + 0.24 * scale, z: z + 0.08, sx: 0.22, sy: 0.08, sz: 0.22, color: '#1e293b' })
    staticBoxes.push({ x, y: y - 0.04 * scale, z: z + 0.08, sx: 0.22, sy: 0.06, sz: 0.22, color: '#1e293b' })
    emissiveBoxes.push({ x, y: y + 0.1 * scale, z: z + 0.08, sx: 0.2, sy: 0.22, sz: 0.2, color: '#fde047' })
    return { hasLantern: true, steamAnchor: null }
  }

  if (id === 'coffee-mug') {
    staticBoxes.push({ x, y, z, sx: 0.22 * scale, sy: 0.24 * scale, sz: 0.22 * scale, color: '#dc2626' })
    staticBoxes.push({ x: x + 0.13 * scale, y, z, sx: 0.08 * scale, sy: 0.14 * scale, sz: 0.06 * scale, color: '#f8fafc' })
    staticBoxes.push({ x, y: y + 0.11 * scale, z, sx: 0.16 * scale, sy: 0.04 * scale, sz: 0.16 * scale, color: '#451a03' })
    return {
      hasLantern: false,
      steamAnchor: { x, y: y + 0.2 * scale, z },
    }
  }

  if (id === 'candy_cane') {
    // Festive striped peppermint candy cane
    const stripes = ['#ef4444', '#f8fafc', '#ef4444', '#f8fafc', '#ef4444']
    for (let i = 0; i < stripes.length; i += 1) {
      staticBoxes.push({
        x,
        y: y - 0.04 * scale + i * 0.065 * scale,
        z,
        sx: 0.075 * scale,
        sy: 0.065 * scale,
        sz: 0.075 * scale,
        color: stripes[i],
      })
    }
    staticBoxes.push({ x: x + 0.055 * scale, y: y + 0.275 * scale, z, sx: 0.095 * scale, sy: 0.07 * scale, sz: 0.075 * scale, color: '#f8fafc' })
    staticBoxes.push({ x: x + 0.12 * scale, y: y + 0.23 * scale, z, sx: 0.07 * scale, sy: 0.095 * scale, sz: 0.075 * scale, color: '#ef4444' })
    return { hasLantern: false, steamAnchor: null }
  }

  if (id === 'bubble_tea') {
    // Creamy strawberry-taro milk tea cup with dark boba pearls, lid & jumbo violet straw
    staticBoxes.push({ x, y: y - 0.04 * scale, z, sx: 0.2 * scale, sy: 0.1 * scale, sz: 0.2 * scale, color: '#fce7f3' })
    staticBoxes.push({ x, y: y + 0.05 * scale, z, sx: 0.22 * scale, sy: 0.12 * scale, sz: 0.22 * scale, color: '#f472b6' })
    staticBoxes.push({ x, y: y + 0.12 * scale, z, sx: 0.24 * scale, sy: 0.04 * scale, sz: 0.24 * scale, color: '#f8fafc' })
    staticBoxes.push({ x: x + 0.02 * scale, y: y + 0.21 * scale, z, sx: 0.048 * scale, sy: 0.16 * scale, sz: 0.048 * scale, color: '#9333ea' })
    // Tapioca boba pearls peeking around lower cup edge
    staticBoxes.push({ x: x - 0.05 * scale, y: y - 0.055 * scale, z: z + 0.095 * scale, sx: 0.042 * scale, sy: 0.042 * scale, sz: 0.025 * scale, color: '#1e1b4b' })
    staticBoxes.push({ x: x + 0.04 * scale, y: y - 0.05 * scale, z: z + 0.095 * scale, sx: 0.042 * scale, sy: 0.042 * scale, sz: 0.025 * scale, color: '#1e1b4b' })
    staticBoxes.push({ x, y: y - 0.02 * scale, z: z + 0.098 * scale, sx: 0.04 * scale, sy: 0.04 * scale, sz: 0.025 * scale, color: '#1e1b4b' })
    return { hasLantern: false, steamAnchor: null }
  }

  if (id === 'pixel_sword') {
    // Enchanted RPG voxel crystal blade held upright with gold crossguard & glowing edges
    staticBoxes.push({ x, y: y - 0.09 * scale, z, sx: 0.08 * scale, sy: 0.055 * scale, sz: 0.08 * scale, color: '#fbbf24' })
    staticBoxes.push({ x, y: y - 0.03 * scale, z, sx: 0.055 * scale, sy: 0.09 * scale, sz: 0.055 * scale, color: '#78350f' })
    staticBoxes.push({ x, y: y + 0.03 * scale, z, sx: 0.22 * scale, sy: 0.055 * scale, sz: 0.075 * scale, color: '#fbbf24' })
    staticBoxes.push({ x, y: y + 0.18 * scale, z, sx: 0.075 * scale, sy: 0.25 * scale, sz: 0.045 * scale, color: '#e2e8f0' })
    staticEmissiveBoxes.push({ x: x - 0.042 * scale, y: y + 0.18 * scale, z, sx: 0.03 * scale, sy: 0.24 * scale, sz: 0.036 * scale, color: '#22d3ee' })
    staticEmissiveBoxes.push({ x: x + 0.042 * scale, y: y + 0.18 * scale, z, sx: 0.03 * scale, sy: 0.24 * scale, sz: 0.036 * scale, color: '#a855f7' })
    staticEmissiveBoxes.push({ x, y: y + 0.33 * scale, z, sx: 0.065 * scale, sy: 0.075 * scale, sz: 0.04 * scale, color: '#67e8f9' })
    return { hasLantern: false, steamAnchor: null }
  }

  if (id === 'white-fish') {
    // Little white-and-silver frozen-lake fish with icy-blue tail fin
    staticBoxes.push({ x, y, z: z + 0.04, sx: 0.14, sy: 0.14, sz: 0.26, color: '#f8fafc' })
    staticBoxes.push({ x, y, z: z - 0.13, sx: 0.08, sy: 0.16, sz: 0.11, color: '#bae6fd' })
    staticBoxes.push({ x: x + 0.075, y: y + 0.02, z: z + 0.11, sx: 0.03, sy: 0.04, sz: 0.04, color: '#0f172a' })
    staticBoxes.push({ x: x - 0.075, y: y + 0.02, z: z + 0.11, sx: 0.03, sy: 0.04, sz: 0.04, color: '#0f172a' })
    return { hasLantern: false, steamAnchor: null }
  }

  staticBoxes.push({ x, y: y - 0.02 * scale, z, sx: 0.28 * scale, sy: 0.18 * scale, sz: 0.22 * scale, color: '#facc15' })
  staticBoxes.push({ x: x - 0.04 * scale, y: y + 0.06 * scale, z, sx: 0.16 * scale, sy: 0.09 * scale, sz: 0.18 * scale, color: '#fde047' })
  staticBoxes.push({ x: x + 0.06 * scale, y: y, z: z + 0.11 * scale, sx: 0.06 * scale, sy: 0.06 * scale, sz: 0.04 * scale, color: '#ca8a04' })
  return { hasLantern: false, steamAnchor: null }
}

/**
 * Modular 3D voxel companion builder supporting 8 species and 30 accessories
 * (head/body/hand) snapped onto per-species dynamic Box3 rig anchors.
 */
export function buildVoxelCompanion(
  species: CompanionSpeciesId,
  equipped: EquippedAccessories,
): BuiltCompanion {
  const profile = SPECIES_RIG_PROFILES[species]
  const group = new THREE.Group()
  const bodyGroup = new THREE.Group()
  group.add(bodyGroup)

  const staticBoxes: ColoredBox[] = []
  const staticEmissiveBoxes: ColoredBox[] = []
  const emissiveBoxes: ColoredBox[] = []

  const speciesExtras = buildSpeciesBoxes(species, staticBoxes)

  // Compute real Box3 bounds & dynamic accessory anchors from the companion's constructed voxels
  const { anchors, torsoFit } = computeDynamicCompanionAnchors(species, staticBoxes, speciesExtras)

  if (speciesExtras.groundedStaticBoxes.length > 0) {
    group.add(mergeColoredBoxes(speciesExtras.groundedStaticBoxes, companionStaticMat))
  }
  if (speciesExtras.groundedEmissiveBoxes.length > 0) {
    group.add(mergeColoredBoxes(speciesExtras.groundedEmissiveBoxes, companionEmissiveMat))
  }
  if (speciesExtras.antennaeGroup) {
    // On Gato Alien, angle twin yellow antennae forward when wearing a hat/headset so they peek cleanly without clipping
    if (species === 'leaf_kitty' && equipped.head && equipped.head !== 'golden-butterfly') {
      speciesExtras.antennaeGroup.position.set(0, 0.94, equipped.head === 'dev_headset' ? 0.16 : 0.21)
      speciesExtras.antennaeGroup.rotation.x = equipped.head === 'dev_headset' ? 0.18 : 0.34
    }
    bodyGroup.add(speciesExtras.antennaeGroup)
  }
  if (speciesExtras.tailGroup) {
    bodyGroup.add(speciesExtras.tailGroup)
  }
  if (speciesExtras.armGroups) {
    bodyGroup.add(speciesExtras.armGroups.left)
    bodyGroup.add(speciesExtras.armGroups.right)
  }

  let butterfly: ButterflyHandle | null = null
  let snowFlakes: SnowFlakeHandle[] = []
  if (equipped.head) {
    // Head accessories live in their own pivot group so per companion + slot fits
    // (position / scale / rotation) apply identically in the shop preview and the city scene.
    const headBoxes: ColoredBox[] = []
    const headEmissiveBoxes: ColoredBox[] = []
    const headResult = buildHeadAccessory(
      equipped.head,
      anchors.anchorHeadTop,
      anchors.anchorFaceFront,
      headBoxes,
      headEmissiveBoxes,
    )
    butterfly = headResult.butterfly
    const snowDomeGroup = headResult.snowDomeGroup
    snowFlakes = headResult.snowFlakes

    const pivot = anchors.anchorHeadTop
    const fit = getHeadAccessoryFit(species, equipped.head)
    const headFitGroup = new THREE.Group()
    headFitGroup.name = 'headAccessoryFit'
    headFitGroup.position.set(
      pivot.x + (fit?.position?.[0] ?? 0),
      pivot.y + (fit?.position?.[1] ?? 0),
      pivot.z + (fit?.position?.[2] ?? 0),
    )
    headFitGroup.scale.setScalar(fit?.scale ?? 1)
    headFitGroup.rotation.set(fit?.rotation?.[0] ?? 0, fit?.rotation?.[1] ?? 0, fit?.rotation?.[2] ?? 0)
    // Inner group cancels the pivot so accessory boxes keep their absolute anchor coordinates
    const headLocalGroup = new THREE.Group()
    headLocalGroup.position.set(-pivot.x, -pivot.y, -pivot.z)
    headFitGroup.add(headLocalGroup)

    if (headBoxes.length > 0) {
      headLocalGroup.add(mergeColoredBoxes(headBoxes, companionStaticMat))
    }
    if (headEmissiveBoxes.length > 0) {
      headLocalGroup.add(mergeColoredBoxes(headEmissiveBoxes, companionEmissiveMat))
    }
    // Translucent snow dome / helmet visor after opaque parts so interiors stay visible
    if (snowDomeGroup) {
      headLocalGroup.add(snowDomeGroup)
    }
    if (butterfly) {
      headLocalGroup.add(butterfly.group)
    }
    bodyGroup.add(headFitGroup)
  }

  let visorGlassGroup: THREE.Group | null = null
  if (equipped.body) {
    visorGlassGroup = buildBodyAccessory(
      equipped.body,
      torsoFit,
      anchors,
      staticBoxes,
      staticEmissiveBoxes,
    )
  }

  let lanternMesh: THREE.Mesh | null = null
  const steamPuffs: SteamPuffHandle[] = []
  const steamEntries: Array<{ anchor: { x: number; y: number; z: number }; target: THREE.Group }> =
    speciesExtras.steamAnchors.map((anchor) => ({ anchor, target: group }))

  if (equipped.hand) {
    const handMeta = buildHandAccessory(
      equipped.hand,
      anchors.anchorSideHand,
      staticBoxes,
      emissiveBoxes,
      staticEmissiveBoxes,
    )

    if (emissiveBoxes.length > 0) {
      lanternMesh = mergeColoredBoxes(emissiveBoxes, companionEmissiveMat)
      bodyGroup.add(lanternMesh)
    }

    if (handMeta.steamAnchor) {
      steamEntries.push({ anchor: handMeta.steamAnchor, target: bodyGroup })
    }
  }

  if (steamEntries.length > 0) {
    const steamMat = getVoxelMaterial('#f4f8ff', 0.65)
    for (let sIdx = 0; sIdx < steamEntries.length; sIdx += 1) {
      const { anchor, target } = steamEntries[sIdx]
      for (let i = 0; i < 3; i += 1) {
        const puff = new THREE.Mesh(steamGeom, steamMat)
        puff.position.set(anchor.x, anchor.y + i * 0.14, anchor.z)
        target.add(puff)
        steamPuffs.push({
          mesh: puff,
          baseX: anchor.x,
          baseY: anchor.y,
          baseZ: anchor.z,
          phase: i * 0.8 + sIdx * 0.35,
        })
      }
    }
  }

  bodyGroup.add(mergeColoredBoxes(staticBoxes, companionStaticMat))

  if (staticEmissiveBoxes.length > 0) {
    bodyGroup.add(mergeColoredBoxes(staticEmissiveBoxes, companionEmissiveMat))
  }

  // Add holographic visor after opaque boxes so eyes remain cleanly visible
  if (visorGlassGroup) {
    bodyGroup.add(visorGlassGroup)
  }

  return {
    group,
    bodyGroup,
    lanternMesh,
    butterfly,
    snowFlakes,
    steamPuffs,
    antennaeGroup: speciesExtras.antennaeGroup,
    tailGroup: speciesExtras.tailGroup,
    armGroups: speciesExtras.armGroups,
    anchors,
    height: profile.modelHeight,
  }
}

export function updateCompanionAnimation(
  companion: BuiltCompanion,
  timeSec: number,
  phaseOffset = 0,
): void {
  const bob = Math.abs(Math.sin(timeSec * 2.5 + phaseOffset)) * 0.055
  const sway = Math.sin(timeSec * 1.7 + phaseOffset) * 0.038
  companion.bodyGroup.position.y = bob
  companion.bodyGroup.rotation.z = sway

  if (companion.armGroups) {
    companion.armGroups.left.rotation.x = Math.sin(timeSec * 5.4 + phaseOffset) * 0.22
    companion.armGroups.right.rotation.x = Math.cos(timeSec * 5.4 + phaseOffset) * 0.22
  }

  if (companion.antennaeGroup) {
    companion.antennaeGroup.rotation.z = Math.sin(timeSec * 3.6 + phaseOffset) * 0.12
    companion.antennaeGroup.rotation.x = Math.cos(timeSec * 2.9 + phaseOffset) * 0.08
  }

  if (companion.tailGroup) {
    companion.tailGroup.rotation.y = Math.sin(timeSec * 4.2 + phaseOffset) * 0.28
  }

  if (companion.lanternMesh) {
    const pulse = 0.94 + 0.12 * (0.5 + 0.5 * Math.sin(timeSec * 4.2 + phaseOffset))
    companion.lanternMesh.scale.setScalar(pulse)
  }

  if (companion.butterfly) {
    const b = companion.butterfly
    b.group.position.set(
      b.baseX + Math.sin(timeSec * 2.4 + phaseOffset) * 0.06,
      b.baseY + Math.sin(timeSec * 4.6 + phaseOffset) * 0.08,
      b.baseZ + Math.cos(timeSec * 2.1 + phaseOffset) * 0.04,
    )
    b.group.rotation.y = Math.sin(timeSec * 3.8 + phaseOffset) * 0.35
  }

  for (const flake of companion.snowFlakes) {
    const cycle = (timeSec * flake.speed + flake.phase + phaseOffset * 0.1) % 1.0
    flake.mesh.position.set(
      flake.baseX + Math.sin(timeSec * 3.2 + flake.phase * 6.28) * flake.driftAmp,
      flake.topY - cycle * flake.fallRange,
      flake.baseZ + Math.cos(timeSec * 2.7 + flake.phase * 6.28) * flake.driftAmp,
    )
  }

  for (const puff of companion.steamPuffs) {
    const cycle = (timeSec * 0.55 + puff.phase) % 1.0
    puff.mesh.position.set(
      puff.baseX + Math.sin(timeSec * 2.2 + puff.phase) * 0.05,
      puff.baseY + cycle * 0.45,
      puff.baseZ,
    )
    const scale = 0.65 + (1 - cycle) * 0.45
    puff.mesh.scale.setScalar(scale)
  }
}

export function disposeBuiltCompanion(companion: BuiltCompanion): void {
  const sharedUnitBox = getUnitBoxGeometry()
  companion.group.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh &&
      obj.geometry &&
      obj.geometry !== steamGeom &&
      obj.geometry !== baseBox &&
      obj.geometry !== sharedUnitBox
    ) {
      obj.geometry.dispose()
    }
  })
}
