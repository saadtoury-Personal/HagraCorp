// Simplified analytic Sun/Earth model in the Moon-fixed frame, ported from Nazim's mockup.
// x = sub-Earth point (lon 0, lat 0), y = lunar north, z = west. SIMULATED until SPICE data lands.
export const TAU = Math.PI * 2
const D2R = Math.PI / 180
const SYN = 29.530588
const ANOM = 27.55455
const DRAC = 27.212221
const ECL = 346.62
const AGE0 = 4.86 // lunar age at epoch, days since new Moon

/** Day 0 of the timeline. */
export const EPOCH = Date.UTC(2026, 10, 14, 18, 40)
export const SPAN_DAYS = 90

export type Vec3 = [number, number, number]

export function sunVec(t: number): Vec3 {
  const ls = (TAU * (AGE0 + t)) / SYN - Math.PI
  const dec = 1.54 * D2R * Math.sin((TAU * (t - 70)) / ECL)
  return [Math.cos(dec) * Math.cos(ls), Math.sin(dec), Math.cos(dec) * Math.sin(ls)]
}

export function libration(t: number) {
  return { lat: 6.68 * Math.sin((TAU * (t + 17)) / DRAC), lon: 7.9 * Math.sin((TAU * (t + 1)) / ANOM) }
}

export function earthVec(t: number): Vec3 {
  const l = libration(t)
  const la = l.lat * D2R
  const lw = -l.lon * D2R
  return [Math.cos(la) * Math.cos(lw), Math.sin(la), Math.cos(la) * Math.sin(lw)]
}

export const earthDistKm = (t: number) => 384400 * (1 - 0.0549 * Math.cos((TAU * (t + 5)) / ANOM))
export const sunDecDeg = (t: number) => 1.54 * Math.sin((TAU * (t - 70)) / ECL)

export function subSolarLonE(t: number) {
  const l = -((TAU * (AGE0 + t)) / SYN - Math.PI) * (180 / Math.PI)
  return ((((l + 180) % 360) + 360) % 360) - 180
}

export const ageDays = (t: number) => (((AGE0 + t) % SYN) + SYN) % SYN

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
