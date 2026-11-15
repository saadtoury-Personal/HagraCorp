import { expect, test } from 'vitest'
import { ageDays, earthVec, phaseName, subSolarLonE, sunVec } from './ephemeris'

test('sun and earth directions are unit vectors for any day', () => {
  for (const t of [0, 17, 45.5, 90]) {
    for (const v of [sunVec(t), earthVec(t)]) expect(Math.hypot(...v)).toBeCloseTo(1, 10)
  }
})

test('lunar age wraps and sub-solar longitude stays in range', () => {
  for (const t of [0, 10, 29.5, 60, 90]) {
    expect(ageDays(t)).toBeGreaterThanOrEqual(0)
    expect(ageDays(t)).toBeLessThan(29.53)
    expect(Math.abs(subSolarLonE(t))).toBeLessThanOrEqual(180)
  }
  expect(phaseName(14.8)).toBe('Full Moon')
})
