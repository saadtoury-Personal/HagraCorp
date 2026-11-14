# What the frontend has to do — Slip Navigator (LunarNav)

Frontend version of "What the backend has to do". Owner: Youssef (frontend), with Nazim (design system). Draft of 2026-11-14, to validate with Saad / Nizar / Edi.

## In one paragraph

The frontend is a **static single-page app that renders precomputed data**. It is not a CRUD app and has no database. It loads JSON/binary files produced by the backend pipeline, does only cheap math in the browser (metrics from hourly series, ranking sites for a slipped date), and calls **one** live endpoint for custom coordinates. Never call Horizons from the browser. The demo must work with the network cable pulled, except the custom-coordinates call, which needs a cached fallback.

## Tech decisions (my calls, correct me)

| Topic | Choice | Why |
|---|---|---|
| App | **Vite + React 19 + TypeScript** (SPA) | Everything is precomputed, so no SSR or Node server is needed. Vite is the shortest path. Deploys as plain static files (Vercel / GitHub Pages). *Changed from my earlier PDF: Next.js is dropped as unnecessary.* |
| Routing | React Router | 4 screens, nothing exotic |
| Styling / UI | Tailwind CSS v4 + shadcn/ui (Radix) | Nazim's design system maps to Tailwind tokens; accessible primitives for free |
| Charts | **Apache ECharts** (heatmap, timeline, miss-map) | One library handles all three; handles 100k points; heatmap built in |
| Horizon panorama / polar | Hand-written SVG | 720 points, the hero visual, needs full control (Sun/Earth discs, 0.53° / 1.9°) |
| Site map | Static polar hillshade image + SVG markers | No map library needed |
| 3D globe | React Three Fiber + drei, **lazy-loaded, last phase** | Optional per README; never blocks the core |
| State | **Zustand**, synced to the URL | A scenario (site, date, slip, stay) = a shareable link; useful for the pitch |
| Compute | Plain TypeScript functions on the main thread | Moving the slip slider only changes which day column is read, and ranking ~13 sites is a sort of 13 numbers. No Worker (Saad's review) |
| Data fetching | Plain `fetch` | Static files plus one live call; no TanStack Query (Saad's review) |
| Tests | Vitest, against `fixtures/metrics.json` written by the C# precompute | Proves the TS metrics equal the backend metrics (expected countdowns, longest dark and window for 3 sites and dates) |

## The data contract (the real interface with the backend)

The backend is C# (`LunarNav.Core`, per Saad's review). The frontend depends only on these language-independent file formats. The single source of truth is the shared `docs/data-contract.md` (drafted by Saad, to be approved by both sides); this table only summarizes it, and where they differ the contract wins. Mast height (`{mast}` = 2 or 10) is part of every file name because visibility depends on it.

| File | Content | Source (backend section) |
|---|---|---|
| `sites.json` | Same fields as the backend `Site` record (`LunarNav.Core/Models.cs`): `id, name, latDeg, lonDeg, category, notes, terrain`. `category` is `artemis\|clps\|apollo\|international\|failure\|custom`; `terrain: false` = outside the south-pole map (Apollo 11), flat horizon. A wrong field name makes the .NET reader skip the field silently and place the site at 0,0 | 1 |
| `series/index.json` | Shared header: `start`, `stepMinutes`, `count`. The frontend reads it and never hardcodes the grid | 2 |
| `series/{id}_{mast}m.bin` | 10-byte rows per step: `sunAz u16, sunEl i16, sunFrac u8, earthAz u16, earthEl i16, earthFrac u8` (0.01° units, fractions /255). About 440 KB per site and mast | 2 + 4 |
| `masks/{id}_{mast}m.json` | 720 numbers; element *i* = horizon elevation at azimuth *i* × 0.5° | 3 |
| `heatmap_{mast}m.json` | `{ sites, days, sunH[site][day], bothH[site][day] }`: continuous hours of Sun (and Sun + Earth) starting each day at 06:00 UTC. The browser computes `viable = hours >= stayDays * 24`, so one file serves every stay length and the require-Earth switch | 6 |
| `miss/{id}.json` | 11×11 metric grid around the target, 50 m spacing (stretch) | 7 |
| `validation.json` | Our Sun/Earth % vs NASA PGDA 69 at 2–3 sites | 8 |
| `fixtures/metrics.json` | Expected countdowns / longest dark / window for 3 sites and dates, written by the C# precompute; used only by the tests | 5 |
| `GET /api/custom/mask?lat&lon&mast` | 720 numbers, same as `masks/*.json`. Returns 400 if `lat` is outside [-90, -80.5] (the terrain map only covers the south pole) | 3 |
| `GET /api/custom/series?lat&lon&mast` | Same binary as `series/*.bin` (the single live endpoint, in two calls) | 2 |

One shape for curated and custom sites means the UI treats them identically.

## Mapping: what each backend job becomes in the frontend

| Backend job | What the frontend does |
|---|---|
| 1. Site list | Site picker (list + polar map), search, "add custom coordinates" |
| 2. Sun/Earth positions | Shows az/el of Sun and Earth on the panorama for the selected hour; no astronomy math in the UI |
| 3. Terrain horizon | Draws the horizon silhouette (360° panorama + polar diagram); toggle 2 m / 10 m mast |
| 4. Visibility per hour | Draws Sun and Earth as discs partly hidden by the horizon; shows the fraction as a % |
| 5. Metrics | Computed in TypeScript from `series` (offline demo), using the exact formulas of `LunarNav.Core/Analysis.cs`: Sun up = `sunFrac >= 0.5`, Earth in view = `earthFrac > 0`, VIPER flag = longest run with Sun down AND Earth down > 50 h, power = `sunFrac × cos(sunEl)` for a vertical tracking panel; plus time to sunset / Earthset, % Sun / Earth / both down, mission window covers N days. The backend drops its `/metrics` and `/fallback` endpoints, so each formula has one implementation |
| 6. Slip grid | **Slip Navigator** screen: heatmap sites × dates from `heatmap_{mast}m.json`, slip slider, best-fallback ranking (a plain function that sorts ~13 sites for the new date) |
| 7. Landing-miss map | Heatmap of how metrics spread within 250 m (stretch) |
| 8. Accuracy check | A "Validation" panel: our numbers beside NASA's — the pitch slide |

## Screens

1. **Navigator** (home): site picker + date/time slider; panorama with Sun and Earth; countdown cards (time to sunset / Earthset); metric tiles. Planner view and "simple" explainer view via a toggle, because the challenge wants planners, educators and the public.
2. **Slip Navigator** (the differentiator): site × date heatmap, slip slider, stay-duration input, ranked fallback sites for the new date, click a cell to open the Navigator at that scenario.
3. **Compare**: 2–4 sites side by side (same metrics, mini-timelines, one highlighted winner per metric).
4. **Validation + About**: PGDA 69 comparison, data sources, limits (no libration beyond Horizons, Sun disc approximation).
5. **Globe** (optional, last): 3D Moon with the sub-solar / sub-Earth points and site markers.

## Proposed file tree

New folder `frontend/` at the repo root, next to `LunarNav/`. The Blazor project `LunarNav.Web` is removed. The same PR must also:

- delete `LunarNav/LunarNav.Web` and its line in `LunarNav.slnx` (CI builds the whole solution);
- add an `npm ci && npm test && npm run build` CI job;
- tell the backend the new data folder, `frontend/public/data`: `Tools.Precompute` and the `DataDir` default in `Program.cs` currently write to `LunarNav.Web/wwwroot/data`, so both must change.

```
HagraCorp/
├─ README.md
├─ docs/
│  ├─ frontend-architecture.md        ← this file
│  └─ data-contract.md                ← agreed with backend (file formats)
├─ frontend/
│  ├─ package.json, vite.config.ts, tsconfig.json, index.html
│  ├─ public/
│  │  └─ data/                        ← versioned precomputed files (contract above)
│  │     ├─ sites.json, validation.json, heatmap_2m.json, heatmap_10m.json
│  │     ├─ series/, masks/, miss/
│  │     └─ moon-south-hillshade.png
│  └─ src/
│     ├─ main.tsx, App.tsx, routes.tsx
│     ├─ pages/
│     │  ├─ Navigator.tsx
│     │  ├─ SlipNavigator.tsx
│     │  ├─ Compare.tsx
│     │  ├─ Validation.tsx
│     │  └─ Globe.tsx                 ← lazy-loaded
│     ├─ features/
│     │  ├─ sites/                    ← SitePicker, SiteMap, CustomCoordsForm
│     │  ├─ horizon/                  ← Panorama (SVG), PolarHorizon, SunEarthDiscs
│     │  ├─ timeline/                 ← PowerCommsTimeline (ECharts), DateSlider
│     │  ├─ slip/                     ← SlipHeatmap, SlipSlider, FallbackRanking
│     │  ├─ compare/                  ← CompareTable, MiniTimeline
│     │  └─ globe/                    ← MoonGlobe (R3F)
│     ├─ lib/
│     │  ├─ data/                     ← loaders, header validation, binary decoders, customSite client
│     │  ├─ metrics/                  ← timeToSet, longestDark, powerIndex, missionWindow, bestFallback (pure TS)
│     │  └─ types.ts
│     ├─ store/
│     │  └─ scenario.ts               ← Zustand + URL sync (site, date, slip, stay, mast)
│     ├─ components/ui/               ← shadcn primitives + design-system tokens (Nazim)
│     └─ styles/                      ← Tailwind theme, dark "space" palette
└─ fixtures/
   └─ metrics.json                    ← expected values written by the C# precompute; Vitest compares the TS metrics against them
```

## Build order (hackathon sequence)

1. **Skeleton + contract (first):** Vite app, `sites.json`, fake `series/` and `masks/` from the backend stubs, so work starts before real data lands.
2. **Navigator core:** panorama, discs, countdown cards, metric tiles. This is the minimum demo.
3. **Slip Navigator:** heatmap, slider, fallback ranking. The reason to win.
4. **Compare + custom coordinates + Validation panel.**
5. **Polish:** planner / simple toggle, shareable URLs, performance pass.
6. **Stretch:** miss-map, then globe.

## Risks and open items

- **Backend language is still open for the team.** README says FastAPI (Nizar); the repo has the .NET backend with Core math and CI. Saad and Nizar decide today. Until then the frontend codes only against the file formats in `docs/data-contract.md`, which are language-independent.
- **Time range and step:** the series header (`series/index.json`) carries `start`, `stepMinutes`, `count`; the frontend reads it, so the grid can change without a frontend change.
- **Custom coordinates need a live server.** On the demo day, ship a precomputed fallback for 2–3 coordinates so a network failure does not break the pitch.
- **Binary vs JSON series:** binary (10-byte rows, about 440 KB per site and mast) is the contract; see `docs/data-contract.md` before changing it.
- **Challenge.md is on `dev`, not `main`:** it should be merged so the whole team reads the same brief.
