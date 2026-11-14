import type { CoverageOutput } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtDateTime } from '../../lib/format'

export default function CoverageView({ out }: { out: CoverageOutput }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted">
        Alib.ai answered <span className="text-fg">cannot tell</span> instead of guessing. The item refers to a period outside what the phones hold, so no check
        can confirm or contradict it.
      </p>
      <div className="space-y-3">
        {out.devices.map((d) => (
          <div key={d.owner} className="grid grid-cols-[5rem_1fr] items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-2 text-fg">
              <span className="h-2 w-2 rounded-full" style={{ background: personColor(d.owner) }} />
              {personName(d.owner)}
            </span>
            <div className="relative h-7 rounded bg-panel">
              <div className="absolute inset-y-0 left-[46%] right-[4%] flex items-center justify-between rounded px-2 text-[10.5px] text-canvas" style={{ background: personColor(d.owner) }}>
                <span>{fmtDateTime(d.first.t)}</span>
                <span>{fmtDateTime(d.last.t)}</span>
              </div>
              <span className="absolute inset-y-0 left-2 flex items-center text-[10.5px] text-faint">earlier: no data</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-faint">Next step: request carrier or bank records for the period the item refers to.</p>
    </div>
  )
}
