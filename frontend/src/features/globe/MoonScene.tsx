import { Html, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { AdditiveBlending, BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, Mesh, PerspectiveCamera, Quaternion, Vector2, Vector3, type DirectionalLight, type Group, type Material } from 'three'
import bodies from '../../data/bodies.json'
import { sunAxis } from '../../lib/earthOrientation'
import { earthDistKm, earthVec, sunVec } from '../../lib/ephemeris'
import { coords, toneClass } from '../../lib/format'
import SourceTag from '../../components/SourceTag'
import { SITES, verdict } from '../../lib/sites'
import { useSiteMetrics } from '../../lib/useSiteMetrics'
import { useScenario } from '../../store/scenario'
import { earthQuaternion } from './earthPose'
import { kmToUnits, MODEL_URLS, normalise, SUN_ROTATION_DAYS } from './models'

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
 * The Sun and Earth go round the Moon in their real directions (Horizons table, Moon-fixed frame), at display size.
 * Distances are for display only: at true scale both would be far off screen. The label badges are plain DOM that follow the
 * projected 3D positions; the Moon hides a badge while its body is behind it, and the Sun's light (SunLight) comes from the same direction.
 */
export type Body = 'earth' | 'sun'
type BadgeRefs = Record<Body, { box: HTMLDivElement | null }>

/**
 * Sizes are true as seen from the Moon: Earth about 0.95 degrees wide in radius (it follows the Horizons distance), the Sun only 0.27.
 * Both are drawn at that apparent size from wherever the camera is, so next to the Moon (8 degrees at the default zoom) they stay small, the Sun smaller than Earth.
 * Directions are real too. Only the distance is shortened (they stay close to the Moon so they fit on screen).
 */
const DIST: Record<Body, number> = { sun: 2.6, earth: 1.9 }
const D2R_ = Math.PI / 180
const earthAngle = (t: number) => Math.asin(kmToUnits(bodies.earth.meanRadiusKm) / kmToUnits(earthDistKm(t)))
const SUN_ANGLE = bodies.sunAngularRadiusDeg * D2R_
const angleOf = (key: Body, t: number) => (key === 'earth' ? earthAngle(t) : SUN_ANGLE)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Plain DOM write, outside React: this runs every frame. */
function paint(box: HTMLElement, x: number, y: number, opacity: number) {
  box.style.visibility = opacity < 0.02 ? 'hidden' : 'visible'
  box.style.opacity = String(opacity)
  box.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
}

/** Earth, from the team's model: real tilt and real turn (sidereal time) in the Moon frame, lit by the same Sun as the Moon. */
function Earth() {
  const { scene } = useGLTF(MODEL_URLS.earth)
  const clone = useMemo(() => scene.clone(true), [scene])
  const place = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const camera = useThree((st) => st.camera)
  useLayoutEffect(() => {
    normalise(clone, 1)
  }, [clone])
  useFrame(() => {
    const t = useScenario.getState().day
    const e = earthVec(t)
    const g = place.current
    if (!g) return
    g.position.set(e[0], e[1], e[2]).multiplyScalar(DIST.earth)
    g.scale.setScalar(Math.tan(earthAngle(t)) * camera.position.distanceTo(g.position)) // true apparent size from the camera
    if (spin.current) earthQuaternion(t, spin.current.quaternion)
  })
  return (
    <group ref={place}>
      <group ref={spin}>
        <primitive object={clone} />
      </group>
    </group>
  )
}

/** Soft halo so the Sun, which is truly tiny in the sky, can still be found. It is not part of the Sun's size. */
function useGlow() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,236,190,0.95)')
    grad.addColorStop(0.18, 'rgba(255,205,120,0.55)')
    grad.addColorStop(0.5, 'rgba(255,180,80,0.12)')
    grad.addColorStop(1, 'rgba(255,170,70,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new CanvasTexture(c)
  }, [])
}

