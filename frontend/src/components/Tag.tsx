import { CheckCircleIcon, WarningCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import type { Go } from '../lib/go'

const TAGS = {
  server: ['Server', 'Computed by the LunarNav server from the 80 m LOLA terrain and JPL Horizons'],
  bundled: ['Bundled data', 'Computed in your browser from the data shipped with the app (same Horizons table and LOLA skylines)'],
  assumed: ['Assumed', 'A choice we made, not a measured value: change it to match your mission'],
  validated: ['Validated', 'Checked against an independent NASA source'],
} as const

/** Where a number comes from. The title gives the full sentence on hover and to screen readers. */
export function Tag({ kind }: { kind: keyof typeof TAGS }) {
  const [label, title] = TAGS[kind]
  return (
    <span title={title} className="inline-block whitespace-nowrap border border-line px-1.5 py-px align-middle text-[11px] font-medium leading-4 text-dim">
      {label}
      <span className="sr-only">: {title}</span>
    </span>
  )
}

const GO = {
  go: ['GO', CheckCircleIcon, 'text-ok'],
  risky: ['RISKY', WarningCircleIcon, 'text-warn'],
  nogo: ['NO-GO', XCircleIcon, 'text-bad'],
} as const

/** Verdict with an icon and a word, so colour is never the only signal. */
export function GoBadge({ go, size = 16 }: { go: Go; size?: number }) {
  const [word, Icon, tone] = GO[go]
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium tracking-[0.04em] ${tone}`}>
      <Icon size={size} weight="fill" aria-hidden />
      {word}
    </span>
  )
}
