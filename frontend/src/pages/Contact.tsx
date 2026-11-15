import SiteFooter from '../components/SiteFooter'

// Roles from the repository README (Nazim's wording updated to his frontend work).
const TEAM = [
  ['Edi', 'Geospatial scientist, data validation lead', 'LOLA terrain, horizon masks, illumination and Earth-visibility windows, physical checks.'],
  ['Nazim', 'Frontend developer, UI/UX design', 'Interface design system, the 3D Moon, Earth and Sun scene, the Site and Globe pages.'],
  ['Maggie', 'Mission domain specialist, pitch lead', 'Landing-site research, explanatory text, video, final submission and pitch.'],
  ['Youssef', 'Frontend and data visualization engineer', 'Horizon charts, power and communications timeline, site comparison matrix.'],
  ['Saad', 'Tech lead, full-stack and ephemeris engineer', 'Application architecture, Sun and Earth position engine, integration.'],
  ['Nizar', 'Backend and API developer', 'API, per-site pre-computation cache, deployment.'],
] as const

export default function Contact() {
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-[1200px] px-5 pb-16 pt-28 md:px-9">
        <h1 className="text-balance text-[clamp(26px,4vw,56px)] font-light uppercase leading-[1.14] tracking-[0.2em]">Contact</h1>
        <p className="mt-6 max-w-[60ch] text-[17px] font-light text-dim">
          HagraCorp is six people building the Lunar Landing Site Navigator for NASA Space Apps 2026 (Sherbrooke): a tool to compare south-pole landing sites and dates by how long the Sun and Earth stay above the horizon.
        </p>
        <section aria-labelledby="team-title" className="mt-12 border border-line p-6">
          <h2 id="team-title" className="lab">
            The team
          </h2>
          <dl className="mt-4 grid gap-x-6 text-sm md:grid-cols-[auto_auto_1fr]">
            {TEAM.map(([name, role, owns]) => (
              <div key={name} className="grid gap-x-6 border-t border-line-soft py-3 md:col-span-3 md:grid-cols-subgrid">
                <dt className="font-medium">{name}</dt>
                <dd>{role}</dd>
                <dd className="text-dim">{owns}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter photos />
    </>
  )
}
