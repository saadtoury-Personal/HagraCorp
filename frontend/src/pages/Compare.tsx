import { CheckIcon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import Field from '../components/Field'
import MobileFold from '../components/MobileFold'
import { Tag } from '../components/Tag'
import { dayLabel, pad2 } from '../lib/format'
import { getSeries, metrics, SITES } from '../lib/sites'
import SourceTag from '../components/SourceTag'
import { useSiteMetrics } from '../lib/useSiteMetrics'
import { useScenario } from '../store/scenario'

const COLS = 10
const COL_STEP = 9 // 10 start dates over 90 days (a human lander stays viable about 90 days, per the 2023 white paper)

/** Sunlight and Earth link of one recommended window: the server's figures when it answers. */
function PickStats({ site, id, t0, dur, mast }: { site: number; id: string; t0: number; dur: number; mast: number }) {
  const m = useSiteMetrics(site, id, t0, dur, mast)
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
      <span>
        Sunlight <b className="font-medium">{m.E}%</b>
      </span>
      <span>
        Earth link <b className="font-medium">{m.D}%</b>
      </span>
      <SourceTag source={m.source} />
    </div>
  )
}

export default function Compare() {
  const { dur, minE, minD, mast, set } = useScenario()
  const navigate = useNavigate()
  const series = useMemo(() => getSeries(mast), [mast])

  const { cells, top } = useMemo(() => {
    const cells = SITES.flatMap((s) =>
      Array.from({ length: COLS }, (_, c) => {
        const t0 = c * COL_STEP
        const m = metrics(series[s.i], t0, dur)
        const pass = m.E >= minE && m.D >= minD
        const near = !pass && m.E >= minE - 8 && m.D >= minD - 8
        return { s, t0, m, sc: Math.min(m.E, m.D), pass, near }
      }),
    )
    const seen = new Set<number>() // one window per site, so the shortlist offers real alternatives
    const top = cells
      .filter((c) => c.pass && c.s.terrain) // a flat skyline (no relief map) cannot be recommended over real terrain
      .sort((a, b) => b.m.E + b.m.D - (a.m.E + a.m.D) || a.t0 - b.t0)
      .filter((c) => !seen.has(c.s.i) && seen.add(c.s.i))
      .slice(0, 3)
    return { cells, top }
  }, [series, dur, minE, minD])

  const open = (site: number, day?: number) => {
    set(day === undefined ? { site } : { site, day })
    navigate('/site')
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 border-line-soft pt-16 xl:grid-cols-[270px_minmax(0,1fr)_290px]">
      <form className="border-b border-line-soft p-5 sm:p-7 xl:border-b-0 xl:border-r" aria-label="Mission needs" onSubmit={(e) => e.preventDefault()}>
        <MobileFold summary={<><b className="font-medium">Your mission</b>: {dur} days, sunlight at least {minE}%, Earth link at least {minD}%, mast {mast} m</>}>
        <h2 className="mb-2.5 text-2xl font-light uppercase leading-tight tracking-[0.16em]">Your mission</h2>
        <p className="text-sm text-dim">Describe what you need. The tool ranks the best windows.</p>
        <Field id="fDur" label="Duration" value={dur} out={`${dur} days`} min={2} max={14} step={0.5} onChange={(v) => set({ dur: v })} />
        <Field id="fE" label="Minimum sunlight" value={minE} out={`${minE}%`} min={30} max={100} step={1} onChange={(v) => set({ minE: v })} />
        <Field id="fD" label="Minimum Earth link" value={minD} out={`${minD}%`} min={20} max={90} step={1} onChange={(v) => set({ minD: v })} />
        <Field id="fM" label="Mast height" value={mast} out={`${mast} m`} min={0} max={10} step={0.5} onChange={(v) => set({ mast: v })} />
        <button type="button" className="btn btn-ghost mt-7 min-h-10 px-5" onClick={() => print()}>
          Export sheet
        </button>
        <p className="mt-6 text-[13px] text-faint">The 2023 NASA white paper suggests a first landing site sunlit for about 6 to 6.5 days. The default stay is 6 days.</p>
        </MobileFold>
      </form>

      <section className="min-w-0 p-5 sm:p-7 max-xl:order-3" aria-label="Sites by date">
        <h2 className="mb-2.5 flex flex-wrap items-center gap-3 text-2xl font-light uppercase leading-tight tracking-[0.16em]">
          Sites and dates <Tag kind="bundled" />
        </h2>
        <p className="text-sm text-dim">
          Mission start over the next {COLS * COL_STEP} days, {dur} d long, sunlight at least {minE}%, Earth link at least {minD}%
        </p>
        <div className="mt-5 overflow-x-auto">
          <div role="grid" aria-label="Viability by site and start date" className="grid min-w-[600px] grid-cols-[170px_repeat(10,minmax(38px,1fr))] items-stretch gap-[3px]">
            <div />
            {Array.from({ length: COLS }, (_, c) => (
              <div key={c} className="pb-2 text-center text-xs text-faint">
                {dayLabel(c * COL_STEP)}
              </div>
            ))}
            {SITES.map((s) => (
              <div key={s.i} className="contents">
                <button type="button" onClick={() => open(s.i)} className="flex min-h-[34px] items-center gap-2.5 text-left text-sm text-dim transition-colors hover:text-ink">
                  <span className="w-5 text-xs text-faint">{pad2(s.i + 1)}</span>
                  {s.name}
                </button>
                {cells
                  .filter((c) => c.s.i === s.i)
                  .map((c) => {
                    const best = top[0] === c
                    const state = c.pass ? 'meets the mission' : c.near ? 'within 8 points' : 'falls short'
                    const strong = c.pass && c.sc >= Math.max(minE, minD) + 10
                    return (
                      <button
                        key={c.t0}
                        type="button"
                        onClick={() => open(s.i, c.t0)}
                        title={`${s.name}, ${dayLabel(c.t0)}, sunlight ${c.m.E}%, Earth link ${c.m.D}%`}
                        aria-label={`${s.name}, start ${dayLabel(c.t0)}: ${state}, score ${c.sc}%`}
                        className={`relative grid min-h-[34px] place-items-center text-xs font-medium outline-offset-0 hover:z-10 hover:outline hover:outline-1 hover:outline-ink focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
                          c.pass ? (strong ? 'bg-[#2da673] text-[#04130c]' : 'bg-[#1f7f58] text-white') : c.near ? 'hatch bg-[#6f5412] text-white' : 'bg-[#12161d] text-faint'
                        } ${best ? 'z-[1] outline outline-2 outline-ink' : ''}`}
                      >
                        <span className="flex items-center gap-0.5">
                          {c.pass && <CheckIcon size={10} weight="bold" aria-hidden />}
                          {c.sc}
                        </span>
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-dim">
          <li>
            <i className="mr-2 inline-block size-3 bg-[#2da673] align-[-2px]" />
            Meets the mission (check mark)
          </li>
          <li>
            <i className="hatch mr-2 inline-block size-3 bg-[#6f5412] align-[-2px]" />
            Within 8 points (hatched)
          </li>
          <li>
            <i className="mr-2 inline-block size-3 bg-[#12161d] align-[-2px] outline outline-1 outline-line" />
            Falls short
          </li>
          <li>Cell value: the lower of the two scores (%)</li>
          <li>
            Grid: <SourceTag source="bundled" /> with the server’s rules; the recommended windows are checked by the server when it is on
          </li>
        </ul>
      </section>

      <aside className="border-t border-line-soft p-5 sm:p-7 xl:border-l xl:border-t-0 max-xl:order-2" aria-label="Best combinations">
        <h2 className="mb-2.5 text-2xl font-light uppercase leading-tight tracking-[0.16em]">Recommended</h2>
        <p className="text-sm text-dim">The three best windows for your mission.</p>
        <div className="mt-5">
          {top.length ? (
            top.map((c, i) => (
              <button key={c.s.i} type="button" onClick={() => open(c.s.i, c.t0)} className="group block w-full border-t border-line-soft py-5 text-left">
                <div className="lab !text-faint">{i === 0 ? 'Best match' : `Alternative ${i}`}</div>
                <div className="mt-0.5 text-[27px] font-light leading-tight tracking-tight group-hover:underline group-hover:underline-offset-4">{c.s.name}</div>
                <div className="mb-2.5 mt-0.5 text-sm text-dim">
                  {dayLabel(c.t0)} to {dayLabel(c.t0 + dur)}
                </div>
                <PickStats site={c.s.i} id={c.s.id} t0={c.t0} dur={dur} mast={mast} />
              </button>
            ))
          ) : (
            <p className="py-5 text-sm text-dim">No window meets these needs. Shorten the mission, lower the thresholds or raise the mast.</p>
          )}
        </div>
      </aside>
    </div>
  )
}
