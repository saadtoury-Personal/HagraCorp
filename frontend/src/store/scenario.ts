import { create } from 'zustand'

// Single source of truth for a scenario. shortcut: no URL sync yet, add it when sharing links is needed.
type Scenario = {
  siteId: string | null
  /** Days since the timeline epoch (see lib/ephemeris). One shared time for every view. */
  day: number
  playing: boolean
  slipDays: number
  stayDays: number
  mast: 2 | 10
  set: (patch: Partial<Omit<Scenario, 'set'>>) => void
}

export const useScenario = create<Scenario>((set) => ({
  siteId: null,
  day: 17, // waning gibbous: the visible hemisphere is lit, so the first screen is not a black disc
  playing: false,
  slipDays: 0,
  stayDays: 7,
  mast: 2,
  set: (patch) => set(patch),
}))
