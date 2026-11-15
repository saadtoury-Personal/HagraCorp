import { Box3, Vector3, type Object3D } from 'three'

// Scene units: the Moon has radius 1. Sizes come from the team's data book (Maggie's Excel):
// volumetric mean radii Moon 1737.4 km, Earth 6371 km, Sun 695 700 km.
const MOON_KM = 1737.4
export const MOON_R = 1
export const EARTH_R = 6371 / MOON_KM // about 3.67
export const kmToUnits = (km: number) => km / MOON_KM

// The real Sun is 86 000 units away, far beyond the camera range, so it is drawn closer
// at its true angular size seen from the Moon (0.53 degrees). Direction is the real one.
export const SUN_DIST = 600
export const SUN_R = SUN_DIST * Math.tan(Math.atan(695700 / 149597870.7))

export const MODEL_URLS = {
  moon: '/models/Moon_LRO_clean.glb',
  earth: '/models/Earth_lite.glb',
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
