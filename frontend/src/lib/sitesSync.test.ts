import { expect, test } from 'vitest'
import bundled from '../data/sites.json'
import backendRaw from '../../../LunarNav/LunarNav.Web/wwwroot/data/sites.json?raw'

// The backend owns the site list. The copy bundled with the frontend must keep the very same ids and coordinates.
test('bundled sites have the same ids and coordinates as the backend list (LunarNav.Web/wwwroot/data/sites.json)', () => {
  const backend = JSON.parse(backendRaw) as { id: string; latDeg: number; lonDeg: number }[]
  expect(bundled.map((s) => s.id)).toEqual(backend.map((s) => s.id))
  for (const b of backend) {
    const f = bundled.find((s) => s.id === b.id)!
    expect(f.latDeg).toBeCloseTo(b.latDeg, 6)
    expect(f.lonDeg).toBeCloseTo(b.lonDeg, 6)
  }
})

// Same rule for the position-uncertainty files the Site page falls back to when the server is offline.
test('bundled uncertainty files are identical to the backend precompute', async () => {
  for (const m of [2, 10]) {
    const bundledU = (await import(`../data/uncertainty_${m}m.json`)).default
    const backendU = (await import(`../../../LunarNav/LunarNav.Web/wwwroot/data/uncertainty_${m}m.json?raw`)).default as string
    expect(bundledU).toEqual(JSON.parse(backendU))
  }
})
