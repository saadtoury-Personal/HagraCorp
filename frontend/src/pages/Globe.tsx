import { MinusIcon, PlusIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import TimeBar from '../components/TimeBar'
import MoonScene, { type Level } from '../features/globe/MoonScene'
import { ageDays, earthDistKm, libration, phaseName, subSolarLonE, sunDecDeg } from '../lib/ephemeris'
import { signed } from '../lib/format'
import { SITES } from '../lib/sites'
import { useScenario } from '../store/scenario'

const LEVELS = ['Moon', 'Pole', 'Region'] as const

function Readouts() {
  const day = useScenario((s) => s.day)
  const age = ageDays(day)
  const lib = libration(day)
  const lon = subSolarLonE(day)
  const items = [
    ['Lunar day', `${age.toFixed(1)} d`, phaseName(age)],
    ['Sun over the Moon', `${Math.abs(lon).toFixed(0)}° ${lon >= 0 ? 'E' : 'W'}`, `declination ${signed(sunDecDeg(day))}°`],
    ['Earth libration', `${signed(lib.lat)}°`, `longitude ${signed(lib.lon)}°`],
    ['Earth to Moon', `${(Math.round(earthDistKm(day) / 100) * 100).toLocaleString('en-US')} km`, 'distance'],
  ]
  return (
    <dl className="grid grid-cols-2 border-t border-line lg:grid-cols-4">
      {items.map(([k, v, sub], i) => (
        <div key={k} className={`py-3 pr-4 ${i % 2 ? 'border-l border-line-soft pl-4' : ''} ${i > 1 ? 'border-t border-line-soft lg:border-t-0' : ''} lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0`}>
          <dt className="lab">{k}</dt>
          <dd className="mt-0.5 text-2xl font-light tracking-tight">{v}</dd>
          <dd className="hidden text-[13px] text-dim sm:block">{sub}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Globe() {
  const [level, setLevel] = useState<Level>(0)
  const site = useScenario((s) => s.site)
  const set = useScenario((s) => s.set)
  const navigate = useNavigate()

  const select = (i: number) => {
    set({ site: i })
    setLevel(2)
  }
  const step = (d: number) => setLevel((l) => Math.min(2, Math.max(0, l + d)) as Level)

  return (
    <div className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden">
      <div className="absolute inset-0">
        <MoonScene
          level={level}
          onSelect={select}
          onOpen={(i) => {
            set({ site: i })
            navigate('/site')
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-full bg-gradient-to-r from-bg/85 via-bg/40 to-transparent md:w-2/3" aria-hidden />

      <main className="pointer-events-none relative z-10 flex flex-1 flex-col justify-between px-5 pb-4 pt-20 md:px-9">
        {level === 0 ? (
          <section className="max-w-[760px]">
            <h1 className="text-balance text-[clamp(26px,5vw,72px)] font-light uppercase leading-[1.14] tracking-[0.2em]">
              The Moon&apos;s
              <br />
              South Pole
            </h1>
            <p className="mt-4 max-w-[46ch] text-[17px] font-light text-dim [text-shadow:0_1px_12px_#000] md:mt-6">
              Where to land, and when. Compare candidate sites by how long the Sun and Earth stay above the horizon.
            </p>
            <div className="pointer-events-auto mt-6 flex flex-wrap gap-3 md:mt-8">
              <button type="button" className="btn" onClick={() => setLevel(1)}>
                Explore the South Pole
              </button>
              <Link to="/site?tour=1" className="btn btn-ghost">
                Tour the 13 regions
              </Link>
            </div>
          </section>
        ) : (
          <nav aria-label="Breadcrumb" className="flex gap-3 text-xs uppercase tracking-[0.16em] text-dim [text-shadow:0_1px_8px_#000]">
            <button type="button" className="pointer-events-auto hover:text-ink" onClick={() => setLevel(0)}>
              Moon
            </button>
            <span aria-hidden>&rsaquo;</span>
            <button type="button" className="pointer-events-auto hover:text-ink" onClick={() => setLevel(1)}>
              South Pole
            </button>
            {level === 2 && (
              <>
                <span aria-hidden>&rsaquo;</span>
                <b className="font-medium text-ink">{SITES[site].name}</b>
              </>
            )}
          </nav>
        )}

        <div className="pointer-events-auto">{level === 0 && <Readouts />}</div>
      </main>

      <div className="absolute right-5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end md:right-9" role="group" aria-label="Zoom level">
        {LEVELS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-current={level === i}
            onClick={() => setLevel(i as Level)}
            className="group flex min-h-11 items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-faint transition-colors hover:text-ink aria-[current=true]:text-ink [text-shadow:0_1px_8px_#000]"
          >
            {name}
            <i className="block h-px w-4 bg-current transition-[width] duration-300 group-aria-[current=true]:w-11" />
          </button>
        ))}
        <div className="mt-3 flex border border-line bg-bg/70">
          <button type="button" aria-label="Zoom in" onClick={() => step(1)} className="grid size-11 place-items-center text-dim hover:text-ink">
            <PlusIcon size={16} />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => step(-1)} className="grid size-11 place-items-center border-l border-line text-dim hover:text-ink">
            <MinusIcon size={16} />
          </button>
        </div>
      </div>

      <div className="relative z-20">
        <TimeBar />
      </div>
    </div>
  )
}
