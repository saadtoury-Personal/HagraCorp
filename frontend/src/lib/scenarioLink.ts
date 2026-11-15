// A scenario is a link: site, date, needs and delay live in the query string so the page can be shared.
import { SPAN_DAYS } from './ephemeris'
import { SITES } from './sites'
import { useScenario } from '../store/scenario'

export const KEYS = { site: 's', day: 'd', dur: 'u', minE: 'e', minD: 'l', mast: 'm', maxDark: 'b', slip: 'x', requireEarth: 'r' } as const
type Key = keyof typeof KEYS
type Patch = Partial<Pick<ReturnType<typeof useScenario.getState>, Key>>

/** The scenario as it is right now, as a query string (also used by Share, so a link copied while time plays is current). */
export function toQuery() {
  const st = useScenario.getState()
  const q = new URLSearchParams()
  ;(Object.keys(KEYS) as Key[]).forEach((k) => q.set(KEYS[k], k === 'requireEarth' ? (st[k] ? '1' : '0') : String(k === 'day' ? Math.round(st[k] * 10) / 10 : st[k])))
  return q
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/**
 * Reads a link into a scenario patch. Links can be edited by hand, so every value is brought back into the range the pages can show
 * (a fractional or out-of-range site, or a negative date, used to crash Site, Globe and Slip). Unknown or non-numeric values are skipped.
 */
export function fromQuery(search: string): Patch {
  const q = new URLSearchParams(search)
  const out: Partial<Record<Key, number | boolean>> = {}
  const patch = out as Record<Key, number | boolean> // each key gets the type its field has (boolean for requireEarth only)
  for (const k of Object.keys(KEYS) as Key[]) {
    const raw = q.get(KEYS[k])
    if (raw === null || raw.trim() === '') continue
    const v = Number(raw)
    if (!Number.isFinite(v)) continue
    if (k === 'requireEarth') patch[k] = v !== 0
    else if (k === 'site') patch[k] = clamp(Math.round(v), 0, SITES.length - 1)
    else if (k === 'day') patch[k] = clamp(v, 0, SPAN_DAYS)
    else if (k === 'dur') patch[k] = clamp(v, 1, SPAN_DAYS)
    else if (k === 'mast') patch[k] = clamp(v, 0, 10)
    else if (k === 'slip') patch[k] = clamp(Math.round(v / 7) * 7, 0, SPAN_DAYS)
    else patch[k] = Math.max(0, v) // minE, minD (percent), maxDark (hours)
  }
  return out as Patch
}
