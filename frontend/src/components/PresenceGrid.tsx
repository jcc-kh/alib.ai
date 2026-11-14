import type { PresenceOutput, PresenceStatus } from '../api'
import { personName } from '../mock/data'
import { fmtKm, fmtTime } from '../lib/format'
import Portrait from './Portrait'

export const PRESENCE_STYLE: Record<PresenceStatus, { label: string; fill: string; text: string }> = {
  scene: { label: 'At the scene', fill: 'var(--serious)', text: 'var(--surface)' },
  near: { label: 'Within 2 km', fill: 'color-mix(in srgb, var(--serious) 38%, var(--surface))', text: 'var(--ink)' },
  away: { label: 'More than 2 km away', fill: 'var(--sunken)', text: 'var(--ink-3)' },
  no_data: { label: 'No location data', fill: 'transparent', text: 'var(--ink-3)' },
}

/**
 * Alibi grid: one row per phone, one cell per 10-minute slot of the time-of-death window.
 * Every cell is one location row (or its absence), with the distance to the scene on hover.
 */
export default function PresenceGrid({ out, onPick, compact = false }: { out: PresenceOutput; onPick?: (rowId: string) => void; compact?: boolean }) {
  const slots = out.phones[0].slots
  const cell = compact ? 22 : 30
  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {slots.map((s, i) => (
              <th key={s.t} className="text-left align-bottom text-[10.5px] font-normal text-ink-3" style={{ width: cell }}>
                {i % 3 === 0 ? fmtTime(s.t) : ''}
              </th>
            ))}
            <th className="pl-3 text-left text-[10.5px] font-normal text-ink-3">Closest</th>
          </tr>
        </thead>
        <tbody>
          {out.phones.map((p) => (
            <tr key={p.person}>
              <td className="pr-3">
                <Portrait id={p.person} size={compact ? 22 : 28} label />
              </td>
              {p.slots.map((s) => {
                const st = PRESENCE_STYLE[s.status]
                const title = s.status === 'no_data' ? `${fmtTime(s.t)} · no location data${s.gap_type ? ` (${s.gap_type.replace('_', ' ')})` : ''}` : `${fmtTime(s.t)} · ${fmtKm(s.distance_m!)} from ${out.scene.name}`
                return (
                  <td key={s.t} className="p-0">
                    <button
                      title={title}
                      onClick={() => s.row_id && onPick?.(s.row_id)}
                      className="block rounded-[4px]"
                      style={{
                        width: cell,
                        height: compact ? 18 : 24,
                        background: s.status === 'no_data' ? 'repeating-linear-gradient(45deg, var(--line-strong) 0 1.5px, transparent 1.5px 5px)' : st.fill,
                        border: s.status === 'no_data' ? '1px solid var(--line-strong)' : '1px solid transparent',
                      }}
                    />
                  </td>
                )
              })}
              <td className="tnum whitespace-nowrap pl-3 text-[12px] text-ink-2">
                {p.counts.scene ? `at the scene from ${fmtTime(p.slots.find((x) => x.status === 'scene')!.t)}` : p.closest_m === null ? '—' : `${fmtKm(p.closest_m)} at ${fmtTime(p.closest_t!)}`}
                {p.counts.no_data > 0 && <span className="ml-2 text-ink-3">· {p.counts.no_data} slots no data</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-ink-2">
        {(Object.keys(PRESENCE_STYLE) as PresenceStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-4 rounded-sm"
              style={{ background: k === 'no_data' ? 'repeating-linear-gradient(45deg, var(--line-strong) 0 1.5px, transparent 1.5px 4px)' : PRESENCE_STYLE[k].fill, border: k === 'away' || k === 'no_data' ? '1px solid var(--line-strong)' : undefined }}
            />
            {PRESENCE_STYLE[k].label}
          </span>
        ))}
        <span className="text-ink-3">· one cell = one 10-minute location fix · {personName(out.phones[0].person)}'s row is the victim's phone</span>
      </div>
    </div>
  )
}
