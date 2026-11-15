import { expect, test } from 'vitest'
import { calendar, evaluate, hoursToFirstSunset, longestRun, nextWorking, rankSites, tolerance } from './slip'
import { getSeries, N, SITES, STEP } from './sites'

const needs = { dur: 6.5, minE: 90, minD: 50, maxDark: 60 }

test('longestRun measures the longest stretch in hours', () => {
  const a = new Uint8Array(N).fill(1)
  const day = Math.round(1 / STEP)
  a.fill(0, 2 * day, 3 * day) // one dark day
  a.fill(0, 4 * day, 4 * day + 4) // then a short one
  expect(longestRun(a, 0, 6, 0)).toBeCloseTo(24, 5)
  expect(longestRun(a, 0, 1.5, 0)).toBe(0)
})

test('a failing outcome says why, a passing one does not', () => {
  const series = getSeries(3)
  const outcomes = SITES.map((s) => evaluate(series[s.i], s.i, 5, needs))
  for (const o of outcomes) expect(o.pass).toBe(o.why.length === 0)
  const lenient = SITES.map((s) => evaluate(series[s.i], s.i, 5, { dur: 2, minE: 0, minD: 0, maxDark: 10000 }))
  expect(lenient.every((o) => o.pass)).toBe(true)
})

test('ranking puts passing sites first and nextWorking never looks back', () => {
  const series = getSeries(3)
  const ranked = rankSites(series, 12, { ...needs, minE: 40, minD: 20, maxDark: 200 }).filter((o) => o.terrain)
  const firstFail = ranked.findIndex((o) => !o.pass)
  if (firstFail >= 0) expect(ranked.slice(firstFail).every((o) => !o.pass)).toBe(true)
  const cal = calendar(series[0], 0, { ...needs, minE: 30, minD: 10, maxDark: 300 })
  const hit = nextWorking(cal, 10)
  if (hit) expect(hit.t0).toBeGreaterThanOrEqual(10)
})

test('sites without a relief map are ranked after every site with real terrain', () => {
  const ranked = rankSites(getSeries(3), 20, needs)
  const firstFlat = ranked.findIndex((o) => !o.terrain)
  expect(firstFlat).toBeGreaterThanOrEqual(0)
  expect(ranked.slice(firstFlat).every((o) => !o.terrain)).toBe(true)
})

test('tolerance counts the consecutive working days around a date', () => {
  const mk = (pass: boolean[]) => pass.map((p, t0) => ({ site: 0, t0, E: 0, D: 0, dark: 0, pass: p, why: [] }))
  const cal = mk([false, true, true, true, false, true])
  expect(tolerance(cal, 2)).toBe(3)
  expect(tolerance(cal, 0)).toBe(0)
  expect(tolerance(cal, 5)).toBe(1)
})

test('without the Earth requirement a low Earth share no longer fails the mission', () => {
  const series = getSeries(3)
  const strict = { dur: 4, minE: 0, minD: 100, maxDark: 10000 }
  const o = evaluate(series[0], 0, 3, strict)
  if (o.D < 100) expect(o.pass).toBe(false)
  expect(evaluate(series[0], 0, 3, { ...strict, requireEarth: false }).pass).toBe(true)
  const h = hoursToFirstSunset(series[0], 3)
  if (h !== null) expect(h).toBeGreaterThanOrEqual(0)
})
