// Client for the LunarNav API (LunarNav/LunarNav.Api). The server computes from the real LOLA terrain and JPL Horizons data.
// Set VITE_API_URL to point at another server; by default it is the one `dotnet run` starts locally (launchSettings.json).
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5204').replace(/\/$/, '')

/** Response shapes, mirroring LunarNav.Core/Models.cs (System.Text.Json camelCase). */
export type Health = { status: string; sites: number }
/** rules / validated come from rules.json (Nizar's branch); older servers omit them. */
export type Rule = { id: string; label: string; value: unknown; unit?: string; description: string; status: 'assumed' | 'validated'; source: string }
export type About = { precision: string[]; sources: string[]; rules?: Rule[]; validated?: Rule[] }
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

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(5000)
  const res = await fetch(`${API_BASE}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export const fetchHealth = (signal?: AbortSignal) => getJson<Health>('/api/health', signal)
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

/** GET /api/validation serves validation.json as written by the backend; its shape is not fixed yet, so it is shown as received. */
export const fetchValidation = (signal?: AbortSignal) => getJson<unknown>('/api/validation', signal)
export const exportCsvUrl = (siteId: string, from: Date, days: number, mastM: number) =>
  `${API_BASE}/api/sites/${encodeURIComponent(siteId)}/export.csv?${new URLSearchParams({ from: from.toISOString(), days: String(days), mast: String(serverMast(mastM)) })}`
