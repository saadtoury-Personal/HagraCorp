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

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `relative flex min-h-11 shrink-0 items-center px-4 text-xs font-medium uppercase tracking-[0.16em] transition-colors ${
    isActive ? 'text-ink after:absolute after:inset-x-4 after:bottom-2 after:h-px after:bg-ink' : 'text-dim hover:text-ink'
  }`

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-12 items-center border-l-2 px-5 text-sm font-medium uppercase tracking-[0.16em] transition-colors ${
    isActive ? 'border-ink bg-white/5 text-ink' : 'border-transparent text-dim hover:text-ink'
  }`

function Header() {
  const [open, setOpen] = useState(false)

  // The menu closes when a page is chosen, on Esc, and when the screen grows to the desktop layout.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const wide = matchMedia('(min-width: 768px)')
    const onWide = () => wide.matches && setOpen(false)
    addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    return () => {
      removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
    }
  }, [open])

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-2 bg-bg px-3 md:gap-6 md:bg-gradient-to-b md:from-bg md:to-transparent md:px-9">
      <NavLink to="/" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-3 text-sm font-medium uppercase tracking-[0.3em]" aria-label="LunarNav home">
        <MoonIcon size={22} weight="light" aria-hidden />
        <span className="hidden sm:inline">LunarNav</span>
      </NavLink>
      <nav aria-label="Main" className="hidden min-w-0 flex-1 justify-center md:flex">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={desktopLink}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 md:ml-0 md:gap-6">
        <ServerStatus />
        <CopyLink />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="grid size-11 shrink-0 place-items-center text-ink md:hidden"
        >
          {open ? <XIcon size={24} weight="light" aria-hidden /> : <ListIcon size={24} weight="light" aria-hidden />}
        </button>
      </div>
      {open && (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-x-0 bottom-0 top-16 -z-10 bg-black/60 md:hidden" />
          <nav id="mobile-menu" aria-label="Main" className="absolute inset-x-0 top-16 border-t border-line bg-bg py-2 shadow-[0_16px_40px_rgb(0_0_0/0.7)] md:hidden">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={mobileLink} onClick={() => setOpen(false)}>
                {label}
              </NavLink>
            ))}
          </nav>
        </>
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