/** The Sun, from the team's model: it glows by itself, turns once per 25.4 days on its real axis, and is as small as the real Sun looks. */
function SunBody() {
  const { scene } = useGLTF(MODEL_URLS.sun)
  const clone = useMemo(() => scene.clone(true), [scene])
  const glow = useGlow()
  const place = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const axis = useMemo(() => new Vector3(), [])
  const camera = useThree((st) => st.camera)
  useLayoutEffect(() => {
    normalise(clone, 1)
  }, [clone])
  useFrame(() => {
    const t = useScenario.getState().day
    const s = sunVec(t)
    const g = place.current
    if (!g) return
    g.position.set(s[0], s[1], s[2]).multiplyScalar(DIST.sun)
    g.scale.setScalar(Math.tan(SUN_ANGLE) * camera.position.distanceTo(g.position))
    const a = sunAxis(t)
    g.quaternion.setFromUnitVectors(Y, axis.set(a[0], a[1], a[2]))
    if (spin.current) spin.current.rotation.y = (2 * Math.PI * t) / SUN_ROTATION_DAYS
  })
  return (
    <group ref={place}>
      <group ref={spin}>
        <primitive object={clone} />
      </group>
      <sprite scale={[20, 20, 1]}>
        <spriteMaterial map={glow} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
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
      pos.set(d[0], d[1], d[2]).multiplyScalar(DIST[key])
      // Moon in front of it: the line from the camera to the body passes through the Moon (radius 1) before reaching the body.
      ray.copy(pos).sub(cam)
      const len = ray.length()
      ray.divideScalar(len)
      const along = -cam.dot(ray)
      const closest = along > 0 && along < len ? hit.copy(cam).addScaledVector(ray, along).length() : 99
      const behindMoon = clamp01((closest - 1) / 0.25) // fades out as it slips behind the limb
      // Label under the body: its on-screen radius is its display radius over the view height at that distance.
      const radiusPx = (Math.tan(angleOf(key, t)) / Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360)) * (size.height / 2)
      pos.project(camera)
      const inView = pos.z < 1 ? clamp01((1 - Math.max(Math.abs(pos.x), Math.abs(pos.y))) / 0.1) : 0
      paint(box, (pos.x * 0.5 + 0.5) * size.width, (-pos.y * 0.5 + 0.5) * size.height + radiusPx + 14, behindMoon * inView)
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

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const TRANSITION_S = 1.5

/**
 * The camera. Changing level (Moon, Pole, Region) is one smooth move of fixed length: the camera swings around the Moon along an arc
 * (never cutting through it), the target, the roll and the framing offset all ease together, and nothing jumps. Once there, the camera
 * follows the user's drag and zoom with a light damping.
 */
function Rig({ level, view }: { level: Level; view: RefObject<View> }) {
  const { camera, size } = useThree()
  const pos = useRef(toVec(-38, LON0, 7))
  const look = useRef(new Vector3())
  const cur = useRef({ yaw: 0, zoom: 1, ox: 0, oy: 0 })
  const goal = useRef({ pos: new Vector3(), look: new Vector3(), up: new Vector3(0, 1, 0), side: new Vector3(), negSide: new Vector3(), want: new Vector3() })
  const last = useRef<Level>(level)
  const tween = useRef<{ t: number; from: { pos: Vector3; look: Vector3; up: Vector3; ox: number; oy: number } } | null>(null)
  const tmp = useMemo(() => ({ q: new Quaternion(), id: new Quaternion(), da: new Vector3(), db: new Vector3(), pos: new Vector3() }), [])

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
    want.copy(level === 2 ? negSide : Y)
    // Push the Moon right of the headline on wide screens, and a little low on narrow ones.
    const wide = size.width >= 1024
    const goalOx = wide && level === 0 ? -size.width * 0.15 : 0
    const goalOy = wide ? 0 : size.height * 0.04

    // A level change starts one move from wherever the camera is right now.
    if (last.current !== level) {
      last.current = level
      tween.current = { t: 0, from: { pos: pos.current.clone(), look: look.current.clone(), up: up.clone(), ox: cur.current.ox, oy: cur.current.oy } }
    }
    const tw = tween.current
    if (tw) {
      tw.t += reduce ? 1 : dt / TRANSITION_S
      const e = easeInOut(Math.min(1, tw.t))
      // Position: swing around the Moon (spherical interpolation of the direction), radius eased on its own.
      tmp.da.copy(tw.from.pos).normalize()
      tmp.db.copy(goalPos).normalize()
      tmp.q.setFromUnitVectors(tmp.da, tmp.db)
      tmp.id.identity().slerp(tmp.q, e)
      const r = tw.from.pos.length() + (goalPos.length() - tw.from.pos.length()) * e
      pos.current.copy(tmp.da.applyQuaternion(tmp.id)).multiplyScalar(r)
      look.current.lerpVectors(tw.from.look, goalLook, e)
      up.copy(tw.from.up).lerp(want, e).normalize()
      cur.current.ox = tw.from.ox + (goalOx - tw.from.ox) * e
      cur.current.oy = tw.from.oy + (goalOy - tw.from.oy) * e
      if (tw.t >= 1) tween.current = null
    } else {
      pos.current.lerp(goalPos, k)
      look.current.lerp(goalLook, k)
      up.lerp(want, k).normalize()
      cur.current.ox += (goalOx - cur.current.ox) * k
      cur.current.oy += (goalOy - cur.current.oy) * k
    }
    camera.position.copy(pos.current)
    camera.up.copy(up)
    camera.lookAt(look.current)
    ;(camera as PerspectiveCamera).setViewOffset(size.width, size.height, cur.current.ox, cur.current.oy, size.width, size.height)
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
  // The 3D models are the markers; these are only their names, kept under them.
  const badge = (key: Body, label: string) => (
    <div ref={(el) => void (badgeRefs.current[key].box = el)} className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
      <span className="scene-label">{label}</span>
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
      <Earth />
      <SunBody />
      <SkyBadges refs={badgeRefs} />
      {SITES.map((s) => (
        <Marker key={s.i} i={s.i} level={level} onSelect={onSelect} onOpen={onOpen} />
      ))}
    </Canvas>
      <div className="pointer-events-none absolute inset-0 z-[6]">
        {badge('earth', 'Earth')}
        {badge('sun', 'Sun')}
      </div>
    </>
  )
}

useGLTF.preload(MODEL_URLS.moon)
useGLTF.preload(MODEL_URLS.earth)
useGLTF.preload(MODEL_URLS.sun)
