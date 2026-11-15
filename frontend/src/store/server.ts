import { create } from 'zustand'
import { fetchAbout, fetchHealth, type About } from '../lib/api'

// Whether the LunarNav API answers. When it does not, every view keeps working from the data bundled with the app.
type ServerState = {
  status: 'checking' | 'online' | 'offline'
  sites: number
  about: About | null
  check: () => Promise<void>
}

// The free Render server can take up to a minute to wake: one health call at a time, not one more per 30 s tick.
let inFlight: Promise<void> | null = null

export const useServer = create<ServerState>(() => ({
  status: 'checking',
  sites: 0,
  about: null,
  check: () => (inFlight ??= run().finally(() => (inFlight = null))),
}))

async function run() {
  const { setState: set, getState: get } = useServer
  try {
    const h = await fetchHealth()
    set({ status: 'online', sites: h.sites })
    if (!get().about) fetchAbout().then((about) => set({ about }), () => undefined)
  } catch {
    set({ status: 'offline' })
  }
}
