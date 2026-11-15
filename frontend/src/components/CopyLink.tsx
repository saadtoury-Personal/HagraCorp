import { CheckIcon, LinkSimpleIcon } from '@phosphor-icons/react'
import { useState } from 'react'

/** Copies the current page address, which already carries the scenario. */
export default function CopyLink() {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      window.prompt('Copy this link', window.location.href)
    }
  }
  return (
    <button type="button" onClick={copy} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-2 text-xs font-medium uppercase tracking-[0.16em] text-dim transition-colors hover:text-ink">
      {done ? <CheckIcon size={16} aria-hidden /> : <LinkSimpleIcon size={16} aria-hidden />}
      <span className="hidden sm:inline" aria-live="polite">
        {done ? 'Link copied' : 'Share'}
      </span>
      <span className="sr-only sm:hidden">Copy link to this scenario</span>
    </button>
  )
}
