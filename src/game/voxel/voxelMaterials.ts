import * as THREE from 'three'

const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1)
const toonCache = new Map<string, THREE.MeshToonMaterial>()
const emissiveCache = new Map<string, THREE.MeshBasicMaterial>()

let sharedGradientMap: THREE.DataTexture | null = null

/**
 * 4-step discrete nearest-neighbor luminance gradient map for crisp
 * pixel-art cel shading on voxel faces without blurry gradients.
 */
export function getToonGradientMap(): THREE.DataTexture {
  if (!sharedGradientMap) {
    // 4 crisp light bands from soft cool shadow (~56%) up to full sunlit brightness (100%)
    const steps = [142, 186, 224, 255]
    const data = new Uint8Array(steps.length * 4)
    for (let i = 0; i < steps.length; i += 1) {
      const v = steps[i]
      data[i * 4] = v
      data[i * 4 + 1] = v
      data[i * 4 + 2] = v
      data[i * 4 + 3] = 255
    }
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.needsUpdate = true
    sharedGradientMap = tex
  }
  return sharedGradientMap
}

export function getUnitBoxGeometry(): THREE.BoxGeometry {
  return unitBoxGeometry
}

export function getVoxelMaterial(color: string, opacity = 1): THREE.MeshToonMaterial {
  const key = `${color}_${opacity}`
  let mat = toonCache.get(key)
  if (!mat) {
    mat = new THREE.MeshToonMaterial({
      color,
      gradientMap: getToonGradientMap(),
      transparent: opacity < 1,
      opacity,
    })
    toonCache.set(key, mat)
  }
  return mat
}

export function getEmissiveMaterial(color: string, opacity = 1, fog = true): THREE.MeshBasicMaterial {
  const key = `${color}_${opacity}_${fog ? 1 : 0}`
  let mat = emissiveCache.get(key)
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      fog,
    })
    emissiveCache.set(key, mat)
  }
  return mat
}

export function createVoxelMesh(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  emissive = false,
  opacity = 1,
  fog = true,
): THREE.Mesh {
  const mat = emissive ? getEmissiveMaterial(color, opacity, fog) : getVoxelMaterial(color, opacity)
  const mesh = new THREE.Mesh(unitBoxGeometry, mat)
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  return mesh
}

/**
 * Synchronizes an InstancedMesh count, visibility, and GPU upload flags safely
 * across graphics-quality transitions (High <-> Low).
 */
export function syncInstancedMeshState(
  mesh: THREE.InstancedMesh | null,
  count: number,
  visible: boolean,
): void {
  if (!mesh) return
  const safeCount = visible ? Math.max(0, count) : 0
  mesh.visible = visible && safeCount > 0
  mesh.count = safeCount
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true
  }
}
