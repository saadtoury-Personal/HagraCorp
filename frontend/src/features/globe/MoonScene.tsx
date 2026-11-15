import { Html, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, PerspectiveCamera, Vector2, Vector3, type DirectionalLight, type Material } from 'three'
import { earthVec, sunVec } from '../../lib/ephemeris'
import { coords, toneClass } from '../../lib/format'
import SourceTag from '../../components/SourceTag'
import { SITES, verdict } from '../../lib/sites'
import { useSiteMetrics } from '../../lib/useSiteMetrics'
import { useScenario } from '../../store/scenario'
import { MODEL_URLS } from './models'

/** 0 = whole Moon, 1 = south pole, 2 = one candidate region. */
export type Level = 0 | 1 | 2

const D2R = Math.PI / 180
const toVec = (lat: number, lon: number, r: number) =>
  new Vector3(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R)).multiplyScalar(r)
const Y = new Vector3(0, 1, 0)
const LON0 = 112 // longitude the camera looks from before the user rotates the Moon
const ZOOM_MIN = 0.6
const ZOOM_MAX = 1.8

/**
 * The Sun and Earth go round the Moon in their real directions (Horizons table, Moon-fixed frame), on two invisible circles around it.
 * Distances are for display only: at true scale both would be far off screen. The label badges are plain DOM that follow the
 * projected 3D positions; the Moon hides a badge while its body is behind it, and the Sun's light (SunLight) comes from the same direction.
 */
export type Body = 'earth' | 'sun'
type BadgeRefs = Record<Body, { box: HTMLDivElement | null }>

/** Display radii of the two orbits, in Moon radii. */
const ORBIT_R: Record<Body, number> = { sun: 1.95, earth: 1.5 }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Plain DOM write, outside React: this runs every frame. */
function paint(box: HTMLElement, x: number, y: number, opacity: number) {
  box.style.visibility = opacity < 0.02 ? 'hidden' : 'visible'
  box.style.opacity = String(opacity)
  box.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
}

/** Moves the Earth and Sun badges to where those bodies are on their rings, and fades them out while the Moon is in front of them. */
function SkyBadges({ refs }: { refs: RefObject<BadgeRefs> }) {
  const { camera, size } = useThree()
  const pos = useMemo(() => new Vector3(), [])
  const ray = useMemo(() => new Vector3(), [])
  const hit = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const t = useScenario.getState().day
    camera.updateMatrixWorld()
    const cam = camera.position
    const dirs: Record<Body, [number, number, number]> = { earth: earthVec(t), sun: sunVec(t) }
    for (const key of ['earth', 'sun'] as Body[]) {
      const box = refs.current[key].box
      if (!box) continue
      const d = dirs[key]
      pos.set(d[0], d[1], d[2]).multiplyScalar(ORBIT_R[key])
      // Moon in front of it: the line from the camera to the body passes through the Moon (radius 1) before reaching the body.
      ray.copy(pos).sub(cam)
      const len = ray.length()
      ray.divideScalar(len)
      const along = -cam.dot(ray)
      const closest = along > 0 && along < len ? hit.copy(cam).addScaledVector(ray, along).length() : 99
      const behindMoon = clamp01((closest - 1) / 0.25) // fades out as it slips behind the limb
      pos.project(camera)
      const inView = pos.z < 1 ? clamp01((1 - Math.max(Math.abs(pos.x), Math.abs(pos.y))) / 0.1) : 0
      paint(box, (pos.x * 0.5 + 0.5) * size.width, (-pos.y * 0.5 + 0.5) * size.height, behindMoon * inView)
    }
  })
  return null
}

/**
 * Sky from Nazim's mockup: a screen-space hash starfield (same grid and thresholds), drawn behind everything.
 * It ignores the camera, so the stars stay still while the Moon turns.
 */
