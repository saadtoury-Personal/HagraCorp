import { useEffect, useState, type ReactNode } from 'react'

const query = '(min-width: 1024px)'

/**
 * On a large screen the settings are always shown. On a phone or tablet they fold into one line that says what is set, so the
 * results are the first thing you see; tap the line to change the settings.
 */
export default function MobileFold({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [wide, setWide] = useState(() => matchMedia(query).matches)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  if (wide) return <>{children}</>
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center justify-between gap-4 border border-line px-4 text-left"
      >
        <span className="text-sm">{summary}</span>
        <span className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-dim">{open ? 'Hide' : 'Change'}</span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  )
}
