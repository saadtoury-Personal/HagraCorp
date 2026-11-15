import { Tag } from '../../components/Tag'
import { fetchBlockers, serverMast, type Blockers } from '../../lib/api'
import { dayToDate } from '../../lib/ephemeris'
import { useServerData } from '../../lib/useServerData'

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
/** Compass name of the middle of a sector (azimuth clockwise from north, as in Geometry.cs). */
const compass = (from: number, to: number) => POINTS[Math.round(((from + to) / 2 / 45) % 8) % 8]

/** What hides the Sun during the stay: hours lost to the terrain, the directions responsible, and what a 10 m mast wins back (server S11). */
export default function BlockersPanel({ siteId, day, dur, mast }: { siteId: string; day: number; dur: number; mast: number }) {
  const at = Math.round(day * 4) / 4
  const m = serverMast(mast)
  const res = useServerData<Blockers>(`${siteId}|${at}|${dur}|${m}`, (sig) => fetchBlockers(siteId, dayToDate(at), dayToDate(at + dur), mast, sig))
  const b = res.data
  const max = b ? Math.max(1, ...b.top.map((x) => x.hours)) : 1

  return (
    <section aria-label="What hides the Sun" className="mt-5 border-t border-line-soft pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="lab">What hides the Sun</span>
        {res.state === 'ok' && <Tag kind="server" />}
      </div>
      {res.state === 'offline' && <p className="mt-1 text-[13px] text-dim">This breakdown comes from the LunarNav server, which is not reachable right now.</p>}
      {res.state === 'error' && <p className="mt-1 text-[13px] text-dim">The server could not compute this stay.</p>}
      {res.state === 'loading' && <p className="mt-1 text-[13px] text-dim">Asking the server</p>}
      {b &&
        (b.lostHours === 0 ? (
          <p className="mt-1 text-lg font-light text-ok">Nothing: the terrain never hides the Sun during this stay.</p>
        ) : (
          <>
            <p className="mt-1 text-lg font-light">
              The terrain hides the Sun for {b.lostHours} h, {b.lostPct.toFixed(0)}% of the hours it would be up over a flat horizon.
            </p>
            <ul className="mt-3 grid gap-2" aria-label="Directions that hide the Sun most">
              {b.top.map((x) => (
                <li key={x.azFromDeg} className="text-[13px]">
                  <span className="flex justify-between gap-3">
                    <span className="text-dim">
                      Toward {compass(x.azFromDeg, x.azToDeg)}, {x.azFromDeg}–{x.azToDeg}°
                    </span>
                    <span>
                      {x.hours} h, ridge {x.horizonElDeg.toFixed(1)}° high
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 bg-line-soft" aria-hidden>
                    <span className="block h-full bg-warn" style={{ width: `${(100 * x.hours) / max}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-dim">
              {m === 10 ? (
                `The 10 m mast already sees the Sun ${b.mast10GainHours} h more than a 2 m one would.`
              ) : b.mast10GainHours > 0 ? (
                <>
                  A 10 m mast instead of 2 m would see the Sun for <b className="font-medium text-ink">{b.mast10GainHours} h more</b>.
                </>
              ) : (
                'A 10 m mast would not win back any Sun hours here.'
              )}
            </p>
          </>
        ))}
    </section>
  )
}
