import { useCallback, useId, useRef, useState } from 'react'
import { entryFor } from '../lib/glossary'
import Floating from './Floating'

/**
 * A label with a small "?" next to it: press it for a plain-language definition (also by keyboard). The text is looked up in lib/glossary,
 * so a term is always explained the same way everywhere. Without a definition it renders the label alone.
 */
export default function Term({ children, term }: { children: string; term?: string }) {
  const entry = entryFor(term ?? children)
  const [open, setOpen] = useState(false)
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  if (!entry) return <>{children}</>
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <button
        ref={btn}
        type="button"
        aria-label={`What does “${entry.term}” mean?`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="-m-3 grid size-11 place-items-center text-faint transition-colors hover:text-ink"
      >
        <span className="grid size-4 place-items-center rounded-full border border-current text-[10px] font-medium normal-case leading-none tracking-normal">?</span>
      </button>
      <Floating open={open} onClose={close} anchor={btn} id={id}>
        <b className="mb-1 block font-medium text-ink">{entry.term}</b>
        {entry.def}
      </Floating>
    </span>
  )
}
