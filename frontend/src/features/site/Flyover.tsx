import { useEffect, useRef, useState } from 'react'
import { azEl, bodiesAt, maskAt, SITES, SUN_EDGE_DEG } from '../../lib/sites'

type Props = { site: number; day: number; mast: number; /** Camera at ground level instead of high above the terrain. */ low: boolean; tour: boolean }
type V3 = [number, number, number]

const D2R = Math.PI / 180
const DIST_EM = 221.3 // Earth to Moon in lunar radii
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

const VS = `#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

// Procedural lunar terrain ray-marched in a fragment shader, lit by a very low Sun with soft shadows.
// The terrain is synthetic (same seed per region) until real LOLA heightmaps are served.
const FS = `#version 300 es
precision highp float;out vec4 o;
uniform vec2 uRes;uniform vec3 uCam,uSun;uniform float uYaw,uPitch,uSeed,uLit;
float h21(vec2 p){p=fract(p*vec2(.3183099,.3678794)+.1);p*=17.;return fract(p.x*p.y*(p.x+p.y));}
float vn2(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
vec3 stars(vec2 uv){vec2 g=floor(uv*vec2(1100.,620.));float r=h21(g);float s=step(.9986,r);
 float b=h21(g+7.3);return vec3(.78,.82,.95)*s*(.18+.6*b*b);}
float cr2(vec2 p,float sc,float amp){
 vec2 q=p*sc,i=floor(q),f=fract(q);
 if(h21(i+17.)<.5)return 0.;
 vec2 c=vec2(h21(i+3.1),h21(i+7.7))*.46+.27;
 float rad=.16+.2*h21(i+23.);float d=length(f-c)/rad;
 float bowl=d<1.?-(1.-d*d)*.85:0.;float rim=exp(-pow((d-1.06)*5.,2.))*.5;
 return (bowl+rim)*rad*amp/sc*.5;}
float H(vec2 p){p+=uSeed*vec2(37.1,12.7);
 float h=0.,a=1.;vec2 q=p*.28;
 for(int i=0;i<4;i++){h+=a*vn2(q);q=q*2.07+vec2(1.7,9.2);a*=.45;}
 return h*1.1+cr2(p,.55,1.2)+cr2(p+4.,1.4,1.)+cr2(p+9.,3.2,.9);}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*uRes)/(.5*uRes.y);
 vec3 f=vec3(cos(uPitch)*sin(uYaw),sin(uPitch),cos(uPitch)*cos(uYaw));
 vec3 uu=normalize(cross(f,vec3(0,1,0))),vv=cross(uu,f);
 vec3 ro=vec3(uCam.x,H(uCam.xz)+uCam.y,uCam.z);
 vec3 rd=normalize(uv.x*uu+uv.y*vv+1.6*f);
 float sd=dot(rd,uSun);
 vec3 col=stars(gl_FragCoord.xy/uRes)*.9;
 if(uLit>0.){col+=vec3(1.,.82,.5)*(.55*pow(max(sd,0.),180.)+.25*pow(max(sd,0.),14.))+vec3(1.)*smoothstep(.9996,.9999,sd);}
 float t=.05;bool hit=false;
 for(int i=0;i<120;i++){vec3 p=ro+rd*t;float hh=p.y-H(p.xz);if(hh<.0015*t){hit=true;break;}t+=max(.012,hh*.55);if(t>60.)break;}
 if(hit){
  vec3 p=ro+rd*t;float e=.003*t+.0008;
  vec3 n=normalize(vec3(H(p.xz-vec2(e,0))-H(p.xz+vec2(e,0)),2.*e,H(p.xz-vec2(0,e))-H(p.xz+vec2(0,e))));
  float sh=1.;float tt=.03;
  if(uLit>0.){for(int i=0;i<64;i++){vec3 q=p+n*.004+uSun*tt;float hh=q.y-H(q.xz);sh=min(sh,10.*hh/tt);tt+=clamp(hh*.8,.04,1.1);if(sh<.001||tt>40.)break;}}
  sh=clamp(sh,0.,1.);
  float dif=max(dot(n,uSun),0.)*sh*uLit;
  float g=.5+.1*vn2(p.xz*9.)+.08*vn2(p.xz*40.);
  vec3 alb=vec3(g,g*.975,g*.94);
  // Night: a little earthshine keeps the relief readable instead of a black screen.
  vec3 c=alb*(dif*2.1+.035+(1.-uLit)*.045)+vec3(.0,.005,.012);
  col=mix(c,vec3(.004,.006,.01),smoothstep(30.,60.,t));
 }
 o=vec4(col,1.);}`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error')
  return s
}

/** Project a sky direction (azimuth, elevation in degrees) onto the flyover camera. Null when it is behind or off screen. */
function place(az: number, el: number, yaw: number, pitch: number, w: number, h: number) {
  const f: V3 = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)]
  const uu = norm(cross(f, [0, 1, 0]))
  const vv = cross(uu, f)
  const A = az * D2R
  const E = el * D2R
  const dir: V3 = [Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A)]
  const zf = dot(dir, f)
  if (zf <= 0.05) return null
  const x = w / 2 + ((1.6 * dot(dir, uu)) / zf) * 0.5 * h
  const y = h / 2 - ((1.6 * dot(dir, vv)) / zf) * 0.5 * h
  return x < 20 || x > w - 20 || y < 130 || y > h - 200 ? null : { x, y }
}

/** Cinematic terrain flyover of the selected region, with the real Sun and Earth directions. */
export default function Flyover({ site, day, mast, low, tour }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const sunTag = useRef<HTMLDivElement>(null)
  const earthTag = useRef<HTMLDivElement>(null)
  const props = useRef({ site, day, mast, low, tour })
  const [failed] = useState(() => !document.createElement('canvas').getContext('webgl2'))
  // The render loop reads the latest props from a ref, so a new day or region never restarts the GL setup.
  useEffect(() => {
    props.current = { site, day, mast, low, tour }
  })

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) return
    let prog: WebGLProgram
    try {
      prog = gl.createProgram()
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS))
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS))
      gl.linkProgram(prog)
    } catch (err) {
      console.error('Terrain flyover shader failed', err)
      return
    }
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.useProgram(prog)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < (props.current.tour ? 50 : 90)) return
      last = now
      const { site: si, day: d, mast: m, low: lo, tour: tr } = props.current
      const s = SITES[si]
      const b = bodiesAt(d)
      const sp = azEl(s, b.sun)
      const ep = azEl(s, b.earth, DIST_EM)
      // Real LOLA horizon at this mast height, same rule as the Site charts (Sun counted by its upper edge).
      const lit = sp.el + SUN_EDGE_DEG > maskAt(s, sp.az, m)
      const earthUp = ep.el > maskAt(s, ep.az, m)
      // The real Sun is only a few degrees high: raise it for the shader so relief stays readable. Labels keep the true value.
      const sunVis = clamp(0.9 + 2.4 * Math.max(sp.el, 0), 0.9, 10) * D2R
      const sa = sp.az * D2R
      const sun: V3 = [Math.cos(sunVis) * Math.sin(sa), Math.sin(sunVis), Math.cos(sunVis) * Math.cos(sa)]
      const clock = reduce ? 0 : now / 1000
      let yaw: number
      let pitch: number
      let cam: V3
      if (!lo) {
        const a = sa + 1.25 + (tr ? clock * 0.06 : Math.sin(clock * 0.05) * 0.12)
        yaw = a + Math.PI
        pitch = -0.32
        cam = [Math.sin(a) * 4.6, 1.5, Math.cos(a) * 4.6]
      } else {
        yaw = sa + (tr ? Math.sin(clock * 0.12) * 0.28 : Math.sin(clock * 0.06) * 0.1)
        pitch = 0.03
        cam = [0, 0.11, 0]
      }
      const dpr = Math.min(devicePixelRatio || 1, 1.5) * 0.6
      const W = Math.max(2, Math.round(cv.clientWidth * dpr))
      const H = Math.max(2, Math.round(cv.clientHeight * dpr))
      if (cv.width !== W || cv.height !== H) {
        cv.width = W
        cv.height = H
      }
      gl.viewport(0, 0, W, H)
      gl.uniform2f(U('uRes'), W, H)
      gl.uniform3fv(U('uCam'), cam)
      gl.uniform3fv(U('uSun'), sun)
      gl.uniform1f(U('uYaw'), yaw)
      gl.uniform1f(U('uPitch'), pitch)
      gl.uniform1f(U('uSeed'), si + 1)
      gl.uniform1f(U('uLit'), lit ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      const cw = cv.clientWidth
      const ch = cv.clientHeight
      const tags: [HTMLDivElement | null, { x: number; y: number } | null, string][] = [
        [sunTag.current, place(sp.az, sunVis / D2R, yaw, pitch, cw, ch), lit ? `Sun · ${sp.el.toFixed(1)}° above horizon` : 'Sun · below horizon'],
        [earthTag.current, place(ep.az, Math.max(ep.el, 0.5), yaw, pitch, cw, ch), earthUp ? `Earth · ${ep.el.toFixed(1)}° · link possible` : 'Earth · below horizon'],
      ]
      for (const [el, p, text] of tags) {
        if (!el) continue
        el.style.display = p ? 'flex' : 'none'
        if (p) {
          el.style.left = `${p.x}px`
          el.style.top = `${p.y}px`
          const label = el.lastElementChild
          if (label && label.textContent !== text) label.textContent = text
        }
      }
    }
    raf = requestAnimationFrame(frame)
    // Free the GL objects but keep the context: React runs effects twice in development, and a lost context cannot be reused.
    return () => {
      cancelAnimationFrame(raf)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
    }
  }, [])

  if (failed) {
    return (
      <div className="grid size-full place-items-center bg-black p-8 text-center text-dim">
        The terrain flyover needs WebGL 2. Switch to Panorama or Polar to see the sky from this site.
      </div>
    )
  }
  const tag = 'pointer-events-none absolute z-10 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center [text-shadow:0_1px_10px_#000]'
  const label = 'absolute top-full mt-2.5 whitespace-nowrap text-xs font-medium uppercase tracking-[0.1em]'
  return (
    <div className="relative size-full bg-black">
      <canvas ref={canvas} className="block size-full" role="img" aria-label={`Terrain flyover of ${SITES[site].name}, lit by the Sun at its current height above the horizon`} />
      <div ref={sunTag} className={tag}>
        <i className="block size-4 rounded-full bg-sun" />
        <span className={`${label} text-sun`} />
      </div>
      <div ref={earthTag} className={tag}>
        <i className="block size-3 rounded-full bg-earth" />
        <span className={`${label} text-earth`} />
      </div>
    </div>
  )
}
