import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { dayToDate, SPAN_DAYS } from '../lib/ephemeris'
import { dateLabel, dayLabel, timeLabel } from '../lib/format'
import { useScenario } from '../store/scenario'

/** One shared clock for the Globe and Site views. */
export default function TimeBar() {
  const day = useScenario((s) => s.day)
  const playing = useScenario((s) => s.playing)
  const set = useScenario((s) => s.set)

  // The router renders a page change as a low-priority transition; a tick every 50 ms would restart it forever and the click
  // would seem dead. While the address already shows another page than the one drawn, the clock waits.
  const { pathname } = useLocation()
  const drawn = useRef(pathname)
  useEffect(() => {
    drawn.current = pathname // set after commit: this is the page actually on screen
  }, [pathname])
  useEffect(() => {
    if (!playing || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      if (window.location.pathname !== drawn.current) return
      const d = useScenario.getState().day + 0.075
      set({ day: d > SPAN_DAYS ? 0 : d })
    }, 50)
    return () => clearInterval(id)
  }, [playing, set])

  return (
    <div className="flex h-[72px] shrink-0 items-center gap-4 border-t border-line-soft bg-bg/90 px-5 md:gap-7 md:px-9">
      <button
        type="button"
        onClick={() => set({ playing: !playing })}
        className="grid size-11 shrink-0 place-items-center border border-line transition-colors hover:bg-ink hover:text-bg"
        aria-label={playing ? 'Pause time' : 'Play time'}
      >
        {playing ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
      </button>
      <div className="w-28 shrink-0 md:w-52">
        <div className="text-[15px]">{dateLabel(day)}</div>
        <div className="text-[13px] text-dim">{timeLabel(day)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={SPAN_DAYS}
          step={0.05}
          value={day}
          onChange={(e) => set({ day: Number(e.target.value), playing: false })}
          aria-label="Date and time"
          aria-valuetext={dayToDate(day).toUTCString()}
        />
        <div className="-mt-1.5 flex justify-between text-xs text-faint" aria-hidden>
          {[0, 30, 60, 90].map((d) => (
            <span key={d} className={d % 90 ? 'max-sm:hidden' : ''}>{dayLabel(d)}</span>
          ))}
        </div>
      </div>
      <span className="hidden shrink-0 text-xs uppercase tracking-[0.16em] text-faint xl:block">JPL Horizons positions, modelled horizon</span>
    </div>
  )
}
