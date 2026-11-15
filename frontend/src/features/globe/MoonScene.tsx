import { Html, Stars, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { create } from 'zustand'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { AdditiveBlending, CanvasTexture, Mesh, PerspectiveCamera, Quaternion, Vector3, type DirectionalLight, type Group, type Material, type MeshStandardMaterial } from 'three'
import { sunAxis } from '../../lib/earthOrientation'
import { sunVec } from '../../lib/ephemeris'
import { coords, toneClass } from '../../lib/format'
import SourceTag from '../../components/SourceTag'
import { SITES, verdict } from '../../lib/sites'
import { useSiteMetrics } from '../../lib/useSiteMetrics'
import { useScenario } from '../../store/scenario'
import { earthQuaternion } from './earthPose'
import { bodyAt, census, glowAlpha, HALO_R, MODEL_URLS, normalise, sphereGeometry, SUN_ROTATION_DAYS, type Body } from './models'

/** 0 = whole Moon, 1 = south pole, 2 = one candidate region. */
export type Level = 0 | 1 | 2
export type { Body }

const D2R = Math.PI / 180
// Camera placement only, west-positive longitude (the scene's z axis points west).
const toVec = (lat: number, lonW: number, r: number) =>
  new Vector3(Math.cos(lat * D2R) * Math.cos(lonW * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.sin(lonW * D2R)).multiplyScalar(r)
const Y = new Vector3(0, 1, 0)
const LON0 = 112 // degrees west the camera looks from before the user rotates the Moon
const ZOOM_MIN = 0.6
const ZOOM_MAX = 1.8
const SIDEREAL_MONTH = 27.321661 // days: the Moon turns once against the stars

/**
 * One smooth clock for everything drawn: it eases toward the store's day (the slider and play button move that in steps)
 * and jumps when the date jumps. Bodies, light, badges and stars all read it, so nothing drifts apart.
 */
const clock = { day: useScenario.getState().day }
function Clock() {
  useFrame((_, dt) => {
    const target = useScenario.getState().day
    const gap = target - clock.day
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    clock.day = reduce || Math.abs(gap) > 2 ? target : clock.day + gap * (1 - Math.exp(-dt * 8))
  })
  return null
}

type BadgeRefs = Record<Body, { box: HTMLDivElement | null }>
const BODIES: Body[] = ['earth', 'sun']

/** A fresh, normalised copy of a model (radius 1). Done once, outside any effect, so a re-render can never resize it. */
function useModel(url: string) {
  const { scene } = useGLTF(url)
  return useMemo(() => normalise(scene.clone(true), 1), [scene])
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Plain DOM write, outside React: this runs every frame. */
function paint(box: HTMLElement, x: number, y: number, opacity: number) {
  box.style.visibility = opacity < 0.02 ? 'hidden' : 'visible'
  box.style.opacity = String(opacity)
  box.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
}

/** Earth, from the team's model: real tilt and real turn (sidereal time) in the Moon frame, lit by the same Sun as the Moon. */
function Earth() {
  const clone = useModel(MODEL_URLS.earth)
  const place = useRef<Group>(null)
  const spin = useRef<Group>(null)
  useFrame(() => {
    const t = clock.day
    const b = bodyAt('earth', t)
    const g = place.current
    if (!g) return
    g.position.set(b.dir[0], b.dir[1], b.dir[2]).multiplyScalar(b.dist)
    g.scale.setScalar(b.radius)
    if (spin.current) earthQuaternion(t, spin.current.quaternion)
  })
  return (
    <group ref={place} name="earth">
      <group ref={spin}>
        <primitive object={clone} />
      </group>
    </group>
  )
}

/** Halo texture for the Sun: drawn from glowAlpha, so it can only fade outward from the disc's edge (no second disc). */
function useGlow() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    for (let k = 0; k <= 12; k++) grad.addColorStop(k / 12, `rgba(255,214,150,${glowAlpha((k / 12) * HALO_R).toFixed(3)})`)
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new CanvasTexture(c)
  }, [])
}

