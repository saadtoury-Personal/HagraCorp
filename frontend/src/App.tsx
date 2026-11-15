import { MoonIcon } from '@phosphor-icons/react'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import CopyLink from './components/CopyLink'
import ServerStatus from './components/ServerStatus'
import UrlSync from './components/UrlSync'
import RouteEffects from './components/RouteEffects'

// Every page is loaded when first visited, so the first screen only carries what it needs.
const Globe = lazy(() => import('./pages/Globe'))
const Site = lazy(() => import('./pages/Site'))
const Compare = lazy(() => import('./pages/Compare'))
const Slip = lazy(() => import('./pages/Slip'))
const Method = lazy(() => import('./pages/Method'))
const Contact = lazy(() => import('./pages/Contact'))

const links = [
  ['/', 'Globe'],
  ['/site', 'Site'],
  ['/compare', 'Compare'],
  ['/slip', 'Slip'],
  ['/method', 'Method'],
  ['/contact', 'Contact'],
] as const

function Header() {
  const { pathname } = useLocation()
  // On phones the links scroll sideways: keep the current one in view.
  useEffect(() => {
    document.querySelector('nav[aria-label="Main"] [aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-2 bg-bg px-3 md:gap-6 md:bg-gradient-to-b md:from-bg md:to-transparent md:px-9">
      <NavLink to="/" className="flex shrink-0 items-center gap-3 text-sm font-medium uppercase tracking-[0.3em]" aria-label="LunarNav home">
        <MoonIcon size={22} weight="light" aria-hidden />
        <span className="hidden sm:inline">LunarNav</span>
      </NavLink>
      <nav aria-label="Main" className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_88%,transparent)] md:justify-center md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex min-h-11 shrink-0 items-center px-2 text-xs font-medium uppercase tracking-[0.06em] transition-colors md:px-4 md:tracking-[0.16em] ${
                isActive ? 'text-ink after:absolute after:inset-x-2 after:bottom-2 after:h-px after:bg-ink md:after:inset-x-4' : 'text-dim hover:text-ink'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <ServerStatus />
      <CopyLink />
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UrlSync />
      <RouteEffects />
      <a href="#main" className="sr-only fixed left-3 top-3 z-50 bg-ink px-4 py-2 text-sm font-medium text-bg focus:not-sr-only">
        Skip to content
      </a>
      <Header />
      <div id="main" tabIndex={-1} className="outline-none">
      <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-dim" role="status">Loading</div>}>
        <Routes>
          <Route path="/" element={<Globe />} />
          <Route path="/site" element={<Site />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/slip" element={<Slip />} />
          <Route path="/method" element={<Method />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
      </div>
    </BrowserRouter>
  )
}
