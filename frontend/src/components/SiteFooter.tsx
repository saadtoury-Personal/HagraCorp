import { MoonIcon } from '@phosphor-icons/react'
import { Link, useLocation } from 'react-router'

// Drop image files into src/assets/photos and they appear in the Photos card, in file-name order.
const PHOTOS = Object.entries(import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({ url: url as string, alt: (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }))

export default function SiteFooter({ photos = false }: { photos?: boolean }) {
  const single = PHOTOS.length === 1
  const onContact = useLocation().pathname === '/contact' // no link to the page we are already on
  return (
    <footer className="relative z-10 border-t border-line bg-bg px-5 pb-8 pt-12 md:px-9">
      {photos && (
      <section aria-labelledby="photos-title" className="mx-auto mb-8 max-w-[1200px] border border-line p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="photos-title" className="lab">
            Photos
          </h2>
          {!onContact && (
            <Link to="/contact" className="inline-flex min-h-11 items-center text-xs font-medium uppercase tracking-[0.16em] text-dim transition-colors hover:text-ink">
              Meet the team
            </Link>
          )}
        </div>
        {PHOTOS.length > 0 ? (
          <ul className={`mt-4 grid gap-2 ${single ? '' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {PHOTOS.map((p) => (
              <li key={p.url} className={`overflow-hidden border border-line-soft ${single ? 'aspect-[16/9] md:aspect-[2/1]' : 'aspect-[4/3]'}`}>
                <img src={p.url} alt={single ? 'The six members of HagraCorp in NASA Space Apps Sherbrooke T-shirts' : p.alt} loading="lazy" className="size-full object-cover object-[50%_35%]" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-dim">Team and mission photos will appear here.</p>
        )}
      </section>
      )}

      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-dim">
        <span className="flex items-center gap-2 font-medium uppercase tracking-[0.2em] text-ink">
          <MoonIcon size={18} weight="light" aria-hidden />
          LunarNav
        </span>
        <span>&copy; 2026 HagraCorp. All rights reserved.</span>
        <span className="text-faint">NASA Space Apps Challenge 2026, Lunar Landing Site Navigator</span>
      </div>
    </footer>
  )
}
