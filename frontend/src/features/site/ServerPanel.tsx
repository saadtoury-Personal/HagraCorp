import { serverMast, type ServerMetrics } from '../../lib/api'
import { useServer } from '../../store/server'

type Props = { dur: number; mast: number; /** undefined: server off, null: waiting for the answer. */ server: ServerMetrics | null | undefined }

const hours = (h: number | null) => (h == null ? 'none soon' : h < 48 ? `${h.toFixed(0)} h` : `${(h / 24).toFixed(1)} d`)

/** The server's own answers for this site, date, stay and mast, computed from the full 80 m LOLA terrain and JPL Horizons. */
export default function ServerPanel({ dur, mast, server: m }: Props) {
  const status = useServer((s) => s.status)
  const about = useServer((s) => s.about)

  if (status !== 'online') {
    return (
      <p className="mt-5 border-t border-line-soft pt-4 text-[13px] text-faint">
        The LunarNav server is not reachable, so every figure here comes from the data bundled with the app (same Horizons table and LOLA horizon masks, same rules as the server).
      </p>
    )
  }
  const rows: [string, string][] = m
    ? [
        ['Sunlight', `${m.sunPct.toFixed(0)}% of ${dur} d`],
        ['Earth in view', `${m.earthPct.toFixed(0)}% of ${dur} d`],
        ['Longest dark spell', `${m.longestDarkHours.toFixed(0)} h${m.viperRuleViolated ? ', over the 50 h VIPER limit' : ''}`],
        ['Longest dark without Earth', `${m.longestDarkNoEarthHours.toFixed(0)} h`],
        ['Sun window from now', `${m.windowSunHours.toFixed(0)} h, ${m.viable ? 'long enough for the stay' : 'shorter than the stay'}`],
        ['Next sunset · sunrise', `${hours(m.hoursToSunset)} · ${hours(m.hoursToSunrise)}`],
        ['Next Earth set · rise', `${hours(m.hoursToEarthset)} · ${hours(m.hoursToEarthrise)}`],
      ]
    : []
  return (
    <section aria-label="Server results" className="mt-5 border-t border-line-soft pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="lab">From the server</span>
        <span className="text-xs text-faint">{serverMast(mast)} m mast, 80 m terrain pixel</span>
      </div>
      {!m && <p className="mt-2 text-[13px] text-dim">Asking the server</p>}
      {m && (
        <dl className="mt-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line-soft py-1.5">
              <dt className="text-dim">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {about && (
        <details className="mt-2 text-[13px] text-dim">
          <summary className="cursor-pointer hover:text-ink">How precise is this?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {about.precision.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-faint">Sources: {about.sources.join(', ')}.</p>
        </details>
      )}
    </section>
  )
}
