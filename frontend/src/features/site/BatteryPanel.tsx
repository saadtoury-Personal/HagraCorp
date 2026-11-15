import { useState } from 'react'
import { Tag } from '../../components/Tag'
import { fetchBattery, type Battery, type BatteryParams } from '../../lib/api'
import { dayToDate } from '../../lib/ephemeris'
import { useServerData } from '../../lib/useServerData'

// Default lander from rules.json (assumed, to be checked by the science team).
const DEFAULTS: BatteryParams = { capacityWh: 5000, loadW: 150, panelM2: 2, efficiency: 0.28, minSocPct: 20 }

const FIELDS: { k: keyof BatteryParams; label: string; unit: string; scale: number; min: number; max: number; step: number }[] = [
  { k: 'capacityWh', label: 'Battery', unit: 'kWh', scale: 1000, min: 0.5, max: 100, step: 0.5 },
  { k: 'loadW', label: 'Constant load', unit: 'W', scale: 1, min: 0, max: 2000, step: 10 },
  { k: 'panelM2', label: 'Solar panel', unit: 'm²', scale: 1, min: 0, max: 30, step: 0.5 },
  { k: 'efficiency', label: 'Panel efficiency', unit: '%', scale: 0.01, min: 1, max: 40, step: 1 },
  { k: 'minSocPct', label: 'Lowest allowed charge', unit: '%', scale: 1, min: 0, max: 90, step: 5 },
]

function Chart({ b }: { b: Battery }) {
  const W = 320
  const H = 90
  const n = b.series.length
  if (n < 2) return null
  const x = (i: number) => (i / (n - 1)) * W
  const y = (pct: number) => H - (pct / 100) * H
  const line = b.series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.socPct).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-3 w-full" role="img" aria-label={`State of charge over the stay, lowest ${b.minSocPct.toFixed(0)}%, floor ${b.params.minSocPct}%`}>
      <rect width={W} height={H} fill="#0b0e14" />
      <line x1={0} x2={W} y1={y(b.params.minSocPct)} y2={y(b.params.minSocPct)} stroke="var(--color-bad)" strokeDasharray="4 3" strokeWidth="1" />
      <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
      <text x={0} y={H + 12} fontSize="10" fill="var(--color-faint)">
        Landing
      </text>
      <text x={W} y={H + 12} fontSize="10" fill="var(--color-faint)" textAnchor="end">
        End of stay
      </text>
      <text x={W - 2} y={y(b.params.minSocPct) - 3} fontSize="10" fill="var(--color-bad)" textAnchor="end">
        floor {b.params.minSocPct}%
      </text>
    </svg>
  )
}

/** F4: hour-by-hour battery over the stay, from the server's simulation (Analysis.Battery). */
export default function BatteryPanel({ siteId, day, dur, mast }: { siteId: string; day: number; dur: number; mast: number }) {
  const [p, setP] = useState<BatteryParams>(DEFAULTS)
  const at = Math.round(day * 4) / 4
  const res = useServerData<Battery>(`${siteId}|${at}|${dur}|${mast}|${JSON.stringify(p)}`, (sig) => fetchBattery(siteId, dayToDate(at), dur, mast, p, sig))
  const b = res.data

  return (
    <section aria-label="Battery" className="mt-5 border-t border-line-soft pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="lab">Battery over the stay</span>
        {res.state === 'ok' && <Tag kind="server" />}
      </div>
      {res.state === 'offline' && <p className="mt-1 text-[13px] text-dim">The battery simulation runs on the LunarNav server, which is not reachable right now.</p>}
      {res.state === 'error' && <p className="mt-1 text-[13px] text-dim">The server could not simulate this stay.</p>}
      {res.state === 'loading' && <p className="mt-1 text-[13px] text-dim">Simulating</p>}
      {b && (
        <>
          <p className={`mt-1 text-lg font-light ${b.viable ? 'text-ok' : 'text-bad'}`}>
            {b.viable ? `The battery holds: lowest charge ${b.minSocPct.toFixed(0)}%.` : `The battery is below its floor for ${b.hoursBelowMin} h.`}
          </p>
          <Chart b={b} />
          <p className="mt-2 text-[13px] text-dim">
            Smallest battery that survives this stay: <b className="font-medium text-ink">{(b.minBatteryWhToSurvive / 1000).toFixed(1)} kWh</b>. Charge at the end: {b.endSocPct.toFixed(0)}%.
          </p>
        </>
      )}
      <details className="mt-2 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-dim hover:text-ink">
          Lander settings <Tag kind="assumed" />
        </summary>
        <div className="grid grid-cols-2 gap-3 pb-2">
          {FIELDS.map((f) => (
            <label key={f.k} className="text-[13px] text-dim">
              {f.label} ({f.unit})
              <input
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step={f.step}
                value={+(p[f.k] / f.scale).toFixed(2)}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v >= f.min && v <= f.max) setP({ ...p, [f.k]: v * f.scale })
                }}
                className="mt-1 block min-h-11 w-full border border-line bg-bg px-3 text-sm text-ink"
              />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => setP(DEFAULTS)} className="min-h-11 text-[13px] text-dim underline underline-offset-4 hover:text-ink">
          Reset to the default lander
        </button>
      </details>
    </section>
  )
}
