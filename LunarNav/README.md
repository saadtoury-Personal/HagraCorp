# LunarNav

**HagraCorp · NASA Space Apps Hackathon**

LunarNav helps mission planners, educators and the public compare lunar south-pole landing sites and dates. A lander arrives at a site near the Moon's south pole at a given time and stays a number of days. Will it see the **Sun** (solar power) **and the Earth** (radio link) for long enough? If the launch slips by a few weeks, **which site becomes the best one?**

The Moon has no air, so the answer is pure geometry: where the Sun and the Earth are in the sky, and whether the mountains around the site hide them. The backend computes that geometry from NASA data, then turns it into countdowns, percentages, verdicts and rankings.

| | |
|---|---|
| **32** landing sites (31 with real relief, Apollo 11 flat) | **43,825** hourly Sun/Earth positions, 2026 → 2030 (JPL Horizons) |
| **57.8 M** terrain heights, 80 m pixels (NASA LOLA) | **0.006°** max gap vs JPL Horizons for Sun/Earth direction |
| **0.7 pt** median gap vs NASA illumination maps (31 sites) | **16** HTTP endpoints |
| **148** automated tests (87 maths, 61 API) | **0** network calls needed to answer (except the Moon picture) |

## Repository layout

| Project | Role |
|---|---|
| `LunarNav.Core` | Pure maths and decisions: geometry, ephemeris, terrain/horizon mask, analysis. No files, no network, unit-testable. No dependency other than .NET 11. |
| `LunarNav.Api` | ASP.NET Core (.NET 11) web server: 16 endpoints, input validation, error mapping, data loading, Moon proxy. Also the entry point of the offline `precompute` job. |
| `LunarNav.Web` | Blazor web app. Its `wwwroot/data` folder holds the precomputed data files. |
| `LunarNav.Core.Tests` | 87 tests on the maths (geometry vs JPL, DEM projection, ephemeris, gaps, battery, ranking…). |
| `LunarNav.Tests` | 61 tests that start the real API in memory and call its endpoints. |
| `Dockerfile` | Container build used for hosting. |

The split is deliberate: Core has no I/O, so every formula can be tested with plain numbers and reused by the API, the offline job, the tests and the web app. The API stays thin: it reads files, validates inputs and calls Core.

Main files of `LunarNav.Core`: `Models.cs` (shared data types), `Geometry.cs` (sky positions, parallax, disk sizes, visible fraction, eclipses), `Ephemeris.cs` (hourly CSV loader and interpolation), `Terrain.cs` (`Dem` projection and height lookup, `HorizonMask` 720-direction skyline by ray casting), `Analysis.cs` (every decision: timelines, countdowns, stay statistics, windows, heatmap, fallback and robust ranking, battery, uncertainty, relief cost, DSN).
Main files of `LunarNav.Api`: `Program.cs`, `AppData.cs` (lazy, thread-safe in-memory cache of the data folder), `Tools.cs` (DEM loading and the `precompute` job), `MoonService.cs` (NASA Dial-A-Moon proxy with hourly cache and local fallback).

## Architecture

The backend has two halves that never run at the same time:

- **Offline jobs** (run by hand, before a deploy): download the Sun/Earth positions from JPL, then compute the skylines and the big multi-year tables that are too slow to compute per request. Results are plain JSON/CSV files.
- **Online API**: loads those files and computes everything else per request. It never needs the internet to answer, except to fetch a Moon picture from NASA (with a local fallback).

```
Sources (internet)       Offline jobs (by hand)      Data folder (files)        Online API (per request)
JPL Horizons API    -->  fetch_ephem.py          --> wwwroot/data/          --> LunarNav.Api
NASA PDS · LOLA DEM -->  precompute              -->   sites.json                 AppData -> LunarNav.Core
Team (by hand)      ---------------------------->      ephem.csv                 MoonService -> NASA Dial-A-Moon
                                                       masks/{id}_{2|10}m.json     |-> Web app (Blazor)
                                                       heatmap_{2|10}m.json        '-> Swagger UI
                                                       uncertainty_{2|10}m.json
```

