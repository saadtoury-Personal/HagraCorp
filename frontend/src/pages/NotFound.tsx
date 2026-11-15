import { Link } from 'react-router'

/** Shown for any address the app does not know, with a way back to every page. */
export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[760px] content-center px-5 pb-16 pt-28 md:px-9">
      <p className="lab">Error 404</p>
      <h1 className="mt-3 text-[clamp(26px,4vw,48px)] font-light uppercase leading-[1.14] tracking-[0.16em]">Page not found</h1>
      <p className="mt-5 max-w-[52ch] text-[17px] font-light text-dim">This address does not exist in LunarNav. Pick a page below, or use the menu at the top.</p>
      <nav aria-label="Pages" className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="btn">
          Globe
        </Link>
        <Link to="/site" className="btn btn-ghost">
          Site
        </Link>
        <Link to="/compare" className="btn btn-ghost">
          Compare
        </Link>
        <Link to="/slip" className="btn btn-ghost">
          Slip
        </Link>
        <Link to="/method" className="btn btn-ghost">
          Method
        </Link>
        <Link to="/contact" className="btn btn-ghost">
          Contact
        </Link>
      </nav>
    </main>
  )
}
