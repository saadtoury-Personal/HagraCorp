import { useEffect, useRef, useState } from 'react'

/** Pixel size of an element, kept up to date, so an SVG can draw itself at 1:1 instead of being scaled (and its text shrunk). */
export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setBox({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}