Almost every endpoint runs the same chain, once per time step (hourly or every 10 minutes):

1. **Time** `t`, any UTC time in 2026-2030.
2. **Ephemeris**: interpolate the two nearest hourly rows.
3. **Sky position**: Sun and Earth azimuth/elevation (the Earth needs a parallax correction, the Sun does not).
4. **Visible part**: share of each disk above the site's skyline, eclipses included.
5. **Flags**: Sun up? Earth in view? Power index.
6. **Answers**: percentages, countdowns, windows, verdicts, rankings.

## Input data

| Data | Source | Notes |
|---|---|---|
| Sun/Earth positions | JPL Horizons (target Moon 301 from Earth centre, quantities 14, 15, 20), hourly 2026-01-01 → 2031-01-01 | Stored as `ephem.csv` (43,825 rows). `fetch_ephem.py` refuses wrong frame, gaps, wrong row count; raw Horizons text is kept as the citable source. |
| Terrain | NASA PDS LOLA `LDEM_80S_80M.IMG` (115,520,000 bytes) | 7600 × 7600 px, 80 m/px, latitude −80° to −90°, south polar stereographic. Too big for git: the Docker build downloads it. |
| Sites | `sites.json`, curated by the team | 32 sites: 28 Artemis III candidate-region points, 1 CLPS (IM-2 Athena), 1 international, 1 failure, and Apollo 11 as an equator comparison (`terrain: false`, flat skyline). |
| Moon picture (optional) | NASA SVS Dial-A-Moon | Only for `GET /api/moon`, with a local fallback. |

Conventions: angles in degrees (radians only inside formulas); longitude east-positive in [0, 360], latitude north-positive; distances in km unless the name ends with `M`; **time in UTC only** (a query time without `Z` is read as UTC); frame Moon Mean Earth (ME, DE421), shared by LOLA and JPL Horizons; Moon is a sphere of radius 1737.4 km; JSON is camelCase.

## How decisions are made

- **Skyline**: 720 azimuths (every 0.5°), 80 m steps, 250 km range, ray casting on true 3D points so the Moon's curvature is built in. No refraction (no atmosphere).
- **Sun up / Earth in view**: any part of the disk above the skyline (NASA's own definition, so results are comparable with NASA's maps). Rules `edge`/`any` (default), `center` and `full` are available.
- **Libration** is included automatically, because JPL gives the sub-Earth point hour by hour; the Earth–Moon distance sets its apparent size.
- **Power**: vertical Sun-tracking panel by default, `index = SunFrac × cos(el)`; flat panel option `SunFrac × max(0, sin(el))`. Battery simulated hour by hour (defaults: 5000 Wh, 150 W load, 2 m² panel, 28 % efficiency, 20 % minimum charge, all adjustable and shown as assumptions), plus the smallest battery that survives the stay.
- **Windows and verdict**: continuous Sun (or Sun + Earth) hours from arrival, dark gaps ≤ 6 h bridged. **Viable** when the window is at least as long as the stay. The VIPER rule flags more than 50 h without both Sun and Earth. DSN visibility requires Goldstone, Madrid or Canberra to see the Moon above 10°.
- **Close call**: the verdict flips if the skyline is 0.2° higher or lower.
- **Slip heatmap** (precomputed): every site × every day 2026-01-01 → 2030-10-31, best landing hour and window length; one file serves every stay length.
- **Fallback ranking** ("the launch slipped, which site now?"): sorted by real relief first (flat sites are fake-good), then longest window, then shortest longest-night, then robustness (share of viable days within ±2 weeks). Also reports slip tolerance and nearest viable date.
- **Uncertainty**: 41 points around each site (rings of 100-500 m) to show how much a landing off target changes the result; **robust ranking** over 2000 random weightings (fixed seed, Pareto).

## API

Base path `/api`. All GET except `/custom`. JSON in camelCase, times in UTC (a missing `at` means "now"). Interactive docs at `/swagger`, OpenAPI at `/openapi/v1.json`, `/` redirects to Swagger. CORS is open and there is no authentication: the API is read-only, holds no secrets and no user data.

