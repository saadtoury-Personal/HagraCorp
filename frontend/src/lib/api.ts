// Client for the LunarNav API (LunarNav/LunarNav.Api). The server computes from the real LOLA terrain and JPL Horizons data.
// Default: the team's deployed server (Render, deployed from main). For a local `dotnet run` set VITE_API_URL=http://localhost:5204.
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'https://lunarnav-api.onrender.com').replace(/\/$/, '')

/** Response shapes, mirroring LunarNav.Core/Models.cs (System.Text.Json camelCase). */
export type Health = { status: string; sites: number }
/** rules / validated come from rules.json (Nizar's branch); older servers omit them. */
export type Rule = { id: string; label: string; value: unknown; unit?: string; description: string; status: 'assumed' | 'validated'; source: string }
/** The deployed server nests the rules file: rules = { note, rules, validated }. Older builds returned flat arrays. */
export type About = { precision: string[]; sources: string[]; rules?: Rule[] | { note?: string; rules?: Rule[]; validated?: Rule[] }; validated?: Rule[] }
export const aboutRules = (a: About | null): Rule[] => {
  if (!a) return []
  const r = a.rules
  return Array.isArray(r) ? [...r, ...(a.validated ?? [])] : [...(r?.rules ?? []), ...(r?.validated ?? [])]
}
export type ServerMetrics = {
  at: string
  hoursToSunset: number | null
  hoursToSunrise: number | null
  hoursToEarthset: number | null
  hoursToEarthrise: number | null
  sunPct: number
  earthPct: number
  bothDownPct: number
  longestDarkHours: number
  longestDarkNoEarthHours: number
  viperRuleViolated: boolean
  windowSunHours: number
  windowBothHours: number
  viable: boolean
  sunPctRange?: number[] | null
  closeCall?: boolean
  dsnPct?: number | null
}

