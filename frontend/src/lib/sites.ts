// Sites, horizon masks and visibility series, ported from Nazim's mockup (simplified analytic model).
// Site coordinates and Sun/Earth positions are real (team data). Horizons are still synthetic until the LOLA masks land.
import sitesJson from '../data/sites.json'
import { earthVec, sunVec, TAU, toVec, type Vec3 } from './ephemeris'

const D2R = Math.PI / 180
export const STEP = 0.05 // days per sample
export const SPAN = 90 // days shown in the UI
const DAYS = 110 // samples run past SPAN so a window starting on day 90 is complete
export const N = Math.round(DAYS / STEP)
const DIST_EM = 221.3 // Earth to Moon in lunar radii
const MAST_DEG = 0.04 // horizon lowering per metre of mast

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

type SiteRow = { id: string; name: string; latDeg: number; lonDeg: number; category: string; terrain: boolean }
const SITE_DEF = sitesJson as SiteRow[]

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

export type Site = {
  i: number
  name: string
  lat: number
  lonE: number
  category: string
  /** false = flat horizon (Apollo 11, outside the polar terrain map) */
  terrain: boolean
  /** Unit vector from the Moon's centre to the site, Moon-fixed frame. */
  q: Vec3
  n: Vec3
  e: Vec3
  mask: number[] // m0, m1, p1, m2, p2, m3, p3
  sEl: Float32Array
  sMk: Float32Array
  eEl: Float32Array
  eMk: Float32Array
}

export const maskAt = (s: Site, az: number) => {
  const a = az * D2R
  const [m0, m1, p1, m2, p2, m3, p3] = s.mask
  return m0 + m1 * Math.cos(a - p1) + m2 * Math.cos(2 * a - p2) + m3 * Math.cos(3 * a - p3)
}

/** Azimuth (deg from north, east-positive) and elevation (deg) of a body seen from a site. */
export function azEl(s: Site, v: Vec3, dist?: number) {
  const q = s.q
  let w: Vec3 = v
  let el: number
  if (dist) {
    const dq = dot(v, q)
    w = [dist * v[0] - q[0], dist * v[1] - q[1], dist * v[2] - q[2]]
    el = Math.asin(clamp((dist * dq - 1) / Math.hypot(...w), -1, 1))
  } else el = Math.asin(clamp(dot(v, q), -1, 1))
  let az = Math.atan2(dot(w, s.e), dot(w, s.n)) / D2R
  az = (az + 360) % 360
  return { az, el: el / D2R }
}

const Sx: Vec3[] = []
const Ex: Vec3[] = []
for (let k = 0; k < N; k++) {
  Sx.push(sunVec(k * STEP))
  Ex.push(earthVec(k * STEP))
}
export const bodiesAt = (t: number) => ({ sun: sunVec(t), earth: earthVec(t) })

export const SITES: Site[] = SITE_DEF.map(({ name, latDeg: lat, lonDeg: lonE, category, terrain }, i) => {
  const r = rng(i + 11)
  const q = toVec(lat, lonE)
  const P: Vec3 = [0, 1, 0]
  const pq = dot(P, q)
  const n = norm([P[0] - pq * q[0], P[1] - pq * q[1], P[2] - pq * q[2]])
  const e = cross(n, q)
  const mask = !terrain ? [0, 0, 0, 0, 0, 0, 0] : [-0.3 + r() * 2.1, 0.3 + r() * 0.7, r() * TAU, 0.2 + r() * 0.5, r() * TAU, 0.1 + r() * 0.3, r() * TAU]
  const s: Site = { i, name, lat, lonE, category, terrain, q, n, e, mask, sEl: new Float32Array(N), sMk: new Float32Array(N), eEl: new Float32Array(N), eMk: new Float32Array(N) }
  for (let k = 0; k < N; k++) {
    const a = azEl(s, Sx[k])
    const b = azEl(s, Ex[k], DIST_EM)
    s.sEl[k] = a.el
    s.sMk[k] = maskAt(s, a.az)
    s.eEl[k] = b.el
    s.eMk[k] = maskAt(s, b.az)
  }
  return s
})

export type Series = { sun: Uint8Array; earth: Uint8Array; /** hours */ night: number }

const cache = new Map<number, Series[]>()
/** Visibility series for every site at a given mast height (m). Cached per mast. */
export function getSeries(mast: number): Series[] {
  const hit = cache.get(mast)
  if (hit) return hit
  const m = mast * MAST_DEG
  const out = SITES.map((s) => {
    const sun = new Uint8Array(N)
    const earth = new Uint8Array(N)
    for (let k = 0; k < N; k++) {
      sun[k] = s.sEl[k] > s.sMk[k] - m ? 1 : 0
      earth[k] = s.eEl[k] > s.eMk[k] - m ? 1 : 0
    }
    let run = 0
    let best = 0
    for (let k = 0; k < SPAN / STEP; k++) {
      if (!sun[k]) best = Math.max(best, ++run)
      else run = 0
    }
    return { sun, earth, night: best * STEP * 24 }
  })
  cache.set(mast, out)
  return out
}

export const idxAt = (t: number) => clamp(Math.floor(t / STEP), 0, N - 1)

export function frac(arr: Uint8Array, t0: number, dur: number) {
  const a = Math.floor(t0 / STEP)
  const b = Math.min(N, Math.floor((t0 + dur) / STEP))
  let c = 0
  for (let k = a; k < b; k++) c += arr[k]
  return b > a ? c / (b - a) : 0
}

/** Percent of the window with the Sun up (E) and Earth in view (D). */
export const metrics = (sr: Series, t: number, dur: number) => ({ E: Math.round(100 * frac(sr.sun, t, dur)), D: Math.round(100 * frac(sr.earth, t, dur)) })

export type Verdict = { word: 'Viable' | 'Marginal' | 'Not viable'; tone: 'ok' | 'warn' | 'bad'; why: string }
export function verdict(E: number, D: number): Verdict {
  const m = Math.min(E, D)
  if (m >= 75) return { word: 'Viable', tone: 'ok', why: `Sunlit ${E}% and Earth in view ${D}% of the window: the mission can run almost continuously.` }
  if (m >= 45) return { word: 'Marginal', tone: 'warn', why: `Sunlit ${E}% and Earth in view ${D}% of the window: plan batteries and gaps in contact.` }
  return { word: 'Not viable', tone: 'bad', why: `Sunlit ${E}% and Earth in view ${D}% of the window: too much shadow or no line of sight to Earth.` }
}

export function timeToChange(arr: Uint8Array, t: number) {
  const k0 = idxAt(t)
  const cur = arr[k0]
  let k = k0
  while (k < N && arr[k] === cur) k++
  if (k >= N) return 'beyond the window'
  const d = (k - k0) * STEP
  const h = d * 24
  const w = cur ? 'sets' : 'rises'
  return h >= 48 ? `${w} in ${Math.floor(d)} d ${Math.round((d % 1) * 24)} h` : `${w} in ${Math.round(h)} h`
}

/** Sun or Earth track across the sky for a time window, sampled every `every` days. */
export function track(s: Site, which: 'sun' | 'earth', t0: number, dur: number, every = 0.25) {
  const pts: { az: number; el: number }[] = []
  for (let t = t0; t <= t0 + dur + 1e-9; t += every) {
    const k = idxAt(t)
    pts.push(which === 'sun' ? azEl(s, Sx[k]) : azEl(s, Ex[k], DIST_EM))
  }
  return pts
}

export const MAST_TO_DEG = MAST_DEG
