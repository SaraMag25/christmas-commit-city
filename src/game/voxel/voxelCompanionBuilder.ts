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

interface FaceAnchorPoint extends AnchorPoint {
  eyeSpan: number
}

interface CompanionRig {
  headAnchor: AnchorPoint
  faceAnchor: FaceAnchorPoint
  neckAnchor: AnchorPoint
  backAnchor: AnchorPoint
  handAnchor: AnchorPoint
  height: number
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
  height: number
}

const SPECIES_RIGS: Record<CompanionSpeciesId, CompanionRig> = {
  frog: {
    headAnchor: { x: 0, y: 0.72, z: 0.04, scale: 1.0 },
    faceAnchor: { x: 0, y: 0.62, z: 0.36, scale: 1.0, eyeSpan: 0.42 },
    neckAnchor: { x: 0, y: 0.41, z: 0.02, scale: 1.24 },
    backAnchor: { x: 0, y: 0.36, z: -0.34, scale: 1.0 },
    handAnchor: { x: 0.46, y: 0.36, z: 0.22, scale: 1.0 },
    height: 1.05,
  },
  otter: {
    headAnchor: { x: 0, y: 1.06, z: 0.04, scale: 0.92 },
    faceAnchor: { x: 0, y: 0.86, z: 0.32, scale: 0.92, eyeSpan: 0.28 },
    neckAnchor: { x: 0, y: 0.62, z: 0.06, scale: 0.92 },
    backAnchor: { x: 0, y: 0.5, z: -0.26, scale: 0.95 },
    handAnchor: { x: 0.38, y: 0.48, z: 0.24, scale: 0.95 },
    height: 1.25,
  },
  snake: {
    headAnchor: { x: 0, y: 0.96, z: 0.08, scale: 0.88 },
    faceAnchor: { x: 0, y: 0.81, z: 0.34, scale: 0.88, eyeSpan: 0.28 },
    neckAnchor: { x: 0, y: 0.56, z: 0.06, scale: 0.84 },
    backAnchor: { x: 0, y: 0.42, z: -0.2, scale: 0.86 },
    handAnchor: { x: 0.42, y: 0.44, z: 0.2, scale: 0.92 },
    height: 1.18,
  },
  capybara: {
    headAnchor: { x: 0, y: 0.94, z: 0.2, scale: 0.98 },
    faceAnchor: { x: 0, y: 0.76, z: 0.54, scale: 0.96, eyeSpan: 0.32 },
    neckAnchor: { x: 0, y: 0.54, z: 0.14, scale: 1.16 },
    backAnchor: { x: 0, y: 0.56, z: -0.2, scale: 1.06 },
    handAnchor: { x: 0.42, y: 0.38, z: 0.34, scale: 1.0 },
    height: 1.15,
  },
  mouse: {
    headAnchor: { x: 0, y: 0.92, z: 0.06, scale: 0.86 },
    faceAnchor: { x: 0, y: 0.7, z: 0.34, scale: 0.88, eyeSpan: 0.26 },
    neckAnchor: { x: 0, y: 0.48, z: 0.06, scale: 0.88 },
    backAnchor: { x: 0, y: 0.4, z: -0.22, scale: 0.88 },
    handAnchor: { x: 0.36, y: 0.38, z: 0.22, scale: 0.9 },
    height: 1.12,
  },
  cat: {
    headAnchor: { x: 0, y: 0.98, z: 0.06, scale: 0.88 },
    faceAnchor: { x: 0, y: 0.78, z: 0.31, scale: 0.88, eyeSpan: 0.28 },
    neckAnchor: { x: 0, y: 0.56, z: 0.06, scale: 0.88 },
    backAnchor: { x: 0, y: 0.44, z: -0.22, scale: 0.9 },
    handAnchor: { x: 0.36, y: 0.4, z: 0.22, scale: 0.9 },
    height: 1.2,
  },
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

function buildSpeciesBoxes(species: CompanionSpeciesId, boxes: ColoredBox[]): void {
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
    return
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
    return
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
    return
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
    return
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
    return
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
  anchor: AnchorPoint,
  boxes: ColoredBox[],
  staticEmissiveBoxes: ColoredBox[],
): HeadAccessoryResult {
  const { x, y, z, scale } = anchor
  const emptyResult: HeadAccessoryResult = { butterfly: null, snowDomeGroup: null, snowFlakes: [] }

  if (id === 'dev_headset') {
    // Sleek dark over-ear arch + padded cups on left/right sides + neon LED rings + boom mic
    const spanX = 0.31 * scale
    const cupY = y - 0.16 * scale
    const cupZ = z + 0.05 * scale

    // Top padded headband arch
    boxes.push({ x, y: y + 0.075 * scale, z, sx: 0.62 * scale, sy: 0.065 * scale, sz: 0.11 * scale, color: '#1e293b' })
    boxes.push({ x, y: y + 0.095 * scale, z, sx: 0.34 * scale, sy: 0.04 * scale, sz: 0.09 * scale, color: '#334155' })
    // Side vertical arch struts connecting down to earcups
    boxes.push({ x: x - spanX, y: y - 0.03 * scale, z: cupZ, sx: 0.055 * scale, sy: 0.24 * scale, sz: 0.08 * scale, color: '#1e293b' })
    boxes.push({ x: x + spanX, y: y - 0.03 * scale, z: cupZ, sx: 0.055 * scale, sy: 0.24 * scale, sz: 0.08 * scale, color: '#1e293b' })
    // Left & right over-ear cushions + outer shells
    boxes.push({ x: x - spanX, y: cupY, z: cupZ, sx: 0.095 * scale, sy: 0.2 * scale, sz: 0.2 * scale, color: '#0f172a' })
    boxes.push({ x: x + spanX, y: cupY, z: cupZ, sx: 0.095 * scale, sy: 0.2 * scale, sz: 0.2 * scale, color: '#0f172a' })
    boxes.push({ x: x - (spanX + 0.025 * scale), y: cupY, z: cupZ, sx: 0.055 * scale, sy: 0.15 * scale, sz: 0.15 * scale, color: '#1e293b' })
    boxes.push({ x: x + (spanX + 0.025 * scale), y: cupY, z: cupZ, sx: 0.055 * scale, sy: 0.15 * scale, sz: 0.15 * scale, color: '#1e293b' })
    // Glowing neon RGB LED rings (cyan left, neon-green right)
    staticEmissiveBoxes.push({
      x: x - (spanX + 0.05 * scale),
      y: cupY,
      z: cupZ,
      sx: 0.025 * scale,
      sy: 0.1 * scale,
      sz: 0.1 * scale,
      color: '#38bdf8',
    })
    staticEmissiveBoxes.push({
      x: x + (spanX + 0.05 * scale),
      y: cupY,
      z: cupZ,
      sx: 0.025 * scale,
      sy: 0.1 * scale,
      sz: 0.1 * scale,
      color: '#39d353',
    })
    // Adjustable boom mic arm extending forward toward cheek/mouth + subtle neon mic tip
    boxes.push({
      x: x + spanX,
      y: cupY - 0.05 * scale,
      z: cupZ + 0.14 * scale,
      sx: 0.03 * scale,
      sy: 0.03 * scale,
      sz: 0.18 * scale,
      color: '#334155',
    })
    boxes.push({
      x: x + spanX - 0.06 * scale,
      y: cupY - 0.06 * scale,
      z: cupZ + 0.24 * scale,
      sx: 0.13 * scale,
      sy: 0.03 * scale,
      sz: 0.03 * scale,
      color: '#1e293b',
    })
    staticEmissiveBoxes.push({
      x: x + spanX - 0.125 * scale,
      y: cupY - 0.06 * scale,
      z: cupZ + 0.24 * scale,
      sx: 0.042 * scale,
      sy: 0.042 * scale,
      sz: 0.042 * scale,
      color: '#38bdf8',
    })
    return emptyResult
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
    const bx = x + 0.38 * scale
    const by = y + 0.28 * scale
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

  if (id === 'wizard-hat') {
    boxes.push({ x, y: y + 0.04 * scale, z, sx: 0.76 * scale, sy: 0.09 * scale, sz: 0.76 * scale, color: '#6d28d9' })
    boxes.push({ x, y: y + 0.14 * scale, z, sx: 0.48 * scale, sy: 0.11 * scale, sz: 0.48 * scale, color: '#fbbf24' })
    boxes.push({ x, y: y + 0.14 * scale, z: z + 0.25 * scale, sx: 0.16 * scale, sy: 0.12 * scale, sz: 0.05 * scale, color: '#fde047' })
    boxes.push({ x, y: y + 0.29 * scale, z: z - 0.02 * scale, sx: 0.42 * scale, sy: 0.2 * scale, sz: 0.42 * scale, color: '#7c3aed' })
    boxes.push({ x: x + 0.04 * scale, y: y + 0.46 * scale, z: z - 0.06 * scale, sx: 0.26 * scale, sy: 0.18 * scale, sz: 0.26 * scale, color: '#6d28d9' })
    boxes.push({ x: x + 0.1 * scale, y: y + 0.6 * scale, z: z - 0.12 * scale, sx: 0.14 * scale, sy: 0.14 * scale, sz: 0.14 * scale, color: '#8b5cf6' })
    return emptyResult
  }

  if (id === 'strawberry-hat') {
    boxes.push({ x, y: y + 0.05 * scale, z, sx: 0.56 * scale, sy: 0.16 * scale, sz: 0.56 * scale, color: '#ef4444' })
    boxes.push({ x, y: y + 0.19 * scale, z, sx: 0.44 * scale, sy: 0.14 * scale, sz: 0.44 * scale, color: '#dc2626' })
    boxes.push({ x: x - 0.16 * scale, y: y + 0.08 * scale, z: z + 0.28 * scale, sx: 0.07 * scale, sy: 0.07 * scale, sz: 0.04 * scale, color: '#fef3c7' })
    boxes.push({ x: x + 0.14 * scale, y: y + 0.12 * scale, z: z + 0.28 * scale, sx: 0.07 * scale, sy: 0.07 * scale, sz: 0.04 * scale, color: '#fef3c7' })
    boxes.push({ x, y: y + 0.28 * scale, z, sx: 0.34 * scale, sy: 0.08 * scale, sz: 0.34 * scale, color: '#22c55e' })
    boxes.push({ x, y: y + 0.36 * scale, z, sx: 0.1 * scale, sy: 0.12 * scale, sz: 0.1 * scale, color: '#15803d' })
    return emptyResult
  }

  if (id === 'leaf-umbrella') {
    boxes.push({ x: x + 0.12 * scale, y: y + 0.18 * scale, z: z - 0.04 * scale, sx: 0.08 * scale, sy: 0.38 * scale, sz: 0.08 * scale, color: '#7c4d2b' })
    boxes.push({ x, y: y + 0.38 * scale, z, sx: 0.84 * scale, sy: 0.1 * scale, sz: 0.78 * scale, color: '#16a34a' })
    boxes.push({ x, y: y + 0.44 * scale, z, sx: 0.62 * scale, sy: 0.06 * scale, sz: 0.58 * scale, color: '#22c55e' })
    boxes.push({ x, y: y + 0.48 * scale, z, sx: 0.1 * scale, sy: 0.04 * scale, sz: 0.62 * scale, color: '#4ade80' })
    return emptyResult
  }

  // 'santa-hat'
  boxes.push({ x, y: y + 0.04 * scale, z, sx: 0.58 * scale, sy: 0.12 * scale, sz: 0.58 * scale, color: '#f4f8ff' })
  boxes.push({ x, y: y + 0.18 * scale, z, sx: 0.46 * scale, sy: 0.16 * scale, sz: 0.46 * scale, color: '#dc2626' })
  boxes.push({ x: x + 0.08 * scale, y: y + 0.32 * scale, z: z - 0.04 * scale, sx: 0.32 * scale, sy: 0.16 * scale, sz: 0.32 * scale, color: '#ef4444' })
  boxes.push({ x: x + 0.22 * scale, y: y + 0.38 * scale, z: z - 0.1 * scale, sx: 0.16 * scale, sy: 0.16 * scale, sz: 0.16 * scale, color: '#ffffff' })
  return emptyResult
}

interface TorsoFitSpec {
  body: { x: number; y: number; z: number; sx: number; sy: number; sz: number }
  hood: { x: number; y: number; z: number; sx: number; sy: number; sz: number }
}

const TORSO_APPAREL_FITS: Record<CompanionSpeciesId, TorsoFitSpec> = {
  frog: {
    body: { x: 0, y: 0.29, z: 0.01, sx: 0.72, sy: 0.29, sz: 0.7 },
    hood: { x: 0, y: 0.44, z: -0.34, sx: 0.56, sy: 0.14, sz: 0.16 },
  },
  otter: {
    body: { x: 0, y: 0.35, z: 0.01, sx: 0.61, sy: 0.44, sz: 0.58 },
    hood: { x: 0, y: 0.56, z: -0.29, sx: 0.5, sy: 0.15, sz: 0.16 },
  },
  snake: {
    body: { x: 0, y: 0.42, z: 0.05, sx: 0.44, sy: 0.3, sz: 0.46 },
    hood: { x: 0, y: 0.56, z: -0.18, sx: 0.4, sy: 0.13, sz: 0.14 },
  },
  capybara: {
    body: { x: 0, y: 0.36, z: 0.0, sx: 0.72, sy: 0.34, sz: 0.86 },
    hood: { x: 0, y: 0.62, z: -0.1, sx: 0.56, sy: 0.15, sz: 0.18 },
  },
  mouse: {
    body: { x: 0, y: 0.3, z: 0.01, sx: 0.56, sy: 0.36, sz: 0.53 },
    hood: { x: 0, y: 0.48, z: -0.26, sx: 0.46, sy: 0.14, sz: 0.15 },
  },
  cat: {
    body: { x: 0, y: 0.33, z: 0.01, sx: 0.55, sy: 0.39, sz: 0.52 },
    hood: { x: 0, y: 0.52, z: -0.24, sx: 0.46, sy: 0.14, sz: 0.14 },
  },
}

function buildBodyAccessory(
  id: BodyAccessoryId,
  species: CompanionSpeciesId,
  rig: CompanionRig,
  boxes: ColoredBox[],
  staticEmissiveBoxes: ColoredBox[],
): THREE.Group | null {
  if (id === 'code_visor') {
    const { x, y, z, scale, eyeSpan } = rig.faceAnchor
    const visorWidth = Math.max(0.46, eyeSpan + 0.22) * scale
    const sideOffset = visorWidth * 0.5

    // Sleek dark top frame & side temple straps gripping the head
    boxes.push({
      x,
      y: y + 0.095 * scale,
      z: z + 0.035,
      sx: visorWidth + 0.04,
      sy: 0.045 * scale,
      sz: 0.075,
      color: '#0f172a',
    })
    boxes.push({
      x: x - sideOffset,
      y: y + 0.02 * scale,
      z: z - 0.12,
      sx: 0.04 * scale,
      sy: 0.06 * scale,
      sz: 0.3,
      color: '#1e293b',
    })
    boxes.push({
      x: x + sideOffset,
      y: y + 0.02 * scale,
      z: z - 0.12,
      sx: 0.04 * scale,
      sy: 0.06 * scale,
      sz: 0.3,
      color: '#1e293b',
    })

    // Micro glowing neon-green simulated log/code lines projected onto visor
    const lineZ = z + 0.072
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
      z + 0.04,
      visorWidth,
      0.17 * scale,
      0.055,
      codeVisorGlassMat,
    )
    return visorGlassGroup
  }

  if (id === 'binary_sweater') {
    const fit = TORSO_APPAREL_FITS[species]
    const b = fit.body
    const chestZ = b.z + b.sz * 0.5 + 0.014

    // Cozy deep-navy holiday knit sweater + festive crimson collar & ribbed hem trim
    boxes.push({ ...b, color: '#1e3a8a' })
    boxes.push({
      x: b.x,
      y: b.y - b.sy * 0.43,
      z: b.z,
      sx: b.sx + 0.025,
      sy: 0.065,
      sz: b.sz + 0.025,
      color: '#b91c1c',
    })
    boxes.push({
      x: b.x,
      y: b.y + b.sy * 0.42,
      z: b.z,
      sx: b.sx * 0.92,
      sy: 0.06,
      sz: b.sz * 0.94,
      color: '#dc2626',
    })

    // Binary pixel `0` (left) and `1` (right) in glowing gold & emerald on belly
    const cy = b.y + 0.02
    const bz = chestZ + 0.005
    // `0` around x = -0.10
    staticEmissiveBoxes.push({ x: -0.145, y: cy, z: bz, sx: 0.022, sy: 0.085, sz: 0.018, color: '#fbbf24' })
    staticEmissiveBoxes.push({ x: -0.075, y: cy, z: bz, sx: 0.022, sy: 0.085, sz: 0.018, color: '#fbbf24' })
    staticEmissiveBoxes.push({ x: -0.11, y: cy + 0.036, z: bz, sx: 0.065, sy: 0.022, sz: 0.018, color: '#fbbf24' })
    staticEmissiveBoxes.push({ x: -0.11, y: cy - 0.036, z: bz, sx: 0.065, sy: 0.022, sz: 0.018, color: '#fbbf24' })
    // `1` around x = +0.005
    staticEmissiveBoxes.push({ x: 0.005, y: cy, z: bz, sx: 0.024, sy: 0.09, sz: 0.018, color: '#4ade80' })
    staticEmissiveBoxes.push({ x: -0.012, y: cy + 0.03, z: bz, sx: 0.03, sy: 0.02, sz: 0.018, color: '#4ade80' })

    // Mini conference lanyard & white tech badge hanging on front chest
    const bx = 0.125
    const by = b.y - 0.01
    boxes.push({ x: bx - 0.035, y: b.y + b.sy * 0.24, z: chestZ, sx: 0.02, sy: b.sy * 0.36, sz: 0.018, color: '#38bdf8' })
    boxes.push({ x: bx + 0.035, y: b.y + b.sy * 0.24, z: chestZ, sx: 0.02, sy: b.sy * 0.36, sz: 0.018, color: '#38bdf8' })
    boxes.push({ x: bx, y: by, z: chestZ + 0.012, sx: 0.115, sy: 0.13, sz: 0.024, color: '#f8fafc' })
    boxes.push({ x: bx, y: by + 0.048, z: chestZ + 0.016, sx: 0.115, sy: 0.03, sz: 0.024, color: '#ef4444' })
    boxes.push({ x: bx, y: by - 0.01, z: chestZ + 0.026, sx: 0.075, sy: 0.022, sz: 0.012, color: '#0f172a' })
    return null
  }

  if (id === 'dev_hoodie') {
    const fit = TORSO_APPAREL_FITS[species]
    const b = fit.body
    const h = fit.hood

    // GitHub Dark fleece torso, ribbed hem trim, kangaroo pocket & side shoulder accents
    boxes.push({ ...b, color: '#161b22' })
    boxes.push({
      x: b.x,
      y: b.y - b.sy * 0.44,
      z: b.z,
      sx: b.sx + 0.02,
      sy: 0.06,
      sz: b.sz + 0.02,
      color: '#30363d',
    })
    boxes.push({
      x: b.x,
      y: b.y - b.sy * 0.22,
      z: b.z + b.sz * 0.5 + 0.012,
      sx: b.sx * 0.58,
      sy: b.sy * 0.3,
      sz: 0.03,
      color: '#21262d',
    })
    // Subtle hoodie drawstring cords on front neckline
    const chestZ = b.z + b.sz * 0.5 + 0.014
    boxes.push({
      x: b.x - 0.08,
      y: b.y + b.sy * 0.35,
      z: chestZ,
      sx: 0.025,
      sy: 0.09,
      sz: 0.02,
      color: '#cbd5e1',
    })
    boxes.push({
      x: b.x + 0.08,
      y: b.y + b.sy * 0.35,
      z: chestZ,
      sx: 0.025,
      sy: 0.09,
      sz: 0.02,
      color: '#cbd5e1',
    })
    // Folded cozy hood collar tucked behind the neck/shoulders
    boxes.push({ ...h, color: '#161b22' })
    boxes.push({
      x: h.x,
      y: h.y + h.sy * 0.35,
      z: h.z + 0.01,
      sx: h.sx * 0.86,
      sy: 0.05,
      sz: h.sz * 0.82,
      color: '#21262d',
    })

    // Glowing GitHub neon-green pixel terminal emblem `>_` on the front chest
    const cy = b.y + b.sy * 0.16
    const cz = b.z + b.sz * 0.5 + 0.018
    staticEmissiveBoxes.push({ x: -0.075, y: cy + 0.026, z: cz, sx: 0.032, sy: 0.024, sz: 0.02, color: '#39d353' })
    staticEmissiveBoxes.push({ x: -0.045, y: cy, z: cz, sx: 0.032, sy: 0.024, sz: 0.02, color: '#39d353' })
    staticEmissiveBoxes.push({ x: -0.075, y: cy - 0.026, z: cz, sx: 0.032, sy: 0.024, sz: 0.02, color: '#39d353' })
    staticEmissiveBoxes.push({ x: 0.048, y: cy - 0.03, z: cz, sx: 0.088, sy: 0.024, sz: 0.02, color: '#39d353' })
    return null
  }

  if (id === 'round-glasses') {
    const { x, y, z, scale, eyeSpan } = rig.faceAnchor
    const halfSpan = eyeSpan * 0.5
    const rimSize = 0.2 * scale
    const lensSize = 0.13 * scale

    boxes.push({ x: x - halfSpan, y, z: z + 0.03, sx: rimSize, sy: rimSize, sz: 0.06, color: '#1e293b' })
    boxes.push({ x: x + halfSpan, y, z: z + 0.03, sx: rimSize, sy: rimSize, sz: 0.06, color: '#1e293b' })
    boxes.push({ x: x - halfSpan, y, z: z + 0.045, sx: lensSize, sy: lensSize, sz: 0.05, color: '#bae6fd' })
    boxes.push({ x: x + halfSpan, y, z: z + 0.045, sx: lensSize, sy: lensSize, sz: 0.05, color: '#bae6fd' })
    boxes.push({ x, y: y + 0.02, z: z + 0.035, sx: Math.max(0.08, eyeSpan - rimSize), sy: 0.05, sz: 0.05, color: '#fbbf24' })
    return null
  }

  if (id === 'wizard-cloak') {
    const n = rig.neckAnchor
    const b = rig.backAnchor
    boxes.push({ x: n.x, y: n.y, z: n.z, sx: 0.62 * n.scale, sy: 0.12, sz: 0.54 * n.scale, color: '#7c3aed' })
    boxes.push({ x: n.x, y: n.y - 0.02, z: n.z + 0.28 * n.scale, sx: 0.14, sy: 0.12, sz: 0.06, color: '#fde047' })
    boxes.push({ x: b.x, y: b.y, z: b.z, sx: 0.64 * b.scale, sy: 0.48, sz: 0.14, color: '#6d28d9' })
    boxes.push({ x: b.x, y: b.y - 0.18, z: b.z - 0.06, sx: 0.72 * b.scale, sy: 0.2, sz: 0.12, color: '#5b21b6' })
    boxes.push({ x: b.x - 0.16, y: b.y - 0.06, z: b.z - 0.08, sx: 0.07, sy: 0.07, sz: 0.04, color: '#fde047' })
    boxes.push({ x: b.x + 0.18, y: b.y + 0.08, z: b.z - 0.08, sx: 0.07, sy: 0.07, sz: 0.04, color: '#fde047' })
    return null
  }

  const n = rig.neckAnchor
  const frontZ = n.z + 0.28 * n.scale
  // Deep spruce-evergreen collar band wrapping clearly outside torso + warm golden sprout clasp & hanging leaf tails
  boxes.push({ x: n.x, y: n.y, z: n.z, sx: 0.64 * n.scale, sy: 0.14, sz: 0.56 * n.scale, color: '#064e3b' })
  boxes.push({ x: n.x, y: n.y + 0.04, z: n.z, sx: 0.66 * n.scale, sy: 0.06, sz: 0.58 * n.scale, color: '#15803d' })
  boxes.push({ x: n.x + 0.13 * n.scale, y: n.y - 0.13, z: frontZ + 0.02, sx: 0.17, sy: 0.24, sz: 0.09, color: '#064e3b' })
  boxes.push({ x: n.x + 0.14 * n.scale, y: n.y - 0.18, z: frontZ + 0.035, sx: 0.12, sy: 0.14, sz: 0.08, color: '#4ade80' })
  boxes.push({ x: n.x - 0.09 * n.scale, y: n.y - 0.08, z: frontZ + 0.02, sx: 0.14, sy: 0.16, sz: 0.08, color: '#15803d' })
  boxes.push({ x: n.x + 0.04 * n.scale, y: n.y, z: frontZ + 0.04, sx: 0.11, sy: 0.1, sz: 0.06, color: '#fbbf24' })
  boxes.push({ x: n.x + 0.04 * n.scale, y: n.y + 0.03, z: frontZ + 0.055, sx: 0.06, sy: 0.06, sz: 0.04, color: '#ef4444' })
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
 * Modular 3D voxel companion builder supporting 6 species and 20 accessories
 * (head/body/hand) snapped onto per-species rig anchors.
 */
export function buildVoxelCompanion(
  species: CompanionSpeciesId,
  equipped: EquippedAccessories,
): BuiltCompanion {
  const rig = SPECIES_RIGS[species]
  const group = new THREE.Group()
  const bodyGroup = new THREE.Group()
  group.add(bodyGroup)

  const staticBoxes: ColoredBox[] = []
  const staticEmissiveBoxes: ColoredBox[] = []
  const emissiveBoxes: ColoredBox[] = []

  buildSpeciesBoxes(species, staticBoxes)

  let butterfly: ButterflyHandle | null = null
  let snowDomeGroup: THREE.Group | null = null
  let snowFlakes: SnowFlakeHandle[] = []
  if (equipped.head) {
    const headResult = buildHeadAccessory(
      equipped.head,
      rig.headAnchor,
      staticBoxes,
      staticEmissiveBoxes,
    )
    butterfly = headResult.butterfly
    snowDomeGroup = headResult.snowDomeGroup
    snowFlakes = headResult.snowFlakes
    if (butterfly) {
      bodyGroup.add(butterfly.group)
    }
  }

  let visorGlassGroup: THREE.Group | null = null
  if (equipped.body) {
    visorGlassGroup = buildBodyAccessory(
      equipped.body,
      species,
      rig,
      staticBoxes,
      staticEmissiveBoxes,
    )
  }

  let lanternMesh: THREE.Mesh | null = null
  const steamPuffs: SteamPuffHandle[] = []

  if (equipped.hand) {
    const handMeta = buildHandAccessory(
      equipped.hand,
      rig.handAnchor,
      staticBoxes,
      emissiveBoxes,
      staticEmissiveBoxes,
    )

    if (emissiveBoxes.length > 0) {
      lanternMesh = mergeColoredBoxes(emissiveBoxes, companionEmissiveMat)
      bodyGroup.add(lanternMesh)
    }

    if (handMeta.steamAnchor) {
      const steamMat = getVoxelMaterial('#f4f8ff', 0.65)
      for (let i = 0; i < 3; i += 1) {
        const puff = new THREE.Mesh(steamGeom, steamMat)
        puff.position.set(
          handMeta.steamAnchor.x,
          handMeta.steamAnchor.y + i * 0.16,
          handMeta.steamAnchor.z,
        )
        bodyGroup.add(puff)
        steamPuffs.push({
          mesh: puff,
          baseX: handMeta.steamAnchor.x,
          baseY: handMeta.steamAnchor.y,
          baseZ: handMeta.steamAnchor.z,
          phase: i * 0.8,
        })
      }
    }
  }

  bodyGroup.add(mergeColoredBoxes(staticBoxes, companionStaticMat))

  if (staticEmissiveBoxes.length > 0) {
    bodyGroup.add(mergeColoredBoxes(staticEmissiveBoxes, companionEmissiveMat))
  }

  // Add translucent snow dome and holographic visor after opaque boxes so interior/eyes remain cleanly visible
  if (snowDomeGroup) {
    bodyGroup.add(snowDomeGroup)
  }
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
    height: rig.height,
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
