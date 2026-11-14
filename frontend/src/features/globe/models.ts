import { Box3, Vector3, type Object3D } from 'three'

// Radii relative to the Moon (1737.4 km). The GLBs ship at unrelated native scales
// (Moon r~1, Earth r=500), so each is normalised here. The Sun GLB (r=500 after its node scale)
// is not used: the Sun is a distant light, drawn as a plain emissive disc.
export const MOON_R = 1
export const EARTH_R = 6378.1 / 1737.4 // 3.67 : Earth is really 3.7x wider than the Moon

export const MODEL_URLS = {
  moon: '/models/Moon_NASA_LRO_15k_Grid_Small.glb',
  earth: '/models/Earth_1_12756.glb',
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
