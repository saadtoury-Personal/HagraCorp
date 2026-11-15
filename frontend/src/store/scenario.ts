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
  /** Launch delay explored on the Slip page, days (whole weeks). */
  slip: number
  /** Viable needs Earth in view as well as the Sun (direct-to-Earth link). */
  requireEarth: boolean
  set: (patch: Partial<Omit<Scenario, 'set'>>) => void
}

export const useScenario = create<Scenario>((set) => ({
  site: 0,
  day: 17, // waning gibbous: the visible hemisphere is lit, so the first screen is not a black disc
  // Time runs on arrival, except for people who ask their system for reduced motion.
  playing: !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches),
  dur: 6, // team plan: 6 days (at 14 days only 3% of cells are viable); NASA white paper: about 6 to 6.5 days
  minE: 90,
  minD: 50,
  mast: 3,
  maxDark: 96, // four days: a lander with a large battery or a radioisotope heater
  slip: 14,
  requireEarth: true,
  set: (patch) => set(patch),
}))
