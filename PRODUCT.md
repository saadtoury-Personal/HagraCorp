# Product

<!-- impeccable:product-schema 1 -->

> Context inferred from the user's brief and the README (no formal interview). Items marked "to confirm" are assumptions.

## Platform

web

## Stack

React + TypeScript + Vite, D3 for charts, Three.js / WebGL for the globe and terrain (user's choice, option A). Throwaway static HTML mockup in `design/mockup/`.

## Users

- Lunar mission planners (science and engineering) who compare landing sites and dates.
- Educators and the public who want to understand why the lunar south pole is hard (grazing light, line of sight to Earth).
- Context: NASA Space Apps 2026 challenge "Lunar Landing Site Navigator" (team HagraCorp, Sherbrooke).

## Product Purpose

An intuitive tool that compares landing sites and dates at the lunar south pole, showing the Sun and Earth relative to the horizon, to assess power generation and direct-to-Earth (DTE) communication windows. Success: answer "is this site viable on this date?" within seconds.

## Positioning

Existing tools (Moon Trek, JMARS, LROC QuickMap) are powerful but have complicated interfaces. Here: one continuous zoom from the globe to the ground, a time slider that drives everything, and an inverted ranking (describe the mission, the tool proposes the windows).

## Capabilities and Constraints

- 3 pages: Globe (Moon, Sun and Earth, 45° view, zoom to the 13 regions), Site (terrain flyover in the spirit of NASA SVS 5013, assessment, Sun / Earth / both timeline), Compare (site × date heatmap, ranking).
- Planned backend: FastAPI, per-site precompute (LOLA terrain, SPICE or Skyfield ephemerides). The frontend is built first against simulated data.
- Language: English (the interface is fully in English).
- The 13 Artemis III candidate regions are those of the NASA SVS 5013 video. Their positions in the mockup are illustrative.

## Brand Commitments

Visual direction set by the user: close to NASA and SpaceX websites, clean and professional, dark editorial layouts.

## Evidence on Hand

- Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- Reference video: https://svs.gsfc.nasa.gov/5013/
- No real scientific data is integrated yet: every figure in the mockup is simulated and must stay labelled as such.

## Product Principles

1. A readable answer before the detail: verdict first, curves after.
2. One shared time: the date slider drives the globe, the terrain and the indicators.
3. Scientific honesty: every value states its source or status (simulated / computed).
4. The image carries the page; the interface stays in the background.

## Accessibility & Inclusion

Dark theme by nature; AA text contrast, colours readable by colour-blind users (never code the verdict by colour alone), keyboard navigation, respect for `prefers-reduced-motion`.

## Selection criteria (sources)

- NASA, "50 Years Ago: Lunar Landing Sites Selected" (Apollo, 1968): smoothness, approach paths, propellant, free return, lighting (Sun 7–20° behind the lander), slope under 2°.
- NASA Moon to Mars Architecture, "Lunar Site Selection" white paper (2023): a first landing site should be sunlit about 6–6.5 days; no known south polar location is continuously sunlit; mast height increases sunlight; Earth must be visible for direct-to-Earth communication; a human lander stays viable about 90 days in near-rectilinear halo orbit.
- The mockup uses a simplified analytic model (real synodic, anomalistic and draconic periods). Real SPICE ephemerides and LOLA horizon masks must replace it.
