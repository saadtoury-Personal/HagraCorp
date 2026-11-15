import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import TimeBar from '../components/TimeBar'
import MoonScene, { type Focus, type Level } from '../features/globe/MoonScene'
import { ageDays, earthDistKm, libration, phaseName, subSolarLonE, sunDecDeg } from '../lib/ephemeris'
import { signed } from '../lib/format'
import { SITES } from '../lib/sites'
import { useScenario } from '../store/scenario'
import bodies from '../data/bodies.json'
import { MOON_KM, SUN_DIST } from '../features/globe/models'

const LEVELS = ['Moon', 'Pole', 'Region', 'Space'] as const

function Readouts() {
  const day = useScenario((s) => s.day)
  const age = ageDays(day)
  const lib = libration(day)
  const lon = subSolarLonE(day)
  const items = [
    ['Lunar day', `${age.toFixed(1)} d`, phaseName(age)],
    ['Sun over the Moon', `${Math.abs(lon).toFixed(0)}° ${lon >= 0 ? 'E' : 'W'}`, `declination ${signed(sunDecDeg(day))}°`],
    ['Earth libration', `${signed(lib.lat)}°`, `longitude ${signed(lib.lon)}°`],
    ['Earth to Moon', `${(Math.round(earthDistKm(day) / 100) * 100).toLocaleString('en-US')} km`, 'Earth at true size, distance compressed'],
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

const km = (n: number) => `${n.toLocaleString('en-US')} km`
const AU = SUN_DIST * MOON_KM // km, derived from the Sun's radius and its angular radius in Geometry.cs

/** Real sizes, spins, tilts and distances of the Moon, Earth and Sun, read from data/bodies.json and the Horizons table. */
function Facts() {
  const day = useScenario((s) => s.day)
  const e = bodies.earth
  const m = bodies.moon
  const s = bodies.sun
  const rows: [string, string, string][] = [
    ['Moon', `${km(m.meanRadiusKm)} radius`, `turns once per orbit, ${m.orbit.revolutionDays} d, so it always shows Earth the same face · axis tilted ${m.obliquityToOrbitDeg}° to its orbit`],
    ['Earth', `${km(e.meanRadiusKm)} radius, ${(e.meanRadiusKm / m.meanRadiusKm).toFixed(2)}× the Moon`, `turns once per ${e.siderealRotationHours} h · axis tilted ${e.obliquityDeg}°`],
    ['Sun', `${km(s.meanRadiusKm)} radius, ${Math.round(s.meanRadiusKm / m.meanRadiusKm)}× the Moon`, `turns once per ${(s.siderealRotationHours / 24).toFixed(1)} d · axis tilted ${s.obliquityDeg}° · seen ${(2 * bodies.sunAngularRadiusDeg).toFixed(2)}° wide from the Moon`],
    ['Earth to Moon', `${km(Math.round(earthDistKm(day) / 100) * 100)} now`, `${((earthDistKm(day) / m.meanRadiusKm)).toFixed(0)} Moon radii · ranges ${km(m.orbit.perigeeKm)} to ${km(m.orbit.apogeeKm)} · light takes ${(earthDistKm(day) / 299792.458).toFixed(2)} s`],
    ['Sun to Moon', `${(AU / 1e6).toFixed(1)} million km`, `${Math.round(AU / m.meanRadiusKm).toLocaleString('en-US')} Moon radii · light takes ${(AU / 299792.458 / 60).toFixed(1)} min · ${s.solarIrradianceWm2} W/m² at the Moon`],
  ]
  return (
    <details className="pointer-events-auto relative">
      <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.16em] text-dim transition-colors hover:text-ink [text-shadow:0_1px_8px_#000] [&::-webkit-details-marker]:hidden">
        Real sizes, spins and distances
      </summary>
      <div className="absolute bottom-full left-0 z-30 mb-3 w-[min(92vw,600px)] border border-line bg-bg p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 text-sm">
          {rows.map(([k, v, note]) => (
            <div key={k} className="col-span-2 grid grid-cols-subgrid items-baseline border-b border-line-soft py-2.5 first:pt-0 last:border-0 last:pb-0">
              <dt className="lab">{k}</dt>
              <dd>
                <span className="font-medium">{v}</span>
                <span className="block text-[13px] text-dim">{note}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] text-faint">Sizes and spins: team workbook (NASA fact sheets) and Geometry.cs. Earth to Moon distance: JPL Horizons table, hour by hour. Earth turns at the real sidereal time.</p>
      </div>
    </details>
  )
}

export default function Globe() {
  const [level, setLevel] = useState<Level>(0)
  const [focus, setFocus] = useState<Focus>('system')
  const site = useScenario((s) => s.site)
  const set = useScenario((s) => s.set)
  const navigate = useNavigate()
  // Leaving the true-scale view also goes back to the overview of the Earth-Moon system.
  const changeLevel = (l: Level) => {
    setFocus('system')
    setLevel(l)
  }

  const select = (i: number) => {
    set({ site: i })
    changeLevel(2)
  }

  return (
    <div className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden">
      <div className="absolute inset-0">
        <MoonScene
          level={level}
          focus={focus}
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
              <button type="button" className="btn" onClick={() => changeLevel(1)}>
                Explore the South Pole
              </button>
              <Link to="/site?tour=1" className="btn btn-ghost">
                Tour the {SITES.length} regions
              </Link>
            </div>
          </section>
        ) : (
          <div>
          <nav aria-label="Breadcrumb" className="flex gap-3 text-xs uppercase tracking-[0.16em] text-dim [text-shadow:0_1px_8px_#000]">
            <button type="button" className="pointer-events-auto hover:text-ink" onClick={() => changeLevel(0)}>
              Moon
            </button>
            {level !== 3 && (
              <>
                <span aria-hidden>&rsaquo;</span>
                <button type="button" className="pointer-events-auto hover:text-ink" onClick={() => changeLevel(1)}>
                  South Pole
                </button>
              </>
            )}
            {level === 3 && (
              <>
                <span aria-hidden>&rsaquo;</span>
                <b className="font-medium text-ink">Earth and Sun, true scale</b>
              </>
            )}
            {level === 2 && (
              <>
                <span aria-hidden>&rsaquo;</span>
                <b className="font-medium text-ink">{SITES[site].name}</b>
              </>
            )}
          </nav>
          {level === 3 && (
            <div className="pointer-events-auto mt-4 flex w-fit border border-line bg-bg/70" role="group" aria-label="Fly the camera to">
              {(
                [
                  ['system', 'Earth and Moon'],
                  ['earth', 'Fly to Earth'],
                  ['sun', 'Fly to the Sun'],
                ] as [Focus, string][]
              ).map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={focus === id}
                  onClick={() => setFocus(id)}
                  className="min-h-11 border-l border-line px-4 text-xs font-medium uppercase tracking-[0.14em] text-dim transition-colors first:border-l-0 hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          </div>
        )}

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-x-8 gap-y-2">
            <p className="max-w-[55%] text-xs uppercase md:max-w-none tracking-[0.16em] text-dim [text-shadow:0_1px_8px_#000]">Drag to rotate. Pinch or scroll to zoom.</p>
            {(level === 0 || level === 3) && <Facts />}
          </div>
          <div className="pointer-events-auto">{(level === 0 || level === 3) && <Readouts />}</div>
        </div>
      </main>

      <div className="absolute right-5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end md:right-9" role="group" aria-label="Zoom level">
        {LEVELS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-current={level === i}
            onClick={() => changeLevel(i as Level)}
            className="group flex min-h-11 items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-faint transition-colors hover:text-ink aria-[current=true]:text-ink [text-shadow:0_1px_8px_#000]"
          >
            {name}
            <i className="block h-px w-4 bg-current transition-[width] duration-300 group-aria-[current=true]:w-11" />
          </button>
        ))}
      </div>

      <div className="relative z-20">
        <TimeBar />
      </div>
    </div>
  )
}
