import { Group, Mesh, Sprite, DirectionalLight, AmbientLight } from 'three'
import { expect, test } from 'vitest'
import { toVec } from '../../lib/ephemeris'
import { bodyAt, census, glowAlpha, HALO_R, MAG, sphereGeometry } from './models'

test('Moon texture is not mirrored: north at v = 0, Tycho where the map has it', () => {
  const g = sphereGeometry(64, 32)
  const p = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  const t = toVec(-43.3, -11.4) // Tycho, 43.3 S 11.4 W
  let best = -1
  let bi = 0
  for (let i = 0; i < p.count; i++) {
    const d = p.getX(i) * t[0] + p.getY(i) * t[1] + p.getZ(i) * t[2]
    if (d > best) [best, bi] = [d, i]
  }
  expect(uv.getY(bi)).toBeCloseTo(0.5 + 43.3 / 180, 1)
  expect(uv.getX(bi)).toBeCloseTo(0.5 - 11.4 / 360, 1)
  expect(uv.getY(0)).toBe(0) // first ring is the north pole
  expect(p.getY(0)).toBeCloseTo(1)
})

test('Sun always farther than Earth, both at MAG times their true apparent size, Earth about 3.5 times the Sun', () => {
  for (let t = 0; t <= 90; t += 0.5) {
    const e = bodyAt('earth', t)
    const s = bodyAt('sun', t)
    expect(s.dist).toBeGreaterThan(e.dist)
    const eAng = Math.atan(e.radius / e.dist) / MAG
    const sAng = Math.atan(s.radius / s.dist) / MAG
    expect((eAng * 180) / Math.PI).toBeGreaterThan(0.85)
    expect((eAng * 180) / Math.PI).toBeLessThan(1.05)
    expect((sAng * 180) / Math.PI).toBeGreaterThan(0.26)
    expect((sAng * 180) / Math.PI).toBeLessThan(0.275)
    expect(e.radius / e.dist / (s.radius / s.dist)).toBeGreaterThan(3)
  }
})

test('Sun halo fades outward from the limb only', () => {
  expect(glowAlpha(1)).toBe(0.5)
  expect(glowAlpha(HALO_R)).toBe(0)
  for (let r = 1; r < HALO_R; r += 0.1) expect(glowAlpha(r + 0.1)).toBeLessThanOrEqual(glowAlpha(r))
})

test('census catches a body drawn twice', () => {
  const root = new Group()
  const sun = Object.assign(new Group(), { name: 'sun' })
  sun.add(new Mesh(), new Sprite())
  root.add(sun, Object.assign(new Mesh(), { name: 'moon' }), new DirectionalLight(), new AmbientLight())
  const ok = census(root)
  expect(ok.bodies.sun).toEqual({ meshes: 1, sprites: 1 })
  expect(ok.bodies.moon.meshes).toBe(1)
  expect(ok.lights).toEqual({ DirectionalLight: 1, AmbientLight: 1 })
  sun.add(new Sprite())
  expect(census(root).bodies.sun.sprites).toBe(2)
})

test('each team model holds a single mesh and no lights', async () => {
  const { readFileSync } = await import('node:fs' as string) // no @types/node in this project
  for (const f of ['Earth', 'Sun', 'Moon_LRO_clean']) {
    const buf = readFileSync(new URL(`../../../public/models/${f}.glb`, import.meta.url))
    const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'))
    expect(json.meshes).toHaveLength(1)
    expect(json.meshes[0].primitives).toHaveLength(1)
    expect(json.nodes.filter((n: { mesh?: number }) => n.mesh !== undefined)).toHaveLength(1)
    expect(json.extensions?.KHR_lights_punctual).toBeUndefined()
  }
})
