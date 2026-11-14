import { useState } from 'react'
import type { Segment } from '../../../api'
import { useCase } from '../../../state/caseStore'
import LocationLanes, { GAP_STYLE } from '../../../components/LocationLanes'
import { GAP_OF, SEGMENTS } from '../../../mock/segments'
import { findingById } from '../../../mock/signals'
import { CASE_PEOPLE } from '../../../lib/aggregates'
import { caseMinutes, fmtDate, fmtTime } from '../../../lib/format'
import { Btn, Mono, Panel, PersonTag } from '../kit'
import { DwellMap } from '../charts'

const DAYS = [13, 14, 15, 16, 17, 18, 19]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function TimelineView() {
  const c = useCase()
  const [day, setDay] = useState<number | 'week'>(15)
  const [sel, setSel] = useState<Segment | null>(SEGMENTS.find((s) => s.kind === 'gap' && s.gap_type === 'location_off') ?? null)
  const [t0, t1] = day === 'week' ? [0, 7 * 1440] : [(day - 13) * 1440, (day - 12) * 1440]
  const gaps = SEGMENTS.filter((s) => s.kind === 'gap')
  const out = sel?.kind === 'gap' ? GAP_OF.get(sel.segment_id) : undefined
  return (
    <div className="space-y-3 p-4">
      <Panel
        title="Location timeline"
        sub={`4 phones · ${SEGMENTS.filter((s) => s.kind === 'stay').length} stays · ${SEGMENTS.filter((s) => s.kind === 'travel').length} travel · ${gaps.length} gaps`}
        actions={
          <div className="flex gap-1">
            <Btn kind={day === 'week' ? 'default' : 'ghost'} onClick={() => setDay('week')}>
              Week
            </Btn>
            {DAYS.map((d) => (
              <Btn key={d} kind={day === d ? 'default' : 'ghost'} onClick={() => setDay(d)}>
                {DOW[d - 13]} {d}
              </Btn>
            ))}
          </div>
        }
      >
        <LocationLanes segments={SEGMENTS} people={CASE_PEOPLE} t0={t0} t1={t1} rowH={52} width={1400} selected={sel?.segment_id} onSelect={setSel} />
        <div className="mt-2 flex gap-4 text-[11px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-ink-3/40" /> stay
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-ink-2" /> travel
          </span>
          {(Object.keys(GAP_STYLE) as (keyof typeof GAP_STYLE)[]).map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm border" style={{ borderColor: GAP_STYLE[g].color, background: `repeating-linear-gradient(45deg, ${GAP_STYLE[g].color} 0 1.5px, transparent 1.5px 4px)` }} />
              {g} · {GAP_STYLE[g].reading}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Selected segment" className="col-span-4">
          {!sel ? (
            <div className="text-[12px] text-ink-3">Click a block in the timeline.</div>
          ) : (
            <div className="space-y-2 text-[12.5px]">
              <div className="flex items-center gap-2">
                <PersonTag id={sel.person} />
                <Mono className="text-ink-3">{sel.segment_id}</Mono>
              </div>
              <div className="text-ink">
                {sel.kind === 'stay' && `Stay at ${sel.place}`}
                {sel.kind === 'travel' && `Travel ${sel.from} → ${sel.to}`}
                {sel.kind === 'gap' && out && `No location data · ${out.minutes} min`}
              </div>
              <div className="tnum text-ink-2">
                {fmtDate(out?.start ?? sel.start)} {fmtTime(out?.start ?? sel.start)}–{fmtTime(out?.end ?? sel.end)}
              </div>
              {out && (
                <>
                  <div>
                    <Mono className="text-ink">
                      {out.gap_type}
                    </Mono>{' '}
                    <span className="text-ink-2">· {GAP_STYLE[out.gap_type].reading}</span>
                  </div>
                  {out.activity.map((a) => (
                    <div key={a.id} className="tnum text-ink-2">
                      {fmtTime(a.t)} · {a.label}
                    </div>
                  ))}
                  <div className={out.raised ? 'text-serious' : 'text-ink-3'}>{out.raised ? '▲ raised' : 'not raised (no activity, no overlapping signal)'}</div>
                  {sel.finding_id && findingById(sel.finding_id) && (
                    <Btn onClick={() => c.openFinding(findingById(sel.finding_id!)!)}>Open finding</Btn>
                  )}
                </>
              )}
            </div>
          )}
        </Panel>
        <Panel title="Places in window" className="col-span-8" sub={sel ? `${fmtDate(sel.start)} ${fmtTime(sel.start)}–${fmtTime(sel.end)}` : 'whole range'}>
          <DwellMap window={sel ? [caseMinutes(sel.start), caseMinutes(sel.end)] : [t0, t1]} />
        </Panel>
      </div>

      <Panel title="Gaps ≥ 45 min" count={gaps.length} pad={false}>
        <table className="w-full text-[12px]">
          <thead className="text-left text-[11px] text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-1.5 font-medium">Phone</th>
              <th className="py-1.5 font-medium">No location data</th>
              <th className="py-1.5 text-right font-medium">Minutes</th>
              <th className="px-3 py-1.5 font-medium">Type</th>
              <th className="py-1.5 font-medium">Inside the gap</th>
              <th className="px-3 py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => {
              const o = GAP_OF.get(g.segment_id)!
              return (
                <tr
                  key={g.segment_id}
                  onClick={() => {
                    setSel(g)
                    setDay(Number(o.start.slice(8, 10)))
                  }}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-sunken ${sel?.segment_id === g.segment_id ? 'bg-sunken' : ''}`}
                >
                  <td className="px-3 py-1.5">
                    <PersonTag id={g.person} />
                  </td>
                  <td className="tnum py-1.5 text-ink-2">
                    {fmtDate(o.start)} {fmtTime(o.start)}–{fmtTime(o.end)}
                  </td>
                  <td className="tnum py-1.5 text-right">{o.minutes}</td>
                  <td className="px-3 py-1.5">
                    <Mono className="text-ink">{o.gap_type}</Mono>
                  </td>
                  <td className="py-1.5 text-ink-2">{o.activity.length ? `${o.activity.length} activity rows` : o.power_event_ids.length ? 'power events' : 'nothing'}</td>
                  <td className="px-3 py-1.5">{o.raised ? <span className="text-serious">▲ raised</span> : <span className="text-ink-3">not raised</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
