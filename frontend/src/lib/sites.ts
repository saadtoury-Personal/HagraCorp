// Sites, horizon masks and visibility series.
// Everything here is real team data: site coordinates (NASA Lunar Surface Data Book), Sun and Earth positions (JPL Horizons table)
// and the horizon skylines computed from the LOLA terrain map (data/masks, one file per site and observer height).
import bodies from '../data/bodies.json'
import sitesJson from '../data/sites.json'
import { earthDistKm, earthVec, sunVec, toVec, type Vec3 } from './ephemeris'

const D2R = Math.PI / 180
export const STEP = 0.05 // days per sample
export const SPAN = 90 // days shown in the UI
const DAYS = 110 // samples run past SPAN so a window starting on day 90 is complete
export const N = Math.round(DAYS / STEP)
const MOON_KM = bodies.moonRadiusKm
/** The Sun counts as up when its upper edge clears the horizon (team document: "we test its upper edge"). Apparent radius from the Moon, degrees (Geometry.cs). */
export const SUN_EDGE_DEG = bodies.sunAngularRadiusDeg
/** Earth-Moon distance in lunar radii at day t, from the Horizons table. */
export const earthDistMoons = (t: number) => earthDistKm(t) / MOON_KM

// Skylines: 720 elevations per file, bin i = azimuth i * 0.5 degrees, for an observer 2 m and 10 m above the ground.
const MASK_FILES = import.meta.glob('../data/masks/*.json', { eager: true, import: 'default' }) as Record<string, number[]>
const MAST_LO = 2
const MAST_HI = 10
const skyline = (id: string, mast: number) => Float32Array.from(MASK_FILES[`../data/masks/${id}_${mast}m.json`] ?? new Array(720).fill(0))
/** Share of the 10 m skyline to use for a mast height (the data only exists for 2 m and 10 m, so heights in between are interpolated). */
const mastWeight = (mast: number) => Math.min(1, Math.max(0, (mast - MAST_LO) / (MAST_HI - MAST_LO)))
function bin(h: Float32Array, az: number) {
  const f = (((az % 360) + 360) % 360) * 2
  const i = Math.floor(f)
  const k = f - i
  return h[i % 720] * (1 - k) + h[(i + 1) % 720] * k
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

type SiteRow = { id: string; name: string; latDeg: number; lonDeg: number; category: string; terrain: boolean; notes?: string }
const SITE_DEF = sitesJson as SiteRow[]

export type Site = {
  i: number
  /** Same id as the server (LunarNav.Api /api/sites). */
  id: string
  name: string
  lat: number
  lonE: number
  category: string
  /** Source and caveats written with the site in the repo's sites.json (21 of the 32 have one). */
  notes?: string
  /** false = flat horizon (Apollo 11, outside the polar terrain map) */
  terrain: boolean
  /** Unit vector from the Moon's centre to the site, Moon-fixed frame. */
  q: Vec3
  n: Vec3
  e: Vec3
  /** Horizon elevation by azimuth (720 bins of 0.5 deg), observer 2 m and 10 m above the ground. */
  sky2: Float32Array
  sky10: Float32Array
  /** Elevation of the Sun and Earth over time, and the horizon in their direction for the 2 m and 10 m observer. */
  sEl: Float32Array
  sMk2: Float32Array
  sMk10: Float32Array
  eEl: Float32Array
  eMk2: Float32Array
  eMk10: Float32Array
}

/** Horizon elevation (degrees) at an azimuth, for an observer on a mast of the given height (metres). */
export const maskAt = (s: Site, az: number, mast: number) => {
  const w = mastWeight(mast)
  return bin(s.sky2, az) * (1 - w) + bin(s.sky10, az) * w
}
/** Horizon in the Sun's and in Earth's direction at sample k. */
export const sunMaskAt = (s: Site, k: number, mast: number) => {
  const w = mastWeight(mast)
  return s.sMk2[k] * (1 - w) + s.sMk10[k] * w
}
export const earthMaskAt = (s: Site, k: number, mast: number) => {
  const w = mastWeight(mast)
  return s.eMk2[k] * (1 - w) + s.eMk10[k] * w
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
const Dx: number[] = []
for (let k = 0; k < N; k++) {
  Sx.push(sunVec(k * STEP))
  Ex.push(earthVec(k * STEP))
  Dx.push(earthDistMoons(k * STEP))
}
export const bodiesAt = (t: number) => ({ sun: sunVec(t), earth: earthVec(t) })

export const SITES: Site[] = SITE_DEF.map(({ id, name, latDeg: lat, lonDeg: lonE, category, terrain, notes }, i) => {
  const q = toVec(lat, lonE)
  const P: Vec3 = [0, 1, 0]
  const pq = dot(P, q)
  const n = norm([P[0] - pq * q[0], P[1] - pq * q[1], P[2] - pq * q[2]])
  const e = cross(n, q)
  const sky2 = skyline(id, MAST_LO)
  const sky10 = skyline(id, MAST_HI)
  const s: Site = {
    i, id, name, lat, lonE, category, terrain, notes, q, n, e, sky2, sky10,
    sEl: new Float32Array(N), sMk2: new Float32Array(N), sMk10: new Float32Array(N),
    eEl: new Float32Array(N), eMk2: new Float32Array(N), eMk10: new Float32Array(N),
  }
  for (let k = 0; k < N; k++) {
    const a = azEl(s, Sx[k])
    const b = azEl(s, Ex[k], Dx[k])
    s.sEl[k] = a.el
    s.sMk2[k] = bin(sky2, a.az)
    s.sMk10[k] = bin(sky10, a.az)
    s.eEl[k] = b.el
    s.eMk2[k] = bin(sky2, b.az)
    s.eMk10[k] = bin(sky10, b.az)
  }
  return s
})

export type Series = { sun: Uint8Array; earth: Uint8Array; /** hours */ night: number }

const cache = new Map<number, Series[]>()
/** Visibility series for every site at a given mast height (m). Cached per mast. */
export function getSeries(mast: number): Series[] {
  const hit = cache.get(mast)
  if (hit) return hit
  const out = SITES.map((s) => {
    const sun = new Uint8Array(N)
    const earth = new Uint8Array(N)
    for (let k = 0; k < N; k++) {
      sun[k] = s.sEl[k] + SUN_EDGE_DEG > sunMaskAt(s, k, mast) ? 1 : 0
      earth[k] = s.eEl[k] > earthMaskAt(s, k, mast) ? 1 : 0
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
    pts.push(which === 'sun' ? azEl(s, Sx[k]) : azEl(s, Ex[k], Dx[k]))
  }
  return pts
}

/** Lowest and highest observer height the real skylines cover, metres. */
export const MAST_RANGE = [MAST_LO, MAST_HI] as const
