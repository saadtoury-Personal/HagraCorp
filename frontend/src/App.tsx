import { MoonIcon } from '@phosphor-icons/react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router'
import ServerStatus from './components/ServerStatus'
import Compare from './pages/Compare'
import Contact from './pages/Contact'

// The Globe (three.js) and Site pages are split out so the Compare page stays light.
const Globe = lazy(() => import('./pages/Globe'))
const Site = lazy(() => import('./pages/Site'))

const links = [
  ['/', 'Globe'],
  ['/site', 'Site'],
  ['/compare', 'Compare'],
  ['/contact', 'Contact'],
] as const

export default function App() {
  return (
    <BrowserRouter>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-6 bg-gradient-to-b from-bg to-transparent px-5 md:px-9">
        <NavLink to="/" className="flex shrink-0 items-center gap-3 text-sm font-medium uppercase tracking-[0.3em]" aria-label="LunarNav home">
          <MoonIcon size={22} weight="light" aria-hidden />
          <span className="hidden sm:inline">LunarNav</span>
        </NavLink>
        <nav aria-label="Main" className="-mx-2 flex min-w-0 flex-1 gap-1 overflow-x-auto md:justify-center">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex min-h-11 shrink-0 items-center px-3 text-xs font-medium uppercase tracking-[0.16em] transition-colors md:px-4 ${
                  isActive ? 'text-ink after:absolute after:inset-x-3 after:bottom-2 after:h-px after:bg-ink md:after:inset-x-4' : 'text-dim hover:text-ink'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <ServerStatus />
        <span className="hidden shrink-0 text-xs text-faint lg:block">NASA Space Apps 2026</span>
      </header>
      <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-dim" role="status">Loading</div>}>
        <Routes>
          <Route path="/" element={<Globe />} />
          <Route path="/site" element={<Site />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
