import { Box3, Vector3, type Object3D } from 'three'

// The Moon GLB ships at its own scale, so it is normalised to a radius of 1.
export const MOON_R = 1
// Earth is drawn at its true size ratio to the Moon (12,742 km vs 3,474 km). Only the distance is compressed:
// the real one is about 221 lunar radii, which would put Earth far outside the frame.
export const EARTH_R = 3.67 * MOON_R
export const EARTH_D = 5.2 * MOON_R
export const EARTH_TILT = 23.44 // degrees, Earth's axial tilt

export const MODEL_URLS = {
  moon: '/models/Moon_NASA_LRO_15k_Grid_Small.glb',
} as const

/** Scale `root` so its bounding sphere has the given radius, centred on the origin. */
export function normalise(root: Object3D, radius: number) {
  root.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(root)
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  const s = (2 * radius) / Math.max(size.x, size.y, size.z)
  root.position.sub(centre.multiplyScalar(s))
  root.scale.multiplyScalar(s)
  root.updateMatrixWorld(true) // new scale must be in the matrices before the first render
}
