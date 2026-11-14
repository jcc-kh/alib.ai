import type { SyncOutput } from '../../api'
import { PEOPLE, personColor, personName } from '../../mock/data'
import { caseMinutes, fmtTime } from '../../lib/format'

const W = 640
const LABEL = 64
const ROW = 46

export default function SyncTimeline({ out }: { out: SyncOutput }) {
  const t0 = caseMinutes(out.view.start)
  const t1 = caseMinutes(out.view.end)
  const x = (iso: string) => LABEL + ((caseMinutes(iso) - t0) / (t1 - t0)) * (W - LABEL - 12)
  const rows = PEOPLE.map((p) => p.person_id) // Amy included as a contrast row
  const H = rows.length * ROW + 34
  const ticks: string[] = []
  for (let m = Math.ceil(t0 / 60) * 60; m <= t1; m += 60) {
    const h = Math.floor((m % 1440) / 60)
    ticks.push(`${out.view.start.slice(0, 11)}${String(h).padStart(2, '0')}:00:00-04:00`)
  }

  return (
    <div className="space-y-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <rect x={x(out.window.start)} y={0} width={x(out.window.end) - x(out.window.start)} height={rows.length * ROW} fill="var(--serious)" opacity={0.14} />
        <text x={x(out.window.start) + 4} y={11} fontSize={9.5} fill="var(--serious)">
          {out.window.minutes}-minute window
        </text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={rows.length * ROW} stroke="var(--line)" />
            <text x={x(t)} y={rows.length * ROW + 16} fontSize={9.5} textAnchor="middle" fill="var(--ink-3)">
              {fmtTime(t)}
            </text>
          </g>
        ))}
        {rows.map((owner, r) => {
          const y = r * ROW + ROW / 2 + 6
          const evs = out.events.filter((e) => e.device_owner === owner)
          const off = evs.find((e) => e.event_type === 'power_off')
          const on = evs.find((e) => e.event_type === 'power_on')
          return (
            <g key={owner}>
              <text x={0} y={y + 4} fontSize={12} fill={personColor(owner)}>
                {personName(owner)}
              </text>
              <line x1={LABEL} x2={W - 12} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
              {off && (
                <g>
                  <rect x={x(off.t)} y={y - 6} width={(on ? x(on.t) : W - 12) - x(off.t)} height={12} rx={3} fill="var(--off)" />
                  <text x={x(off.t) + 6} y={y + 3.5} fontSize={9} fill="var(--ink-2)">
                    off {fmtTime(off.t)}–{on ? fmtTime(on.t) : '…'}
                  </text>
                </g>
              )}
              {evs
                .filter((e) => e.event_type === 'thread_deleted')
                .map((e) => (
                  <g key={e.id}>
                    <title>{`${fmtTime(e.t)} thread deleted: ${e.detail} (${e.id})`}</title>
                    <rect x={x(e.t) - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x(e.t)} ${y})`} fill="var(--serious)" stroke="var(--surface)" strokeWidth={1.5} />
                  </g>
                ))}
              {out.trigger && out.trigger.device_owner === owner && (
                <g>
                  <title>{`${fmtTime(out.trigger.t)} ${out.trigger.from_label}: ${out.trigger.body}`}</title>
                  <circle cx={x(out.trigger.t)} cy={y} r={8} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
                  <circle cx={x(out.trigger.t)} cy={y} r={3} fill="var(--ink)" />
                </g>
              )}
              {evs.length === 0 && (
                <text x={LABEL + 6} y={y - 7} fontSize={9.5} fill="var(--ink-3)">
                  no deletions or power-offs
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-5 text-xs text-faint">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border border-fg" /> audit notice</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rotate-45 bg-terra-soft" /> thread deleted</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[var(--off)]" /> powered off</span>
      </div>
      {out.trigger && (
        <blockquote className="border-l-2 border-fg/60 pl-4">
          <div className="text-xs text-faint">
            Paul's phone · {fmtTime(out.trigger.t)} · from {out.trigger.from_label} · {out.trigger.minutes_before_window} min before the window
          </div>
          <p className="mt-1 font-serif text-lg leading-snug text-fg">“{out.trigger.body}”</p>
        </blockquote>
      )}
    </div>
  )
}
