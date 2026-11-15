import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

type Props = { open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; id: string; children: ReactNode }

const W = 352 // wide enough to read, never wider than the screen
const GAP = 8

/**
 * A small note shown next to its button. It is drawn on top of the whole page (in document.body), so no sticky bar, tab row or
 * stacking order can cover it or cut it off, and it flips above the button when there is no room below. Esc or a tap outside closes it.
 */
export default function Floating({ open, onClose, anchor, id, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const place = () => {
    const a = anchor.current?.getBoundingClientRect()
    const b = box.current
    if (!a || !b) return
    const width = Math.min(W, innerWidth - 2 * GAP)
    const left = Math.min(Math.max(GAP, a.left), innerWidth - width - GAP)
    const h = b.offsetHeight
    const below = a.bottom + GAP + h <= innerHeight
    const top = below ? a.bottom + GAP : Math.max(GAP, a.top - GAP - h)
    setPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (open) place()
    else setPos(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, children])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (!box.current?.contains(t) && !anchor.current?.contains(t)) onClose()
    }
    const onMove = () => place()
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onPointer)
    addEventListener('resize', onMove)
    addEventListener('scroll', onMove, true)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('pointerdown', onPointer)
      removeEventListener('resize', onMove)
      removeEventListener('scroll', onMove, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, anchor])

  if (!open) return null
  return createPortal(
    <div
      ref={box}
      id={id}
      role="note"
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width ?? Math.min(W, innerWidth - 2 * GAP), visibility: pos ? 'visible' : 'hidden' }}
      className="z-[100] max-h-[70vh] overflow-y-auto border border-line bg-bg p-4 text-left text-[13px] font-normal normal-case leading-relaxed tracking-normal text-dim shadow-[0_12px_40px_rgb(0_0_0/0.7)]"
    >
      {children}
    </div>,
    document.body,
  )
}
