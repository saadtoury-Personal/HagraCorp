import { useEffect, useState } from 'react'
import { fetchMetrics, serverMast, type ServerMetrics } from './api'
import { dayToDate } from './ephemeris'
import { getSeries, metrics } from './sites'
import { useServer } from '../store/server'

export type Source = 'server' | 'bundled'

/**
 * Sunlight and Earth-link shares for one site, date, stay and mast.
 * When the server answers, its numbers are used as they are (LOLA 80 m terrain, JPL Horizons). Until then, or when it is off,
 * the same quantity comes from the data bundled with the app, computed with the server's rules (they agree within one point).
 */
export function useSiteMetrics(siteIndex: number, siteId: string, day: number, dur: number, mast: number, enabled = true) {
  const status = useServer((s) => s.status)
  const [srv, setSrv] = useState<{ key: string; m: ServerMetrics } | null>(null)
  const at = Math.round(day * 4) / 4 // a quarter-day grid, so dragging the time bar does not call the server for every pixel
  const key = `${siteId}|${at}|${dur}|${serverMast(mast)}`

  useEffect(() => {
    if (status !== 'online' || !enabled) return
    const ctl = new AbortController()
    const id = setTimeout(() => {
      fetchMetrics(siteId, dayToDate(at), dur, mast, ctl.signal).then(
        (m) => setSrv({ key, m }),
        () => undefined,
      )
    }, 250)
    return () => {
      clearTimeout(id)
      ctl.abort()
    }
  }, [status, siteId, at, dur, mast, key, enabled])

  const local = metrics(getSeries(mast)[siteIndex], day, dur)
  if (status === 'online' && srv?.key === key) {
    return { E: Math.round(srv.m.sunPct), D: Math.round(srv.m.earthPct), source: 'server' as Source, server: srv.m }
  }
  return { E: local.E, D: local.D, source: 'bundled' as Source, server: status === 'online' ? null : undefined }
}
