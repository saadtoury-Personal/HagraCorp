import { EnvelopeSimpleIcon, LinkedinLogoIcon } from '@phosphor-icons/react'
import SiteFooter from '../components/SiteFooter'

type Member = { name: string; role: string; owns: string; linkedin?: string; email?: string }

// Roles from the repository README (Nazim's wording updated to his frontend work). Contact links are the ones each person shared.
const TEAM: Member[] = [
  { name: 'Edi', role: 'Geospatial scientist, data validation lead', owns: 'LOLA terrain, horizon masks, illumination and Earth-visibility windows, physical checks.', linkedin: 'https://www.linkedin.com/in/edi-valère-tra/' },
  { name: 'Nazim', role: 'Frontend developer, UI/UX design', owns: 'Interface design system, the Globe and Site pages.', email: 'dellahnazim01@gmail.com' },
  { name: 'Maggie', role: 'Mission domain specialist, pitch lead', owns: 'Landing-site research, explanatory text, video, final submission and pitch.' },
  {
    name: 'Youssef',
    role: 'Frontend and data visualization engineer',
    owns: 'Charts, the Slip and Compare pages, the 3D Earth and Sun.',
    linkedin: 'https://www.linkedin.com/in/youssef-ben-amor-40132a35b/',
    email: 'mohamedyoussefbenamor@gmail.com',
  },
  { name: 'Saad', role: 'Tech lead, full-stack and ephemeris engineer', owns: 'Architecture, the Sun and Earth position engine, integration.' },
  { name: 'Nizar', role: 'Backend and API developer', owns: 'The API, the per-site pre-computation cache, deployment.' },
]

const chip =
  'inline-flex min-h-11 items-center gap-2 border border-line px-4 text-sm text-ink transition-colors hover:bg-ink hover:text-bg focus-visible:bg-ink focus-visible:text-bg'

export default function Contact() {
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-[980px] px-5 pb-20 pt-28 md:px-9">
        <h1 className="text-balance text-[clamp(26px,4vw,48px)] font-light uppercase leading-[1.14] tracking-[0.16em]">Contact</h1>
        <p className="mt-4 max-w-[58ch] text-[17px] font-light text-dim">
          HagraCorp is six people from Sherbrooke who built the Lunar Landing Site Navigator for NASA Space Apps 2026. Write to us about the project, the data or the method.
        </p>

        <ul className="mt-12 border-t border-line" aria-label="The team">
          {TEAM.map((m) => (
            <li key={m.name} className="grid gap-x-10 gap-y-4 border-b border-line-soft py-7 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="text-2xl font-light tracking-tight">{m.name}</h2>
                <p className="mt-1 text-[15px] text-ink">{m.role}</p>
                <p className="mt-1 max-w-[56ch] text-sm text-dim">{m.owns}</p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {m.linkedin && (
                  <a className={chip} href={m.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn (opens in a new tab)`}>
                    <LinkedinLogoIcon size={18} aria-hidden />
                    LinkedIn
                  </a>
                )}
                {m.email && (
                  <a className={chip} href={`mailto:${m.email}`} title={m.email} aria-label={`Email ${m.name}: ${m.email}`}>
                    <EnvelopeSimpleIcon size={18} aria-hidden />
                    Email
                  </a>
                )}
                {!m.linkedin && !m.email && <span className="text-sm text-faint">No public contact yet</span>}
              </div>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter photos />
    </>
  )
}
