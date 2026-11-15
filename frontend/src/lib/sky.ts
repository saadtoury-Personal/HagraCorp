import { useEffect, useState } from 'react'
import { fetchTimeline, serverMast, type TimelinePoint } from './api'
import { dayToDate, earthDistKm } from './ephemeris'
import { azEl, bodiesAt, earthDistMoons, earthRadiusDeg, maskAt, SITES } from './sites'
import { useServer } from '../store/server'
import bodies from '../data/bodies.json'

export type Sky = Omit<TimelinePoint, 't'> & { source: 'server' | 'bundled' }

/** Share (0..1) of a round disk above a straight skyline; margin = elevation of its centre minus the horizon there. Same formula as LunarNav.Core Geometry.DiskFraction. */
export function diskFraction(marginDeg: number, radiusDeg: number) {
  if (marginDeg >= radiusDeg) return 1
  if (marginDeg <= -radiusDeg) return 0
  const k = marginDeg / radiusDeg
  return 1 - (Math.acos(k) - k * Math.sqrt(1 - k * k)) / Math.PI
}

/** The same quantities the server returns, from the data bundled with the app (used until the server answers, or when it is off). */
export function localSky(siteIndex: number, day: number, mast: number): Sky {
  const s = SITES[siteIndex]
  const b = bodiesAt(day)
  const sun = azEl(s, b.sun)
  const earth = azEl(s, b.earth, earthDistMoons(day))
  const sunFrac = diskFraction(sun.el - maskAt(s, sun.az, mast), bodies.sunAngularRadiusDeg)
  const earthFrac = diskFraction(earth.el - maskAt(s, earth.az, mast), earthRadiusDeg(earthDistKm(day) / bodies.moonRadiusKm))
  return { sunAz: sun.az, sunEl: sun.el, sunFrac, earthAz: earth.az, earthEl: earth.el, earthFrac, power: sunFrac * Math.cos((sun.el * Math.PI) / 180), source: 'bundled' }
}

/**
 * How lit the site is at the selected time: the server's own timeline point (LOLA terrain, Horizons) when it answers,
 * otherwise the same numbers computed from the bundled data.
 */
export function useSky(siteIndex: number, siteId: string, day: number, mast: number): Sky {
  const status = useServer((s) => s.status)
  const hour = Math.floor(day * 24) / 24 // one call per simulated hour, not per animation frame
  const key = `${siteId}|${hour}|${serverMast(mast)}`
  const [srv, setSrv] = useState<{ key: string; p: TimelinePoint } | null>(null)

  useEffect(() => {
    if (status !== 'online') return
    const ctl = new AbortController()
    const id = setTimeout(() => {
      fetchTimeline(siteId, dayToDate(hour), 1, 60, mast, ctl.signal).then(
        (pts) => pts[0] && setSrv({ key, p: pts[0] }),
        () => undefined,
      )
    }, 250)
    return () => {
      clearTimeout(id)
      ctl.abort()
    }
  }, [status, siteId, hour, mast, key])

  if (status === 'online' && srv?.key === key) {
    const { t: _t, ...rest } = srv.p
    void _t
    return { ...rest, source: 'server' }
  }
  return localSky(siteIndex, day, mast)
}
