import { useMemo } from 'react'
import { useBox } from '../../lib/useBox'
import { dayLabel } from '../../lib/format'
import { earthDistMoons, earthUpAt, maskAt, SITES, sunUpAt, track } from '../../lib/sites'

type Props = { site: number; day: number; dur: number; mast: number }

const M = { l: 108, r: 20, t: 12, b: 84 }
const STEP = 0.1 // days between samples

/** Nice round tick spacing for a value range. */
function tickStep(range: number) {
  const raw = range / 6
  const p = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? p * 10
}

/**
 * Elevation of the Sun and of Earth above the ideal horizon during the stay, against the real terrain horizon in their direction.
 * A body is usable when its line is above its dashed horizon line: same rules as the server (Sun centre; any part of Earth).
 */
export default function ElevationChart({ site, day, dur, mast }: Props) {
  const [ref, box] = useBox<HTMLDivElement>()
  const W = Math.max(box.w - 24, 320)
  const H = Math.max(box.h, 160)
  const s = SITES[site]
  const d = useMemo(() => {
    const sun = track(s, 'sun', day, dur, STEP)
    const earth = track(s, 'earth', day, dur, STEP)
    const n = sun.length
    return Array.from({ length: n }, (_, i) => {
      const t = day + i * STEP
      return {
        t,
        sunEl: sun[i].el,
        sunHz: maskAt(s, sun[i].az, mast),
        earthEl: earth[i].el,
        earthHz: maskAt(s, earth[i].az, mast),
        sunUp: sunUpAt(sun[i].el, maskAt(s, sun[i].az, mast)),
        earthUp: earthUpAt(earth[i].el, maskAt(s, earth[i].az, mast), earthDistMoons(t)),
      }
    })
  }, [s, day, dur, mast])

  const all = d.flatMap((p) => [p.sunEl, p.sunHz, p.earthEl, p.earthHz])
  const step = tickStep(Math.max(Math.max(...all) - Math.min(...all), 2))
  const yMin = Math.floor((Math.min(...all, 0) - step * 0.3) / step) * step
  const yMax = Math.ceil((Math.max(...all, 0) + step * 0.3) / step) * step
  const plotH = H - M.t - M.b
  const x = (t: number) => M.l + ((t - day) / dur) * (W - M.l - M.r)
  const y = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin)) * plotH
  const path = (f: (p: (typeof d)[number]) => number) => d.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(f(p)).toFixed(1)}`).join('')
  const ticks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  const days: number[] = []
  for (let t = Math.ceil(day); t <= day + dur; t++) days.push(t)
  const strip = (up: (p: (typeof d)[number]) => boolean, yy: number, color: string) =>
    d.slice(0, -1).map((p, i) => (up(p) ? <rect key={i} x={x(p.t)} y={yy} width={x(d[i + 1].t) - x(p.t) + 0.6} height={14} fill={color} /> : null))

  return (
    <div ref={ref} className="size-full px-3 sm:px-6">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="mx-auto block" role="img" aria-label={`Elevation of the Sun and Earth above the horizon at ${s.name} during the ${dur}-day stay, against the terrain horizon in their direction`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.08)" />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="14" fill="#a6aebb">
              {v}°
            </text>
          </g>
        ))}
        {days.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} stroke="rgb(255 255 255 / 0.05)" />
            <text x={x(t)} y={H - M.b + 22} textAnchor="middle" fontSize="14" fill="#a6aebb">
              {dayLabel(t)}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke="rgb(255 255 255 / 0.35)" />
        <text x={W - M.r} y={y(0) - 6} textAnchor="end" fontSize="13" fill="#a6aebb">
          ideal horizon
        </text>

        <path d={path((p) => p.earthHz)} fill="none" stroke="#6fa8ff" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.75" />
        <path d={path((p) => p.sunHz)} fill="none" stroke="#ffc766" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.75" />
        <path d={path((p) => p.earthEl)} fill="none" stroke="#6fa8ff" strokeWidth="3" />
        <path d={path((p) => p.sunEl)} fill="none" stroke="#ffc766" strokeWidth="2.5" />

        {strip((p) => p.sunUp, H - M.b + 38, '#ffc766')}
        {strip((p) => p.earthUp, H - M.b + 58, '#6fa8ff')}
        <text x={M.l - 8} y={H - M.b + 50} textAnchor="end" fontSize="13" fill="#a6aebb">
          Sun up
        </text>
        <text x={M.l - 8} y={H - M.b + 70} textAnchor="end" fontSize="13" fill="#a6aebb">
          Earth in view
        </text>
      </svg>
    </div>
  )
}
