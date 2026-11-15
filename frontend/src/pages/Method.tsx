import { Link } from 'react-router'
import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import { Tag } from '../components/Tag'
import { aboutRules, fetchValidation, type PortedCheck, type Rule, type Validation } from '../lib/api'
import { GLOSSARY as TERMS } from '../lib/glossary'
import { SITES } from '../lib/sites'
import { useServerData } from '../lib/useServerData'
import { useServer } from '../store/server'

type Item = { k?: string; v: string }

const HOW: Item[] = [
  { k: 'Sun and Earth', v: 'Positions seen from the Moon come from JPL Horizons in the Moon Mean Earth frame. The server uses 2026 to 2030; the data bundled with the app covers 14 Nov 2026 to 10 Mar 2027.' },
  { k: 'Horizon', v: 'Each site has a skyline of 720 elevations, one every 0.5 degrees of azimuth, computed from NASA LOLA terrain for an observer 2 m and 10 m above the ground.' },
  { k: 'Sun up', v: 'The Sun counts as up when its upper edge clears the skyline, so a grazing Sun is not lost.' },
  { k: 'Earth in view', v: 'Any part of the Earth above the skyline. The bundled data follows the same rules as the server.' },
  { k: 'Where it runs', v: 'The Slip ranking, landing accuracy, battery and close calls come from the LunarNav server. The Compare grid and the Slip calendar are computed in your browser from the bundled data, and are labelled so.' },
]

const LIMITS: string[] = [
  'Sunlight is not electrical power, and Earth in view is not a working radio link. The battery model is a simple energy balance; there is no thermal model and no radio link budget.',
  'Results are for one 80 m terrain pixel. Moving a few hundred metres can change the Sun share by tens of points, which is why each site shows its landing accuracy.',
  'Boulders and craters smaller than the terrain grid are not in the skyline.',
  'No atmosphere means no refraction: the horizon is the terrain itself.',
  `Apollo 11 is outside the polar terrain map, so its horizon is flat and it is never ranked against the other ${SITES.length - 1} sites.`,
  'The bundled data covers 90 days of start dates. Longer slips need the server.',
]

const GLOSSARY: Item[] = [
  { k: 'Skyline', v: 'The outline of the terrain seen from the site, all the way around. The Sun or Earth is hidden when it is below it.' },
  { k: 'Mast', v: 'How high the solar panel or antenna sits. A taller mast sees over nearby ridges.' },
  { k: 'Window', v: 'The longest stretch with the Sun (and Earth, if required) in view, when landing at the best hour of the day. Dark gaps of 6 h or less are bridged by the battery.' },
  { k: 'Slip', v: 'A launch delay. The Slip page shows whether the landing still works after it, and what to do if not.' },
  { k: 'Close call', v: 'The verdict changes if the skyline is 0.2 degrees higher or lower. Treat it as uncertain.' },
  { k: 'GO, RISKY, NO-GO', v: 'GO: long enough window and not a close call. RISKY: long enough but a close call. NO-GO: too short, or more than 50 h with neither Sun nor Earth (the VIPER rover rule).' },
  { k: 'PGDA', v: "NASA Goddard's Planetary Geodesy Data Archive, which publishes long-term sunlight and Earth-visibility maps of the south pole. We compare our numbers with them." },
]

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-10">
      <h2 className="text-lg font-medium leading-snug">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Pairs({ items }: { items: Item[] }) {
  return (
    <dl className="space-y-4">
      {items.map((it) => (
        <div key={it.v} className={it.k ? 'grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-6' : ''}>
          {it.k && <dt className="text-sm text-faint">{it.k}</dt>}
          <dd className="max-w-[62ch] text-[15px] leading-relaxed text-dim">{it.v}</dd>
        </div>
      ))}
    </dl>
  )
}

const ruleValue = (r: Rule) =>
  typeof r.value === 'object' && r.value !== null
    ? Object.entries(r.value as Record<string, unknown>)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')
    : `${String(r.value)}${r.unit ? ` ${r.unit}` : ''}`

