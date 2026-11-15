import { useEffect, useState } from 'react'
import { Tag } from '../../components/Tag'
import { fetchUncertainty, serverMast, type PctRange, type Uncertainty as U } from '../../lib/api'
import { coords } from '../../lib/format'
import { useServerData } from '../../lib/useServerData'

/** Precomputed copies of the backend files, used when the server is offline (kept identical by sitesSync.test.ts). */
const loadBundled = (mast: 2 | 10) =>
  (mast === 2 ? import('../../data/uncertainty_2m.json') : import('../../data/uncertainty_10m.json')).then((m) => m.default as unknown as U[])

function Range({ label, r, color }: { label: string; r: PctRange; color: string }) {
  const pct = (x: number) => `${Math.max(0, Math.min(100, x))}%`
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-dim">{label}</span>
        <span>
          <b className="font-medium">{r.official.toFixed(0)}%</b>
          <span className="text-dim">
            {' '}
            here, {r.min.toFixed(0)} to {r.max.toFixed(0)}% nearby
          </span>
        </span>
      </div>
      <div className="relative mt-2 h-2" role="img" aria-label={`${label}: ${r.official.toFixed(0)}% at the official point, between ${r.min.toFixed(0)} and ${r.max.toFixed(0)}% within 500 m`}>
        <i className="absolute inset-y-[3px] left-0 right-0 bg-line-soft" />
        <i className="absolute inset-y-[3px]" style={{ left: pct(r.min), width: pct(r.max - r.min), background: color, opacity: 0.55 }} />
        <i className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink" style={{ left: pct(r.official) }} />
      </div>
    </div>
  )
}

/** F3: how much the answer changes if the lander comes down 100 to 500 m off the published point (2026 to 2030, hourly). */
export default function Uncertainty({ siteId, mast }: { siteId: string; mast: number }) {
  const m = serverMast(mast)
  const srv = useServerData<U>(`${siteId}|${m}`, (sig) => fetchUncertainty(siteId, mast, sig))
  const [bundled, setBundled] = useState<{ key: string; u: U | null } | null>(null)
  const needBundled = srv.state === 'offline' || srv.state === 'error'
  useEffect(() => {
    if (!needBundled) return
    let live = true
    loadBundled(m).then((all) => live && setBundled({ key: `${siteId}|${m}`, u: all.find((x) => x.siteId === siteId) ?? null }))
    return () => {
      live = false
    }
  }, [needBundled, siteId, m])

  const u = srv.state === 'ok' ? srv.data : bundled?.key === `${siteId}|${m}` ? bundled.u : null
  const source = srv.state === 'ok' ? 'server' : 'bundled'
  if (srv.state === 'loading' || (needBundled && bundled?.key !== `${siteId}|${m}`)) return null
  if (!u)
    return (
      <section aria-label="Landing accuracy" className="mt-5 border-t border-line-soft pt-4">
        <span className="lab">Landing accuracy</span>
        <p className="mt-1 text-[13px] text-dim">No position spread for this site: it is outside the relief map.</p>
      </section>
    )
  return (
    <section aria-label="Landing accuracy" className="mt-5 border-t border-line-soft pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="lab">Landing accuracy</span>
        <Tag kind={source} />
      </div>
      <p className="mt-1 text-[13px] text-dim">
        A lander touches down within a few hundred metres of its target. Over 2026 to 2030, at a {u.mastM} m mast, within {Math.max(...u.radiiM)} m of the official point:
      </p>
      <Range label="Sunlight" r={u.sunPct} color="var(--color-sun)" />
      <Range label="Earth in view" r={u.earthPct} color="var(--color-earth)" />
      <Range label="Both" r={u.bothPct} color="var(--color-ok)" />
      <p className="mt-1 text-[13px] text-dim">
        Best neighbour: {coords(u.best.latDeg, u.best.lonDeg > 180 ? u.best.lonDeg - 360 : u.best.lonDeg)}, {u.best.distanceM} m away, {u.best.sunPct.toFixed(0)}% sunlight. The official site is not moved.
      </p>
    </section>
  )
}
