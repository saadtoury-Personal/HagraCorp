import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** A small "i" button that opens a short explanation, so the page stays clean until someone wants the detail. Closes on Escape or an outside tap. */
export default function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onPointer = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onPointer)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <span ref={box} className="pointer-events-auto relative inline-block align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="-m-1.5 inline-grid size-9 place-items-center text-dim transition-colors hover:text-ink"
      >
        <span className="grid size-5 place-items-center rounded-full border border-current font-serif text-[12px] font-semibold italic leading-none">i</span>
      </button>
      {open && (
        <span id={id} role="note" className="absolute left-0 top-full z-50 mt-1 block w-[min(22rem,86vw)] border border-line bg-bg p-4 text-left text-[13px] font-normal leading-relaxed text-dim shadow-[0_8px_30px_rgb(0_0_0/0.6)] [text-shadow:none]">
          {children}
        </span>
      )}
    </span>
  )
}
