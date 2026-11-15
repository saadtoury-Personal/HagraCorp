import { useEffect, useState } from 'react'
import SourceTag from '../../components/SourceTag'
import { fetchFallback, type Fallback } from '../../lib/api'
import { dayToDate } from '../../lib/ephemeris'
import { dateLabel } from '../../lib/format'
import { SITES } from '../../lib/sites'
import { useServer } from '../../store/server'

type Props = { planned: number; delayDays: number; dur: number; mast: number; open: (siteIndex: number, day: number) => void }

const byId = new Map(SITES.map((s) => [s.id, s]))

/** The server's own ranking of the sites if the start slips: longest continuous sunlight first (slip heatmap, 2026 to 2030). */
export default function ServerRanking({ planned, delayDays, dur, mast, open }: Props) {
  const status = useServer((s) => s.status)
  const [data, setData] = useState<Fallback | null>(null)
  const [failed, setFailed] = useState(false)
  const weeks = Math.min(52, Math.round(delayDays / 7))

  useEffect(() => {
    if (status !== 'online') return
    const ctl = new AbortController()
    const id = setTimeout(() => {
      fetchFallback(dayToDate(planned), weeks, dur, false, mast, ctl.signal).then(
        (r) => {
          setData(r)
          setFailed(false)
        },
        () => {
          if (!ctl.signal.aborted) setFailed(true)
        },
      )
    }, 300)
    return () => {
      clearTimeout(id)
      ctl.abort()
    }
  }, [status, planned, weeks, dur, mast])

  if (status !== 'online') return null
  return (
    <div className="mt-8" aria-label="Server ranking">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium">Server ranking{data ? `, start ${dateLabel(Math.round((new Date(data.slippedDate).getTime() - dayToDate(0).getTime()) / 86400000))}` : ''}</h3>
        <SourceTag source="server" />
      </div>
      <p className="mt-1 text-[13px] text-dim">Longest continuous sunlight from the slipped start, slip rounded to {weeks} week{weeks === 1 ? '' : 's'}. A site is viable when the window covers the {dur}-day stay.</p>
      {failed && !data && <p className="mt-2 text-sm text-dim">The server did not answer.</p>}
      {data && (
        <ol className="mt-3">
          {data.ranked.slice(0, 8).map((e, i) => {
            const s = byId.get(e.siteId)
            return (
              <li key={e.siteId} className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-x-3 border-b border-line-soft py-2 text-sm">
                <span className="text-faint">{i + 1}</span>
                <span>
                  {s ? (
                    <button type="button" className="min-h-9 text-left hover:underline" onClick={() => open(s.i, Math.min(Math.max(0, Math.round((new Date(data.slippedDate).getTime() - dayToDate(0).getTime()) / 86400000)), 85))}>
                      {s.name}
                    </button>
                  ) : (
                    e.siteId
                  )}
                  <small className="block text-[13px] text-dim">
                    {e.viable ? 'viable' : e.nearestViableDate ? `next viable ${dateLabel(Math.round((new Date(e.nearestViableDate).getTime() - dayToDate(0).getTime()) / 86400000))}` : 'no viable day found'} · {(e.robustness * 100).toFixed(0)}% of nearby days viable
                  </small>
                </span>
                <span className={`font-medium ${e.viable ? 'text-ok' : 'text-dim'}`}>{e.windowHours.toFixed(0)} h</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
