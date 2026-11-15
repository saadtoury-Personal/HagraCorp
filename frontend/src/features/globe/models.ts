import { Box3, Vector3, type Object3D } from 'three'
import bodies from '../../data/bodies.json'

// Scene units: the Moon has radius 1. Every size, rotation and tilt below is read from the repo's own data
// (data/bodies.json: Maggie's workbook and LunarNav.Core/Geometry.cs), and the distances from the Horizons table. Nothing is typed in here.
export const MOON_KM = bodies.moonRadiusKm
export const MOON_R = 1
export const kmToUnits = (km: number) => km / MOON_KM

/** Earth at its real size relative to the Moon (about 3.67 times as large). */
export const EARTH_R = kmToUnits(bodies.earth.meanRadiusKm)
/** Earth turns once per sidereal day, 23.9345 h, on an axis tilted 23.44 degrees. */
export const EARTH_ROTATION_DAYS = bodies.earth.siderealRotationHours / 24
export const EARTH_OBLIQUITY_DEG = bodies.earth.obliquityDeg

// The Sun at its real size and its real distance. The radius is the workbook's (about 400 Moon radii); the distance follows from it
// and from the Sun's angular radius seen from the Moon in Geometry.cs (0.2666 degrees): about 149.5 million km, or 86 000 units.
// The camera range and a logarithmic depth buffer (see MoonScene) make this possible.
export const SUN_R = kmToUnits(bodies.sun.meanRadiusKm)
export const SUN_DIST = SUN_R / Math.tan((bodies.sunAngularRadiusDeg * Math.PI) / 180)
/** The Sun turns once per 25.4 days (sidereal rotation 609.12 h) on an axis tilted 7.25 degrees to the ecliptic. */
export const SUN_ROTATION_DAYS = bodies.sun.siderealRotationHours / 24
export const SUN_OBLIQUITY_DEG = bodies.sun.obliquityDeg

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
