import type { GapOutput } from '../../api'
import { personName } from '../../mock/data'
import { SEGMENTS } from '../../mock/segments'
import { caseMinutes, fmtDate, fmtTime } from '../../lib/format'
import LocationLanes, { GAP_STYLE } from '../LocationLanes'

export default function GapView({ out }: { out: GapOutput }) {
  const g = GAP_STYLE[out.gap_type]
  const t0 = caseMinutes(out.start) - 4 * 60
  const t1 = caseMinutes(out.end) + 4 * 60
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line p-4">
        <LocationLanes
          segments={SEGMENTS}
          people={[out.person]}
          t0={t0}
          t1={t1}
          rowH={70}
          width={680}
          markers={out.activity.map((a) => ({ person: out.person, t: a.t, label: `${fmtTime(a.t)} ${a.label}`, color: a.table === 'transactions' ? 'var(--good)' : 'var(--accent)' }))}
        />
      </div>
      <div className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line">
        {[
          ['No location data', `${fmtTime(out.start)}–${fmtTime(out.end)}`],
          ['Length', `${out.minutes} min`],
          ['Gap type', out.gap_type],
        ].map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <div className="text-[11px] text-faint">{k}</div>
            <div className="font-serif text-2xl" style={{ color: k === 'Gap type' ? g.color : undefined }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 text-xs text-faint">
          Activity on {personName(out.person)}'s phone inside the gap ({fmtDate(out.start)})
        </div>
        <div className="divide-y divide-line rounded-xl border border-line">
          {out.activity.length === 0 && <div className="px-4 py-3 text-sm text-faint">None. Nothing was sent, received or paid during the gap.</div>}
          {out.activity.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-4 py-3 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ background: a.table === 'transactions' ? 'var(--good)' : 'var(--accent)' }} />
              <span className="w-12 tabular-nums text-fg">{fmtTime(a.t)}</span>
              <span className="text-muted">{a.label}</span>
              <span className="ml-auto font-mono text-[10.5px] text-faint">{a.id}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="border-l-2 border-line-strong pl-4 text-sm leading-relaxed text-muted">
        Reported as <span className="text-fg">no location data</span>, not as proof of intent. Phones lose location for ordinary reasons. A gap is raised by
        default only when the phone was clearly in use during it ({g.label === 'location_off' ? 'as here' : 'not the case here'}), or when it overlaps another
        signal.
      </p>
    </div>
  )
}
