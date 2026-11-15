import { Component, type ReactNode } from 'react'

const RETRY_KEY = 'lunarnav-chunk-retry'
// A page's code failed to download (new deploy replaced the files, or the dev server re-optimised its dependencies).
const isChunkError = (e: unknown) => /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(String((e as Error)?.message ?? e))

/**
 * Without this, a page that fails to load or throws leaves a blank screen and every click seems dead.
 * A failed download reloads the page once; anything else shows a message with a way out. Keyed by route in App, so leaving the page resets it.
 */
export default class PageBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown) {
    let retried = false
    try {
      retried = sessionStorage.getItem(RETRY_KEY) === location.pathname
      if (isChunkError(error) && !retried) {
        sessionStorage.setItem(RETRY_KEY, location.pathname)
        location.reload()
        return
      }
      sessionStorage.removeItem(RETRY_KEY)
    } catch {
      // storage blocked: just show the message
    }
    console.error(error)
  }

  render() {
    if (this.state.error === null) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center" role="alert">
        <div>
          <p className="text-lg">This page could not be shown.</p>
          <p className="mt-2 text-sm text-dim">Reloading usually fixes it. Your mission settings are kept in the address.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" className="btn min-h-11 px-5" onClick={() => location.reload()}>
              Reload
            </button>
            <a href="/" className="btn btn-ghost min-h-11 px-5">
              Back to the globe
            </a>
          </div>
        </div>
      </div>
    )
  }
}
