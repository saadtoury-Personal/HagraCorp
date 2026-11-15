import { Link } from 'react-router'
import { GLOSSARY } from '../lib/glossary'
import { SITES } from '../lib/sites'

const blocks: { title: string; items: { k?: string; v: string }[] }[] = [
  {
    title: 'How the numbers are made',
    items: [
      { k: 'Sun and Earth', v: 'Positions seen from the Moon come from a JPL Horizons table, hourly from 14 Nov 2026 to 10 Mar 2027, in the Moon Mean Earth frame. The app interpolates between rows and samples every 1.2 hours.' },
      { k: 'Horizon', v: 'Each site has a skyline of 720 elevations (one every 0.5 degrees of azimuth) computed from NASA LOLA terrain, for an observer 2 m and 10 m above the ground. Other mast heights are interpolated between the two.' },
      { k: 'Sun up', v: 'The Sun counts as up when at least half of its disk is above the skyline, which is when its centre clears it. This is the rule of the LunarNav server, and the app applies the same rule offline.' },
      { k: 'Earth in view', v: 'Earth counts as in view when any part of its disk (about 2 degrees wide) is above the skyline. Same rule as the server.' },
      { k: 'Verdicts', v: 'Compare and Slip use the needs you set: sunlight share, Earth-link share and how long the battery can bridge darkness. The Site page labels a window Viable when both shares reach 75%, Marginal from 45%.' },
    ],
  },
  {
    title: 'What it does not tell you',
    items: [
      { v: 'Sunlight is not electrical power, and Earth in view is not a working radio link. There is no power, thermal or link-budget model.' },
      { v: 'Earth in view ignores ground-station schedules, so a Deep Space Network pass can still be missing.' },
      { v: 'Boulders and craters smaller than the terrain grid are not in the skyline.' },
      { v: 'A lander lands within about 100 m of its target. The tool scores the target point, not the landing ellipse.' },
      { v: `Apollo 11 is outside the polar terrain map, so it is shown with a flat horizon. The other ${SITES.length - 1} sites use real terrain.` },
    ],
  },
  {
    title: 'Not checked yet',
    items: [
      { v: 'We have not yet compared our sunlight and Earth shares with NASA PGDA Product 69, the published long-term visibility maps. Until that is done, treat the numbers as a screening tool, not a flight-ready result.' },
      { v: 'The timeline covers 90 days. Longer slips cannot be scored.' },
    ],
  },
  {
    title: 'Sources',
    items: [
      { k: 'Ephemeris', v: 'NASA JPL Horizons System' },
      { k: 'Terrain', v: 'NASA Lunar Orbiter Laser Altimeter (LOLA) south polar elevation maps' },
      { k: 'Sites', v: 'Coordinates of the 32 sites, including the Artemis III candidate regions, mostly from the NASA Lunar Surface Data Book (ACD-50044 Rev A, May 2023)' },
      { k: 'Moon model', v: 'NASA Lunar Reconnaissance Orbiter imagery, grid removed for this app' },
    ],
  },
]

/** The glossary, so every word the app uses is explained in one place. */
const words = { title: 'Words used here', items: GLOSSARY.map((g) => ({ k: g.term, v: g.def })) }

export default function Method() {
  return (
    <main className="mx-auto min-h-dvh max-w-[980px] px-5 pb-24 pt-28 md:px-9">
      <h1 className="text-[clamp(26px,4vw,48px)] font-light uppercase leading-[1.14] tracking-[0.16em]">Method and limits</h1>
      <p className="mt-4 max-w-[60ch] text-[17px] font-light text-dim">In one sentence: for each landing site and date, this app checks whether the Sun is above the local horizon (power) and whether Earth is (radio), using NASA\u2019s real terrain and the real positions of the Sun and Earth. What the numbers rest on, and where to be careful. Planners should read the second block before quoting a result.</p>

      <div className="mt-12">
        {[...blocks, words].map((b) => (
          <section key={b.title} className="grid gap-4 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-10">
            <h2 className="text-lg font-medium leading-snug">{b.title}</h2>
            <dl className="space-y-4">
              {b.items.map((it) => (
                <div key={it.v} className={it.k ? 'grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-6' : ''}>
                  {it.k && <dt className="text-sm text-faint">{it.k}</dt>}
                  <dd className="max-w-[62ch] text-[15px] leading-relaxed text-dim">{it.v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <Link to="/slip" className="btn mt-6">
        Try the Slip navigator
      </Link>
    </main>
  )
}
