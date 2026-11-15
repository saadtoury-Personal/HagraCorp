import { CaretLeftIcon, CaretRightIcon, PlayIcon, StopIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import InfoTip from '../components/InfoTip'
import Term from '../components/Term'
import TimeBar from '../components/TimeBar'
import DetailsPanel from '../features/site/DetailsPanel'
import ElevationChart from '../features/site/ElevationChart'
import OrbitDiagram from '../features/site/OrbitDiagram'
import { useSky } from '../lib/sky'
import Horizon from '../features/site/Horizon'
import Lanes from '../features/site/Lanes'
import { categoryLabel, coords, pad2, toneClass } from '../lib/format'
import { frac, getSeries, metrics, SITES, verdict } from '../lib/sites'
import { SPAN_DAYS } from '../lib/ephemeris'
import { useScenario } from '../store/scenario'

const TOUR_MS = 7000

/** Four views of the same site and dates, all drawn from data (SVG): the horizon, the sky dome, the elevation curves and the Earth-Moon orbit. */
type Mode = 'panorama' | 'polar' | 'elevation' | 'orbit'
/** One sentence on how to read each view, shown under the title. */
const MODE_HELP: Record<Mode, string> = {
  panorama: 'The horizon around the lander. The gold line is the Sun\u2019s path and the blue line Earth\u2019s during the stay: each can be used only while above the dark skyline.',
  polar: 'The whole sky seen from straight above the lander: the centre is overhead and the edge is the horizon. Gold is the Sun\u2019s path, blue is Earth\u2019s.',
  elevation: 'How high the Sun (gold) and Earth (blue) climb. Dashed lines are the hills blocking the view in the same direction: a body is usable while its solid line is above its dashed line.',
  orbit: 'The Moon on its orbit around Earth on the chosen date. The gold arc is how far the Moon travels during the stay, which decides the lighting.',
}
const MODES: [Mode, string][] = [
  ['panorama', 'Panorama'],
  ['polar', 'Polar'],
  ['elevation', 'Elevation'],
  ['orbit', 'Orbit'],
]

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

  const sky = useSky(site, s.id, day, mast)
  const [mode, setMode] = useState<Mode>('panorama')
  const [drawer, setDrawer] = useState<'regions' | 'details' | null>(null)
  const [params, setParams] = useSearchParams()
  const [tour, setTour] = useState(params.get('tour') === '1')
  const tourStep = useRef(site)

  // Guided tour: step through all the regions, one every few seconds.
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
      const rest = new URLSearchParams(params)
      rest.delete('tour')
      setParams(rest, { replace: true })
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
    <div className="relative flex min-h-dvh flex-col">
      <div className="relative flex flex-1 flex-col overflow-hidden bg-black pb-[170px] md:pb-[150px]">
        <div className="pointer-events-none relative z-30 flex shrink-0 flex-col gap-3 px-5 pt-20 md:px-9 lg:flex-row lg:items-start lg:justify-between">
        <header className="pointer-events-none">
          <h1 className="max-w-[14em] text-[clamp(24px,3.8vw,52px)] font-light uppercase leading-[1.12] tracking-[0.16em] [text-shadow:0_1px_16px_#000]">{s.name}</h1>
          <p className="mt-2 text-sm text-dim [text-shadow:0_1px_8px_#000]">Region {site + 1} of {SITES.length}</p>
          <p className="mt-1 text-sm text-ink [text-shadow:0_1px_8px_#000]">
            {coords(s.lat, s.lonE)} · {categoryLabel(s.category)}
          </p>
          <p className="mt-2 max-w-[46ch] text-sm leading-snug text-ink [text-shadow:0_1px_8px_#000]">
            {v.why}{' '}
            <InfoTip label="How to read this view">
              <b className="mb-1 block font-medium text-ink">How to read this view</b>
              {MODE_HELP[mode]}
              <b className="mb-1 mt-3 block font-medium text-ink">Right now</b>
              {Math.round(sky.sunFrac * 100)}% of the Sun is above the terrain and Earth is {Math.round(sky.earthFrac * 100)}% in view ({sky.source === 'server' ? 'figures from the server' : 'figures from the bundled data'}).
            </InfoTip>
          </p>
          {tour && (
            <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-dim">
              <span>
                Segment {site + 1} / {SITES.length}
              </span>
              <i key={site} className="relative block h-px w-28 bg-line">
                <b className="tour-bar absolute inset-y-0 left-0 bg-ink" style={{ animationDuration: `${TOUR_MS}ms` }} />
              </i>
            </div>
          )}
        </header>

        <div className="pointer-events-auto flex gap-2 overflow-x-auto [scrollbar-width:none] max-lg:-mx-5 max-lg:px-5 lg:flex-wrap lg:justify-end lg:gap-2.5 lg:overflow-visible [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden">
          <Seg label="Region">
            <button type="button" className={segBtn} aria-label="Previous region" onClick={() => go(site - 1)}>
              <CaretLeftIcon size={14} />
            </button>
            <span className="grid min-w-20 place-items-center border-l border-line text-xs tracking-[0.14em]">
              {pad2(site + 1)} / {SITES.length}
            </span>
            <button type="button" className={segBtn} aria-label="Next region" onClick={() => go(site + 1)}>
              <CaretRightIcon size={14} />
            </button>
          </Seg>
          <Seg label="Point of view">
            {MODES.map(([id, name]) => (
              <button key={id} type="button" className={segBtn} aria-pressed={mode === id} onClick={() => setMode(id)}>
                {name}
              </button>
            ))}
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

        <div className={`relative ${mode === 'polar' ? 'h-[clamp(320px,64vh,680px)]' : 'h-[clamp(300px,46vh,560px)]'}`}>
          <div className="mx-auto size-full max-w-[1400px]">
            {mode === 'elevation' ? (
              <ElevationChart site={site} day={day} dur={dur} mast={mast} />
            ) : mode === 'orbit' ? (
              <OrbitDiagram day={day} dur={dur} />
            ) : (
              <Horizon site={site} day={day} dur={dur} mast={mast} mode={mode === 'polar' ? 'orbit' : 'lander'} />
            )}
          </div>
        </div>

        <dl className="absolute inset-x-5 bottom-[0px] z-[4] grid grid-cols-2 border-t border-line md:inset-x-9 md:grid-cols-4">
          {stats.map(([k, val, tone], i) => (
            <div key={k} className={`py-2.5 pr-4 ${i % 2 ? 'border-l border-line-soft pl-4' : ''} ${i > 1 ? 'border-t border-line-soft md:border-t-0' : ''} md:border-l md:pl-5 md:first:border-l-0 md:first:pl-0`}>
              <dt className="lab">
                <Term>{k}</Term>
              </dt>
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
            <span className="lab">{SITES.length} candidate regions</span>
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
