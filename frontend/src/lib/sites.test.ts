import { expect, test } from 'vitest'
import { getSeries, metrics, SITES, verdict } from './sites'

test('13 sites with unit position vectors, all but Apollo 11 near the south pole', () => {
  expect(SITES).toHaveLength(13)
  for (const s of SITES) {
    expect(Math.hypot(...s.q)).toBeCloseTo(1, 10)
    if (s.terrain) expect(s.q[1]).toBeLessThan(-0.99)
  }
})

test('a taller mast never reduces visibility', () => {
  const low = getSeries(0)
  const high = getSeries(10)
  SITES.forEach((s) => {
    const a = metrics(low[s.i], 0, 30)
    const b = metrics(high[s.i], 0, 30)
    expect(b.E).toBeGreaterThanOrEqual(a.E)
    expect(b.D).toBeGreaterThanOrEqual(a.D)
  })
})

test('verdict follows the lower of Sun and Earth shares', () => {
  expect(verdict(100, 75).word).toBe('Viable')
  expect(verdict(100, 74).word).toBe('Marginal')
  expect(verdict(44, 100).word).toBe('Not viable')
})
