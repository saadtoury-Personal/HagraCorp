import { Box3, BufferGeometry, Float32BufferAttribute, Vector3, type Object3D } from 'three'
import bodies from '../../data/bodies.json'
import { earthDistKm, earthVec, sunDistKm, sunRadiusDeg, sunVec, type Vec3 } from '../../lib/ephemeris'
import { earthRadiusDeg } from '../../lib/sites'

// Scene units: the Moon has radius 1, centred on the origin, in the Moon-fixed frame of the Horizons table (x = sub-Earth point, y = north, z = west).
export const MOON_KM = bodies.moonRadiusKm

/** The Sun turns once per 25.4 days (sidereal rotation 609.12 h) on an axis tilted 7.25 degrees to the ecliptic. */
export const SUN_ROTATION_DAYS = bodies.sun.siderealRotationHours / 24

// The team's models (3Dobjets/), with their textures recompressed to JPEG so the page loads fast.
export const MODEL_URLS = {
  moon: '/models/Moon_LRO_clean.glb',
  earth: '/models/Earth.glb',
  sun: '/models/Sun.glb',
} as const

/**
 * Display scale, centred on the Moon so its own sky stays right:
 * directions are the Horizons ones, distances are compressed on a log scale (the Sun always stays farther than Earth),
 * and both discs are drawn MAG times their true apparent size seen from the Moon (so Earth stays 3.5 times the Sun).
 */
export const MAG = 4
export const displayDist = (km: number) => 1 + 0.36 * Math.log10(km / MOON_KM)
export const displayRadius = (dist: number, angRad: number) => dist * Math.tan(angRad) * MAG

export type Body = 'earth' | 'sun'
export type BodyPose = { dir: Vec3; dist: number; radius: number }
const D2R = Math.PI / 180

/** Where one body is drawn at day t: true direction, log distance, magnified true angular size. */
export function bodyAt(key: Body, t: number): BodyPose {
  const km = key === 'earth' ? earthDistKm(t) : sunDistKm(t)
  const angDeg = key === 'earth' ? earthRadiusDeg(km / MOON_KM) : sunRadiusDeg(t)
  const dist = displayDist(km)
  return { dir: key === 'earth' ? earthVec(t) : sunVec(t), dist, radius: displayRadius(dist, angDeg * D2R) }
}

/** Sun halo opacity at r disc radii from the centre: 0.5 at the limb, falling smoothly to 0 at HALO_R. Inside the disc it is hidden by the ball. */
export const HALO_R = 3
export const glowAlpha = (r: number) => (r <= 1 ? 0.5 : r >= HALO_R ? 0 : 0.5 * ((HALO_R - r) / (HALO_R - 1)) ** 2)

/** Scale `root` so its bounding sphere has the given radius, centred on the origin. Call it on a fresh clone, before it has a parent. */
export function normalise(root: Object3D, radius: number) {
  root.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(root)
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  const s = (2 * radius) / Math.max(size.x, size.y, size.z)
  root.position.sub(centre.multiplyScalar(s))
  root.scale.multiplyScalar(s)
  root.updateMatrixWorld(true) // new scale must be in the matrices before the first render
  return root
}

/**
 * The GLB mesh is only 64 segments wide, which smears the texture into a fan at the pole.
 * Same mapping as the GLB (u = 0.5 + lonE / 2pi, v = 0.5 - lat / pi, north at v = 0 since glTF textures are not flipped), with more segments.
 */
export function sphereGeometry(seg = 256, rings = 128) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= rings; j++) {
    const lat = Math.PI / 2 - (Math.PI * j) / rings
    for (let i = 0; i <= seg; i++) {
      const lon = Math.PI - (2 * Math.PI * i) / seg // west-positive, as z = west
      pos.push(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
      uv.push(i / seg, j / rings)
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i
      const b = a + seg + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(pos, 3)) // unit sphere: normal = position
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export type Census = { bodies: Record<string, { meshes: number; sprites: number }>; lights: Record<string, number> }

/** Counts meshes and sprites under each named body, and lights by type: one of each per body, or something is drawn twice. */
export function census(root: Object3D, names: string[] = ['moon', 'earth', 'sun']): Census {
  const out: Census = { bodies: Object.fromEntries(names.map((n) => [n, { meshes: 0, sprites: 0 }])), lights: {} }
  root.traverse((o) => {
    if ((o as { isLight?: boolean }).isLight) out.lights[o.type] = (out.lights[o.type] ?? 0) + 1
    let p: Object3D | null = o
    while (p && !names.includes(p.name)) p = p.parent
    if (!p) return
    const c = out.bodies[p.name]
    if ((o as { isSprite?: boolean }).isSprite) c.sprites++
    else if ((o as { isMesh?: boolean }).isMesh) c.meshes++
  })
  return out
}
