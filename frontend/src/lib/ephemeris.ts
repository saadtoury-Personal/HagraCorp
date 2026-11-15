// Sun and Earth in the Moon-fixed frame, from the team's JPL Horizons table (hourly, Moon Mean Earth frame).
// x = sub-Earth point (lon 0, lat 0), y = lunar north, z = west. Window: 14 Nov 2026 to 10 Mar 2027.
import ephemCsv from '../data/ephem-window.csv?raw'

export const TAU = Math.PI * 2
const D2R = Math.PI / 180
const SYN = 29.530588

/** Day 0 of the timeline. */
export const EPOCH = Date.UTC(2026, 10, 14, 18, 40)
export const SPAN_DAYS = 90

export type Vec3 = [number, number, number]

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
// East-positive sub-point to a unit vector in our frame (z = west).
export const toVec = (latDeg: number, lonEastDeg: number): Vec3 => {
  const la = latDeg * D2R
  const lo = lonEastDeg * D2R
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)]
}

const rows = ephemCsv
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [utc, sLat, sLon, eLat, eLon, km] = line.split(',')
    return { day: (Date.parse(utc) - EPOCH) / 86400000, sLat: +sLat, sLon: wrap180(+sLon), eLat: +eLat, eLon: wrap180(+eLon), km: +km }
  })
const T0 = rows[0].day
const STEP_D = rows[1].day - rows[0].day

/** Interpolate one table column between the two hourly rows around day t (longitudes wrap). */
function at(t: number) {
  const f = Math.min(rows.length - 1.001, Math.max(0, (t - T0) / STEP_D))
  const i = Math.floor(f)
  const k = f - i
  const a = rows[i]
  const b = rows[i + 1]
  const mix = (x: number, y: number) => x + (y - x) * k
  const mixLon = (x: number, y: number) => wrap180(x + wrap180(y - x) * k)
  return { sLat: mix(a.sLat, b.sLat), sLon: mixLon(a.sLon, b.sLon), eLat: mix(a.eLat, b.eLat), eLon: mixLon(a.eLon, b.eLon), km: mix(a.km, b.km) }
}

export const sunVec = (t: number): Vec3 => {
  const r = at(t)
  return toVec(r.sLat, r.sLon)
}
export const earthVec = (t: number): Vec3 => {
  const r = at(t)
  return toVec(r.eLat, r.eLon)
}
export const libration = (t: number) => {
  const r = at(t)
  return { lat: r.eLat, lon: r.eLon }
}
export const earthDistKm = (t: number) => at(t).km

// Same as LunarNav.Core Geometry.SunAngularRadiusAt: Sun-Earth distance from the mean anomaly (Meeus, low precision).
const AU_KM = 149_597_870.7
export const SUN_RADIUS_KM = 696_000
const J2000 = Date.UTC(2000, 0, 1, 12)
export const sunDistKm = (t: number) => {
  const days = (EPOCH + t * 86400000 - J2000) / 86400000
  return AU_KM * (1 - 0.0167 * Math.cos((357.529 + 0.98560028 * days) * D2R))
}
/** Apparent radius of the Sun's disc at day t, degrees (0.262 to 0.272 over the year). */
export const sunRadiusDeg = (t: number) => Math.asin(SUN_RADIUS_KM / sunDistKm(t)) / D2R
export const sunDecDeg = (t: number) => at(t).sLat
export const subSolarLonE = (t: number) => at(t).sLon

/** Days since new Moon, from the sub-solar longitude (180 E at new Moon, 0 at full). */
export const ageDays = (t: number) => ((((180 - at(t).sLon) % 360) + 360) % 360 / 360) * SYN

export function phaseName(age: number) {
  const f = age / SYN
  if (f < 0.03 || f > 0.97) return 'New Moon'
  if (f < 0.22) return 'Waxing crescent'
  if (f < 0.28) return 'First quarter'
  if (f < 0.47) return 'Waxing gibbous'
  if (f < 0.53) return 'Full Moon'
  if (f < 0.72) return 'Waning gibbous'
  if (f < 0.78) return 'Last quarter'
  return 'Waning crescent'
}

export const dayToDate = (t: number) => new Date(EPOCH + t * 86400000)
