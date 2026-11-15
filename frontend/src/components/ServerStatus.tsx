import { useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { useServer } from '../store/server'

/** Small header indicator: is the LunarNav API reachable? Checked at start and every 30 s. */
export default function ServerStatus() {
  const { status, sites, check } = useServer()
  useEffect(() => {
    void check()
    const id = setInterval(() => void check(), 30000)
    return () => clearInterval(id)
  }, [check])
  const online = status === 'online'
  return (
    <span className="hidden shrink-0 items-center gap-2 text-xs text-dim xl:flex" title={`${API_BASE}/api/health`} role="status">
      <i className={`size-2 rounded-full ${online ? 'bg-ok' : status === 'checking' ? 'bg-warn' : 'bg-faint'}`} aria-hidden />
      {online ? `Server online, ${sites} sites` : status === 'checking' ? 'Checking server' : 'Server offline, using bundled data'}
    </span>
  )
}
