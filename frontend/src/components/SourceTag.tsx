import type { Source } from '../lib/useSiteMetrics'

/** Says where a figure comes from: the LunarNav server, or the data bundled with the app. */
export default function SourceTag({ source, className = '' }: { source: Source; className?: string }) {
  const server = source === 'server'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] ${server ? 'text-ok' : 'text-faint'} ${className}`}
      title={server ? 'Computed by the LunarNav server from the 80 m LOLA terrain and JPL Horizons' : 'Computed in the browser from the bundled LOLA horizon masks and the Horizons table, with the server’s rules'}
    >
      <i className={`size-1.5 rounded-full ${server ? 'bg-ok' : 'bg-faint'}`} aria-hidden />
      {server ? 'Server' : 'Bundled data'}
    </span>
  )
}
