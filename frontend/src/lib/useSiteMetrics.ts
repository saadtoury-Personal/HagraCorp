import { useEffect, useState } from 'react'
import { withRetry } from './retry'
import { fetchMetrics, serverMast, type ServerMetrics } from './api'
import { dayToDate } from './ephemeris'
import { getSeries, metrics } from './sites'
import { useServer } from '../store/server'

export type Source = 'server' | 'bundled'

// Answers already received, so going back to a date or a site never shows the bundled figure again while the server is asked a second time.
const answers = new Map<string, ServerMetrics>()
const remember = (key: string, m: ServerMetrics) => {
  if (answers.size > 500) answers.delete(answers.keys().next().value as string)
  answers.set(key, m)
}

/**
 * Sunlight and Earth-link shares for one site, date, stay and mast.
 * When the server answers, its numbers are used as they are (LOLA 80 m terrain, JPL Horizons). Until then, or when it is off,
 * the same quantity comes from the data bundled with the app, computed with the server's rules (they agree within one point).
 */
export function useSiteMetrics(siteIndex: number, siteId: string, day: number, dur: number, mast: number, enabled = true) {
  const status = useServer((s) => s.status)
  const [, bump] = useState(0)
  const at = Math.round(day * 4) / 4 // a quarter-day grid, so dragging the time bar does not call the server for every pixel
  const key = `${siteId}|${at}|${dur}|${serverMast(mast)}`

  useEffect(() => {
    if (status !== 'online' || !enabled || answers.has(key)) return
    const ctl = new AbortController()
    const id = setTimeout(() => {
      withRetry(() => fetchMetrics(siteId, dayToDate(at), dur, mast, ctl.signal), ctl.signal).then(
        (m) => {
          remember(key, m)
          bump((n) => n + 1)
        },
        () => undefined,
      )
    }, 250)
    return () => {
      clearTimeout(id)
      ctl.abort()
    }
  }, [status, siteId, at, dur, mast, key, enabled])

  const local = metrics(getSeries(mast)[siteIndex], day, dur)
  const hit = status === 'online' ? answers.get(key) : undefined
  if (hit) return { E: Math.round(hit.sunPct), D: Math.round(hit.earthPct), source: 'server' as Source, server: hit }
  return { E: local.E, D: local.D, source: 'bundled' as Source, server: status === 'online' ? null : undefined }
}
