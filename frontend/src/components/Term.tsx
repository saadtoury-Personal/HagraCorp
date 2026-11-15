import { useEffect, useId, useRef, useState } from 'react'
import { entryFor } from '../lib/glossary'

/**
 * A label with a small "?" next to it: press it for a plain-language definition (also by keyboard). The text is looked up in lib/glossary,
 * so a term is always explained the same way everywhere. Without a definition it renders the label alone.
 */
export default function Term({ children, term }: { children: string; term?: string }) {
  const entry = entryFor(term ?? children)
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

  if (!entry) return <>{children}</>
  return (
    <span ref={box} className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        aria-label={`What does “${entry.term}” mean?`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="-m-2 grid size-9 place-items-center text-faint transition-colors hover:text-ink"
      >
        <span className="grid size-4 place-items-center rounded-full border border-current text-[10px] font-medium normal-case leading-none tracking-normal">?</span>
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-full z-50 mt-2 w-[min(18rem,80vw)] border border-line bg-bg p-3 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-ink shadow-[0_8px_30px_rgb(0_0_0/0.6)]">
          <b className="mb-1 block font-medium">{entry.term}</b>
          {entry.def}
        </span>
      )}
    </span>
  )
}
