import { useProgress } from '@react-three/drei'

/** Shown over a 3D scene while its models and textures download, so the first screen is never silently empty. */
export default function SceneLoading({ what }: { what: string }) {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[6] grid place-items-center" role="status" aria-live="polite">
      <div className="w-56 text-center text-xs font-medium uppercase tracking-[0.16em] text-dim">
        Loading {what}
        <div className="mt-3 h-px w-full bg-line">
          <i className="block h-px bg-ink transition-[width] duration-300" style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  )
}
