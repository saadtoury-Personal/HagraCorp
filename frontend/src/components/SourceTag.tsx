import type { Source } from '../lib/useSiteMetrics'
import { Tag } from './Tag'

/** Says where a figure comes from: the LunarNav server, or the data bundled with the app (same look as every other source label). */
export default function SourceTag({ source, className = '' }: { source: Source; className?: string }) {
  return (
    <span className={className}>
      <Tag kind={source} />
    </span>
  )
}
