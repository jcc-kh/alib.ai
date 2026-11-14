import type { HostilityOutput, LastContactsOutput } from '../../api'
import { personName } from '../../mock/data'
import { fmtDate, fmtTime } from '../../lib/format'
import Portrait from '../Portrait'

/** Posts by one account about another, each with its classifier score against the threshold. */
export function HostilityList({ out }: { out: HostilityOutput }) {
  return (
    <div className="space-y-4">
      {out.context && (
        <div className="rounded-xl border border-line px-4 py-3 text-sm">
          <div className="text-[11px] text-faint">Context · {fmtDate(out.context.t)} {fmtTime(out.context.t)}</div>
          <div className="text-fg">{out.context.label}</div>
        </div>
      )}
      <div className="divide-y divide-line rounded-xl border border-line">
        {out.items.map((i) => {
          const over = i.score >= out.threshold
          return (
            <div key={i.id} className="flex items-start gap-3 px-4 py-3">
              <Portrait id={out.actor} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-faint">
                  {fmtDate(i.t)} {fmtTime(i.t)} · {i.kind} · {i.where}
                </div>
                <div className="text-sm text-fg">“{i.text}”</div>
              </div>
              <div className="w-28 shrink-0 text-right">
                <div className="tnum text-sm" style={{ color: over ? 'var(--serious)' : 'var(--ink-3)' }}>
                  {over ? '▲ ' : ''}
                  {i.score.toFixed(2)}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full" style={{ width: `${i.score * 100}%`, background: over ? 'var(--serious)' : 'var(--ink-3)' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="border-l-2 border-line-strong pl-4 text-sm leading-relaxed text-muted">
        Scored by {out.model}; flagged at ≥ {out.threshold}. Hostile posts point to tension, not to who was where. Always read them next to the presence check.
      </p>
    </div>
  )
}

/** The victim's last messages and calls, and whether each still exists on the other phone. */
export function LastContactsList({ out }: { out: LastContactsOutput }) {
  return (
    <div className="space-y-4">
      <div className="divide-y divide-line rounded-xl border border-line">
        {out.items.map((i) => (
          <div key={i.id} className={`flex items-start gap-3 px-4 py-2.5 ${i.id === out.last_active.id ? 'bg-sunken' : ''}`}>
            <span className="w-12 shrink-0 pt-0.5 tabular-nums text-sm text-fg">{fmtTime(i.t)}</span>
            {i.counterpart !== 'other' ? <Portrait id={i.counterpart} size={22} /> : <span className="h-[22px] w-[22px]" />}
            <div className="min-w-0 flex-1 text-sm">
              <div className="text-muted">
                {i.direction === 'out' ? '→' : '←'} {i.table === 'calls' ? i.label : `${i.direction === 'out' ? 'to' : 'from'} ${i.counterpart === 'other' ? 'other' : personName(i.counterpart)}`}
                {i.id === out.last_active.id && <span className="ml-2 text-[11px] text-accent">last outgoing activity</span>}
              </div>
              {i.body && <div className="text-fg">“{i.body}”</div>}
            </div>
            <span className="shrink-0 text-[11px]" style={{ color: i.on_counterpart === 'deleted' ? 'var(--serious)' : 'var(--ink-3)' }}>
              {i.on_counterpart === 'deleted' ? 'deleted on their phone' : i.on_counterpart === 'present' ? 'on both phones' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
