import { useEffect, useState } from 'react'
import { useServer } from '../store/server'

export type ServerData<T> = { state: 'offline' | 'loading' | 'error' | 'ok'; data: T | null }

/**
 * Calls the LunarNav server when it is online, again whenever `key` changes (debounced so sliders do not flood it).
 * Returns 'offline' when the server is not reachable, so the caller can fall back to bundled data.
 */
export function useServerData<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled = true): ServerData<T> {
  const online = useServer((s) => s.status === 'online')
  const [res, setRes] = useState<{ key: string; data: T | null; failed: boolean }>({ key: '', data: null, failed: false })
  useEffect(() => {
    if (!online || !enabled) return
    const ctl = new AbortController()
    const id = setTimeout(() => {
      load(ctl.signal).then(
        (data) => setRes({ key, data, failed: false }),
        () => !ctl.signal.aborted && setRes({ key, data: null, failed: true }),
      )
    }, 250)
    return () => {
      clearTimeout(id)
      ctl.abort()
    }
    // load is recreated every render; key carries everything it depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, enabled, key])
  if (!online || !enabled) return { state: 'offline', data: null }
  if (res.key !== key) return { state: 'loading', data: null }
  return res.failed ? { state: 'error', data: null } : { state: 'ok', data: res.data }
}
