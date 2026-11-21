import * as THREE from 'three'

const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1)
const lambertCache = new Map<string, THREE.MeshLambertMaterial>()
const emissiveCache = new Map<string, THREE.MeshBasicMaterial>()

export function getUnitBoxGeometry(): THREE.BoxGeometry {
  return unitBoxGeometry
}

export function getVoxelMaterial(color: string, opacity = 1): THREE.MeshLambertMaterial {
  const key = `${color}_${opacity}`
  let mat = lambertCache.get(key)
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({
      color,
      transparent: opacity < 1,
      opacity,
    })
    lambertCache.set(key, mat)
  }
  return mat
}

export function getEmissiveMaterial(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const key = `${color}_${opacity}`
  let mat = emissiveCache.get(key)
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
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
): THREE.Mesh {
  const mat = emissive ? getEmissiveMaterial(color, opacity) : getVoxelMaterial(color, opacity)
  const mesh = new THREE.Mesh(unitBoxGeometry, mat)
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  return mesh
}
