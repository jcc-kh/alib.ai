import type { MissingOutput } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtDateTime, fmtTimeSec } from '../../lib/format'

export default function MessagesDiff({ out }: { out: MissingOutput }) {
  const cols = [out.person_a, out.person_b]
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        The thread between {personName(out.person_a)} and {personName(out.person_b)}, aligned by timestamp on both phones.{' '}
        <span className="text-terra-soft">{out.missing_count} messages</span> exist on one side only.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {cols.map((c) => (
          <div key={c} className="flex items-center gap-2 border-b border-line pb-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: personColor(c) }} />
            {personName(c)}'s phone
          </div>
        ))}
        {out.items.map((it, i) =>
          [it.on_a, it.on_b].map((id, side) => {
            const outgoing = it.from === cols[side]
            return id ? (
              <div key={`${i}-${side}`} className={`rounded-xl px-3 py-2.5 text-sm ${it.channel === 'call' ? 'border border-line text-muted italic' : outgoing ? 'bg-azure/25 text-fg' : 'bg-raised text-fg'}`}>
                <div className="mb-1 flex justify-between text-[10.5px] text-faint">
                  <span>{it.channel === 'call' ? 'Call · ' : ''}{outgoing ? `to ${personName(it.to)}` : `from ${personName(it.from)}`}</span>
                  <span>{fmtDateTime(it.t)}:{fmtTimeSec(it.t).slice(-2)}</span>
                </div>
                {it.body}
                <div className="mt-1 font-mono text-[10px] text-faint">{id}</div>
              </div>
            ) : (
              <div key={`${i}-${side}`} className="grid place-items-center rounded-xl border border-dashed border-terra/60 text-xs text-terra-soft">
                Not on this phone
              </div>
            )
          }),
        )}
      </div>
      {out.deletion_events.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-xl border border-terra/40 px-4 py-3 text-sm">
          <span className="h-2 w-2 rotate-45 bg-terra-soft" />
          <span className="text-muted">
            {personName(d.device_owner)}'s phone deleted its thread with {personName(d.counterpart)}'s number on <span className="text-fg">{fmtDateTime(d.t)}</span>
          </span>
          <span className="ml-auto font-mono text-[10px] text-faint">{d.id}</span>
        </div>
      ))}
    </div>
  )
}
