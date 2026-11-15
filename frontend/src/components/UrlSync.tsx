import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { SITES } from '../lib/sites'
import { useScenario } from '../store/scenario'

// A scenario is a link: site, date, needs and delay live in the query string so the page can be shared.
const KEYS = { site: 's', day: 'd', dur: 'u', minE: 'e', minD: 'l', mast: 'm', maxDark: 'b', slip: 'x', requireEarth: 'r' } as const
type Key = keyof typeof KEYS

const toQuery = () => {
  const st = useScenario.getState()
  const q = new URLSearchParams()
  ;(Object.keys(KEYS) as Key[]).forEach((k) => q.set(KEYS[k], k === 'requireEarth' ? (st[k] ? '1' : '0') : String(k === 'day' ? Math.round(st[k] * 10) / 10 : st[k])))
  return q
}

export default function UrlSync() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  // Read the link once on load.
  useEffect(() => {
    const q = new URLSearchParams(search)
    const patch: Record<string, number | boolean> = {}
    ;(Object.keys(KEYS) as Key[]).forEach((k) => {
      const v = Number(q.get(KEYS[k]))
      if (q.has(KEYS[k]) && Number.isFinite(v)) patch[k] = k === 'requireEarth' ? v !== 0 : v
    })
    if (typeof patch.site === 'number' && !(patch.site >= 0 && patch.site < SITES.length)) delete patch.site
    useScenario.setState(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write it back, slowly, whenever the scenario or the page changes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const write = () => {
      const qs = toQuery()
      const keep = new URLSearchParams(window.location.search)
      if (keep.get('tour')) qs.set('tour', keep.get('tour')!)
      if (qs.toString() !== keep.toString()) navigate({ pathname, search: qs.toString() }, { replace: true })
    }
    const unsub = useScenario.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(write, 400)
    })
    timer = setTimeout(write, 50)
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [navigate, pathname])

  return null
}
