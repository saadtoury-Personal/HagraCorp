import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { type Group, Vector3 } from 'three'
import bodies from '../../data/bodies.json'
import { sunAxis } from '../../lib/earthOrientation'
import { sunVec } from '../../lib/ephemeris'
import { useScenario } from '../../store/scenario'
import { SUN_ROTATION_DAYS } from './models'
import { sunSurface } from './sunTexture'

const Y = new Vector3(0, 1, 0)

/** The Sun seen from the Moon, turning on its real axis (7.25 degrees) once per 25.4 days of the shared clock. The surface texture is illustrative. */
function SunGlobe() {
  const map = useMemo(() => sunSurface(), [])
  useEffect(() => () => map.dispose(), [map])
  const group = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const tmp = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const day = useScenario.getState().day
    const a = sunAxis(day)
    group.current?.quaternion.setFromUnitVectors(Y, tmp.set(a[0], a[1], a[2]))
    if (spin.current) spin.current.rotation.y = (2 * Math.PI * day) / SUN_ROTATION_DAYS
    const s = sunVec(day)
    camera.position.set(s[0] * 5.2, s[1] * 5.2, s[2] * 5.2)
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 0, 0)
  })
  return (
    <group ref={group}>
      <group ref={spin}>
        <mesh>
          <sphereGeometry args={[1, 64, 32]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** A live monitor of the Sun (press the Sun badge on the Moon scene): its real data, turning with the shared clock. */
export default function SunMonitor({ onClose }: { onClose: () => void }) {
  const lines = [
    `${(2 * bodies.sunAngularRadiusDeg).toFixed(2)}° wide from the Moon`,
    `1 turn per ${(bodies.sun.siderealRotationHours / 24).toFixed(1)} days`,
    `axis tilted ${bodies.sun.obliquityDeg}°`,
    `${bodies.sun.solarIrradianceWm2} W/m² at the Moon`,
  ]
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1">
      <button type="button" onClick={onClose} className="min-h-9 px-2 text-xs font-medium uppercase tracking-[0.14em] text-dim hover:text-ink [text-shadow:0_1px_8px_#000]">
        Close
      </button>
      <figure className="w-[148px] text-right [text-shadow:0_1px_8px_#000]" aria-label="Sun">
        <div className="aspect-square w-full">
          <Canvas dpr={[1, 2]} camera={{ fov: 24, near: 0.1, far: 50, position: [0, 0, 5] }} gl={{ antialias: true, alpha: true }} aria-label="The Sun as seen from the Moon">
            <SunGlobe />
          </Canvas>
        </div>
        <figcaption className="mt-1 text-[13px] leading-snug text-dim">
          <span className="lab block text-sun">Sun</span>
          {lines.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </figcaption>
      </figure>
    </div>
  )
}
