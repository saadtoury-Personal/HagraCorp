import { create } from 'zustand'

// Single source of truth for a scenario. shortcut: no URL sync yet, add it when sharing links is needed.
type Scenario = {
  siteId: string | null
  date: string | null // ISO UTC
  slipDays: number
  stayDays: number
  mast: 2 | 10
  set: (patch: Partial<Omit<Scenario, 'set'>>) => void
}

export const useScenario = create<Scenario>((set) => ({
  siteId: null,
  date: null,
  slipDays: 0,
  stayDays: 7,
  mast: 2,
  set: (patch) => set(patch),
}))
