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
  if (D < n.minD) why.push(`Earth link ${D}%, needs ${n.minD}%`)
  if (dark > n.maxDark) why.push(`Dark for ${dark} h, batteries last ${n.maxDark} h`)
  return { site, t0, E, D, dark, pass: why.length === 0, why }
}

/** Last start day the 90 day timeline can score completely. */
export const lastStart = (dur: number) => Math.max(0, SPAN - Math.ceil(dur))

/** Every whole start day for one site, with the outcome of each. */
export const calendar = (sr: Series, site: number, n: Needs) => Array.from({ length: lastStart(n.dur) + 1 }, (_, t0) => evaluate(sr, site, t0, n))

/** First working start day at or after `from`, or null. */
export const nextWorking = (cal: Outcome[], from: number) => cal.find((o) => o.t0 >= from && o.pass) ?? null

/** Every site for one start day: passing sites first, then the smallest shortfall. */
export function rankSites(series: Series[], t0: number, n: Needs) {
  return SITES.map((s) => evaluate(series[s.i], s.i, t0, n)).sort((a, b) => Number(b.pass) - Number(a.pass) || Math.min(b.E, b.D) - Math.min(a.E, a.D) || a.dark - b.dark)
}

export { idxAt }
