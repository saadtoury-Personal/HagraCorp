import { Html, Stars, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PerspectiveCamera, Vector3, type DirectionalLight } from 'three'
import { sunVec } from '../../lib/ephemeris'
import { toneClass } from '../../lib/format'
import { getSeries, metrics, SITES, verdict } from '../../lib/sites'
import { useScenario } from '../../store/scenario'
import { MODEL_URLS, MOON_R, normalise } from './models'

/** 0 = whole Moon, 1 = south pole, 2 = one candidate region. */
export type Level = 0 | 1 | 2

const D2R = Math.PI / 180
const toVec = (lat: number, lon: number, r: number) =>
  new Vector3(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R)).multiplyScalar(r)
const SIDE = toVec(0, 112, 1) // horizontal direction the camera looks from
const NEG_SIDE = SIDE.clone().negate()
const Y = new Vector3(0, 1, 0)

function Moon() {
  const { scene } = useGLTF(MODEL_URLS.moon)
  const clone = useMemo(() => scene.clone(true), [scene])
  useLayoutEffect(() => {
    normalise(clone, MOON_R)
  }, [clone])
  return <primitive object={clone} />
}

function Rig({ level }: { level: Level }) {
  const { camera, size } = useThree()
  const pos = useRef(toVec(-38, 112, 7))
  const look = useRef(new Vector3())
  const goal = useRef({ pos: new Vector3(), look: new Vector3(), up: new Vector3(0, 1, 0) })
  useFrame((_, dt) => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const { pos: goalPos, look: goalLook, up } = goal.current
    const fit = size.width < size.height ? 0.75 / (size.width / size.height) : 1 // keep the Moon inside a portrait screen
    if (level === 0) {
      goalPos.copy(toVec(-38, 112, 7 * fit))
      goalLook.set(0, 0, 0)
    } else if (level === 1) {
      goalPos.copy(toVec(-72, 112, 2.2 * fit))
      goalLook.set(0, -0.95, 0)
    } else {
      const q = SITES[useScenario.getState().site].q
      goalLook.set(q[0], q[1], q[2])
      // Above the site, tilted a little toward the camera side, looking down at it.
      goalPos.copy(goalLook).multiplyScalar(1.7).addScaledVector(SIDE, 0.55 * Math.max(1, fit * 0.7))
    }
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2)
    pos.current.lerp(goalPos, k)
    look.current.lerp(goalLook, k)
    camera.position.copy(pos.current)
    // Looking straight up the axis from below the pole, +y is degenerate, so tilt the up vector.
    up.lerp(level === 2 ? NEG_SIDE : Y, k).normalize()
    camera.up.copy(up)
    camera.lookAt(look.current)
    // Push the Moon right of the headline on wide screens, and a little low on narrow ones.
    const wide = size.width >= 1024
    ;(camera as PerspectiveCamera).setViewOffset(size.width, size.height, wide && level === 0 ? -size.width * 0.15 : 0, wide ? 0 : size.height * 0.04, size.width, size.height)
  })
  return null
}

/** The Sun is only a light here: its direction follows the shared clock. */
function SunLight() {
  const light = useRef<DirectionalLight>(null)
  useFrame(() => {
    const s = sunVec(useScenario.getState().day)
    light.current?.position.set(s[0] * 10, s[1] * 10, s[2] * 10)
  })
  return (
    <>
      <directionalLight ref={light} intensity={3.4} color="#fff4e2" />
      <ambientLight intensity={0.14} color="#8fb0ff" />
    </>
  )
}

// Html renders in its own React root, so no router context here: navigation goes through onOpen.
function Marker({ i, level, onSelect, onOpen }: { i: number; level: Level; onSelect: (i: number) => void; onOpen: (i: number) => void }) {
  const s = SITES[i]
  const { camera } = useThree()
  const wrap = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  const selected = useScenario((st) => st.site === i)
  const day = useScenario((st) => st.day)
  const dur = useScenario((st) => st.dur)
  const mast = useScenario((st) => st.mast)
  const q = useMemo(() => new Vector3(...s.q).multiplyScalar(1.003), [s])
  const tmp = useMemo(() => new Vector3(), [])

  // Hide markers on the far side of the Moon and when zoomed all the way out.
  useFrame(() => {
    const el = wrap.current
    if (!el) return
    tmp.copy(camera.position).sub(q)
    el.style.display = level > 0 && q.dot(tmp) > 0.02 ? '' : 'none'
  })

  const m = metrics(getSeries(mast)[i], day, dur)
  const v = verdict(m.E, m.D)
  const open = hover || (selected && level === 2)
  return (
    <Html position={q} center zIndexRange={[20, 0]}>
      <div ref={wrap} className="relative">
        <button
          type="button"
          aria-label={`${s.name}, region ${i + 1} of 13`}
          aria-pressed={selected}
          onClick={() => onSelect(i)}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          className="group relative grid size-8 place-items-center"
        >
          <span className={`block size-3 rounded-full border-2 border-ink bg-bg/50 shadow-[0_0_0_1px_rgb(0_0_0/0.6)] transition-transform duration-200 ${selected ? 'scale-150 bg-ink' : 'group-hover:scale-150 group-hover:bg-ink'}`} />
        </button>
        {open && (
          <div className="absolute left-9 top-1/2 z-10 w-64 -translate-y-1/2 border border-line bg-bg p-4 text-left" role="group" aria-label={`${s.name} summary`}>
            <h3 className="mb-3 text-lg font-normal leading-tight">{s.name}</h3>
            <dl className="mb-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-dim">Sunlight, {dur} d</dt>
              <dd className="text-right font-medium">{m.E}%</dd>
              <dt className="text-dim">Earth link</dt>
              <dd className="text-right font-medium">{m.D}%</dd>
              <dt className="text-dim">Assessment</dt>
              <dd className={`text-right font-medium ${toneClass[v.tone]}`}>{v.word}</dd>
            </dl>
            <button type="button" onClick={() => onOpen(i)} className="btn min-h-9 px-4">
              Open site
            </button>
          </div>
        )}
      </div>
    </Html>
  )
}

export default function MoonScene({ level, onSelect, onOpen }: { level: Level; onSelect: (i: number) => void; onOpen: (i: number) => void }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 28, near: 0.05, far: 400, position: [0, 0, 7] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="The Moon seen from the south with the 13 candidate regions near the pole"
    >
      <color attach="background" args={['#050608']} />
      <Stars radius={150} depth={40} count={2200} factor={3} saturation={0} fade speed={0} />
      <Rig level={level} />
      <SunLight />
      <Moon />
      {SITES.map((s) => (
        <Marker key={s.i} i={s.i} level={level} onSelect={onSelect} onOpen={onOpen} />
      ))}
    </Canvas>
  )
}

useGLTF.preload(MODEL_URLS.moon)
