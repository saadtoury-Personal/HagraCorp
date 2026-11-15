import { create } from 'zustand'
import { fetchAbout, fetchHealth, type About } from '../lib/api'

// Whether the LunarNav API answers. When it does not, every view keeps working from the data bundled with the app.
type ServerState = {
  status: 'checking' | 'online' | 'offline'
  sites: number
  about: About | null
  check: () => Promise<void>
}

export const useServer = create<ServerState>((set, get) => ({
  status: 'checking',
  sites: 0,
  about: null,
  check: async () => {
    try {
      const h = await fetchHealth()
      set({ status: 'online', sites: h.sites })
      if (!get().about) fetchAbout().then((about) => set({ about }), () => undefined)
    } catch {
      set({ status: 'offline' })
    }
  },
}))
