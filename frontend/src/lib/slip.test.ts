import { expect, test } from 'vitest'
import { calendar, evaluate, longestRun, nextWorking, rankSites } from './slip'
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
  const ranked = rankSites(series, 12, { ...needs, minE: 40, minD: 20, maxDark: 200 })
  const firstFail = ranked.findIndex((o) => !o.pass)
  if (firstFail >= 0) expect(ranked.slice(firstFail).every((o) => !o.pass)).toBe(true)
  const cal = calendar(series[0], 0, { ...needs, minE: 30, minD: 10, maxDark: 300 })
  const hit = nextWorking(cal, 10)
  if (hit) expect(hit.t0).toBeGreaterThanOrEqual(10)
})
