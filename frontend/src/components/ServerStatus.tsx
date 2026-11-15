import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '../lib/api'
import { useServer } from '../store/server'

/** Header indicator (large screens) and a notice on every screen when the server goes away or comes back. Checked at start and every 30 s. */
export default function ServerStatus() {
  const { status, sites, check } = useServer()
  const was = useRef(status)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void check()
    const id = setInterval(() => void check(), 30000)
    return () => clearInterval(id)
  }, [check])

  useEffect(() => {
    if (was.current === 'online' && status === 'offline') setNotice('The LunarNav server stopped answering. Figures now come from the data bundled with the app.')
    else if (was.current === 'offline' && status === 'online') setNotice('The LunarNav server is back. Figures marked Server come from it again.')
    was.current = status
  }, [status])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 8000)
    return () => clearTimeout(id)
  }, [notice])

  const online = status === 'online'
  return (
    <>
      <span className="hidden shrink-0 items-center gap-2 text-xs text-dim xl:flex" title={`${API_BASE}/api/health`} role="status">
        <i className={`size-2 rounded-full ${online ? 'bg-ok' : status === 'checking' ? 'bg-warn' : 'bg-faint'}`} aria-hidden />
        {online ? `Server online, ${sites} sites` : status === 'checking' ? 'Checking server' : 'Server offline, using bundled data'}
      </span>
      {notice && (
        <div role="alert" className="fixed bottom-24 left-3 z-40 max-w-[min(92vw,26rem)] border border-line bg-bg px-4 py-3 text-sm text-ink md:left-9">
          {notice}
          <button type="button" className="ml-3 min-h-9 text-dim underline underline-offset-4 hover:text-ink" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}
