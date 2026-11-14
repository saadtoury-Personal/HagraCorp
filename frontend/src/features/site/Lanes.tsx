import { useEffect, useRef } from 'react'
import { SPAN_DAYS } from '../../lib/ephemeris'
import { dayLabel } from '../../lib/format'
import { N, STEP, type Series } from '../../lib/sites'

type Props = { series: Series; day: number; dur: number; onSeek: (day: number) => void }

const LANES = [
  ['Sun', '#ffc766'],
  ['Earth', '#6fa8ff'],
  ['Both', '#4ad295'],
] as const

/** 90 day strip: when the Sun, Earth and both are visible. Click or drag to move time. */
export default function Lanes({ series, day, dur, onSeek }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const w = cv.clientWidth
      const h = cv.clientHeight
      cv.width = w * dpr
      cv.height = h * dpr
      const c = cv.getContext('2d')!
      c.scale(dpr, dpr)
      c.clearRect(0, 0, w, h)
      const total = Math.min(N, SPAN_DAYS / STEP)
      const lh = 14
      const gap = 6
      LANES.forEach(([, col], i) => {
        const y = i * (lh + gap) + 2
        c.fillStyle = 'rgba(255,255,255,.06)'
        c.fillRect(0, y, w, lh)
        c.fillStyle = col
        const on = (k: number) => (i === 0 ? series.sun[k] : i === 1 ? series.earth[k] : series.sun[k] && series.earth[k])
        let k = 0
        while (k < total) {
          if (on(k)) {
            let e = k
            while (e < total && on(e)) e++
            c.fillRect((k / total) * w, y, Math.max(1, ((e - k) / total) * w), lh)
            k = e
          } else k++
        }
      })
      const x0 = (day / SPAN_DAYS) * w
      const x1 = Math.min(w, ((day + dur) / SPAN_DAYS) * w)
      c.fillStyle = 'rgba(255,255,255,.1)'
      c.fillRect(x0, 0, x1 - x0, h)
      c.strokeStyle = '#fff'
      c.beginPath()
      c.moveTo(x0 + 0.5, 0)
      c.lineTo(x0 + 0.5, h)
      c.stroke()
      c.font = '500 12px Barlow, system-ui, sans-serif'
      c.fillStyle = '#a6aebb'
      ;[0, 30, 60, 90].forEach((d) => c.fillText(dayLabel(d), d === 90 ? w - 38 : Math.min(w - 38, (d / SPAN_DAYS) * w + 3), h - 2))
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(cv)
    return () => ro.disconnect()
  }, [series, day, dur])

  const seek = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onSeek(Math.min(SPAN_DAYS, Math.max(0, ((e.clientX - r.left) / r.width) * SPAN_DAYS)))
  }

  return (
    <div className="border-t border-line-soft bg-bg/90 px-5 pb-2.5 pt-3.5 md:px-9">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="lab">90 days, drag to move time</span>
        <span className="flex gap-5 text-xs uppercase tracking-[0.08em] text-dim">
          {LANES.map(([name, col]) => (
            <span key={name}>
              <i className="mr-2 inline-block h-[3px] w-2.5 align-middle" style={{ background: col }} />
              {name}
            </span>
          ))}
        </span>
      </div>
      <canvas
        ref={ref}
        role="img"
        aria-label="Timeline of Sun visibility, Earth visibility and both, over 90 days"
        className="block h-[78px] w-full cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seek(e)
        }}
        onPointerMove={(e) => e.buttons && seek(e)}
      />
    </div>
  )
}
