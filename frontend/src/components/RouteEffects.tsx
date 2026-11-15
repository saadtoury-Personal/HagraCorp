import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { SITES } from '../lib/sites'
import { useScenario } from '../store/scenario'

const TITLES: Record<string, string> = {
  '/': 'The Moon’s South Pole',
  '/compare': 'Compare sites and dates',
  '/slip': 'Slip navigator',
  '/method': 'Method and limits',
  '/contact': 'Contact',
}

/** One title per page, and keyboard focus moved to the page content after each navigation (not on the first load). */
export default function RouteEffects() {
  const { pathname } = useLocation()
  const site = useScenario((s) => s.site)
  const first = useRef(true)

  useEffect(() => {
    const page = pathname === '/site' ? SITES[site].name : (TITLES[pathname] ?? 'Page not found')
    document.title = `${page} · LunarNav`
  }, [pathname, site])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    scrollTo(0, 0) // a new page starts at its top, not where the last one was scrolled to
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
  return null
}
