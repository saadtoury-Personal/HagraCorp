import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { fromQuery, toQuery } from '../lib/scenarioLink'
import { useScenario } from '../store/scenario'

export default function UrlSync() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  // Read the link once on load (values are validated and clamped in fromQuery).
  useEffect(() => {
    useScenario.setState(fromQuery(search))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write it back, slowly, whenever the scenario or the page changes. While time plays this keeps waiting; Share reads toQuery() itself.
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
