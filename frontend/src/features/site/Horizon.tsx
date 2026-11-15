import { useMemo } from 'react'
import { azEl, bodiesAt, earthDistMoons, earthUpAt, maskAt, SITES, sunUpAt, track } from '../../lib/sites'

type Props = { site: number; day: number; dur: number; mast: number; mode: 'lander' | 'orbit' }

const SUN = '#ffc766'
const EARTH = '#6fa8ff'
const D2R = Math.PI / 180

/** Split a track wherever azimuth wraps from 360 to 0, so the line does not cross the whole panorama. */
function splitWrap(pts: { az: number; el: number }[]) {
  const out: { az: number; el: number }[][] = [[]]
  pts.forEach((p, i) => {
    if (i > 0 && Math.abs(p.az - pts[i - 1].az) > 180) out.push([])
    out[out.length - 1].push(p)
  })
  return out
}

/**
 * Horizon silhouette seen from the site, with the Sun and Earth at the selected time.
 * "lander" is a 360 degree panorama, "orbit" is the same sky as a polar diagram.
 * Discs are enlarged so they stay visible (the Sun is really 0.5 degrees wide).
 */
export default function Horizon({ site, day, dur, mast, mode }: Props) {
  const s = SITES[site]
  const { sun, earth } = useMemo(() => {
    const b = bodiesAt(day)
    return { sun: azEl(s, b.sun), earth: azEl(s, b.earth, earthDistMoons(day)) }
  }, [s, day])
  const tracks = useMemo(() => ({ sun: splitWrap(track(s, 'sun', day, dur)), earth: splitWrap(track(s, 'earth', day, dur)) }), [s, day, dur])
  const horizon = useMemo(() => Array.from({ length: 181 }, (_, i) => ({ az: i * 2, el: maskAt(s, i * 2, mast) })), [s, mast])

  const sunUp = sunUpAt(sun.el, maskAt(s, sun.az, mast))
  const earthUp = earthUpAt(earth.el, maskAt(s, earth.az, mast), earthDistMoons(day))

  if (mode === 'lander') {
    const W = 1000
    const H = 300
    const lo = -6
    const hi = 12
    const x = (az: number) => (az / 360) * W
    const y = (el: number) => H * (1 - (el - lo) / (hi - lo))
    const ground = `M0,${H} ` + horizon.map((p) => `L${x(p.az)},${y(p.el)}`).join(' ') + ` L${W},${H} Z`
    const line = (pts: { az: number; el: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.az)},${y(Math.max(lo, Math.min(hi, p.el)))}`).join(' ')
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="size-full" role="img" aria-label={`Horizon panorama of ${s.name}. Sun ${sunUp ? 'above' : 'below'} the horizon, Earth ${earthUp ? 'in view' : 'hidden'}.`}>
        <rect width={W} height={H} fill="#070a10" />
        {[0, 5, 10].map((e) => (
          <line key={e} x1={0} x2={W} y1={y(e)} y2={y(e)} stroke="rgb(255 255 255 / .07)" strokeDasharray={e ? '2 6' : undefined} />
        ))}
        {tracks.sun.map((t, i) => (
          <path key={'s' + i} d={line(t)} fill="none" stroke={SUN} strokeOpacity=".55" strokeWidth="1.5" />
        ))}
        {tracks.earth.map((t, i) => (
          <path key={'e' + i} d={line(t)} fill="none" stroke={EARTH} strokeOpacity=".6" strokeWidth="1.5" strokeDasharray="5 4" />
        ))}
        <path d={ground} fill="#0d1118" stroke="rgb(255 255 255 / .35)" strokeWidth="1.2" />
        {(
          [
            ['Sun', sun, SUN, sunUp, 7],
            ['Earth', earth, EARTH, earthUp, 6],
          ] as const
        ).map(([name, p, col, up, r]) => (
          <g key={name} transform={`translate(${x(p.az)} ${y(Math.max(lo + 1, Math.min(hi - 1, p.el)))})`}>
            <circle r={r} fill={up ? col : 'none'} stroke={col} strokeWidth="1.5" strokeDasharray={up ? undefined : '2 3'} />
            <text y={-r - 8} textAnchor="middle" fontSize="13" fill={col} className="select-none">
              {name} {p.el.toFixed(1)}° {up ? '' : 'hidden'}
            </text>
          </g>
        ))}
        {[
          ['N', 0],
          ['E', 90],
          ['S', 180],
          ['W', 270],
        ].map(([l, a]) => (
          <text key={l} x={x(+a) + 6} y={H - 8} fontSize="13" fill="#a6aebb">
            {l}
          </text>
        ))}
      </svg>
    )
  }

  const R = 70
  const rho = (el: number) => Math.max(0, R * (1 - Math.max(-8, el) / 14))
  const pt = (az: number, r: number) => `${r * Math.sin(az * D2R)},${-r * Math.cos(az * D2R)}`
  const sky = horizon.map((p, i) => `${i ? 'L' : 'M'}${pt(p.az, rho(p.el))}`).join(' ') + ' Z'
  const line = (pts: { az: number; el: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${pt(p.az, rho(p.el))}`).join(' ')
  return (
    <svg viewBox="-100 -100 200 200" className="size-full" role="img" aria-label={`Polar sky diagram of ${s.name}. Sun ${sunUp ? 'above' : 'below'} the horizon, Earth ${earthUp ? 'in view' : 'hidden'}.`}>
      <circle r={96} fill="#070a10" />
      {[5, 10].map((e) => (
        <circle key={e} r={rho(e)} fill="none" stroke="rgb(255 255 255 / .08)" strokeDasharray="1 3" />
      ))}
      <path d={sky} fill="#0d1118" stroke="rgb(255 255 255 / .4)" strokeWidth=".6" />
      {tracks.sun.map((t, i) => (
        <path key={'s' + i} d={line(t)} fill="none" stroke={SUN} strokeOpacity=".6" strokeWidth=".7" />
      ))}
      {tracks.earth.map((t, i) => (
        <path key={'e' + i} d={line(t)} fill="none" stroke={EARTH} strokeOpacity=".65" strokeWidth=".7" strokeDasharray="2 1.5" />
      ))}
      {(
        [
          ['Sun', sun, SUN, sunUp, 2.6],
          ['Earth', earth, EARTH, earthUp, 2.2],
        ] as const
      ).map(([name, p, col, up, r]) => {
        const [px, py] = pt(p.az, rho(p.el)).split(',').map(Number)
        return (
          <g key={name} transform={`translate(${px} ${py})`}>
            <circle r={r} fill={up ? col : 'none'} stroke={col} strokeWidth=".6" strokeDasharray={up ? undefined : '1 1'} />
            <text y={-r - 2.5} textAnchor="middle" fontSize="4.6" fill={col} className="select-none">
              {name} {p.el.toFixed(1)}°
            </text>
          </g>
        )
      })}
      {[
        ['N', 0, -R - 12],
        ['E', R + 12, 0],
        ['S', 0, R + 14],
        ['W', -R - 12, 0],
      ].map(([l, tx, ty]) => (
        <text key={l} x={+tx} y={+ty} textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#a6aebb">
          {l}
        </text>
      ))}
    </svg>
  )
}
