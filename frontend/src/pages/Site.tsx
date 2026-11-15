import { CaretLeftIcon, CaretRightIcon, PlayIcon, StopIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import TimeBar from '../components/TimeBar'
import DetailsPanel from '../features/site/DetailsPanel'
import Horizon from '../features/site/Horizon'
import Lanes from '../features/site/Lanes'
import { pad2, toneClass } from '../lib/format'
import { frac, getSeries, metrics, SITES, verdict } from '../lib/sites'
import { SPAN_DAYS } from '../lib/ephemeris'
import { useScenario } from '../store/scenario'

const TOUR_MS = 7000

function Seg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex border border-line bg-bg/70" role="group" aria-label={label}>
      {children}
    </div>
  )
}
const segBtn = 'min-h-11 px-4 text-xs font-medium uppercase tracking-[0.14em] text-dim transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg border-l border-line first:border-l-0'

export default function Site() {
  const { site, day, dur, mast, minD, set } = useScenario()
  const series = useMemo(() => getSeries(mast), [mast])
  const sr = series[site]
  const s = SITES[site]
  const m = metrics(sr, day, dur)
  const v = verdict(m.E, m.D)

  const [mode, setMode] = useState<'lander' | 'orbit'>('lander')
  const [drawer, setDrawer] = useState<'regions' | 'details' | null>(null)
  const [params, setParams] = useSearchParams()
  const [tour, setTour] = useState(params.get('tour') === '1')
  const tourStep = useRef(site)

  // Guided tour: step through the 13 regions, one every few seconds.
  useEffect(() => {
    if (!tour) return
    const id = setInterval(() => {
      tourStep.current = (tourStep.current + 1) % SITES.length
      set({ site: tourStep.current })
    }, TOUR_MS)
    return () => clearInterval(id)
  }, [tour, set])
  useEffect(() => {
    if (params.get('tour') === '1') {
      tourStep.current = 0
      set({ site: 0 })
      setParams({}, { replace: true })
    }
  }, [params, setParams, set])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(null)
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [])

  const go = (i: number) => {
    setTour(false)
    set({ site: (i + SITES.length) % SITES.length })
  }
  const toggle = (d: 'regions' | 'details') => setDrawer((x) => (x === d ? null : d))

  const stats = [
    ['Assessment', v.word, toneClass[v.tone]],
    ['Sunlight', `${m.E}%`, ''],
    ['Earth link', `${m.D}%`, ''],
    ['Longest night', `${Math.round(sr.night)} h`, ''],
  ]

  return (
    <div className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <div className="absolute inset-x-0 bottom-[170px] top-0 md:bottom-[150px]">
          <div className="mx-auto size-full max-w-[1400px] pt-52 lg:pt-16">
            <Horizon site={site} day={day} dur={dur} mast={mast} mode={mode} />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-5 top-20 z-30 flex flex-col gap-3 md:inset-x-9 lg:flex-row lg:items-start lg:justify-between">
        <header className="pointer-events-none">
          <h1 className="max-w-[14em] text-[clamp(24px,3.8vw,52px)] font-light uppercase leading-[1.12] tracking-[0.16em] [text-shadow:0_1px_16px_#000]">{s.name}</h1>
          <p className="mt-2 text-sm text-dim">Region {site + 1} of 13, landing site radius 100 m, modelled horizon (LOLA terrain pending)</p>
          {tour && (
            <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-dim">
              <span>
                Segment {site + 1} / 13
              </span>
              <i key={site} className="relative block h-px w-28 bg-line">
                <b className="tour-bar absolute inset-y-0 left-0 bg-ink" style={{ animationDuration: `${TOUR_MS}ms` }} />
              </i>
            </div>
          )}
        </header>

        <div className="pointer-events-auto flex flex-wrap gap-2.5 lg:justify-end">
          <Seg label="Region">
            <button type="button" className={segBtn} aria-label="Previous region" onClick={() => go(site - 1)}>
              <CaretLeftIcon size={14} />
            </button>
            <span className="grid min-w-20 place-items-center border-l border-line text-xs tracking-[0.14em]">
              {pad2(site + 1)} / 13
            </span>
            <button type="button" className={segBtn} aria-label="Next region" onClick={() => go(site + 1)}>
              <CaretRightIcon size={14} />
            </button>
          </Seg>
          <Seg label="Point of view">
            <button type="button" className={segBtn} aria-pressed={mode === 'lander'} onClick={() => setMode('lander')}>
              Lander
            </button>
            <button type="button" className={segBtn} aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>
              Orbit
            </button>
          </Seg>
          <Seg label="Panels">
            <button type="button" className={segBtn} aria-pressed={drawer === 'regions'} onClick={() => toggle('regions')}>
              Regions
            </button>
            <button type="button" className={segBtn} aria-pressed={drawer === 'details'} onClick={() => toggle('details')}>
              Details
            </button>
          </Seg>
          <button type="button" className="btn btn-ghost bg-bg/70" aria-pressed={tour} onClick={() => setTour((t) => !t)}>
            {tour ? <StopIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
            {tour ? 'Stop tour' : 'Guided tour'}
          </button>
        </div>
        </div>

        <dl className="absolute inset-x-5 bottom-[0px] z-[4] grid grid-cols-2 border-t border-line md:inset-x-9 md:grid-cols-4">
          {stats.map(([k, val, tone], i) => (
            <div key={k} className={`py-2.5 pr-4 ${i % 2 ? 'border-l border-line-soft pl-4' : ''} ${i > 1 ? 'border-t border-line-soft md:border-t-0' : ''} md:border-l md:pl-5 md:first:border-l-0 md:first:pl-0`}>
              <dt className="lab">{k}</dt>
              <dd className={`text-[26px] font-light leading-tight [text-shadow:0_1px_12px_#000] ${tone}`}>{val}</dd>
            </div>
          ))}
        </dl>

        <aside
          aria-label="Candidate regions"
          aria-hidden={drawer !== 'regions'}
          inert={drawer !== 'regions'}
          className={`absolute bottom-0 left-0 top-16 z-40 w-[min(100%,300px)] lg:top-[136px] lg:z-20 overflow-auto border-r border-line-soft bg-bg/95 transition-transform duration-500 ease-out-expo ${drawer === 'regions' ? '' : '-translate-x-full'}`}
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-line-soft bg-bg px-5 py-4">
            <span className="lab">13 candidate regions</span>
            <button type="button" aria-label="Close regions" className="grid size-11 place-items-center text-dim hover:text-ink" onClick={() => setDrawer(null)}>
              <XIcon size={16} />
            </button>
          </div>
          <ol>
            {SITES.map((x) => {
              const pct = Math.round(100 * frac(series[x.i].sun, 0, SPAN_DAYS))
              return (
                <li key={x.i}>
                  <button
                    type="button"
                    aria-current={x.i === site}
                    onClick={() => {
                      go(x.i)
                      setDrawer(null)
                    }}
                    className="grid min-h-12 w-full grid-cols-[28px_1fr_46px] items-center gap-2 border-b border-line-soft px-5 py-3 text-left text-dim transition-colors hover:text-ink aria-[current=true]:bg-white/5 aria-[current=true]:text-ink"
                  >
                    <span className="text-xs tracking-[0.08em] text-faint">{pad2(x.i + 1)}</span>
                    <span className="text-sm leading-snug">{x.name}</span>
                    <span className="relative h-0.5 bg-line-soft" title={`Sun above the horizon ${pct}% of the next 90 days`}>
                      <i className="absolute inset-y-0 left-0 bg-sun" style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <aside
          aria-label="Site assessment"
          aria-hidden={drawer !== 'details'}
          inert={drawer !== 'details'}
          className={`absolute bottom-0 right-0 top-16 z-40 w-[min(100%,360px)] lg:top-[136px] lg:z-20 overflow-auto border-l border-line-soft bg-bg/95 px-6 pb-8 pt-6 transition-transform duration-500 ease-out-expo ${drawer === 'details' ? '' : 'translate-x-full'}`}
        >
          <button type="button" aria-label="Close details" className="absolute right-2 top-2 grid size-11 place-items-center text-dim hover:text-ink" onClick={() => setDrawer(null)}>
            <XIcon size={16} />
          </button>
          <DetailsPanel site={site} series={sr} day={day} dur={dur} mast={mast} minD={minD} onMast={(x) => set({ mast: x })} />
        </aside>
      </div>

      <div className="relative z-20">
        <Lanes series={sr} day={day} dur={dur} onSeek={(d) => set({ day: d, playing: false })} />
        <TimeBar />
      </div>
    </div>
  )
}
