import { useEffect, useRef } from 'react'
import { SPAN_DAYS } from '../../lib/ephemeris'
import { dayLabel } from '../../lib/format'
import { N, STEP, type Series } from '../../lib/sites'

type Props = { series: Series; day: number; dur: number; onSeek: (day: number) => void }

// One bar for the 90 days, one colour per moment: green when the Sun and Earth are both usable, amber when only one is, dark when neither is.
const STATES = [
  { name: 'Sun and Earth', color: '#4ad295' },
  { name: 'One of them', color: '#f2b441' },
  { name: 'Neither', color: 'rgba(255,255,255,.07)' },
] as const

/** 90 day strip: how good each moment is. Click or drag to move time; the pale block is the stay. */
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
      const bar = 22
      const state = (k: number) => (series.sun[k] && series.earth[k] ? 0 : series.sun[k] || series.earth[k] ? 1 : 2)
      let k = 0
      while (k < total) {
        const st = state(k)
        let e = k
        while (e < total && state(e) === st) e++
        c.fillStyle = STATES[st].color
        c.fillRect((k / total) * w, 0, Math.max(1, ((e - k) / total) * w), bar)
        k = e
      }
      const x0 = (day / SPAN_DAYS) * w
      const x1 = Math.min(w, ((day + dur) / SPAN_DAYS) * w)
      c.fillStyle = 'rgba(255,255,255,.22)'
      c.fillRect(x0, 0, x1 - x0, bar)
      c.strokeStyle = '#fff'
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(x0 + 1, 0)
      c.lineTo(x0 + 1, bar + 4)
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
        <span className="lab">Next 90 days, drag to pick a date</span>
        <span className="flex gap-4 text-xs text-dim">
          {STATES.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm border border-line-soft" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </span>
      </div>
      <canvas
        ref={ref}
        role="img"
        aria-label="Timeline of the next 90 days: green when the Sun and Earth are both usable, amber when only one is, dark when neither is"
        className="block h-[44px] w-full cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seek(e)
        }}
        onPointerMove={(e) => e.buttons && seek(e)}
      />
    </div>
  )
}