| Endpoint | Parameters (defaults) | Returns |
|---|---|---|
| `GET /health` | | `{status:"ok", sites:32}` |
| `GET /about` | | Precision statements and data sources |
| `GET /sites` | | The 32 sites |
| `GET /sites/{id}/mask` | `mast` (2) | 720 skyline elevations, bin *i* = azimuth *i* × 0.5° |
| `GET /sites/{id}/metrics` | `at`, `stayDays` (14), `mast` (2), `sunRule` (edge), `earthRule` (any) | `SiteMetrics`: countdowns, %, longest dark, VIPER, windows, viable, margin ranges, close call, DSN % |
| `GET /sites/{id}/battery` | `at`, `stayDays`, `mast`, `capacityWh` (5000), `loadW` (150), `panelM2` (2), `efficiency` (0.28), `minSocPct` (20) | `BatteryDto` |
| `GET /sites/{id}/uncertainty` | `mast` | `UncertaintyDto` (41 points, ranges, best point) |
| `GET /sites/{id}/blockers` | `from`, `to`, `mast` | `BlockersDto`: Sun hours flat vs real, top 3 blocking sectors |
| `GET /sites/{id}/timeline` | `from` (now), `days` (30, max 366), `stepMinutes` (60, min 10), `mast` | Array of `TimelinePoint`, cut at the end of the data |
| `GET /sites/{id}/export.csv` | `from` (now), `days` (30, max 366), `mast` | Hourly series as CSV (Sun/Earth position, visible fraction, power), with a header naming the sources |
| `GET /validation` | | `validation.json`: our Sun/Earth % vs NASA PGDA for 31 sites, thresholds, negative controls |
| `GET /heatmap` | `mast` | `HeatmapDto` (all sites × days) |
| `GET /fallback` | **`date`**, `slipWeeks` (0), `stayDays` (14), `requireEarth` (true), `mast` | `FallbackDto`: ranked sites |
| `GET /ranking` | **`date`**, `stayDays` (14), `mast` | `RankingDto`: robust ranking of relief sites |
| `POST /custom` | body `{lat, lon, mast, at}` | Skyline computed live + 14-day metrics for any point on the polar map (~1 s) |
| `GET /moon` | `at` (now) | `MoonDto`: phase, age, distance, picture URL, source `nasa` or `local` |

Errors: **400** for caller mistakes (mast not 2 or 10, `stayDays` outside (0, 60], `slipWeeks` outside 0..52, `days` outside 1..366, `stepMinutes` < 10, invalid battery values, date outside 2026-2030, custom latitude outside [−89.9, −80.5] or mast outside [1, 20]), with a clear message; **404** for an unknown site id or a file not precomputed yet; **503** when the terrain file is missing on the server (only `/custom` needs it).

Example:

```
GET /api/fallback?date=2027-10-10&slipWeeks=4
```

## Run it

Run the API locally, then open `/swagger`:

```bash
dotnet run --project LunarNav.Api
```

Run the tests:

```bash
dotnet test
```

### Regenerate the precomputed data (offline, never during a demo)

1. Ephemeris: `python3 fetch_ephem.py <raw_dir> <out_csv>` writes `ephem.csv` (43,825 rows) plus the raw Horizons files.
2. Everything else: `dotnet run --project LunarNav.Api -- precompute <dem.img> <dataDir>` writes, for masts 2 and 10, `masks/{id}_{mast}m.json`, `heatmap_{mast}m.json` and `uncertainty_{mast}m.json`.

At runtime only `sites.json` is read at start (fails fast if missing). The ephemeris and the 115 MB terrain map are loaded lazily; skylines, heatmaps and uncertainty files are cached on demand. Folders come from the `DataDir` and `DemPath` settings (environment variables in Docker). If the terrain file is missing, only `/custom` returns 503; everything else keeps working.

## Deployment

The API is containerised (`Dockerfile`) and hosted on Render with auto-deploy on every approved merge into `dev`.

