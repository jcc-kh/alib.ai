import type { TimelineEvent } from '../api'
import { PEOPLE, personColor, personName } from '../mock/data'
import { caseMinutes } from '../lib/format'
import { GAP_STYLE } from './LocationLanes'

const W = 1100
const LABEL = 84
const ROW = 58
const TOP = 26
const DAYS = 7
const DAY_W = (W - LABEL - 10) / DAYS

const x = (iso: string) => LABEL + (caseMinutes(iso) / 1440) * DAY_W
const rowY = (owner: string) => TOP + PEOPLE.findIndex((p) => p.person_id === owner) * ROW + ROW / 2

export default function WeekTimeline({
  events,
  highlight,
  onPick,
}: {
  events: TimelineEvent[]
  highlight?: string | null
  onPick?: (findingId: string) => void
}) {
  const H = TOP + PEOPLE.length * ROW + 8
  const dim = (e: TimelineEvent) => (highlight && e.finding_id !== highlight ? 0.18 : 1)
  const click = (e: TimelineEvent) => e.finding_id && onPick?.(e.finding_id)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
        {/* day columns */}
        {Array.from({ length: DAYS }, (_, d) => (
          <g key={d}>
            <line x1={LABEL + d * DAY_W} x2={LABEL + d * DAY_W} y1={TOP - 6} y2={H - 8} stroke="#2a2826" />
            <text x={LABEL + d * DAY_W + 8} y={14} fontSize={11} fill="#6f6a63">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]} {13 + d} Apr
            </text>
            {/* night shading 00:00–06:00 */}
            <rect x={LABEL + d * DAY_W} y={TOP - 6} width={DAY_W * 0.25} height={H - TOP} fill="#ffffff" opacity={0.018} />
          </g>
        ))}
        {/* rows */}
        {PEOPLE.map((p) => (
          <g key={p.person_id}>
            <text x={0} y={rowY(p.person_id) + 4} fontSize={12} fill={p.color}>
              {personName(p.person_id)}
            </text>
            <line x1={LABEL} x2={W - 10} y1={rowY(p.person_id)} y2={rowY(p.person_id)} stroke="#2a2826" strokeDasharray="2 4" />
          </g>
        ))}

        {/* intervals first, markers on top */}
        {events
          .filter((e) => e.end)
          .map((e) => {
            const y = rowY(e.owner)
            const w = Math.max(4, x(e.end!) - x(e.t))
            const fill = e.kind === 'meeting' ? '#e8a33d' : e.kind === 'power_off' ? '#4a4642' : personColor(e.owner)
            if (e.kind === 'gap') {
              const gs = GAP_STYLE[e.gap_type!]
              const raised = !!e.finding_id
              return (
                <g key={e.id} opacity={dim(e)} onClick={() => click(e)} className={raised ? 'cursor-pointer' : ''}>
                  <title>{e.label}</title>
                  <rect x={x(e.t)} y={y - 11} width={w} height={22} rx={3} fill={`url(#wk-hatch-${e.gap_type})`} stroke={gs.color} strokeWidth={raised ? 1.2 : 0.5} opacity={raised ? 1 : 0.55} />
                </g>
              )
            }
            return (
              <g key={e.id} opacity={dim(e)} onClick={() => click(e)} className={e.finding_id ? 'cursor-pointer' : ''}>
                <title>{e.label}</title>
                <rect x={x(e.t)} y={y - (e.kind === 'power_off' ? 5 : 8)} width={w} height={e.kind === 'power_off' ? 10 : 16} rx={3} fill={fill} opacity={e.kind === 'location' ? 0.55 : 0.95} />
                {e.kind === 'meeting' && e.link_to && <line x1={x(e.t) + w / 2} x2={x(e.t) + w / 2} y1={y + 8} y2={rowY(e.link_to) - 8} stroke="#e8a33d" strokeWidth={1.2} strokeDasharray="3 3" />}
              </g>
            )
          })}
        {events
          .filter((e) => !e.end)
          .map((e) => {
            const y = rowY(e.owner)
            const cx = x(e.t)
            return (
              <g key={e.id} opacity={dim(e)} onClick={() => click(e)} className={e.finding_id ? 'cursor-pointer' : ''}>
                <title>{e.label}</title>
                {e.kind === 'deletion' && <rect x={cx - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${cx} ${y})`} fill="#e07a5f" stroke="#101010" strokeWidth={1.5} />}
                {e.kind === 'message' && <circle cx={cx} cy={y} r={5} fill="#6b9bff" stroke="#101010" strokeWidth={1.5} />}
                {e.kind === 'trigger' && (
                  <>
                    <circle cx={cx} cy={y} r={8} fill="none" stroke="#f5f1ea" strokeWidth={1.5} />
                    <circle cx={cx} cy={y} r={3} fill="#f5f1ea" />
                  </>
                )}
                {e.kind === 'transfer' && (
                  <>
                    <circle cx={cx} cy={y} r={5.5} fill="#4fc493" stroke="#101010" strokeWidth={1.5} />
                    {e.link_to && (
                      <path
                        d={`M${cx},${y + 6} C${cx + 18},${y + 20} ${cx + 18},${rowY(e.link_to) - 20} ${cx},${rowY(e.link_to) - 6}`}
                        fill="none"
                        stroke="#4fc493"
                        strokeWidth={1.4}
                        markerEnd="url(#arrow)"
                      />
                    )}
                  </>
                )}
              </g>
            )
          })}
        <defs>
          {(Object.keys(GAP_STYLE) as (keyof typeof GAP_STYLE)[]).map((g) => (
            <pattern key={g} id={`wk-hatch-${g}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#101010" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={GAP_STYLE[g].color} strokeWidth="2.5" />
            </pattern>
          ))}
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4fc493" />
          </marker>
        </defs>
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-faint">
        <Legend swatch={<span className="h-2.5 w-4 rounded-sm bg-muted/50" />} label="Location of interest" />
        <Legend swatch={<span className="h-2.5 w-4 rounded-sm bg-amber" />} label="Phones together, no contact" />
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-full bg-sage" />} label="Money transfer" />
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-full bg-azure-soft" />} label="Message" />
        <Legend swatch={<span className="h-2 w-2 rotate-45 bg-terra-soft" />} label="Thread deleted" />
        <Legend swatch={<span className="h-2.5 w-4 rounded-sm border border-terra-soft bg-[repeating-linear-gradient(45deg,#e07a5f_0_2px,transparent_2px_5px)]" />} label="No location data, phone in use" />
        <Legend swatch={<span className="h-2.5 w-4 rounded-sm border border-[#8a847c] bg-[repeating-linear-gradient(45deg,#8a847c_0_2px,transparent_2px_5px)]" />} label="No location data, powered off" />
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-full border border-fg" />} label="Audit notice" />
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {swatch}
      {label}
    </span>
  )
}
