import { ArrowRightIcon, CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import { useMemo, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import Field from '../components/Field'
import MobileFold from '../components/MobileFold'
import ServerRanking from '../features/slip/ServerRanking'
import { dateLabel, dayLabel, pad2 } from '../lib/format'
import { calendar, lastStart, nextWorking, rankSites, type Outcome } from '../lib/slip'
import { getSeries, SITES } from '../lib/sites'
import { useScenario } from '../store/scenario'

const H2 = 'mb-2.5 text-2xl font-light uppercase leading-tight tracking-[0.16em]'

function Status({ pass, size = 18 }: { pass: boolean; size?: number }) {
  const Icon = pass ? CheckCircleIcon : XCircleIcon
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${pass ? 'text-ok' : 'text-bad'}`}>
      <Icon size={size} weight="fill" aria-hidden />
      {pass ? 'Meets the mission' : 'Falls short'}
    </span>
  )
}

function OutcomeBlock({ title, when, o }: { title: string; when: number; o: Outcome }) {
  return (
    <div className="border-t border-line pt-4">
      <div className="lab">{title}</div>
      <div className="mt-1 text-[26px] font-light leading-tight tracking-tight">{dateLabel(when)}</div>
      <div className="mt-2 text-sm">
        <Status pass={o.pass} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-dim">Sunlight</dt>
          <dd className="text-lg font-light">{o.E}%</dd>
        </div>
        <div>
          <dt className="text-dim">Earth link</dt>
          <dd className="text-lg font-light">{o.D}%</dd>
        </div>
        <div>
          <dt className="text-dim">Longest dark</dt>
          <dd className="text-lg font-light">{o.dark} h</dd>
        </div>
      </dl>
      {o.why.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] text-dim">
          {o.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Slip() {
  const { site, day, slip, dur, minE, minD, maxDark, mast, set } = useScenario()
  const navigate = useNavigate()
  const series = useMemo(() => getSeries(mast), [mast])
  const needs = useMemo(() => ({ dur, minE, minD, maxDark }), [dur, minE, minD, maxDark])

  const last = lastStart(dur)
  const planned = Math.min(Math.floor(day), last)
  const maxSlip = Math.max(0, last - planned)
  const delay = Math.min(slip, maxSlip)
  const newDay = planned + delay

  const cal = useMemo(() => calendar(series[site], site, needs), [series, site, needs])
  const before = cal[planned]
  const after = cal[newDay]
  const later = nextWorking(cal, newDay)
  const ranked = useMemo(() => rankSites(series, newDay, needs), [series, newDay, needs])
  const fallback = ranked.find((o) => o.pass && o.site !== site)
  const works = cal.filter((o) => o.pass).length

  const open = (s: number, d: number) => {
    set({ site: s, day: d })
    navigate('/site')
  }
  const pick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = Math.min(last, Math.max(planned, Math.floor(((e.clientX - r.left) / r.width) * (last + 1))))
    set({ slip: t - planned })
  }

  const headline = after.pass ? `Stay at ${SITES[site].name}.` : later ? `Wait for ${SITES[site].name}, or move.` : fallback ? `Move to ${SITES[fallback.site].name}.` : 'No site meets the mission on this date.'
  const pos = (t: number) => `${((t + 0.5) / (last + 1)) * 100}%`

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
        <Field id="fSlip" label="Launch slips by" value={delay} out={`${delay} days`} min={0} max={maxSlip} step={1} onChange={(v) => set({ slip: v })} />

        <h2 className={`${H2} mt-10`}>The mission needs</h2>
        <Field id="fDur" label="Stay on the surface" value={dur} out={`${dur} days`} min={2} max={14} step={0.5} onChange={(v) => set({ dur: v })} />
        <Field id="fE" label="Minimum sunlight" value={minE} out={`${minE}%`} min={30} max={100} step={1} onChange={(v) => set({ minE: v })} />
        <Field id="fD" label="Minimum Earth link" value={minD} out={`${minD}%`} min={20} max={90} step={1} onChange={(v) => set({ minD: v })} />
        <Field id="fB" label="Battery lasts" value={maxDark} out={`${maxDark} h`} min={12} max={240} step={6} onChange={(v) => set({ maxDark: v })} />
        <Field id="fM" label="Mast height" value={mast} out={`${mast} m`} min={0} max={10} step={0.5} onChange={(v) => set({ mast: v })} />
        </MobileFold>
      </form>

      <section className="min-w-0 p-5 sm:p-7 lg:p-9" aria-label="What a slip changes">
        <h2 className={H2}>Slip navigator</h2>
        <p className="max-w-[60ch] text-sm text-dim">If the launch slips, does the site still work, and if not, what is the next best choice?</p>

        <div className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
          <OutcomeBlock title="As planned" when={planned} o={before} />
          <OutcomeBlock title={delay ? `After a ${delay} day slip` : 'No delay'} when={newDay} o={after} />
        </div>

        <div className="mt-8 border-t border-line pt-5" aria-live="polite">
          <div className="lab">Recommendation</div>
          <p className="mt-1 text-[clamp(26px,3.2vw,40px)] font-light leading-tight tracking-tight">{headline}</p>
          {after.pass ? (
            <p className="mt-2 text-sm text-dim">It still meets every need on {dateLabel(newDay)}. No change required.</p>
          ) : (
            <ul className="mt-4 grid gap-x-10 gap-y-3 text-sm md:grid-cols-2">
              <li>
                <div className="text-dim">Same site, later</div>
                {later ? (
                  <button type="button" onClick={() => open(site, later.t0)} className="mt-0.5 flex min-h-11 items-center gap-2 text-left text-lg font-light hover:underline hover:underline-offset-4">
                    {dateLabel(later.t0)}, {later.t0 - newDay} days after the new date
                    <ArrowRightIcon size={16} aria-hidden />
                  </button>
                ) : (
                  <div className="mt-0.5 text-lg font-light">No working date in the next 90 days</div>
                )}
              </li>
              <li>
                <div className="text-dim">Another site, same date</div>
                {fallback ? (
                  <button type="button" onClick={() => open(fallback.site, newDay)} className="mt-0.5 flex min-h-11 items-center gap-2 text-left text-lg font-light hover:underline hover:underline-offset-4">
                    {SITES[fallback.site].name}, sunlight {fallback.E}%, Earth link {fallback.D}%
                    <ArrowRightIcon size={16} aria-hidden />
                  </button>
                ) : (
                  <div className="mt-0.5 text-lg font-light">No site works on {dateLabel(newDay)}</div>
                )}
              </li>
            </ul>
          )}
        </div>

        <div className="mt-8">
          <h3 className="text-base font-medium">{SITES[site].name}, every start date</h3>
          <p className="mt-1 text-sm text-dim">
            Works on {works} of {cal.length} start dates. Click the strip to try a date.
          </p>
          <div className="relative mt-4">
            <div
              role="img"
              aria-label={`${SITES[site].name} meets the mission on ${works} of ${cal.length} start dates. Planned ${dayLabel(planned)}, slipped to ${dayLabel(newDay)}.`}
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

        <div className="mt-8">
          <h3 className="text-base font-medium">All sites on {dateLabel(newDay)}</h3>
          <ol className="mt-3">
            {ranked.slice(0, 5).map((o, i) => (
              <Row key={o.site} o={o} i={i} planned={o.site === site} onOpen={() => open(o.site, newDay)} />
            ))}
          </ol>
          <details className="group mt-1">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-dim hover:text-ink">Show the other {ranked.length - 5} sites</summary>
            <ol>
              {ranked.slice(5).map((o, i) => (
                <Row key={o.site} o={o} i={i + 5} planned={o.site === site} onOpen={() => open(o.site, newDay)} />
              ))}
            </ol>
          </details>
        </div>

        <ServerRanking planned={planned} delayDays={delay} dur={dur} mast={mast} open={open} />
      </section>
    </div>
  )
}

function Row({ o, i, planned, onOpen }: { o: Outcome; i: number; planned: boolean; onOpen: () => void }) {
  return (
    <li className="border-t border-line-soft">
      <button type="button" onClick={onOpen} className="grid min-h-12 w-full grid-cols-[28px_1fr_auto] items-center gap-3 py-2 text-left hover:bg-white/5 md:grid-cols-[28px_1fr_150px_190px]">
        <span className="text-xs text-faint">{pad2(i + 1)}</span>
        <span className="text-sm">
          {SITES[o.site].name}
          {planned && <span className="ml-2 text-xs text-dim">planned site</span>}
        </span>
        <span className="hidden text-[13px] text-dim md:block">
          Sun {o.E}%, Earth {o.D}%, dark {o.dark} h
        </span>
        <span className="justify-self-end text-sm">
          <Status pass={o.pass} size={16} />
        </span>
      </button>
    </li>
  )
}
