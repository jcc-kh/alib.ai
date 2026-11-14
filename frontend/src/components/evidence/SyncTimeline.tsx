import type { SyncOutput } from '../../api'
import { PEOPLE, personColor, personName } from '../../mock/data'
import { caseMinutes, fmtTime } from '../../lib/format'

const W = 480
const LABEL = 56
const ROW = 34

export default function SyncTimeline({ out }: { out: SyncOutput }) {
  const t0 = caseMinutes(out.view.start)
  const t1 = caseMinutes(out.view.end)
  const x = (iso: string) => LABEL + ((caseMinutes(iso) - t0) / (t1 - t0)) * (W - LABEL - 8)
  const rows = PEOPLE.map((p) => p.person_id) // include Amy as a contrast row
  const H = rows.length * ROW + 30
  const ticks: string[] = []
  for (let m = Math.ceil(t0 / 30) * 30; m <= t1; m += 30) {
    const h = Math.floor((m % 1440) / 60)
    const mi = m % 60
    ticks.push(`${out.view.start.slice(0, 11)}${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00-04:00`)
  }

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* shared window */}
        <rect x={x(out.window.start)} y={0} width={x(out.window.end) - x(out.window.start)} height={rows.length * ROW} fill="#fee2e2" />
        <text x={x(out.window.start) + 3} y={10} fontSize={8} fill="#b91c1c" fontWeight={600}>
          {out.window.minutes}-min window
        </text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={rows.length * ROW} stroke="#e2e8f0" />
            <text x={x(t)} y={rows.length * ROW + 12} fontSize={8} textAnchor={x(t) > W - 20 ? 'end' : 'middle'} fill="#64748b">
              {fmtTime(t)}
            </text>
          </g>
        ))}
        {rows.map((owner, r) => {
          const y = r * ROW + ROW / 2
          const evs = out.events.filter((e) => e.device_owner === owner)
          const off = evs.find((e) => e.event_type === 'power_off')
          const on = evs.find((e) => e.event_type === 'power_on')
          return (
            <g key={owner}>
              <text x={0} y={y + 3} fontSize={10} fontWeight={600} fill={personColor(owner)}>
                {personName(owner)}
              </text>
              <line x1={LABEL} x2={W - 8} y1={y} y2={y} stroke="#cbd5e1" />
              {off && (
                <g>
                  <rect x={x(off.t)} y={y - 6} width={(on ? x(on.t) : W - 8) - x(off.t)} height={12} rx={2} fill="#334155" opacity={0.85} />
                  <text x={x(off.t) + 4} y={y + 3} fontSize={7.5} fill="#fff">
                    powered off {fmtTime(off.t)}–{on ? fmtTime(on.t) : '…'}
                  </text>
                </g>
              )}
              {evs
                .filter((e) => e.event_type === 'thread_deleted')
                .map((e) => (
                  <g key={e.id}>
                    <title>{`${fmtTime(e.t)} thread_deleted: ${e.detail} (${e.id})`}</title>
                    <rect x={x(e.t) - 4} y={y - 4} width={8} height={8} transform={`rotate(45 ${x(e.t)} ${y})`} fill="#dc2626" />
                  </g>
                ))}
              {out.trigger && out.trigger.device_owner === owner && (
                <g>
                  <title>{`${fmtTime(out.trigger.t)} ${out.trigger.from_label}: ${out.trigger.body}`}</title>
                  <circle cx={x(out.trigger.t)} cy={y} r={5} fill="#2563eb" />
                  <text x={x(out.trigger.t)} y={y - 8} fontSize={7.5} textAnchor="middle" fill="#2563eb" fontWeight={600}>
                    audit notice
                  </text>
                </g>
              )}
              {evs.length === 0 && (
                <text x={LABEL + 4} y={y - 4} fontSize={7.5} fill="#94a3b8">
                  no deletions or power-offs
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> trigger message</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rotate-45 bg-red-600" /> thread_deleted</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-4 rounded-sm bg-slate-700" /> powered off</span>
      </div>
      {out.trigger && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs">
          <div className="text-[10px] text-slate-500">
            Paul's phone · {fmtTime(out.trigger.t)} · from {out.trigger.from_label} · {out.trigger.minutes_before_window} min before the window
          </div>
          “{out.trigger.body}”
        </div>
      )}
    </div>
  )
}
