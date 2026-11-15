// Slip Navigator maths: does a mission starting on day t0 meet the needs, and what are the alternatives if the start slips.
// Same visibility series as the rest of the app (lib/sites), so every page agrees.
import { frac, idxAt, N, SITES, SPAN, STEP, type Series } from './sites'

export type Needs = {
  /** Mission length, days. */
  dur: number
  /** Minimum sunlit share, percent. */
  minE: number
  /** Minimum Earth-link share, percent. */
  minD: number
  /** Longest stretch without sunlight the batteries can bridge, hours. */
  maxDark: number
  /** When false, the Earth-link share is shown but does not decide the verdict. */
  requireEarth?: boolean
}

export type Outcome = {
  site: number
  t0: number
  E: number
  D: number
  /** Longest continuous stretch with the Sun down inside the window, hours. */
  dark: number
  pass: boolean
  /** Plain-language reasons the mission falls short (empty when it passes). */
  why: string[]
}

/** Longest run of `value` in arr between days t0 and t0 + dur, in hours. */
export function longestRun(arr: Uint8Array, t0: number, dur: number, value: 0 | 1) {
  const a = Math.max(0, Math.floor(t0 / STEP))
  const b = Math.min(N, Math.floor((t0 + dur) / STEP))
  let run = 0
  let best = 0
  for (let k = a; k < b; k++) {
    if (arr[k] === value) best = Math.max(best, ++run)
    else run = 0
  }
  return best * STEP * 24
}

export function evaluate(sr: Series, site: number, t0: number, n: Needs): Outcome {
  const E = Math.round(100 * frac(sr.sun, t0, n.dur))
  const D = Math.round(100 * frac(sr.earth, t0, n.dur))
  const dark = Math.round(longestRun(sr.sun, t0, n.dur, 0))
  const why: string[] = []
  if (E < n.minE) why.push(`Sunlight ${E}%, needs ${n.minE}%`)
  if (n.requireEarth !== false && D < n.minD) why.push(`Earth link ${D}%, needs ${n.minD}%`)
  if (dark > n.maxDark) why.push(`Dark for ${dark} h, batteries last ${n.maxDark} h`)
  return { site, t0, E, D, dark, pass: why.length === 0, why }
}

/** Last start day the 90 day timeline can score completely. */
export const lastStart = (dur: number) => Math.max(0, SPAN - Math.ceil(dur))

/** Every whole start day for one site, with the outcome of each. */
export const calendar = (sr: Series, site: number, n: Needs) => Array.from({ length: lastStart(n.dur) + 1 }, (_, t0) => evaluate(sr, site, t0, n))

/** First working start day at or after `from`, or null. */
export const nextWorking = (cal: Outcome[], from: number) => cal.find((o) => o.t0 >= from && o.pass) ?? null

export type Ranked = Outcome & { before: Outcome; terrain: boolean }

/**
 * Every site for one start day, with its outcome on the original day so changed verdicts can be marked.
 * Sites with a real relief map come first (a flat skyline cannot beat real terrain), then passing sites, then the smallest shortfall.
 */
export function rankSites(series: Series[], t0: number, n: Needs, tBefore = t0): Ranked[] {
  return SITES.map((s) => ({ ...evaluate(series[s.i], s.i, t0, n), before: evaluate(series[s.i], s.i, tBefore, n), terrain: s.terrain })).sort(
    (a, b) => Number(b.terrain) - Number(a.terrain) || Number(b.pass) - Number(a.pass) || Math.min(b.E, b.D) - Math.min(a.E, a.D) || a.dark - b.dark,
  )
}

/** Consecutive working start days around day t (0 when t itself does not work): how far this landing can slip. */
export function tolerance(cal: Outcome[], t: number) {
  if (!cal[t]?.pass) return 0
  let lo = t
  let hi = t
  while (lo > 0 && cal[lo - 1].pass) lo--
  while (hi < cal.length - 1 && cal[hi + 1].pass) hi++
  return hi - lo + 1
}

/** Hours after landing at t0 until the Sun first goes down (null if it stays up to the end of the data). */
export function hoursToFirstSunset(sr: Series, t0: number) {
  for (let k = Math.max(0, Math.floor(t0 / STEP)); k < N; k++) if (!sr.sun[k]) return Math.round((k * STEP - t0) * 24)
  return null
}

export { idxAt }
