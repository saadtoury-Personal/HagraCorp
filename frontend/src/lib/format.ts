import { dayToDate } from './ephemeris'

export const dayLabel = (t: number) => dayToDate(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const dateLabel = (t: number) => dayToDate(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const timeLabel = (t: number) => dayToDate(t).toISOString().slice(11, 16) + ' UTC'
export const signed = (n: number, d = 1) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(d)
export const pad2 = (n: number) => String(n).padStart(2, '0')

export const toneClass = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' } as const
