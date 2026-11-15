import { dayToDate } from './ephemeris'

export const dayLabel = (t: number) => dayToDate(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const dateLabel = (t: number) => dayToDate(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const timeLabel = (t: number) => dayToDate(t).toISOString().slice(11, 16) + ' UTC'
export const signed = (n: number, d = 1) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(d)
/** Coordinates as in the repo's site list: latitude north-positive, longitude east-positive, four decimals. */
export const coords = (lat: number, lonE: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lonE).toFixed(4)}° ${lonE >= 0 ? 'E' : 'W'}`

const CATEGORY: Record<string, string> = {
  artemis: 'Artemis III candidate region',
  clps: 'Commercial lander (CLPS) area',
  international: 'International mission area',
  apollo: 'Apollo landing site',
  failure: 'Past landing attempt that failed',
  custom: 'Custom point',
}
export const categoryLabel = (c: string) => CATEGORY[c] ?? c

export const pad2 = (n: number) => String(n).padStart(2, '0')

export const toneClass = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' } as const
