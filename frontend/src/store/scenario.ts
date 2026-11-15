import { create } from 'zustand'

// Single source of truth for a scenario: every view reads it, none keeps its own copy.
// shortcut: no URL sync yet, add it when sharing links is needed.
type Scenario = {
  /** Index of the selected site in SITES. */
  site: number
  /** Days since the timeline epoch (see lib/ephemeris). */
  day: number
  playing: boolean
  /** Mission length in days. */
  dur: number
  /** Minimum sunlit share, percent. */
  minE: number
  /** Minimum Earth-link share, percent. */
  minD: number
  /** Mast height in metres. */
  mast: number
  /** Longest stretch without sunlight the batteries can bridge, hours. */
  maxDark: number
  /** Launch delay explored on the Slip page, days. */
  slip: number
  set: (patch: Partial<Omit<Scenario, 'set'>>) => void
}

export const useScenario = create<Scenario>((set) => ({
  site: 0,
  day: 17, // waning gibbous: the visible hemisphere is lit, so the first screen is not a black disc
  playing: false,
  dur: 6.5, // 2023 NASA white paper: a first landing site should be sunlit about 6 to 6.5 days
  minE: 90,
  minD: 50,
  mast: 3,
  maxDark: 96, // four days: a lander with a large battery or a radioisotope heater
  slip: 14,
  set: (patch) => set(patch),
}))
