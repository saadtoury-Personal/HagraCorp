import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import MoonScene, { type View } from '../features/globe/MoonScene'
import { ageDays, dayToDate, earthDistKm, libration, phaseName, SPAN_DAYS, subSolarLonE, sunDecDeg } from '../lib/ephemeris'
import { useScenario } from '../store/scenario'

const sign = (n: number) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(1)

function Readouts() {
  const day = useScenario((s) => s.day)
  const age = ageDays(day)
  const lib = libration(day)
  const lon = subSolarLonE(day)
  const items = [
    ['Lunar day', `${age.toFixed(1)} d`, phaseName(age)],
    ['Sun over the Moon', `${Math.abs(lon).toFixed(0)}° ${lon >= 0 ? 'E' : 'W'}`, `declination ${sign(sunDecDeg(day))}°`],
    ['Earth libration', `${sign(lib.lat)}°`, `longitude ${sign(lib.lon)}°`],
    ['Earth to Moon', `${(Math.round(earthDistKm(day) / 100) * 100).toLocaleString('en-US')} km`, 'shown compressed on screen'],
  ]
  return (
    <dl className="grid grid-cols-2 border-t border-line lg:grid-cols-4">
      {items.map(([k, v, sub], i) => (
        <div key={k} className={`py-3 pr-4 ${i % 2 ? 'pl-4 border-l border-line-soft' : ''} ${i > 1 ? 'border-t border-line-soft lg:border-t-0' : ''} lg:pl-5 lg:first:pl-0 lg:border-l lg:first:border-l-0`}>
          <dt className="lab">{k}</dt>
          <dd className="mt-0.5 text-2xl font-light tracking-tight">{v}</dd>
          <dd className="hidden text-[13px] text-dim sm:block">{sub}</dd>
        </div>
      ))}
    </dl>
  )
}

function TimeBar() {
  const day = useScenario((s) => s.day)
  const playing = useScenario((s) => s.playing)
  const set = useScenario((s) => s.set)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const d = useScenario.getState().day + 0.06
      set({ day: d > SPAN_DAYS ? 0 : d })
    }, 50)
    return () => clearInterval(id)
  }, [playing, set])

  const date = dayToDate(day)
  return (
    <div className="flex h-full items-center gap-4 border-t border-line-soft bg-bg/90 px-5 md:gap-7 md:px-9">
      <button
        type="button"
        onClick={() => set({ playing: !playing })}
        className="grid size-11 shrink-0 place-items-center border border-line transition-colors hover:bg-ink hover:text-bg"
        aria-label={playing ? 'Pause time' : 'Play time'}
      >
        {playing ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
      </button>
      <div className="w-32 shrink-0 md:w-52">
        <div className="text-[15px]">
          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
        </div>
        <div className="text-[13px] text-dim">{date.toISOString().slice(11, 16)} UTC</div>
      </div>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={SPAN_DAYS}
          step={0.05}
          value={day}
          onChange={(e) => set({ day: Number(e.target.value), playing: false })}
          aria-label="Date and time"
          aria-valuetext={date.toUTCString()}
        />
        <div className="-mt-1.5 flex justify-between text-xs text-faint" aria-hidden>
          {[0, 30, 60, 90].map((d) => (
            <span key={d}>{dayToDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Globe() {
  const [view, setView] = useState<View>('moon')
  return (
    <div className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden">
      <div className="absolute inset-0">
        <MoonScene view={view} />
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-full bg-gradient-to-r from-bg/85 via-bg/40 to-transparent md:w-2/3" aria-hidden />
      <main className="pointer-events-none relative z-10 flex flex-1 flex-col justify-between px-5 pb-4 pt-20 md:px-9">
        <section className="max-w-[760px]">
          <h1 className="text-[clamp(26px,5vw,72px)] font-light uppercase leading-[1.14] tracking-[0.2em] text-balance">
            The Moon&apos;s
            <br />
            South Pole
          </h1>
          <p className="mt-4 max-w-[46ch] md:mt-6 text-[17px] font-light text-dim [text-shadow:0_1px_12px_#000]">
            Where to land, and when. Compare candidate sites by how long the Sun and Earth stay above the horizon.
          </p>
          <div className="pointer-events-auto mt-6 flex flex-wrap gap-3 md:mt-8">
            <button type="button" className="btn" aria-pressed={view === 'pole'} onClick={() => setView(view === 'pole' ? 'moon' : 'pole')}>
              {view === 'pole' ? 'Back to the Moon' : 'Explore the South Pole'}
            </button>
            <Link to="/slip" className="btn btn-ghost">
              Open Slip Navigator
            </Link>
          </div>
        </section>

        <div className="pointer-events-auto">
          <p className="mb-3 hidden text-right text-xs text-faint sm:block">Simulated ephemeris. Sizes follow the real ratios, distances are compressed.</p>
          <Readouts />
        </div>
      </main>

      <div className="relative z-20 h-[72px] shrink-0">
        <TimeBar />
      </div>
    </div>
  )
}
