import { MoonIcon } from '@phosphor-icons/react'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import Compare from './pages/Compare'
import CopyLink from './components/CopyLink'
import UrlSync from './components/UrlSync'
import Method from './pages/Method'
import Slip from './pages/Slip'

// The Globe (three.js) and Site pages are split out so the Compare page stays light.
const Globe = lazy(() => import('./pages/Globe'))
const Site = lazy(() => import('./pages/Site'))

const links = [
  ['/', 'Globe'],
  ['/site', 'Site'],
  ['/compare', 'Compare'],
  ['/slip', 'Slip'],
  ['/method', 'Method'],
] as const

function Header() {
  const { pathname } = useLocation()
  // On phones the five links scroll sideways: keep the current one in view.
  useEffect(() => {
    document.querySelector('nav[aria-label="Main"] [aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])
  return (
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-2 bg-bg px-3 md:gap-6 md:bg-gradient-to-b md:from-bg md:to-transparent md:px-9">
  <NavLink to="/" className="flex shrink-0 items-center gap-3 text-sm font-medium uppercase tracking-[0.3em]" aria-label="LunarNav home">
    <MoonIcon size={22} weight="light" aria-hidden />
    <span className="hidden sm:inline">LunarNav</span>
  </NavLink>
  <nav aria-label="Main" className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] md:justify-center [&::-webkit-scrollbar]:hidden">
    {links.map(([to, label]) => (
      <NavLink
        key={to}
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          `relative flex min-h-11 shrink-0 items-center px-2.5 text-xs font-medium uppercase tracking-[0.1em] transition-colors md:px-4 md:tracking-[0.16em] ${
            isActive ? 'text-ink after:absolute after:inset-x-2.5 after:bottom-2 after:h-px after:bg-ink md:after:inset-x-4' : 'text-dim hover:text-ink'
          }`
        }
      >
        {label}
      </NavLink>
    ))}
  </nav>
  <CopyLink />
</header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UrlSync />
      <Header />
      <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-dim" role="status">Loading</div>}>
        <Routes>
          <Route path="/" element={<Globe />} />
          <Route path="/site" element={<Site />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/slip" element={<Slip />} />
          <Route path="/method" element={<Method />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