- Two-stage image: the .NET SDK only builds; the final image holds the runtime, the app, the data folder (copied from `LunarNav.Web/wwwroot/data`) and the DEM.
- The build downloads `LDEM_80S_80M.IMG` from NASA PDS (3 retries) and keeps it only if its size is exactly 115,520,000 bytes.
- Runs on port 10000 as a non-root user, health check on `GET /api/health`.
- The free plan sleeps when idle: warm it up with `/api/health` before a demo.
- An AWS Lambda hosting option (`AddAWSLambdaHosting(HttpApi)`) is in progress; outside Lambda it does nothing.

## Validation

| What | Reference | Result |
|---|---|---|
| Sun and Earth az/el | JPL Horizons (observer quantity 4, centre = the site) | within 0.006° (goal was 0.01°) |
| Skylines | Independent Python re-implementation on the same DEM | max difference 0.000° on all 31 masks |
| Sun % per site | NASA PGDA / LOLA AVGVISIB maps | median gap 0.7 pt, 26/31 sites within 5 pts |
| Earth % per site | Same NASA product | median gap 0.7 pt, 28/31 sites within 5 pts |
| Best spot near the connecting ridge | Gläser et al. 2014 | ours 89.8 % at 2 m (literature 92.3 % on finer 20 m terrain) |
| Moon phase | NASA Dial-A-Moon | same formula, checked in tests |

Stated precision (also in `GET /api/about`): percentages good to about ±5 points; rise/set times to about ±2 h (up to ±4 h when the Sun grazes the horizon). Results are for one observer above one 80 m pixel: moving a few hundred metres can change Sun % by tens of points, hence the uncertainty rings.

Pull requests into `dev` need an approved review; tests run before merging.

## Known limits

- Data covers 2026-2030 only (heatmap to 2030-10-31): dates outside return 400 (a period that starts inside and runs past the end returns what exists). Re-run the two offline jobs with a longer range to extend.
- The polar map covers −80° to −90° only: other sites get a flat skyline (`terrain: false`), are ranked last and are excluded from the robust ranking.
- 80 m pixels and one observer point: small rocks and nearby relief are averaged (see uncertainty rings and the ±0.2° margin).
- Only masts of 2 m and 10 m are precomputed; other heights (1-20 m) go through `/custom`.
- 5 years of data vs NASA's 18.6: year-to-year Sun % varies by about 2.5 pts (max 3.3).
- Simple battery model (constant load, no temperature, no ageing): optimistic in the cold.
- Heatmap days are UTC days; the "best hour" is returned in UTC.
- Dial-A-Moon only covers up to the end of 2026: no NASA picture for 2027-2030 (local phase and distance are returned instead).
- Eclipse handling may count a part of the Sun already behind terrain (a few hours per year, slightly too dark).

## Next steps

Longer time span; finer terrain (20 m or 5 m polar DEMs near the best sites); more precomputed mast heights; thermal model for the battery; relay satellites as a second communication path; region search for the best point within a few km of a site; finish the AWS Lambda hosting option.

## Data used

- **NASA**: LRO LOLA `LDEM_80S_80M` polar DEM (PDS Geosciences Node); JPL Horizons; PGDA product 69 Lunar Polar Illumination (validation); SVS Dial-A-Moon; Artemis III candidate landing regions; Lunar Surface Data Book (ACD-50044); Deep Space Network station locations; LROC QuickMap (manual spot checks).
- **Literature and other**: Gläser et al. 2014 (Icarus 243, DLR); Mazarico et al. 2011 (Icarus 211); Astronomical Almanac low-precision lunar formulas; J. Meeus, *Astronomical Algorithms*; CLPS and international mission records for the non-Artemis sites.

## Use of artificial intelligence

- **Code writing**: much of the backend code was written by a local open-weight language model (Qwen, run on a team laptop), working from task specifications written by the team.
- **Review**: an AI assistant (Claude) helped write the specifications and reviewed every change against them.
- **Human checks**: every line marked `MATH-REVIEW` in the code was checked by the team; all results are checked by tests and against independent NASA/JPL data, not trusted because an AI produced them.
- **No AI at run time**: the API uses no AI model. Every answer comes from deterministic, explainable formulas.
