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