/** The Sun, from the team's model: it glows by itself (not tone-mapped, like the halo) and turns once per 25.4 days on its real axis. */
function SunBody() {
  const clone = useModel(MODEL_URLS.sun)
  useEffect(() => clone.traverse((o) => void ((o as Mesh).isMesh && Object.assign((o as Mesh).material as MeshStandardMaterial, { toneMapped: false, needsUpdate: true }))), [clone])
  const glow = useGlow()
  const place = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const axis = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const t = clock.day
    const b = bodyAt('sun', t)
    const g = place.current
    if (!g) return
    g.position.set(b.dir[0], b.dir[1], b.dir[2]).multiplyScalar(b.dist)
    g.scale.setScalar(b.radius)
    const a = sunAxis(t)
    g.quaternion.setFromUnitVectors(Y, axis.set(a[0], a[1], a[2]))
    if (spin.current) spin.current.rotation.y = (2 * Math.PI * t) / SUN_ROTATION_DAYS
  })
  return (
    <group ref={place} name="sun">
      <group ref={spin}>
        <primitive object={clone} />
      </group>
      {/* Same group as the ball, so it can never sit apart from it; the opaque ball hides its centre. */}
      <sprite scale={[2 * HALO_R, 2 * HALO_R, 1]}>
        <spriteMaterial map={glow} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

/** Moves the Earth and Sun labels under their bodies, and fades them out while the Moon is in front of them. */
function SkyBadges({ refs }: { refs: RefObject<BadgeRefs> }) {
  const { camera, size } = useThree()
  const pos = useMemo(() => new Vector3(), [])
  const ray = useMemo(() => new Vector3(), [])
  const hit = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const t = clock.day
    camera.updateMatrixWorld()
    const cam = camera.position
    for (const key of BODIES) {
      const box = refs.current[key].box
      if (!box) continue
      const b = bodyAt(key, t)
      pos.set(b.dir[0], b.dir[1], b.dir[2]).multiplyScalar(b.dist)
      // Moon in front of it: the line from the camera to the body passes through the Moon (radius 1) before reaching the body.
      ray.copy(pos).sub(cam)
      const len = ray.length()
      ray.divideScalar(len)
      const along = -cam.dot(ray)
      const closest = along > 0 && along < len ? hit.copy(cam).addScaledVector(ray, along).length() : 99
      const behindMoon = clamp01((closest - 1) / 0.25) // fades out as it slips behind the limb
      // Label under the body: its on-screen radius is its display radius over the view height at that distance.
      const radiusPx = (b.radius / len / Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360)) * (size.height / 2)
      pos.project(camera)
      const inView = pos.z < 1 ? clamp01((1 - Math.max(Math.abs(pos.x), Math.abs(pos.y))) / 0.1) : 0
      paint(box, (pos.x * 0.5 + 0.5) * size.width, (-pos.y * 0.5 + 0.5) * size.height + radiusPx + 14, behindMoon * inView)
    }
  })
  return null
}

/**
 * Star sphere, fixed in space: in this Moon-fixed view it turns west once per sidereal month (27.3 d), so the Moon is visibly what turns
 * and the Sun drifts about 1 degree a day against the stars, as it does.
 */
function Sky() {
  const g = useRef<Group>(null)
  useFrame(() => {
    if (g.current) g.current.rotation.y = (-2 * Math.PI * clock.day) / SIDEREAL_MONTH
  })
  return (
    <group ref={g}>
      {/* drei's shader draws each star at twice its stored distance (w = 0.5), so 45..65 lands at 90..130, inside far = 200. */}
      <Stars radius={45} depth={20} count={40000} factor={4} saturation={0} fade speed={0} />
    </group>
  )
}

/** User view: yaw spins the camera around the polar axis (degrees), so the south pole stays put. */
type View = { yaw: number; zoom: number }

function Moon() {
  const { scene } = useGLTF(MODEL_URLS.moon)
  const mesh = useMemo(() => {
    let material: Material | Material[] | undefined
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) material = (o as Mesh).material
    })
    const m = Array.isArray(material) ? material[0] : material
    if (m && 'map' in m && m.map) Object.assign(m.map, { anisotropy: 8 })
    return Object.assign(new Mesh(sphereGeometry(), m), { name: 'moon' })
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

/**
 * The only light: the Sun, with parallel rays along its true direction (at its true distance the rays are parallel; a point light at the
 * display distance would move the terminator away from what the site data says). The faint ambient only keeps the night side from being pure black.
 */
