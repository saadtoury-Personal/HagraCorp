import Term from './Term'

export default function Field({ id, label, value, out, ...range }: { id: string; label: string; value: number; out: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const { onChange, ...rest } = range
  return (
    <div className="mt-6">
      <div className="flex justify-between">
        <label htmlFor={id} className="lab">
          <Term>{label}</Term>
        </label>
        <output htmlFor={id} className="font-medium">
          {out}
        </output>
      </div>
      <input id={id} type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} {...rest} />
    </div>
  )
}
