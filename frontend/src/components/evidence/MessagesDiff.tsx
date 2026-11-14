import type { MissingOutput } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtDateTime, fmtTimeSec } from '../../lib/format'

export default function MessagesDiff({ out }: { out: MissingOutput }) {
  const cols = [out.person_a, out.person_b]
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Thread between {personName(out.person_a)} and {personName(out.person_b)}, aligned by timestamp (tolerance {out.tolerance_s} s).{' '}
        <b className="text-red-700">{out.missing_count} missing</b> from one phone.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cols.map((c) => (
          <div key={c} className="flex items-center gap-1.5 border-b border-slate-200 pb-1 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full" style={{ background: personColor(c) }} />
            {personName(c)}'s phone
          </div>
        ))}
        {out.items.map((it, i) =>
          [it.on_a, it.on_b].map((id, side) => {
            const outgoing = it.from === cols[side]
            return id ? (
              <div key={`${i}-${side}`} className={`rounded-lg p-2 text-xs ${it.channel === 'call' ? 'bg-slate-100 italic' : outgoing ? 'bg-blue-50' : 'bg-white ring-1 ring-slate-200'}`}>
                <div className="mb-0.5 flex justify-between text-[10px] text-slate-500">
                  <span>
                    {it.channel === 'call' ? '📞 ' : ''}
                    {outgoing ? `to ${personName(it.to)}` : `from ${personName(it.from)}`}
                  </span>
                  <span>{fmtDateTime(it.t)}:{fmtTimeSec(it.t).slice(-2)}</span>
                </div>
                {it.body}
                <div className="mt-0.5 font-mono text-[9.5px] text-slate-400">{id}</div>
              </div>
            ) : (
              <div key={`${i}-${side}`} className="grid place-items-center rounded-lg border-2 border-dashed border-red-300 bg-red-50/50 p-2 text-[11px] font-medium text-red-700">
                Not on this phone
              </div>
            )
          }),
        )}
      </div>
      {out.deletion_events.map((d) => (
        <div key={d.id} className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs">
          <b>{personName(d.device_owner)}'s phone</b>: <span className="font-mono">thread_deleted</span> for {personName(d.counterpart)}'s number at{' '}
          {fmtDateTime(d.t)} <span className="font-mono text-[10px] text-slate-500">({d.id})</span>
        </div>
      ))}
    </div>
  )
}