function SunLight() {
  const light = useRef<DirectionalLight>(null)
  useFrame(() => {
    const s = sunVec(clock.day)
    light.current?.position.set(s[0] * 10, s[1] * 10, s[2] * 10)
  })
  return (
    <>
      <directionalLight ref={light} intensity={3.4} color="#fff4e2" />
      <ambientLight intensity={0.06} color="#8fb0ff" />
    </>
  )
}

/** Dev only: warns if any body is ever drawn twice (one mesh each, the Sun's one halo, one Sun light). */
function DoublesCheck() {
  const scene = useThree((s) => s.scene)
  const done = useRef(false)
  useFrame(() => {
    if (done.current || !import.meta.env.DEV) return
    done.current = true
    const c = census(scene)
    const ok = c.bodies.moon.meshes === 1 && c.bodies.earth.meshes === 1 && c.bodies.sun.meshes === 1 && c.bodies.sun.sprites === 1 && c.lights.DirectionalLight === 1
    console.assert(ok, 'Globe scene has a duplicated body or light', c)
  })
  return null
}

// Html renders in its own React root, so no router context here: navigation goes through onOpen.
// Which marker the pointer is on, shared by all markers so that only one summary card is ever open.
const useHovered = create<{ i: number | null; set: (i: number | null) => void }>((set) => ({ i: null, set: (i) => set({ i }) }))
const leave = (i: number) => useHovered.getState().i === i && useHovered.getState().set(null)

function Marker({ i, level, onSelect, onOpen }: { i: number; level: Level; onSelect: (i: number) => void; onOpen: (i: number) => void }) {
  const s = SITES[i]
  const { camera } = useThree()
  const wrap = useRef<HTMLDivElement>(null)
  const hovered = useHovered((st) => st.i)
  const [place, setPlace] = useState({ left: false, edge: 'mid' as 'mid' | 'top' | 'bottom' })
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

  // One card at a time: the one under the pointer, or, when the pointer is on no marker, the selected region's.
  const open = hovered === i || (selected && level === 2 && hovered === null)
  // The card opens on the side, and at the height, where there is room for it.
  useEffect(() => {
    const r = wrap.current?.getBoundingClientRect()
    if (open && r) setPlace({ left: r.left > innerWidth * 0.55, edge: r.top < 190 ? 'top' : r.bottom > innerHeight - 190 ? 'bottom' : 'mid' })
  }, [open])
  // The server is only asked for the card that is open: 32 markers must not each call it.
  const m = useSiteMetrics(i, s.id, day, dur, mast, open)
  const v = verdict(m.E, m.D)
  return (
    <Html position={q} center zIndexRange={open ? [70, 50] : [20, 0]}>
      <div ref={wrap} className="relative">
        <button
          type="button"
          aria-label={`${s.name}, region ${i + 1} of ${SITES.length}`}
          aria-pressed={selected}
          onClick={() => onSelect(i)}
          onPointerEnter={() => useHovered.getState().set(i)}
          onPointerLeave={() => leave(i)}
          onFocus={() => useHovered.getState().set(i)}
          onBlur={() => leave(i)}
          className="group relative grid size-8 place-items-center"
        >
          <span className={`block size-3 rounded-full border-2 border-ink bg-bg/50 shadow-[0_0_0_1px_rgb(0_0_0/0.6)] transition-transform duration-200 ${selected ? 'scale-150 bg-ink' : 'group-hover:scale-150 group-hover:bg-ink'}`} />
        </button>
        {open && (
          <div className={`absolute z-10 w-64 border border-line bg-bg p-4 text-left shadow-[0_12px_40px_rgb(0_0_0/0.7)] ${place.left ? 'right-9' : 'left-9'} ${place.edge === 'top' ? 'top-0' : place.edge === 'bottom' ? 'bottom-0' : 'top-1/2 -translate-y-1/2'}`} role="group" aria-label={`${s.name} summary`}>
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
      <Clock />
      <color attach="background" args={['#050608']} />
      <Sky />
      <Rig level={level} view={view} />
      <Controls view={view} level={level} />
      <SunLight />
      <Moon />
      <Earth />
      <SunBody />
      <SkyBadges refs={badgeRefs} />
      <DoublesCheck />
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
