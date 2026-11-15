import { useBox } from '../../lib/useBox'
import bodies from '../../data/bodies.json'
import { ageDays, dayToDate, earthDistKm, libration, phaseName, subSolarLonE } from '../../lib/ephemeris'
import { dayLabel, signed } from '../../lib/format'

type Props = { day: number; dur: number }

const SYNODIC = 29.530588 // days from one New Moon to the next

/**
 * The Earth-Moon system seen from above the north pole, with sunlight coming from the left. It shows where the Moon is on its orbit on the
 * selected date and how far it travels during the stay, so a planner sees the phase that sets the lighting of the whole mission.
 */
export default function OrbitDiagram({ day, dur }: Props) {
  const [ref, box] = useBox<HTMLDivElement>()
  const W = Math.max(box.w - 24, 480)
  const H = Math.max(box.h, 200)
  const R = Math.max(60, Math.min(H * 0.36, W * 0.17)) // drawn orbit radius: the diagram is not to scale
  const CX = W * 0.4
  const CY = H * 0.46
  const TX = Math.max(CX + R + 50, W * 0.64) // text column
  const age = ageDays(day)
  const phi = (2 * Math.PI * age) / SYNODIC // angle from New Moon (Moon toward the Sun)
  const pos = (a: number): [number, number] => [CX - R * Math.cos(a), CY + R * Math.sin(a)]
  const [mx, my] = pos(phi)
  const a1 = phi + (2 * Math.PI * dur) / SYNODIC
  const [ex, ey] = pos(a1)
  const large = (a1 - phi) % (2 * Math.PI) > Math.PI ? 1 : 0
  const km = earthDistKm(day)
  const lib = libration(day)
  const lon = subSolarLonE(day)
  const sweep = Math.round((360 * dur) / SYNODIC)

  return (
    <div ref={ref} className="size-full px-3 sm:px-6">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="mx-auto block" role="img" aria-label={`The Moon on its orbit around Earth on ${dayLabel(day)}: ${phaseName(age)}, day ${age.toFixed(1)} of the lunar month`}>
        {[CY - 60, CY - 20, CY + 20, CY + 60].map((yy) => (
          <g key={yy}>
            <line x1="40" x2="150" y1={yy} y2={yy} stroke="#ffc766" strokeWidth="2" opacity="0.8" />
            <path d={`M150,${yy} l-10,-5 v10 z`} fill="#ffc766" opacity="0.8" />
          </g>
        ))}
        <text x="40" y={Math.max(CY - 90, 16)} fontSize="15" fill="#ffc766">
          Sunlight
        </text>

        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeDasharray="3 5" />
        <path d={`M${pos(phi)[0]},${pos(phi)[1]} A${R},${R} 0 ${large} 1 ${ex},${ey}`} fill="none" stroke="#ffc766" strokeWidth="5" strokeLinecap="round" opacity="0.9" />

        <circle cx={CX} cy={CY} r="30" fill="#1d3a6e" />
        <path d={`M${CX},${CY - 30} A30,30 0 0 0 ${CX},${CY + 30} Z`} fill="#6fa8ff" />
        <text x={CX} y={CY + 52} textAnchor="middle" fontSize="15" fill="#6fa8ff">
          Earth
        </text>

        <circle cx={mx} cy={my} r="15" fill="#2a2e36" stroke="rgb(255 255 255 / 0.3)" />
        <path d={`M${mx},${my - 15} A15,15 0 0 0 ${mx},${my + 15} Z`} fill="#e9e6df" />
        <text x={mx + (mx < CX ? -24 : 24)} y={my + 5} textAnchor={mx < CX ? 'end' : 'start'} fontSize="15" fill="#f3f5f8">
          Moon, {dayLabel(day)}
        </text>

        <g fontSize="16" fill="#a6aebb">
          <text x={TX} y={22 + 0}>
            <tspan fill="#f3f5f8" fontSize="26" fontWeight="300">
              {phaseName(age)}
            </tspan>
          </text>
          <text x={TX} y={22 + 28}>Lunar day {age.toFixed(1)} of {SYNODIC.toFixed(1)}</text>
          <text x={TX} y={22 + 50}>Earth to Moon {(Math.round(km / 100) * 100).toLocaleString('en-US')} km</text>
          <text x={TX} y={22 + 70} fontSize="16">
            (ranges {bodies.moon.orbit.perigeeKm.toLocaleString('en-US')} to {bodies.moon.orbit.apogeeKm.toLocaleString('en-US')} km)
          </text>
          <text x={TX} y={22 + 96}>Sun over the Moon {Math.abs(lon).toFixed(0)}° {lon >= 0 ? 'E' : 'W'}</text>
          <text x={TX} y={22 + 118}>Earth libration {signed(lib.lat)}° lat, {signed(lib.lon)}° lon</text>
          <text x={TX} y={22 + 152} fill="#ffc766" fontSize="16">
            Gold arc: the Moon&apos;s path during the stay
          </text>
          <text x={TX} y={22 + 172} fill="#ffc766" fontSize="16">
            {sweep}° in {dur} days, {dayLabel(day)} to {dayLabel(day + dur)} {dayToDate(day + dur).getUTCFullYear()}
          </text>
        </g>
        <text x="40" y={H - 6} fontSize="13" fill="#8b94a3">
          Seen from above the north pole. Distances and sizes are not to scale; the figures are real (JPL Horizons).
        </text>
      </svg>
    </div>
  )
}
