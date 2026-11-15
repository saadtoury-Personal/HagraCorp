import { Box3, Vector3, type Object3D } from 'three'

// The Moon GLB ships at its own scale, so it is normalised to a radius of 1.
// Earth and Sun are not drawn in this view.
export const MOON_R = 1

export const MODEL_URLS = {
  moon: '/models/Moon_LRO_clean.glb',
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
