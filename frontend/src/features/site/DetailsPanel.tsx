import { earthMaskAt, idxAt, metrics, SITES, SUN_EDGE_DEG, sunMaskAt, timeToChange, verdict, type Series } from '../../lib/sites'
import { signed, toneClass } from '../../lib/format'
import ServerPanel from './ServerPanel'

type Props = { site: number; series: Series; day: number; dur: number; mast: number; minD: number; onMast: (m: number) => void }

function Row({ label, value, sub, bar }: { label: string; value: string; sub: string; bar?: { pct: number; color: string } }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3.5 gap-y-0.5 border-b border-line-soft py-4">
      <span className="lab">{label}</span>
      <span className="text-[22px] font-light">{value}</span>
      {bar && (
        <div className="relative col-span-full my-1.5 h-0.5 bg-line-soft" aria-hidden>
          <i className="absolute inset-y-0 left-0" style={{ width: `${bar.pct}%`, background: bar.color }} />
        </div>
      )}
      <small className="col-span-full text-[13px] text-dim">{sub}</small>
    </div>
  )
}

/** Assessment, live values and selection criteria for one site at the selected time. */
export default function DetailsPanel({ site, series, day, dur, mast, minD, onMast }: Props) {
  const s = SITES[site]
  const m = metrics(series, day, dur)
  const v = verdict(m.E, m.D)
  const k = idxAt(day)
  const sunHorizon = sunMaskAt(s, k, mast)
  const earthHorizon = earthMaskAt(s, k, mast)
  const night = Math.round(series.night)
  const lit = m.E >= 99
  const link = m.D >= minD
  const criteria: [string, string, string, string][] = [
    ['Sunlit for the whole mission', lit ? 'Met' : 'Not met', lit ? 'text-ok' : 'text-bad', `White paper: a first landing site should be sunlit about 6 to 6.5 days. Here: ${m.E}% of ${dur} d.`],
    ['Direct-to-Earth link', link ? 'Met' : 'Not met', link ? 'text-ok' : 'text-bad', `Earth must be visible in the lunar sky. Mission threshold set to ${minD}% (adjust in Compare).`],
    ['Sun angle at landing', 'Info', 'text-dim', 'Apollo wanted the Sun 7 to 20° behind the lander. At the pole it stays within a few degrees: long shadows, low light.'],
    ['Slope and hazards', 'Not modelled', 'text-dim', 'Apollo required a slope under 2°. Needs LOLA and LROC data.'],
  ]
  return (
    <div>
      <div className="border-b border-line-soft pb-5">
        <span className="lab">Assessment</span>
        <b className={`mt-1 block text-4xl font-light leading-tight tracking-tight ${toneClass[v.tone]}`}>{v.word}</b>
        <p className="mt-2.5 text-sm text-dim">{v.why}</p>
      </div>
      <Row label="Sunlight" value={`${m.E}%`} sub={`of the ${dur}-day window with the Sun above the local horizon`} bar={{ pct: m.E, color: '#ffc766' }} />
      <Row label="Earth link (DTE)" value={`${m.D}%`} sub={`of the ${dur}-day window with Earth in view`} bar={{ pct: m.D, color: '#6fa8ff' }} />
      <Row label="Longest night" value={`${night} h`} sub={`longest continuous shadow in the next 90 days (${(night / 24).toFixed(1)} days)`} />
      <Row label="Sun now" value={`${signed(s.sEl[k])}°`} sub={`${s.sEl[k] + SUN_EDGE_DEG > sunHorizon ? 'above' : 'below'} the local horizon (${sunHorizon.toFixed(1)}°), ${timeToChange(series.sun, day)}`} />
      <Row label="Earth now" value={`${signed(s.eEl[k])}°`} sub={`${s.eEl[k] > earthHorizon ? 'in view' : 'hidden'} (horizon ${earthHorizon.toFixed(1)}°), ${timeToChange(series.earth, day)}`} />

      <ServerPanel siteId={s.id} day={day} dur={dur} mast={mast} />

      <div className="mt-5">
        <div className="flex justify-between">
          <label htmlFor="mast" className="lab">
            Mast height
          </label>
          <output htmlFor="mast" className="font-medium">
            {mast} m
          </output>
        </div>
        <input id="mast" type="range" min={0} max={10} step={0.5} value={mast} onChange={(e) => onMast(Number(e.target.value))} />
      </div>

      <ul className="mt-5" aria-label="Selection criteria">
        {criteria.map(([name, status, tone, note]) => (
          <li key={name} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-line-soft py-3 text-sm">
            <span>{name}</span>
            <span className={`text-xs font-medium uppercase tracking-[0.1em] ${tone}`}>{status}</span>
            <small className="col-span-full text-[13px] text-dim">{note}</small>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[13px] text-faint">
        Criteria: NASA,{' '}
        <a className="underline underline-offset-4 hover:text-ink" href="https://www.nasa.gov/history/50-years-ago-lunar-landing-sites-selected/" target="_blank" rel="noopener">
          Apollo landing site selection (1968)
        </a>
        ; NASA Moon to Mars Architecture,{' '}
        <a className="underline underline-offset-4 hover:text-ink" href="https://www.nasa.gov/wp-content/uploads/2024/02/15-2024-architecture-workshop-white-paper-lunar-site-selection.pdf" target="_blank" rel="noopener">
          Lunar Site Selection white paper
        </a>
        . Simplified analytic model, not real ephemeris data.
      </p>
    </div>
  )
}