const SKY_VS = 'void main(){gl_Position=vec4(position.xy,1.,1.);}'
const SKY_FS = `
uniform vec2 uRes;
float h21(vec2 p){p=fract(p*vec2(.3183099,.3678794)+.1);p*=17.;return fract(p.x*p.y*(p.x+p.y));}
vec3 stars(vec2 uv){vec2 g=floor(uv*vec2(1100.,620.));float r=h21(g);float s=step(.9986,r);
 float b=h21(g+7.3);return vec3(.78,.82,.95)*s*(.18+.6*b*b);}
void main(){gl_FragColor=vec4(vec3(.0196,.0235,.0314)+stars(gl_FragCoord.xy/uRes),1.);}`
function Sky() {
  const { size, viewport } = useThree()
  const uniforms = useMemo(() => ({ uRes: { value: new Vector2() } }), [])
  useFrame(() => uniforms.uRes.value.set(size.width * viewport.dpr, size.height * viewport.dpr))
  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={SKY_VS} fragmentShader={SKY_FS} uniforms={uniforms} depthTest={false} depthWrite={false} side={DoubleSide} />
    </mesh>
  )
}

/** User view: yaw spins the camera around the polar axis (degrees), so the south pole stays put. */
type View = { yaw: number; zoom: number }

/**
 * The GLB mesh is only 64 segments wide, which smears the texture into a fan at the pole.
 * Same mapping (u = 0.5 - lon / 2pi, v = 0.5 - lat / pi), but with enough segments to stay smooth.
 */
function sphereGeometry(seg = 256, rings = 128) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= rings; j++) {
    const lat = Math.PI / 2 - (Math.PI * j) / rings
    for (let i = 0; i <= seg; i++) {
      const lon = Math.PI - (2 * Math.PI * i) / seg
      pos.push(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
      uv.push(i / seg, 1 - j / rings)
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i
      const b = a + seg + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(pos, 3)) // unit sphere: normal = position
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

function Moon() {
  const { scene } = useGLTF(MODEL_URLS.moon)
  const mesh = useMemo(() => {
    let material: Material | Material[] | undefined
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) material = (o as Mesh).material
    })
    const m = Array.isArray(material) ? material[0] : material
    if (m && 'map' in m && m.map) Object.assign(m.map, { anisotropy: 8 })
    return new Mesh(sphereGeometry(), m)
  }, [scene])
  return <primitive object={mesh} />
}

function Rig({ level, view }: { level: Level; view: RefObject<View> }) {
  const { camera, size } = useThree()
  const pos = useRef(toVec(-38, LON0, 7))
  const look = useRef(new Vector3())
  const cur = useRef({ yaw: 0, zoom: 1 })
  const goal = useRef({ pos: new Vector3(), look: new Vector3(), up: new Vector3(0, 1, 0), side: new Vector3(), negSide: new Vector3(), want: new Vector3() })
  useFrame((_, dt) => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const { pos: goalPos, look: goalLook, up, side, negSide, want } = goal.current
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2)
    cur.current.yaw += (view.current.yaw - cur.current.yaw) * k
    cur.current.zoom += (view.current.zoom - cur.current.zoom) * k
    const z = cur.current.zoom
    const lon = LON0 + cur.current.yaw
    side.copy(toVec(0, lon, 1))
    negSide.copy(side).negate()
    const fit = size.width < size.height ? 0.75 / (size.width / size.height) : 1 // keep the Moon inside a portrait screen
    if (level === 0) {
      goalPos.copy(toVec(-38, lon, 7 * fit * z))
      goalLook.set(0, 0, 0)
    } else if (level === 1) {
      goalPos.copy(toVec(-72, lon, 2.2 * fit * z))
      goalLook.set(0, -0.95, 0)
    } else {
      const q = SITES[useScenario.getState().site].q
      goalLook.set(q[0], q[1], q[2])
      // Above the site, tilted a little toward the camera side, looking down at it.
      goalPos.copy(goalLook).multiplyScalar(1.7 * z).addScaledVector(side, 0.55 * Math.max(1, fit * 0.7) * z)
    }
    pos.current.lerp(goalPos, k)
    look.current.lerp(goalLook, k)
    camera.position.copy(pos.current)
    // Looking straight up the axis from below the pole, +y is degenerate, so tilt the up vector.
    want.copy(level === 2 ? negSide : Y)
    up.lerp(want, k).normalize()
    camera.up.copy(up)
    camera.lookAt(look.current)
    // Push the Moon right of the headline on wide screens, and a little low on narrow ones.
    const wide = size.width >= 1024
    ;(camera as PerspectiveCamera).setViewOffset(size.width, size.height, wide && level === 0 ? -size.width * 0.15 : 0, wide ? 0 : size.height * 0.04, size.width, size.height)
  })
  return null
}

