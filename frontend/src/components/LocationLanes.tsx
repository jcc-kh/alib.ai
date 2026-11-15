import type { GapType, PersonId, Segment } from '../api'
import { personColor, personName } from '../mock/data'
import { caseMinutes, fmtTime } from '../lib/format'

export const GAP_STYLE: Record<GapType, { color: string; label: string; reading: string }> = {
  location_off: { color: 'var(--serious)', label: 'location_off', reading: 'Phone in use while reporting no location' },
  powered_off: { color: 'var(--ink-3)', label: 'powered_off', reading: 'A power-off event covers the gap' },
  unexplained: { color: 'var(--line-strong)', label: 'unexplained', reading: 'No activity of any kind (battery, signal…)' },
}

export interface LaneMarker {
  person: PersonId
  t: string
  label: string
  color: string
}

/** One horizontal lane per person on a shared axis: stays as blocks, travel as a thin line, gaps hatched by type. */
export default function LocationLanes({
  segments,
  people,
  t0,
  t1,
  selected,
  onSelect,
  markers = [],
  rowH = 54,
  width = 1100,
  fresh = [],
}: {
  segments: Segment[]
  people: PersonId[]
  t0: number
  t1: number
  selected?: string | null
  onSelect?: (s: Segment) => void
  markers?: LaneMarker[]
  rowH?: number
  width?: number
  /** Phones just added: their lanes animate in. */
  fresh?: PersonId[]
}) {
  const LABEL = 70
  const TOP = 24
  const W = width
  const span = t1 - t0
  const x = (m: number) => LABEL + ((Math.min(Math.max(m, t0), t1) - t0) / span) * (W - LABEL - 8)
  const H = TOP + people.length * rowH + 6
  const hours = span <= 1440 ? 2 : span <= 3 * 1440 ? 6 : 24
  const ticks: number[] = []
  for (let m = Math.ceil(t0 / (hours * 60)) * hours * 60; m <= t1; m += hours * 60) ticks.push(m)
  const tickLabel = (m: number) => {
    const d = 13 + Math.floor(m / 1440)
    const hh = Math.floor((m % 1440) / 60)
    return hours >= 24 ? `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'][d - 13]} ${d}` : `${String(hh).padStart(2, '0')}:00`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
      <defs>
        {(Object.keys(GAP_STYLE) as GapType[]).map((g) => (
          <pattern key={g} id={`hatch-${g}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--surface)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke={GAP_STYLE[g].color} strokeWidth="3" />
          </pattern>
        ))}
      </defs>
      {ticks.map((m) => (
        <g key={m}>
          <line x1={x(m)} x2={x(m)} y1={TOP - 6} y2={H - 4} stroke="var(--line)" />
          <text x={x(m) + 4} y={12} fontSize={10.5} fill="var(--ink-3)">
            {tickLabel(m)}
          </text>
        </g>
      ))}
      {people.map((p, r) => {
        const y = TOP + r * rowH
        const mid = y + rowH / 2
        const segs = segments.filter((s) => s.person === p && caseMinutes(s.end) > t0 && caseMinutes(s.start) < t1)
        return (
          <g key={p} className={fresh.includes(p) ? 'row-in' : undefined}>
            <text x={0} y={mid + 4} fontSize={12.5} fill={personColor(p)}>
              {personName(p)}
            </text>
            {segs.map((s) => {
              const a = x(caseMinutes(s.start))
              const b = x(caseMinutes(s.end))
              const w = Math.max(2, b - a)
              const sel = selected === s.segment_id
              const click = () => onSelect?.(s)
              const title = s.kind === 'stay' ? `${s.place} · ${fmtTime(s.start)}–${fmtTime(s.end)}` : s.kind === 'travel' ? `Travel ${s.from} → ${s.to}` : `No location data · ${s.gap_type}${s.raised ? ' · raised' : ' · not raised'}`
              if (s.kind === 'travel')
                return (
                  <g key={s.segment_id} onClick={click} className="cursor-pointer">
                    <title>{title}</title>
                    <rect x={a} y={mid - 6} width={w} height={12} fill="transparent" />
                    <line x1={a} x2={a + w} y1={mid} y2={mid} stroke={personColor(p)} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />
                  </g>
                )
              if (s.kind === 'gap')
                return (
                  <g key={s.segment_id} onClick={click} className="cursor-pointer">
                    <title>{title}</title>
                    <rect x={a} y={y + 8} width={w} height={rowH - 16} rx={4} fill={`url(#hatch-${s.gap_type})`} stroke={sel ? 'var(--ink)' : GAP_STYLE[s.gap_type!].color} strokeWidth={sel ? 2 : s.raised ? 1.4 : 0.6} opacity={s.raised ? 1 : 0.7} />
                    {s.raised && w > 14 && <circle cx={a + w / 2} cy={y + 6} r={3} fill={GAP_STYLE[s.gap_type!].color} />}
                  </g>
                )
              return (
                <g key={s.segment_id} onClick={click} className="cursor-pointer">
                  <title>{title}</title>
                  <rect x={a} y={y + 12} width={w} height={rowH - 24} rx={4} fill={personColor(p)} opacity={sel ? 0.95 : 0.32} stroke={sel ? 'var(--ink)' : 'none'} strokeWidth={1.5} />
                  {w > 70 && (
                    <text x={a + 6} y={mid + 4} fontSize={10.5} fill="var(--ink)" style={{ pointerEvents: 'none' }}>
                      {s.place!.length * 6 > w - 10 ? s.place!.slice(0, Math.max(3, Math.floor((w - 16) / 6))) + '…' : s.place}
                    </text>
                  )}
                </g>
              )
            })}
            {markers
              .filter((m) => m.person === p)
              .map((m, i) => (
                <g key={i}>
                  <title>{m.label}</title>
                  <line x1={x(caseMinutes(m.t))} x2={x(caseMinutes(m.t))} y1={y + 4} y2={y + rowH - 4} stroke={m.color} strokeWidth={2} />
                  <circle cx={x(caseMinutes(m.t))} cy={y + 4} r={4} fill={m.color} />
                </g>
              ))}
          </g>
        )
      })}
    </svg>
  )
}
