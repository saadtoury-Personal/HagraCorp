/**
 * Runs an async call and, when it fails, tries again after 3 s, 6 s and 12 s, so a server that is waking up (the free Render plan sleeps when idle)
 * or a brief network drop does not leave a figure stuck on the bundled data. Stops quietly when the signal is aborted.
 */
export async function withRetry<T>(call: () => Promise<T>, signal: AbortSignal, tries = 4): Promise<T> {
  let wait = 3000
  for (let i = 1; ; i++) {
    try {
      return await call()
    } catch (e) {
      if (signal.aborted || i >= tries) throw e
      await new Promise<void>((resolve) => {
        const id = setTimeout(resolve, wait)
        signal.addEventListener('abort', () => (clearTimeout(id), resolve()), { once: true })
      })
      if (signal.aborted) throw e
      wait *= 2
    }
  }
}