/** Drag to spin around the pole, pinch or wheel to zoom, arrow keys and +/- for keyboard users. */
function Controls({ view, level }: { view: RefObject<View>; level: Level }) {
  const el = useThree((s) => s.gl.domElement)
  useEffect(() => {
    Object.assign(view.current, { zoom: 1 }) // each level starts at its own framing
  }, [level, view])
  useEffect(() => {
    const v = view.current
    const pts = new Map<number, { x: number; y: number }>()
    const zoomBy = (f: number) => {
      v.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * f))
    }
    const gap = () => {
      const [a, b] = [...pts.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      if (pts.size === 2) {
        const before = gap()
        p.x = e.clientX
        p.y = e.clientY
        const after = gap()
        if (after > 0) zoomBy(before / after)
      } else {
        v.yaw += (e.clientX - p.x) * 0.4
        p.x = e.clientX
        p.y = e.clientY
      }
    }
    const up = (e: PointerEvent) => void pts.delete(e.pointerId)
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(Math.exp(e.deltaY * 0.0012))
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') v.yaw -= 10
      else if (e.key === 'ArrowRight') v.yaw += 10
      else if (e.key === '+' || e.key === '=') zoomBy(0.85)
      else if (e.key === '-') zoomBy(1.18)
      else return
      e.preventDefault()
    }
    el.style.setProperty('touch-action', 'none')
    el.style.setProperty('cursor', 'grab')
    el.setAttribute('tabindex', '0')
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('keydown', key)
    }
  }, [el, view])
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

  const open = hover || (selected && level === 2)
  // The server is only asked for the card that is open: 32 markers must not each call it.
  const m = useSiteMetrics(i, s.id, day, dur, mast, open)
  const v = verdict(m.E, m.D)
  return (
    <Html position={q} center zIndexRange={[20, 0]}>
      <div ref={wrap} className="relative">
        <button
          type="button"
          aria-label={`${s.name}, region ${i + 1} of ${SITES.length}`}
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
            <h3 className="text-lg font-normal leading-tight">{s.name}</h3>
            <p className="mb-3 mt-1 text-[13px] text-dim">{coords(s.lat, s.lonE)}</p>
            <dl className="mb-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-dim">Sunlight, {dur} d</dt>
              <dd className="text-right font-medium">{m.E}%</dd>
              <dt className="text-dim">Earth link</dt>
              <dd className="text-right font-medium">{m.D}%</dd>
              <dt className="text-dim">Assessment</dt>
              <dd className={`text-right font-medium ${toneClass[v.tone]}`}>{v.word}</dd>
              <dt className="text-dim">Source</dt>
              <dd className="text-right">
                <SourceTag source={m.source} />
              </dd>
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
  const view = useRef<View>({ yaw: 0, zoom: 1 })
  const badgeRefs = useRef<BadgeRefs>({ earth: { box: null }, sun: { box: null } })
  // Plain markers: they only show where the Sun and Earth are.
  const badge = (key: Body, label: string, disc: string) => (
    <div ref={(el) => void (badgeRefs.current[key].box = el)} className="absolute left-0 top-0" title={label} style={{ visibility: 'hidden' }}>
      <div className="relative flex min-h-11 min-w-11 flex-col items-center gap-1.5 p-1.5">
        <span className={`block rounded-full ${disc}`} />
        <span className="scene-label">{label}</span>
      </div>
    </div>
  )
  return (
    <>
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 28, near: 0.05, far: 200, position: [0, 0, 7] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="The Moon seen from the south with the candidate regions near the pole"
    >
      <Sky />
      <Rig level={level} view={view} />
      <Controls view={view} level={level} />
      <SunLight />
      <Moon />
      <SkyBadges refs={badgeRefs} />
      {SITES.map((s) => (
        <Marker key={s.i} i={s.i} level={level} onSelect={onSelect} onOpen={onOpen} />
      ))}
    </Canvas>
      <div className="pointer-events-none absolute inset-0 z-[6]">
        {badge('earth', 'Earth', 'size-6 bg-[radial-gradient(circle_at_35%_30%,#9cc4ff,#2b5fb8_60%,#0c1f45)]')}
        {badge('sun', 'Sun', 'size-5 bg-sun shadow-[0_0_14px_3px_rgb(255_199_102/0.55)]')}
      </div>
    </>
  )
}

useGLTF.preload(MODEL_URLS.moon)
