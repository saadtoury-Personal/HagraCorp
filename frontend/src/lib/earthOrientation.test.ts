import { expect, test } from 'vitest'
import bodies from '../data/bodies.json'
import { earthFrame, julianDay, sunEcliptic } from './earthOrientation'
import { sunVec } from './ephemeris'

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

test('on 14 Nov 2026 18:40 UTC the Sun is over the Pacific near Mexico, at declination about -18.5 degrees', () => {
  // Textbook values: solar declination -18.5 degrees; sub-solar longitude -(18.67 - 12) * 15 - equation of time (15.6 min = 3.9 deg) = about -104 degrees.
  const f = earthFrame(0)
  expect(f.subSolarLatDeg).toBeGreaterThan(-18.9)
  expect(f.subSolarLatDeg).toBeLessThan(-18.1)
  expect(f.subSolarLonDeg).toBeGreaterThan(-106)
  expect(f.subSolarLonDeg).toBeLessThan(-102)
})

test("Earth's axis is tilted by the workbook's obliquity from the ecliptic and points the right way for the season", () => {
  const f = earthFrame(0)
  expect(Math.hypot(...f.axis)).toBeCloseTo(1, 10)
  // The angle between the axis and the Sun direction follows the solar declination: sin(dec) = axis . Sun.
  const sinDec = dot(f.axis, sunVec(0))
  expect(sinDec).toBeCloseTo(Math.sin((sunEcliptic(julianDay(0)).decDeg * Math.PI) / 180), 6)
  expect(bodies.earth.obliquityDeg).toBeCloseTo(23.44, 2)
})

test('the prime meridian is perpendicular to the axis', () => {
  const f = earthFrame(37)
  expect(Math.abs(dot(f.axis, f.prime))).toBeLessThan(1e-9)
})

test('Earth turns once per sidereal day: 24 h later the sub-solar longitude moved by almost a full turn', () => {
  const a = earthFrame(10).subSolarLonDeg
  const b = earthFrame(11).subSolarLonDeg
  // The Sun drifts east by about 1 degree per day relative to the stars, so the point under it shifts by about 1 degree.
  const shift = Math.abs(((b - a + 540) % 360) - 180)
  expect(shift).toBeLessThan(2)
})
