import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import Floating from './Floating'

/** A small "i" button that opens a short explanation, so the page stays clean until someone wants the detail. Closes on Escape or an outside tap. */
export default function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  return (
    <span className="pointer-events-auto inline-block align-middle">
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="-m-1.5 inline-grid size-9 place-items-center text-dim transition-colors hover:text-ink"
      >
        <span className="grid size-5 place-items-center rounded-full border border-current font-serif text-[12px] font-semibold italic leading-none">i</span>
      </button>
      <Floating open={open} onClose={close} anchor={btn} id={id}>
        {children}
      </Floating>
    </span>
  )
}
