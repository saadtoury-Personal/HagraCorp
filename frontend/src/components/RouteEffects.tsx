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
    const page = pathname === '/site' ? SITES[site].name : (TITLES[pathname] ?? 'Lunar Landing Site Navigator')
    document.title = `${page} · LunarNav`
  }, [pathname, site])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
  return null
}
