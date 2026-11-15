// Client for the LunarNav API (LunarNav/LunarNav.Api). The server computes from the real LOLA terrain and JPL Horizons data.
// Set VITE_API_URL to point at another server; by default it is the one `dotnet run` starts locally (launchSettings.json).
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5204').replace(/\/$/, '')

/** Response shapes, mirroring LunarNav.Core/Models.cs (System.Text.Json camelCase). */
export type Health = { status: string; sites: number }
export type About = { precision: string[]; sources: string[] }
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

export type FallbackEntry = { siteId: string; windowHours: number; viable: boolean; nearestViableDate: string | null; robustness: number }
export type Fallback = { originalDate: string; slippedDate: string; ranked: FallbackEntry[] }

/** Sites ranked by the continuous Sunlight window on the slipped date (precomputed slip heatmap on the server). */
export function fetchFallback(date: Date, slipWeeks: number, stayDays: number, requireEarth: boolean, mastM: number, signal?: AbortSignal) {
  const q = new URLSearchParams({ date: date.toISOString(), slipWeeks: String(slipWeeks), stayDays: String(stayDays), requireEarth: String(requireEarth), mast: String(serverMast(mastM)) })
  return getJson<Fallback>(`/api/fallback?${q}`, signal)
}
