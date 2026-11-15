import { ArrowRightIcon, DownloadSimpleIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import Field from '../components/Field'
import MobileFold from '../components/MobileFold'
import { GoBadge, Tag } from '../components/Tag'
import { fetchFallback, type Fallback } from '../lib/api'
import { dayToDate } from '../lib/ephemeris'
import { dateLabel, dayLabel, pad2 } from '../lib/format'
import { goOf, type Go } from '../lib/go'
import { calendar, hoursToFirstSunset, lastStart, rankSites, tolerance, type Outcome } from '../lib/slip'
import { getSeries, SITES } from '../lib/sites'
import { useServerData } from '../lib/useServerData'
import { useScenario } from '../store/scenario'

const H2 = 'mb-2.5 text-2xl font-light uppercase leading-tight tracking-[0.16em]'
const INTRO_KEY = 'lunarnav-slip-intro-seen'

/** One site after the slip, whatever computed it (server ranking or bundled data). */
type Row = {
  site: number
  go: Go
  viable: boolean
  viableBefore: boolean
  terrain: boolean
  /** Main figure for the row, already worded. */
  figure: string
  dark: number | null
  /** Consecutive viable days around the slipped date (0 when not viable). */
  tolerance: number
  /** Nearest viable start day at this site, as a signed shift in days from the slipped date. */
  shift: number | null
  why: string[]
  // server only
  windowHours?: number
  windowHoursBefore?: number
}

const shiftWords = (d: number) => (d === 0 ? 'on this date' : d > 0 ? `${d} day${d > 1 ? 's' : ''} later` : `${-d} day${d < -1 ? 's' : ''} earlier`)
const sunWords = (h: number | null, where: string) =>
  h === null ? `at ${where} the Sun stays up to the end of the data` : h === 0 ? `at ${where} the Sun is already down` : `at ${where} the Sun sets after ${h} h`
const hoursOrDays = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} days` : `${Math.round(h)} h`)

function readIntroSeen() {
  try {
    return localStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return true
  }
}

export default function Slip() {
  const { site, day, slip, dur, minE, minD, maxDark, mast, requireEarth, set } = useScenario()
  const navigate = useNavigate()
  const series = useMemo(() => getSeries(mast), [mast])
  const needs = useMemo(() => ({ dur, minE, minD, maxDark, requireEarth }), [dur, minE, minD, maxDark, requireEarth])

  const last = lastStart(dur)
  const planned = Math.min(Math.floor(day), last)
  const maxSlip = Math.max(0, Math.floor((last - planned) / 7) * 7)
  const delay = Math.min(Math.round(slip / 7) * 7, maxSlip)
  const weeks = delay / 7
  const newDay = planned + delay
  const name = (i: number) => SITES[i].name
  const both = requireEarth ? 'Sun and Earth' : 'Sun'

  // Bundled data: every site, every start day (32 x ~85 evaluations, a few milliseconds).
  const cals = useMemo(() => SITES.map((s) => calendar(series[s.i], s.i, needs)), [series, needs])
  const cal = cals[site]
  const bundledRows = useMemo<Row[]>(
    () =>
      rankSites(series, newDay, needs, planned).map((o) => {
        const c = cals[o.site]
        let shift: number | null = null
        for (let k = 0; shift === null && (newDay - k >= 0 || newDay + k < c.length); k++) {
          if (c[newDay - k]?.pass) shift = -k
          else if (c[newDay + k]?.pass) shift = k
        }
        return {
          site: o.site,
          go: o.pass ? 'go' : 'nogo',
          viable: o.pass,
          viableBefore: o.before.pass,
          terrain: o.terrain,
          figure: `Sun ${o.E}%${requireEarth ? `, Earth ${o.D}%` : ''}`,
          dark: o.dark,
          tolerance: tolerance(c, newDay),
          shift,
          why: o.why,
        }
      }),
    [series, needs, newDay, planned, cals, requireEarth],
  )

  // Server: /api/fallback ranks every site by its continuous window when landing at the best hour, with close calls and slip tolerance.
  const fb = useServerData<Fallback>(`${planned}|${weeks}|${dur}|${requireEarth}|${mast}`, (sig) => fetchFallback(dayToDate(planned), weeks, dur, requireEarth, mast, sig))
  const serverRows = useMemo<Row[] | null>(() => {
    if (fb.state !== 'ok' || !fb.data) return null
    return fb.data.ranked.flatMap((e) => {
      const s = SITES.find((x) => x.id === e.siteId)
      if (!s) return []
      const why = e.viable ? [] : [`${both} for ${hoursOrDays(e.windowHours)} in a row, the stay needs ${hoursOrDays(dur * 24)}`]
      if (e.closeCall) why.push('Close call: the verdict flips if the skyline is 0.2° higher or lower')
      return [
        {
          site: s.i,
          go: goOf(e.viable, e.closeCall),
          viable: e.viable,
          viableBefore: e.viableBefore,
          terrain: e.terrain,
          figure: `${e.lowerBound ? 'at least ' : ''}${hoursOrDays(e.windowHours)} of ${both}`,
          dark: Math.round(e.longestDarkHours),
          tolerance: e.slipToleranceDays,
          shift: e.minShiftToViableDays,
          why,
          windowHours: e.windowHours,
          windowHoursBefore: e.windowHoursBefore,
        },
      ]
    })
  }, [fb, dur, both])

  const source = serverRows ? 'server' : 'bundled'
  const rows = serverRows ?? bundledRows
  const me = rows.find((r) => r.site === site) ?? bundledRows.find((r) => r.site === site)!
  const best = rows.find((r) => r.viable && r.terrain && r.site !== site)
  const changed = rows.filter((r) => r.terrain && r.viable !== r.viableBefore)
  const ranked = rows.filter((r) => r.terrain)
  const flat = rows.filter((r) => !r.terrain)

  // Bundled before/after for the planned site (shares and darkness over the stay).
  const before = cal[planned]
  const after = cal[newDay]
  const works = cal.filter((o) => o.pass).length
  let slack = 0
  while (before.pass && cal[planned + slack + 1]?.pass) slack++

  const [intro, setIntro] = useState(() => !readIntroSeen())
  const closeIntro = () => {
    setIntro(false)
    try {
      localStorage.setItem(INTRO_KEY, '1')
    } catch {
      /* private mode: the intro shows again next time */
    }
  }
  const example = () => {
    set({ slip: 14 })
    closeIntro()
    document.getElementById('answer')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  const open = (s: number, d: number) => {
    set({ site: s, day: d })
    navigate('/site')
  }
  const pick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = Math.floor(((e.clientX - r.left) / r.width) * (last + 1))
    set({ slip: Math.min(maxSlip, Math.max(0, Math.round((t - planned) / 7) * 7)) })
  }
  const pos = (t: number) => `${((t + 0.5) / (last + 1)) * 100}%`

  // The answer in one sentence, from whichever source is active.
  const lost = delay > 0 && me.viableBefore ? 'is no longer viable' : `does not work on ${dayLabel(newDay)}`
  const headline = me.viable ? `Stay at ${name(site)}.` : best ? `${name(site)} ${lost}. Move to ${name(best.site)}.` : `No site meets the mission on ${dateLabel(newDay)}.`
  const detail = me.viable
    ? `It still has ${me.figure}${me.dark !== null ? `, longest night ${me.dark} h` : ''}${delay ? ` after a ${weeks} week slip` : ''}.`
    : best
      ? `${name(best.site)} keeps ${best.figure}${best.dark !== null ? `, longest night ${best.dark} h` : ''}.`
      : 'Shorten the stay, lower the thresholds or raise the mast.'

  const sunsetHere = hoursToFirstSunset(series[site], newDay)
  const sunsetThere = best ? hoursToFirstSunset(series[best.site], newDay) : null

  const csv = () => {
    const head = 'rank,site,verdict,changedBySlip,figure,longestDarkHours,slipToleranceDays,nearestViableShiftDays,source'
    const lines = rows.map((r, i) => [i + 1, `"${name(r.site)}"`, r.go.toUpperCase(), r.viable !== r.viableBefore ? 'yes' : 'no', `"${r.figure}"`, r.dark ?? '', r.tolerance, r.shift ?? '', source].join(','))
    const text = `# LunarNav slip ranking: planned ${dateLabel(planned)}, slip ${weeks} weeks, stay ${dur} d, mast ${mast} m, Earth required: ${requireEarth}\n${head}\n${lines.join('\n')}\n`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
    a.download = `lunarnav-slip-${dayToDate(newDay).toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 pt-16 lg:grid-cols-[300px_1fr]">
      <form className="border-b border-line-soft p-5 sm:p-7 lg:border-b-0 lg:border-r" aria-label="Plan and delay" onSubmit={(e) => e.preventDefault()}>
        <MobileFold summary={<><b className="font-medium">{SITES[site].name}</b>, landing {dayLabel(planned)}, slip {delay} days, stay {dur} days</>}>
        <h2 className={H2}>The plan</h2>
        <p className="text-sm text-dim">Choose where and when you meant to land, then slide the delay.</p>
        <div className="mt-6">
          <label htmlFor="fSite" className="lab">
            Planned site
          </label>
          <select id="fSite" value={site} onChange={(e) => set({ site: Number(e.target.value) })} className="mt-2 min-h-11 w-full border border-line bg-bg px-3 text-sm text-ink">
            {SITES.map((s) => (
              <option key={s.i} value={s.i}>
                {pad2(s.i + 1)} {s.name}
              </option>
            ))}
          </select>
        </div>
        <Field id="fDay" label="Planned landing" value={planned} out={dayLabel(planned)} min={0} max={last} step={1} onChange={(v) => set({ day: v })} />
        <Field id="fSlip" label="Launch slips by" value={delay} out={`${weeks} week${weeks === 1 ? '' : 's'}`} min={0} max={maxSlip} step={7} onChange={(v) => set({ slip: v })} />

        <h2 className={`${H2} mt-10`}>The mission</h2>
        <p className="flex items-center gap-2 text-sm text-dim">
          <Tag kind="assumed" /> Set these for your lander.
        </p>
        <Field id="fDur" label="Stay on the surface" value={dur} out={`${dur} days`} min={2} max={14} step={0.5} onChange={(v) => set({ dur: v })} />
        <label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={requireEarth} onChange={(e) => set({ requireEarth: e.target.checked })} className="size-5 shrink-0 accent-[var(--color-ink)]" />
          Earth must be in view (direct-to-Earth radio)
        </label>
        <Field id="fE" label="Minimum sunlight" value={minE} out={`${minE}%`} min={30} max={100} step={1} onChange={(v) => set({ minE: v })} />
        {requireEarth && <Field id="fD" label="Minimum Earth link" value={minD} out={`${minD}%`} min={20} max={90} step={1} onChange={(v) => set({ minD: v })} />}
        <Field id="fB" label="Battery lasts" value={maxDark} out={`${maxDark} h`} min={12} max={240} step={6} onChange={(v) => set({ maxDark: v })} />
        <Field id="fM" label="Mast height" value={mast} out={`${mast} m`} min={0} max={10} step={0.5} onChange={(v) => set({ mast: v })} />
        <p className="mt-6 text-[13px] text-faint">
          The server judges a site by its continuous {both} window and uses the 2 m or 10 m skyline. Minimum shares and battery apply to the bundled-data views.
        </p>
        </MobileFold>
      </form>

      <section className="min-w-0 p-5 sm:p-7 lg:p-9" aria-label="What a slip changes">
        <h2 className={H2}>Slip navigator</h2>
        <p className="max-w-[60ch] text-sm text-dim">If the launch slips, does the site still work, and if not, what is the next best choice?</p>

        {intro && (
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border border-line px-4 py-3 text-sm" role="note">
            <span className="min-w-0 flex-1">New here? Try the classic case: the launch slips by two weeks.</span>
            <button type="button" className="btn min-h-10 px-4" onClick={example}>
              Show the example
            </button>
            <button type="button" aria-label="Dismiss" onClick={closeIntro} className="grid size-11 place-items-center text-dim hover:text-ink">
              <XIcon size={16} />
            </button>
          </div>
        )}

        <div id="answer" className="mt-6 scroll-mt-24 border-t border-line pt-5" aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            <GoBadge go={me.go} size={18} />
            <Tag kind={source} />
            {fb.state === 'loading' && <span className="text-xs text-faint">Asking the server</span>}
            {fb.state === 'error' && <span className="text-xs text-faint">The server did not answer, showing bundled data</span>}
          </div>
          <p className="mt-2 text-[clamp(26px,3.2vw,40px)] font-light leading-tight tracking-tight">{headline}</p>
          <p className="mt-2 max-w-[65ch] text-sm text-dim">{detail}</p>
          {me.why.length > 0 && (
            <ul className="mt-2 space-y-1 text-[13px] text-dim">
              {me.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {!me.viable && (
            <ul className="mt-5 grid gap-x-10 gap-y-3 text-sm md:grid-cols-2">
              <li>
                <div className="text-dim">Same site, other date</div>
                {me.shift !== null ? (
                  <button type="button" onClick={() => open(site, Math.max(0, newDay + me.shift!))} className="mt-0.5 flex min-h-11 items-center gap-2 text-left text-lg font-light hover:underline hover:underline-offset-4">
                    {dateLabel(newDay + me.shift)}, {shiftWords(me.shift)}
                    <ArrowRightIcon size={16} aria-hidden />
                  </button>
                ) : (
                  <div className="mt-0.5 text-lg font-light">No working date in the data</div>
                )}
              </li>
              <li>
                <div className="text-dim">Another site, same date</div>
                {best ? (
                  <button type="button" onClick={() => open(best.site, newDay)} className="mt-0.5 flex min-h-11 items-center gap-2 text-left text-lg font-light hover:underline hover:underline-offset-4">
                    {name(best.site)}
                    <ArrowRightIcon size={16} aria-hidden />
                  </button>
                ) : (
                  <div className="mt-0.5 text-lg font-light">No site works on {dateLabel(newDay)}</div>
                )}
              </li>
            </ul>
          )}
        </div>

        <div className="mt-10">
          <h3 className="flex flex-wrap items-center gap-3 text-base font-medium">
            Before and after at {name(site)} <Tag kind={source} />
          </h3>
          <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
            <Side
              title="As planned"
              when={planned}
              muted
              viable={me.viableBefore}
              lines={source === 'server' ? [`${hoursOrDays(me.windowHoursBefore ?? 0)} of ${both} in a row`] : outcomeLines(before, requireEarth)}
            />
            <Side
              title={delay ? `After a ${weeks} week slip` : 'No delay'}
              when={newDay}
              viable={me.viable}
              lines={source === 'server' ? [`${me.figure} in a row`, `Longest night ${me.dark} h`] : outcomeLines(after, requireEarth)}
            />
          </div>
          <ul className="mt-5 space-y-1.5 text-sm text-dim">
            {source === 'server' && me.windowHours !== undefined && me.windowHoursBefore !== undefined && delay > 0 && (
              <li>
                The slip {me.windowHours >= me.windowHoursBefore ? 'adds' : 'costs'} <b className="font-medium text-ink">{Math.abs(Math.round(me.windowHours - me.windowHoursBefore))} h</b> of continuous {both}.
              </li>
            )}
            {source === 'bundled' && delay > 0 && (
              <li>
                Sunlight goes from {before.E}% to <b className="font-medium text-ink">{after.E}%</b>
                {requireEarth && (
                  <>
                    , Earth link from {before.D}% to <b className="font-medium text-ink">{after.D}%</b>
                  </>
                )}
                .
              </li>
            )}
            <li>
              {me.viable ? `This landing stays viable for ${me.tolerance} consecutive day${me.tolerance === 1 ? '' : 's'} around ${dayLabel(newDay)}.` : `On ${dayLabel(newDay)} this landing does not work.`}
              {source === 'bundled' && before.pass && ` The original plan could slip ${slack} more day${slack === 1 ? '' : 's'} and still work.`}
            </li>
            {source === 'bundled' && best && (
              <li>
                Landing on {dayLabel(newDay)}: {sunWords(sunsetHere, name(site))}; {sunWords(sunsetThere, name(best.site))}
                {sunsetHere !== null && sunsetThere !== null && sunsetHere > 0 && sunsetThere > 0 && sunsetHere !== sunsetThere
                  ? `. ${sunsetHere < sunsetThere ? name(site) : name(best.site)} loses it first, by ${Math.abs(sunsetHere - sunsetThere)} h`
                  : ''}
                . <Tag kind="bundled" />
              </li>
            )}
          </ul>
        </div>

        <div className="mt-10">
          <h3 className="flex flex-wrap items-center gap-3 text-base font-medium">
            {name(site)}, every start date <Tag kind="bundled" />
          </h3>
          <p className="mt-1 text-sm text-dim">
            Works on {works} of {cal.length} start dates. Click the strip to try a date.
          </p>
          <div className="relative mt-4">
            <div
              role="img"
              aria-label={`${name(site)} meets the mission on ${works} of ${cal.length} start dates. Planned ${dayLabel(planned)}, slipped to ${dayLabel(newDay)}.`}
              onClick={pick}
              className="flex h-10 cursor-pointer gap-px"
            >
              {cal.map((o) => (
                <i key={o.t0} className={`block flex-1 ${o.pass ? 'bg-ok' : 'bg-[#12161d]'}`} />
              ))}
            </div>
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-10" aria-hidden>
              {[planned, newDay].map((t, i) => (
                <i key={i} className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink" style={{ left: pos(t) }} />
              ))}
            </div>
            <div className="relative mt-1 h-5 text-xs text-ink" aria-hidden>
              <span className="absolute -translate-x-full whitespace-nowrap pr-1.5" style={{ left: pos(planned) }}>
                Planned
              </span>
              <span className="absolute whitespace-nowrap pl-1.5" style={{ left: pos(newDay) }}>
                New date
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-faint">
              {[0, 0.33, 0.66, 1].map((f) => (
                <span key={f}>{dayLabel(Math.round(f * last))}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex flex-wrap items-center gap-3 text-base font-medium">
              All sites on {dateLabel(newDay)} <Tag kind={source} />
            </h3>
            <button type="button" onClick={csv} className="flex min-h-11 items-center gap-2 text-sm text-dim hover:text-ink">
              <DownloadSimpleIcon size={16} aria-hidden /> Download CSV
            </button>
          </div>
          {changed.length > 0 && delay > 0 && (
            <p className="mt-1 text-sm text-dim">
              The slip changes the verdict at {changed.length} site{changed.length > 1 ? 's' : ''}, marked below.
            </p>
          )}
          <ol className="mt-3">
            {ranked.slice(0, 5).map((r, i) => (
              <RankRow key={r.site} r={r} i={i} planned={r.site === site} showChange={delay > 0} onOpen={() => open(r.site, newDay)} />
            ))}
          </ol>
          {ranked.length > 5 && (
            <details className="mt-1">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm text-dim hover:text-ink">Show the other {ranked.length - 5} sites</summary>
              <ol>
                {ranked.slice(5).map((r, i) => (
                  <RankRow key={r.site} r={r} i={i + 5} planned={r.site === site} showChange={delay > 0} onOpen={() => open(r.site, newDay)} />
                ))}
              </ol>
            </details>
          )}
          {flat.length > 0 && <p className="mt-4 text-[13px] text-faint">Not ranked, outside the relief map (flat horizon): {flat.map((r) => name(r.site)).join(', ')}.</p>}
        </div>
      </section>
    </div>
  )
}

const outcomeLines = (o: Outcome, requireEarth: boolean) => [`Sunlight ${o.E}%${requireEarth ? `, Earth link ${o.D}%` : ''}`, `Longest dark ${o.dark} h`, ...o.why]

function Side({ title, when, viable, lines, muted }: { title: string; when: number; viable: boolean; lines: string[]; muted?: boolean }) {
  return (
    <div className={`border-t border-line pt-4 ${muted ? 'text-dim' : ''}`}>
      <div className="lab">{title}</div>
      <div className="mt-1 text-[26px] font-light leading-tight tracking-tight">{dateLabel(when)}</div>
      <div className={`mt-2 text-sm ${muted ? 'opacity-75' : ''}`}>
        <GoBadge go={viable ? 'go' : 'nogo'} />
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

function RankRow({ r, i, planned, showChange, onOpen }: { r: Row; i: number; planned: boolean; showChange: boolean; onOpen: () => void }) {
  const changed = showChange && r.viable !== r.viableBefore
  return (
    <li className="border-t border-line-soft">
      <button type="button" onClick={onOpen} className="grid min-h-12 w-full grid-cols-[28px_1fr_auto] items-center gap-3 py-2.5 text-left hover:bg-white/5 md:grid-cols-[28px_1fr_280px_96px]">
        <span className="text-xs text-faint">{pad2(i + 1)}</span>
        <span className="min-w-0 text-sm">
          {SITES[r.site].name}
          {planned && <span className="ml-2 text-xs text-dim">planned site</span>}
          {changed && <span className="mt-0.5 block text-xs text-warn">Changed: {r.viableBefore ? 'viable' : 'not viable'} before the slip</span>}
          <span className="mt-0.5 block text-[13px] text-dim md:hidden">{r.figure}</span>
        </span>
        <span className="hidden text-[13px] text-dim md:block">
          {r.figure}
          {r.dark !== null && `, night ${r.dark} h`}
          {r.viable ? `, can slip ${r.tolerance} d` : r.shift !== null ? `, works ${shiftWords(r.shift)}` : ''}
        </span>
        <span className="justify-self-end text-sm">
          <GoBadge go={r.go} />
        </span>
      </button>
    </li>
  )
}
