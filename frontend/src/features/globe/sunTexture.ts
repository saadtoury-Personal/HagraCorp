import { CanvasTexture, SRGBColorSpace } from 'three'

/**
 * Surface texture for the Sun: granulation and a few dark spots, drawn once. It is illustrative, not a photograph;
 * what is real is the size, distance, axis tilt and spin of the body that wears it.
 */
export function sunSurface() {
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const hash = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const noise = (x: number, y: number, z: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const fx = smooth(x - xi)
    const fy = smooth(y - yi)
    const fz = smooth(z - zi)
    const l = (a: number, b: number, t: number) => a + (b - a) * t
    const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz)
    return l(
      l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
      l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
      fz,
    )
  }
  const spots = [[-0.32, 0.42, 0.07], [-0.28, 0.36, 0.05], [0.4, 3.2, 0.06], [0.26, -1.6, 0.05], [-0.1, 4.6, 0.04]] // [latitude rad, longitude rad, size rad]
  for (let j = 0; j < H; j++) {
    const lat = Math.PI / 2 - (j / (H - 1)) * Math.PI
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * 2 * Math.PI
      // Sampling a 3D field on the sphere makes the texture seamless around the poles and the date line.
      const x = Math.cos(lat) * Math.cos(lon)
      const y = Math.sin(lat)
      const z = Math.cos(lat) * Math.sin(lon)
      let n = 0.5 * noise(x * 38, y * 38, z * 38) + 0.3 * noise(x * 90, y * 90, z * 90) + 0.2 * noise(x * 14, y * 14, z * 14)
      for (const [sl, so, sr] of spots) {
        const d = Math.acos(Math.min(1, Math.sin(lat) * Math.sin(sl) + Math.cos(lat) * Math.cos(sl) * Math.cos(lon - so)))
        if (d < sr * 2) n -= (1 - d / (sr * 2)) * (d < sr ? 0.9 : 0.4)
      }
      const t = Math.max(0, Math.min(1, n))
      const k = (j * W + i) * 4
      img.data[k] = 255
      img.data[k + 1] = 150 + t * 85
      img.data[k + 2] = 40 + t * 95
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
