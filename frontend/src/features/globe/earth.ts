import { CanvasTexture, SRGBColorSpace } from 'three'

// Procedural stand-ins for assets we do not ship: an Earth surface and a Sun glow.
// They are placeholders until a real Earth texture is added next to the Moon model.

const fract = (v: number) => v - Math.floor(v)
const hash = (x: number, y: number, z: number) => {
  const a = fract(x * 0.3183099 + 0.1) * 17
  const b = fract(y * 0.3183099 + 0.1) * 17
  const c = fract(z * 0.3183099 + 0.1) * 17
  return fract(a * b * c * (a + b + c))
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

function valueNoise(x: number, y: number, z: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = fract(x)
  const fy = fract(y)
  const fz = fract(z)
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)
  const h = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz)
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), ux), mix(h(0, 1, 0), h(1, 1, 0), ux), uy),
    mix(mix(h(0, 0, 1), h(1, 0, 1), ux), mix(h(0, 1, 1), h(1, 1, 1), ux), uy),
    uz,
  )
}
function fbm(x: number, y: number, z: number) {
  let a = 0.5
  let s = 0
  for (let i = 0; i < 5; i++) {
    s += a * valueNoise(x, y, z)
    x *= 2.03
    y *= 2.03
    z *= 2.03
    a *= 0.5
  }
  return s
}

/** 512 x 256 equirectangular Earth: ocean, continents, ice caps and clouds, seamless because it samples 3D noise. */
export function makeEarthTexture() {
  const W = 512
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - j / H) * Math.PI
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * 2 * Math.PI
      const px = Math.cos(lat) * Math.cos(lon)
      const py = Math.sin(lat)
      const pz = Math.cos(lat) * Math.sin(lon)
      const land = smooth(0.46, 0.58, fbm(px * 1.9 + 3, py * 1.9 + 3, pz * 1.9 + 3) * 0.8 + fbm(px * 5, py * 5, pz * 5) * 0.2)
      const relief = smooth(0.55, 0.75, fbm(px * 5 + 1, py * 5 + 1, pz * 5 + 1))
      let r = 8
      let g = 36
      let b = 97
      const lr = mix(30, 132, relief)
      const lg = mix(76, 115, relief)
      const lb = mix(36, 76, relief)
      r = mix(r, lr, land)
      g = mix(g, lg, land)
      b = mix(b, lb, land)
      const ice = smooth(0.2, 0.32, Math.abs(lat) / (Math.PI / 2) - 0.6)
      r = mix(r, 235, ice)
      g = mix(g, 240, ice)
      b = mix(b, 245, ice)
      const cloud = smooth(0.55, 0.82, fbm(px * 3.4 + 11, py * 3.4 + 11, pz * 3.4 + 11)) * 0.7
      r = mix(r, 235, cloud)
      g = mix(g, 235, cloud)
      b = mix(b, 235, cloud)
      const o = (j * W + i) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** Soft radial glow for the Sun sprite. */
export function makeGlowTexture() {
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,250,235,1)')
  g.addColorStop(0.06, 'rgba(255,236,190,0.95)')
  g.addColorStop(0.22, 'rgba(255,200,120,0.35)')
  g.addColorStop(1, 'rgba(255,170,80,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new CanvasTexture(canvas)
}
