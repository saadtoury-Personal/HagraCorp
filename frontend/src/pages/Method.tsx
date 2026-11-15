import { Link } from 'react-router'
import { Tag } from '../components/Tag'
import { fetchValidation, type Rule } from '../lib/api'
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

export default function Method() {
  const status = useServer((s) => s.status)
  const about = useServer((s) => s.about)
  const validation = useServerData<unknown>('validation', (sig) => fetchValidation(sig))
  const rules = [...(about?.rules ?? []), ...(about?.validated ?? [])]

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
          {validation.state === 'ok' ? (
            <details className="mt-4">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] text-ink">
                Validation report from the server <Tag kind="server" />
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto border border-line-soft p-4 text-xs leading-relaxed text-dim">{JSON.stringify(validation.data, null, 2)}</pre>
            </details>
          ) : (
            <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-dim">
              {validation.state === 'offline'
                ? 'The comparisons with JPL Horizons and NASA PGDA maps are published by the LunarNav server, which is not reachable right now.'
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
          <Pairs items={GLOSSARY} />
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