async function getJson<T>(path: string, signal?: AbortSignal, ms = 15000): Promise<T> {
  const timeout = AbortSignal.timeout(ms)
  const res = await fetch(`${API_BASE}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

// Render's free plan sleeps when idle and takes up to a minute to wake: give the health check that long.
export const fetchHealth = (signal?: AbortSignal) => getJson<Health>('/api/health', signal, 70000)
export const fetchAbout = (signal?: AbortSignal) => getJson<About>('/api/about', signal)

/** The server only has horizon masks for observers 2 m and 10 m tall: pick the closer one. */
export const serverMast = (mastM: number): 2 | 10 => (mastM < 6 ? 2 : 10)

export function fetchMetrics(siteId: string, at: Date, stayDays: number, mastM: number, signal?: AbortSignal) {
  const q = new URLSearchParams({ at: at.toISOString(), stayDays: String(stayDays), mast: String(serverMast(mastM)) })
  return getJson<ServerMetrics>(`/api/sites/${encodeURIComponent(siteId)}/metrics?${q}`, signal)
}

/** GET /api/fallback (Analysis.BestFallback). windowHours = longest continuous Sun (and Earth when required) window when landing
 * at the best hour of the slipped day, dark gaps of 6 h or less bridged. Viable = windowHours >= stay. */
export type FallbackEntry = {
  siteId: string
  windowHours: number
  viable: boolean
  nearestViableDate: string | null
  robustness: number
  longestDarkHours: number
  windowHoursBefore: number
  viableBefore: boolean
  slipToleranceDays: number
  minShiftToViableDays: number | null
  lowerBound: boolean
  terrain: boolean
  closeCall: boolean | null
}
export type Fallback = { originalDate: string; slippedDate: string; ranked: FallbackEntry[] }

/** Day part of a date as the server's heatmap keys it (UTC). */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export function fetchFallback(date: Date, slipWeeks: number, stayDays: number, requireEarth: boolean, mastM: number, signal?: AbortSignal) {
  const q = new URLSearchParams({ date: isoDay(date), slipWeeks: String(slipWeeks), stayDays: String(stayDays), requireEarth: String(requireEarth), mast: String(serverMast(mastM)) })
  return getJson<Fallback>(`/api/fallback?${q}`, signal)
}

/** Sky state at one time for a site (LunarNav.Core TimelinePoint): disk fractions are the share of the disk above the terrain, power a 0..1 index for a Sun-tracking panel. */
export type TimelinePoint = { t: string; sunAz: number; sunEl: number; sunFrac: number; earthAz: number; earthEl: number; earthFrac: number; power: number }

export function fetchTimeline(siteId: string, from: Date, days: number, stepMinutes: number, mastM: number, signal?: AbortSignal) {
  const q = new URLSearchParams({ from: from.toISOString(), days: String(days), stepMinutes: String(stepMinutes), mast: String(serverMast(mastM)) })
  return getJson<TimelinePoint[]>(`/api/sites/${encodeURIComponent(siteId)}/timeline?${q}`, signal)
}
/** GET /api/sites/{id}/uncertainty: how the answer changes within 100, 250 and 500 m of the published point (2026 to 2030). */
export type PctRange = { official: number; min: number; max: number }
export type UncertaintyPoint = { latDeg: number; lonDeg: number; distanceM: number; bearingDeg: number; sunPct: number; earthPct: number; bothPct: number; viable14Pct: number }
export type Uncertainty = { siteId: string; mastM: number; radiiM: number[]; sunPct: PctRange; earthPct: PctRange; bothPct: PctRange; viable14Pct: PctRange; best: UncertaintyPoint; points: UncertaintyPoint[] }
export const fetchUncertainty = (siteId: string, mastM: number, signal?: AbortSignal) =>
  getJson<Uncertainty>(`/api/sites/${encodeURIComponent(siteId)}/uncertainty?mast=${serverMast(mastM)}`, signal)

/** GET /api/sites/{id}/battery (Analysis.Battery, hourly). */
export type BatteryParams = { capacityWh: number; loadW: number; panelM2: number; efficiency: number; minSocPct: number }
export type Battery = { viable: boolean; minSocPct: number; hoursBelowMin: number; endSocPct: number; minBatteryWhToSurvive: number; params: BatteryParams; series: { t: string; socPct: number; powerW: number }[] }
export function fetchBattery(siteId: string, at: Date, stayDays: number, mastM: number, p: BatteryParams, signal?: AbortSignal) {
  const q = new URLSearchParams({ at: at.toISOString(), stayDays: String(stayDays), mast: String(serverMast(mastM)) })
  for (const [k, v] of Object.entries(p)) q.set(k, String(v))
  return getJson<Battery>(`/api/sites/${encodeURIComponent(siteId)}/battery?${q}`, signal)
}

/** GET /api/sites/{id}/blockers (Analysis.Blockers): Sun hours lost to the terrain over [from, to), the 10-degree sectors that hide it most,
 * and the Sun hours a 10 m mast wins back over 2 m. */
export type Blocker = { azFromDeg: number; azToDeg: number; hours: number; horizonElDeg: number }
export type Blockers = { siteId: string; mastM: number; from: string; to: string; sunHoursFlat: number; sunHours: number; lostHours: number; lostPct: number; top: Blocker[]; mast10GainHours: number }
export function fetchBlockers(siteId: string, from: Date, to: Date, mastM: number, signal?: AbortSignal) {
  const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), mast: String(serverMast(mastM)) })
  return getJson<Blockers>(`/api/sites/${encodeURIComponent(siteId)}/blockers?${q}`, signal)
}

/** GET /api/ranking (Analysis.RobustRanking): terrain sites ranked over 2000 random weightings of Sun, Earth and longest night.
 * firstPct = share of weightings where the site comes first; paretoOptimal = no other site beats it on all three at once. */
export type RankEntry = { siteId: string; sunPct: number; earthPct: number; longestDarkHours: number; paretoOptimal: boolean; firstPct: number; meanRank: number }
export type Ranking = { date: string; stayDays: number; weightings: number; ranked: RankEntry[] }
export function fetchRanking(date: Date, stayDays: number, mastM: number, signal?: AbortSignal) {
  const q = new URLSearchParams({ date: date.toISOString(), stayDays: String(stayDays), mast: String(serverMast(mastM)) })
  return getJson<Ranking>(`/api/ranking?${q}`, signal)
}

/** GET /api/validation: the C# check against NASA PGDA product 69, with thresholds fixed before the run. Only the fields the app shows are typed. */
type Stat = { n: number; within: number; bias: number; rmse: number; r: number; maxAbs: number; maxAbsSite: string }
/** The C# against the Python with the server's disc model ported to it (a check added after the first run, not pre-registered). */
export type PortedCheck = { maxAbsDiffSun: number; maxAbsDiffEarth: number; rowsWithinThreshold: number; rows: number }
type SiteCheck ={ ours0m: number; pgda: number; diff: number; verdict: string }
export type Validation = {
  generated: string
  reference: string
  thresholds?: { note?: string }
  summary: { sun: Stat; earth: Stat; sunVerdicts?: Record<string, number>; earthVerdicts?: Record<string, number>; csharpVsPortedPython?: PortedCheck }
  pass: Record<string, boolean>
  sites: { siteId: string; sun: SiteCheck; earth: SiteCheck }[]
}
export const fetchValidation = (signal?: AbortSignal) => getJson<Validation>('/api/validation', signal)
export const exportCsvUrl = (siteId: string, from: Date, days: number, mastM: number) =>
  `${API_BASE}/api/sites/${encodeURIComponent(siteId)}/export.csv?${new URLSearchParams({ from: from.toISOString(), days: String(days), mast: String(serverMast(mastM)) })}`
