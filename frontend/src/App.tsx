import { ListIcon, MoonIcon, XIcon } from '@phosphor-icons/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import CopyLink from './components/CopyLink'
import PageBoundary from './components/PageBoundary'
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
const NotFound = lazy(() => import('./pages/NotFound'))

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
  // The menu belongs to the page it was opened on, so any navigation (links, back button) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (o: boolean) => setOpenOn(o ? pathname : null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null)
    const wide = matchMedia('(min-width: 768px)')
    const onWide = () => wide.matches && setOpenOn(null)
    document.addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
      document.body.style.overflow = ''
    }
  }, [open])
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-2 bg-bg px-3 md:gap-6 md:bg-gradient-to-b md:from-bg md:to-transparent md:px-9">
      <NavLink to="/" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-3 text-sm font-medium uppercase tracking-[0.3em]" aria-label="LunarNav home">
        <MoonIcon size={22} weight="light" aria-hidden />
        <span>LunarNav</span>
      </NavLink>
      <nav aria-label="Main" className="hidden min-w-0 flex-1 justify-center md:flex">
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
      <span className="flex-1 md:hidden" />
      <ServerStatus />
      <CopyLink />
      <button
        type="button"
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-ink md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen(!open)}
      >
        {open ? <XIcon size={22} aria-hidden /> : <ListIcon size={22} aria-hidden />}
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="menu-in fixed inset-x-0 bottom-0 top-16 flex flex-col overflow-y-auto border-t border-line bg-bg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 items-center border-b border-line text-lg font-medium uppercase tracking-[0.12em] ${isActive ? 'text-ink' : 'text-dim'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UrlSync />
      <RouteEffects />
      <a href="#main" className="fixed left-3 top-3 z-50 -translate-y-20 bg-ink px-4 py-2 text-sm font-medium text-bg transition-transform focus:translate-y-0">
        Skip to content
      </a>
      <Header />
      <div id="main" tabIndex={-1} className="outline-none">
      <Pages />
      </div>
    </BrowserRouter>
  )
}

function Pages() {
  const { pathname } = useLocation()
  return (
    <PageBoundary key={pathname}>
      <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-dim" role="status">Loading</div>}>
        <Routes>
          <Route path="/" element={<Globe />} />
          <Route path="/site" element={<Site />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/slip" element={<Slip />} />
          <Route path="/method" element={<Method />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageBoundary>
  )
}
