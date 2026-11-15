// Where Earth's axis points and which way its prime meridian faces, in the Moon-fixed frame, at a given time.
// Frame: x = sub-Earth point, y = lunar north, z = west (see ephemeris.ts). Only the real Sun direction from the Horizons table
// and standard low-precision solar formulas (Meeus, Astronomical Algorithms ch. 25, about 0.01 degree) are used.
import bodies from '../data/bodies.json'
import { EPOCH, sunVec, type Vec3 } from './ephemeris'

const D2R = Math.PI / 180
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const norm360 = (d: number) => ((d % 360) + 360) % 360
const norm180 = (d: number) => norm360(d + 180) - 180

export const julianDay = (day: number) => (EPOCH + day * 86400000) / 86400000 + 2440587.5

/** Sun's ecliptic longitude, right ascension and declination in degrees. */
export function sunEcliptic(jd: number) {
  const n = jd - 2451545
  const eps = bodies.earth.obliquityDeg * D2R
  const g = (357.528 + 0.9856003 * n) * D2R
  const lam = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R
  return {
    lonDeg: norm360(lam / D2R),
    raDeg: norm360(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / D2R),
    decDeg: Math.asin(Math.sin(eps) * Math.sin(lam)) / D2R,
  }
}

/** Greenwich mean sidereal time, degrees: how far Earth has turned relative to the stars. */
export const gmstDeg = (jd: number) => norm360(280.46061837 + 360.98564736629 * (jd - 2451545))

const rotate = (v: Vec3, k: Vec3, theta: number): Vec3 => {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const kv = cross(k, v)
  const kd = dot(k, v) * (1 - c)
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd]
}

/**
 * The Sun's north pole direction in the Moon frame. It leans by the workbook's obliquity (7.25 degrees to the ecliptic) toward
 * ecliptic longitude 345.76 degrees, the standard orientation of the solar axis (ascending node 75.76 degrees minus 90).
 */
const SUN_POLE_LON_DEG = 75.76 - 90
export function sunAxis(day: number): Vec3 {
  const lam = sunEcliptic(julianDay(day)).lonDeg * D2R
  const S = sunVec(day)
  const k = dot([0, 1, 0], S)
  const zE = norm([-k * S[0], 1 - k * S[1], -k * S[2]])
  const yE = cross(zE, S)
  // Ecliptic directions at longitude 0 and 90 degrees, rebuilt from the Sun's own direction S = cos(lam) X + sin(lam) Y.
  const X: Vec3 = [Math.cos(lam) * S[0] - Math.sin(lam) * yE[0], Math.cos(lam) * S[1] - Math.sin(lam) * yE[1], Math.cos(lam) * S[2] - Math.sin(lam) * yE[2]]
  const Y: Vec3 = [Math.sin(lam) * S[0] + Math.cos(lam) * yE[0], Math.sin(lam) * S[1] + Math.cos(lam) * yE[1], Math.sin(lam) * S[2] + Math.cos(lam) * yE[2]]
  const eps = bodies.sun.obliquityDeg * D2R
  const L = SUN_POLE_LON_DEG * D2R
  const lean: Vec3 = [Math.cos(L) * X[0] + Math.sin(L) * Y[0], Math.cos(L) * X[1] + Math.sin(L) * Y[1], Math.cos(L) * X[2] + Math.sin(L) * Y[2]]
  return norm([
    Math.sin(eps) * lean[0] + Math.cos(eps) * zE[0],
    Math.sin(eps) * lean[1] + Math.cos(eps) * zE[1],
    Math.sin(eps) * lean[2] + Math.cos(eps) * zE[2],
  ])
}

/**
 * Earth's north pole direction and prime meridian direction in the Moon frame.
 * The pole leans by the obliquity (23.44 degrees, workbook) toward ecliptic longitude 90 degrees; the Sun's ecliptic longitude
 * says where that is for the date. The prime meridian is then turned so that the point under the Sun sits at the real
 * sub-solar longitude (right ascension of the Sun minus sidereal time).
 */
export function earthFrame(day: number) {
  const jd = julianDay(day)
  const sun = sunEcliptic(jd)
  const eps = bodies.earth.obliquityDeg * D2R
  const lam = sun.lonDeg * D2R
  const S = sunVec(day) // Moon to Sun, parallel to Earth to Sun
  // The Sun lies in the ecliptic, so ecliptic north is the Moon's north with the Sun's component removed.
  const y: Vec3 = [0, 1, 0]
  const k = dot(y, S)
  const zE = norm([y[0] - k * S[0], y[1] - k * S[1], y[2] - k * S[2]])
  const yE = cross(zE, S)
  const a = norm([
    Math.sin(eps) * Math.sin(lam) * S[0] + Math.sin(eps) * Math.cos(lam) * yE[0] + Math.cos(eps) * zE[0],
    Math.sin(eps) * Math.sin(lam) * S[1] + Math.sin(eps) * Math.cos(lam) * yE[1] + Math.cos(eps) * zE[1],
    Math.sin(eps) * Math.sin(lam) * S[2] + Math.sin(eps) * Math.cos(lam) * yE[2] + Math.cos(eps) * zE[2],
  ])
  const subSolarLonDeg = norm180(sun.raDeg - gmstDeg(jd))
  const d = dot(S, a)
  const sPerp = norm([S[0] - d * a[0], S[1] - d * a[1], S[2] - d * a[2]])
  const prime = rotate(sPerp, a, -subSolarLonDeg * D2R)
  return { axis: a, prime, subSolarLonDeg, subSolarLatDeg: sun.decDeg }
}
