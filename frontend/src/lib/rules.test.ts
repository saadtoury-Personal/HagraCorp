import { expect, test } from 'vitest'
import { earthRadiusDeg, earthUpAt, sunUpAt } from './sites'

// These must stay the same as the server's rules (LunarNav.Core/Analysis.cs and Geometry.cs).
test('the Sun is up as soon as its upper edge clears the horizon (server default SunRule.Edge)', () => {
  expect(sunUpAt(0.01, 0)).toBe(true)
  expect(sunUpAt(-0.2, 0)).toBe(true) // centre below, upper edge (0.27 deg above the centre) still above
  expect(sunUpAt(-0.3, 0)).toBe(false)
})

test('Earth is in view when any part of its disk clears the horizon, and its radius is about 0.95 degrees', () => {
  expect(earthRadiusDeg(221)).toBeGreaterThan(0.9)
  expect(earthRadiusDeg(221)).toBeLessThan(1.0)
  expect(earthUpAt(-0.5, 0, 221)).toBe(true)
  expect(earthUpAt(-1.5, 0, 221)).toBe(false)
})