const PASS_LABEL: Record<string, string> = {
  sun: 'Sun shares within the agreed margin',
  earth: 'Earth shares within the agreed margin',
  noProblemSites: 'No site left unexplained',
  csharpVsPython: 'Server code matches the reference Python code',
  // "added after the first run" must stay: this check was not pre-registered, the failed one above was.
  csharpVsPortedPython: 'Server code matches the Python code with the disc model ported (added after the first run)',
}
const SITE_NAME = new Map(SITES.map((s) => [s.id, s.name]))

/** The server's check against NASA PGDA product 69, with its thresholds fixed before the run. Failures are shown, not hidden. */
/** Why the pre-registered C# vs Python check failed, with the numbers from the server's own re-run (summary.csharpVsPortedPython). */
const portedNote = (p: PortedCheck) =>
  `Cause verified: the server uses a finer disc model (16 strips, Sun size from distance, eclipses). With those changes ported to the Python, the gap is ${Math.max(p.maxAbsDiffSun, p.maxAbsDiffEarth).toFixed(2)} points on ${p.rowsWithinThreshold === p.rows ? 'all' : `${p.rowsWithinThreshold} of`} ${p.rows} rows.`

function ValidationReport({ v }: { v: Validation }) {
  const ported = v.summary.csharpVsPortedPython
  const stat = (label: string, x: Validation['summary']['sun']) => (
    <tr key={label} className="border-t border-line-soft">
      <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">
        {label}
      </th>
      <td className="py-2 pr-4">
        {x.within} of {x.n}
      </td>
      <td className="py-2 pr-4">{x.bias > 0 ? '+' : ''}{x.bias.toFixed(1)}</td>
      <td className="py-2 pr-4">{x.rmse.toFixed(1)}</td>
      <td className="py-2 pr-4">{x.r.toFixed(3)}</td>
      <td className="py-2">
        {x.maxAbs.toFixed(1)} at {SITE_NAME.get(x.maxAbsSite) ?? x.maxAbsSite}
      </td>
    </tr>
  )
  return (
    <div className="mt-6 max-w-[62ch]">
      <div className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
        Comparison with NASA PGDA maps <Tag kind="server" />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-dim">{v.reference}</p>
      {v.thresholds?.note && <p className="mt-1 text-sm leading-relaxed text-dim">{v.thresholds.note}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm text-dim">
          <caption className="sr-only">Agreement with NASA PGDA, percentage points</caption>
          <thead className="text-left text-[13px] text-faint">
            <tr>
              <th className="pb-2 pr-4 font-normal"></th>
              <th className="pb-2 pr-4 font-normal">Within 5 points</th>
              <th className="pb-2 pr-4 font-normal">Bias</th>
              <th className="pb-2 pr-4 font-normal">RMSE</th>
              <th className="pb-2 pr-4 font-normal">Correlation</th>
              <th className="pb-2 font-normal">Largest gap</th>
            </tr>
          </thead>
          <tbody>
            {stat('Sun', v.summary.sun)}
            {stat('Earth', v.summary.earth)}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {Object.entries(v.pass).map(([k, ok]) => (
          <li key={k}>
            <span className="flex items-start gap-2">
              {ok ? <CheckCircleIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <XCircleIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-bad" aria-hidden />}
              <span className="text-dim">
                {PASS_LABEL[k] ?? k}: {ok ? 'met' : 'not met'}
              </span>
            </span>
            {k === 'csharpVsPython' && ported && <p className="ml-6 mt-0.5 text-[13px] leading-relaxed text-faint">{portedNote(ported)}</p>}
          </li>
        ))}
      </ul>
      <details className="mt-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-dim hover:text-ink">Every site, ours against PGDA (Sun, observer on the ground)</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm text-dim">
            <thead className="text-left text-[13px] text-faint">
              <tr>
                <th className="py-2 pr-4 font-normal">Site</th>
                <th className="py-2 pr-4 font-normal">Ours</th>
                <th className="py-2 pr-4 font-normal">PGDA</th>
                <th className="py-2 pr-4 font-normal">Gap</th>
                <th className="py-2 font-normal">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {v.sites.map((x) => (
                <tr key={x.siteId} className="border-t border-line-soft">
                  <td className="py-1.5 pr-4 text-ink">{SITE_NAME.get(x.siteId) ?? x.siteId}</td>
                  <td className="py-1.5 pr-4">{x.sun.ours0m.toFixed(1)}%</td>
                  <td className="py-1.5 pr-4">{x.sun.pgda.toFixed(1)}%</td>
                  <td className="py-1.5 pr-4">{x.sun.diff > 0 ? '+' : ''}{x.sun.diff.toFixed(1)}</td>
                  <td className="py-1.5">{x.sun.verdict === 'OK' ? 'Within 5 points' : x.sun.verdict === 'explained' ? 'Explained by terrain detail' : x.sun.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="mt-2 text-[13px] text-faint">Report generated {v.generated}.</p>
    </div>
  )
}

export default function Method() {
  const status = useServer((s) => s.status)
  const about = useServer((s) => s.about)
  const validation = useServerData<Validation>('validation', (sig) => fetchValidation(sig))
  const rules = aboutRules(about)

  return (
    <main className="mx-auto min-h-dvh max-w-[980px] px-5 pb-24 pt-28 md:px-9">
      <h1 className="text-[clamp(26px,4vw,48px)] font-light uppercase leading-[1.14] tracking-[0.16em]">Method and limits</h1>
      <p className="mt-4 max-w-[60ch] text-[17px] font-light text-dim">What the numbers rest on, what was checked, and where to be careful before quoting a result.</p>

      <div className="mt-12">
        <Block title="How the numbers are made">
          <Pairs items={HOW} />
        </Block>

        <Block title="Rules and thresholds">
          {rules.length > 0 ? (
            <ul className="space-y-4">
              {rules.map((r) => (
                <li key={r.id} className="max-w-[62ch]">
                  <div className="flex flex-wrap items-center gap-2 text-[15px]">
                    <span className="text-ink">{r.label}</span>
                    <span className="text-dim">{ruleValue(r)}</span>
                    <Tag kind={r.status === 'validated' ? 'validated' : 'assumed'} />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-dim">{r.description}</p>
                  <p className="text-[13px] text-faint">Source: {r.source}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="max-w-[62ch] text-[15px] leading-relaxed text-dim">
              {status === 'online'
                ? 'This server does not publish its rules file yet.'
                : 'The rules and their status (assumed or validated) are published by the LunarNav server, which is not reachable right now.'}{' '}
              Every threshold you can change in the app is marked <Tag kind="assumed" />.
            </p>
          )}
        </Block>

        <Block title="What was checked">
          {about?.precision?.length ? (
            <ul className="max-w-[62ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-dim">
              {about.precision.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          {validation.state === 'ok' && validation.data ? (
            <ValidationReport v={validation.data} />
          ) : (
            <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-dim">
              {validation.state === 'offline'
                ? 'The comparison with NASA PGDA maps is published by the LunarNav server, which is not reachable right now.'
                : validation.state === 'loading'
                  ? 'Loading the validation report.'
                  : 'The server has not published its validation report yet.'}{' '}
              Until you can read it, treat the numbers as a screening tool, not a flight-ready result.
            </p>
          )}
        </Block>

        <Block title="What it does not tell you">
          <ul className="max-w-[62ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-dim">
            {LIMITS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Block>

        <Block title="Words used in the app">
          <Pairs items={[...TERMS.map((g) => ({ k: g.term, v: g.def })), ...GLOSSARY.filter((g) => !['Skyline', 'Mast', 'Slip'].includes(g.k ?? ''))]} />
        </Block>

        <Block title="Sources">
          {about?.sources?.length ? (
            <ul className="max-w-[62ch] list-disc space-y-1 pl-5 text-[15px] text-dim">
              {about.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <Pairs
              items={[
                { k: 'Ephemeris', v: 'NASA JPL Horizons System' },
                { k: 'Terrain', v: 'NASA Lunar Orbiter Laser Altimeter (LOLA) south polar elevation maps' },
                { k: 'Sites', v: `Coordinates of the ${SITES.length} sites, including the Artemis III candidate regions, mostly from the NASA Lunar Surface Data Book (ACD-50044 Rev A, May 2023)` },
              ]}
            />
          )}
        </Block>
      </div>

      <Link to="/slip" className="btn mt-6">
        Try the Slip navigator
      </Link>
    </main>
  )
}
