import { Html, Stars, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, MathUtils, PerspectiveCamera, Vector3, type DirectionalLight, type Group } from 'three'
import { earthVec, sunVec, TAU } from '../../lib/ephemeris'
import { useScenario } from '../../store/scenario'
import { EARTH_R, MODEL_URLS, MOON_R, normalise } from './models'

export type View = 'moon' | 'pole'

const D2R = Math.PI / 180
const SUN_DIST = 90
const SUN_R = 5

/** A normalised clone of a GLB scene, sized to `radius`. */
function Body({ url, radius, spin }: { url: string; radius: number; spin?: number }) {
  const { scene } = useGLTF(url)
  const holder = useRef<Group>(null)
  const clone = useMemo(() => scene.clone(true), [scene])
  useLayoutEffect(() => {
    normalise(clone, radius)
  }, [clone, radius])
  useFrame((_, dt) => {
    if (spin && holder.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) holder.current.rotation.y += dt * spin
  })
  return (
    <group ref={holder}>
      <primitive object={clone} />
    </group>
  )
}

// Camera spots, expressed as latitude / longitude of the camera in the Moon-fixed frame.
const VIEWS = {
  moon: { lat: -38, lon: 112, dist: 7 },
  pole: { lat: -62, lon: 112, dist: 3.6 },
}
const toVec = (lat: number, lon: number, r: number) =>
  new Vector3(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R)).multiplyScalar(r)

function Rig({ view }: { view: View }) {
  const { camera, size } = useThree()
  const goal = useRef({ lat: VIEWS.moon.lat, lon: VIEWS.moon.lon, dist: VIEWS.moon.dist })
  useFrame((_, dt) => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const to = VIEWS[view]
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2)
    const g = goal.current
    g.lat = MathUtils.lerp(g.lat, to.lat, k)
    g.lon = MathUtils.lerp(g.lon, to.lon, k)
    const fit = size.width < size.height ? 0.75 / (size.width / size.height) : 1 // keep the Moon inside a portrait screen
    g.dist = MathUtils.lerp(g.dist, to.dist * fit, k)
    camera.position.copy(toVec(g.lat, g.lon, g.dist))
    camera.up.set(0, 1, 0)
    // Aim at the south pole as the camera comes in, so it sits mid-frame instead of at the bottom.
    const zoom = MathUtils.clamp((VIEWS.moon.dist * fit - g.dist) / ((VIEWS.moon.dist - VIEWS.pole.dist) * fit), 0, 1)
    camera.lookAt(0, -0.8 * zoom, 0)
    // Push the Moon right of the headline on wide screens, and below it on narrow ones.
    const cam = camera as PerspectiveCamera
    const wide = size.width >= 1024
    cam.setViewOffset(size.width, size.height, wide ? -size.width * 0.15 : 0, wide ? 0 : size.height * 0.04, size.width, size.height)
  })
  return null
}

/**
 * Earth and Sun, placed behind the Moon.
 * Sizes keep the real Moon : Earth : Sun relationships; distances are compressed so the three fit on one screen.
 * Earth sits on the screen side where it really is (toward the sub-Earth point), well behind the Moon, so it
 * reads as the bigger planet in the background instead of a satellite of the Moon.
 */
function Sky({ view }: { view: View }) {
  const { camera, size } = useThree()
  const sunRef = useRef<Group>(null)
  const earthRef = useRef<Group>(null)
  const light = useRef<DirectionalLight>(null)
  // Start at the right place: a frame at the origin would put the Sun around the Moon.
  const sunStart = useMemo(() => new Vector3(...sunVec(useScenario.getState().day)).multiplyScalar(SUN_DIST), [])
  const f = useMemo(() => new Vector3(), [])
  const r = useMemo(() => new Vector3(), [])
  const u = useMemo(() => new Vector3(), [])
  const e = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const t = useScenario.getState().day
    const s = sunVec(t)
    sunRef.current?.position.set(s[0] * SUN_DIST, s[1] * SUN_DIST, s[2] * SUN_DIST)
    light.current?.position.set(s[0] * 10, s[1] * 10, s[2] * 10)

    camera.getWorldDirection(f)
    r.crossVectors(f, camera.up).normalize()
    u.crossVectors(r, f).normalize()
    const ev = earthVec(t)
    e.set(ev[0], ev[1], ev[2])
    // Screen direction of the sub-Earth point, mapped to a fixed composition slot behind the Moon.
    const ex = MathUtils.clamp(e.dot(r), -1, 1)
    const ey = e.dot(u)
    const portrait = size.width < size.height
    const dE = portrait ? 24 * (0.75 / (size.width / size.height)) : 24
    const ax = (portrait ? 0.1 : 0.21) * Math.sign(ex || 1)
    const ay = (portrait ? 0.17 : 0.19) + ey * 0.5
    earthRef.current?.position.copy(camera.position).addScaledVector(f, dE).addScaledVector(r, dE * Math.tan(ax)).addScaledVector(u, dE * Math.tan(ay))
    if (earthRef.current) earthRef.current.rotation.y = (TAU * t) / 0.99727
  })

  return (
    <>
      <directionalLight ref={light} intensity={3.4} color="#fff4e2" />
      <ambientLight intensity={0.14} color="#8fb0ff" />
      <group ref={sunRef} position={sunStart}>
        <mesh>
          <sphereGeometry args={[SUN_R, 48, 48]} />
          <meshBasicMaterial color="#fff1d6" toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[SUN_R * 2.4, 32, 32]} />
          <meshBasicMaterial color="#ffb84a" transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <group ref={earthRef}>
        <Body url={MODEL_URLS.earth} radius={EARTH_R} />
        <mesh scale={1.035}>
          <sphereGeometry args={[EARTH_R, 64, 64]} />
          <meshBasicMaterial color="#5f9bff" transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        {view === 'moon' && (
        <Html position={[-EARTH_R * 0.35, -EARTH_R - 0.9, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="scene-tag">
            <b className="text-earth">Earth</b>
            <span>3.7x wider than the Moon, distance not to scale</span>
          </div>
        </Html>
        )}
      </group>
    </>
  )
}

export default function MoonScene({ view }: { view: View }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 28, near: 0.1, far: 400, position: [0, 0, 4.4] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="The Moon seen from the south, lit by the Sun, with the larger Earth far behind it"
    >
      <color attach="background" args={['#050608']} />
      <Stars radius={150} depth={40} count={2200} factor={3} saturation={0} fade speed={0} />
      <Rig view={view} />
      <Body url={MODEL_URLS.moon} radius={MOON_R} />
      <Sky view={view} />
    </Canvas>
  )
}

Object.values(MODEL_URLS).forEach((u) => useGLTF.preload(u))
