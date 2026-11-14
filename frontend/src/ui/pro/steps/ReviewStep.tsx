import { useState } from 'react'
import type { Incident, Segment } from '../../../api'
import { useCase } from '../../../state/caseStore'
import { Btn, Kpi, Panel, PersonTag, StrengthBar } from '../kit'
import { ActivityChart, AnchorWindow, PairDistance, PlaceTime } from '../charts'
import LocationLanes from '../../../components/LocationLanes'
import { SEGMENTS } from '../../../mock/segments'
import { caseMinutes, fmtDate, fmtTime } from '../../../lib/format'
import { CASE_PEOPLE } from '../../../lib/aggregates'

export default function ReviewStep({ next, open }: { next: () => void; open: (v: 'timeline' | 'activity' | 'places' | 'distance') => void }) {
  const c = useCase()
  const b = c.briefing
  const [win, setWin] = useState<[number, number] | null>(null)
  const [selSeg, setSelSeg] = useState<string | null>(null)
  if (!b) return null
  const phones = new Set(b.incidents.flatMap((i) => i.people)).size
  const raisedGaps = SEGMENTS.filter((s) => s.kind === 'gap' && s.raised).length
  const allGaps = SEGMENTS.filter((s) => s.kind === 'gap').length

  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Incidents" value={b.incidents.length} sub={`from ${b.signals_total} signals`} tone="serious" />
        <Kpi label="Anchor moment" value={`${fmtTime(b.anchors[0].start)}–${fmtTime(b.anchors[0].end)}`} sub={`${fmtDate(b.anchors[0].start)} · ${b.anchors[0].phones.length} phones`} />
        <Kpi label="Phones involved" value={`${phones} / 4`} />
        <Kpi label="Location gaps raised" value={`${raisedGaps} / ${allGaps}`} />
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Incidents" count={b.incidents.length} className="col-span-8" pad={false} sub="click to open the evidence">
          <IncidentList incidents={b.incidents} />
        </Panel>
        <Panel title="Anchor moment" className="col-span-4" sub={fmtDate(b.anchors[0].start)}>
          <AnchorWindow />
        </Panel>
      </div>

      <Panel title="Activity by phone" sub="hourly" actions={<Btn kind="ghost" onClick={() => open('activity')}>Expand</Btn>}>
        <ActivityChart />
      </Panel>

      <Panel
        title="Location timeline"
        sub="click a block to filter time at places"
        actions={
          <>
            {win && (
              <Btn
                kind="ghost"
                onClick={() => {
                  setWin(null)
                  setSelSeg(null)
                }}
              >
                Clear
              </Btn>
            )}
            <Btn kind="ghost" onClick={() => open('timeline')}>
              Expand
            </Btn>
          </>
        }
      >
        <LocationLanes
          segments={SEGMENTS}
          people={CASE_PEOPLE}
          t0={0}
          t1={7 * 1440}
          rowH={40}
          width={1400}
          selected={selSeg}
          onSelect={(s: Segment) => {
            setSelSeg(s.segment_id)
            setWin([caseMinutes(s.start), caseMinutes(s.end)])
          }}
        />
      </Panel>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Time at places" className="col-span-5" sub={win ? 'selected window' : 'hours'} actions={<Btn kind="ghost" onClick={() => open('places')}>Expand</Btn>}>
          <PlaceTime window={win} />
        </Panel>
        <Panel title="Distance between phones" className="col-span-7" sub="log scale" actions={<Btn kind="ghost" onClick={() => open('distance')}>Expand</Btn>}>
          <PairDistance />
        </Panel>
      </div>

      <div className="flex items-center justify-end gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <Btn kind="primary" onClick={next}>
          Refine with brief →
        </Btn>
      </div>
    </div>
  )
}

function IncidentList({ incidents }: { incidents: Incident[] }) {
  const c = useCase()
  return (
    <ul className="divide-y divide-line">
      {incidents.map((i) => (
        <li key={i.incident_id}>
          <button onClick={() => c.openFinding(i.findings[0])} className="grid w-full grid-cols-[1.5rem_1fr_auto] items-start gap-3 px-3 py-2.5 text-left hover:bg-sunken">
            <span className="tnum pt-px text-[12px] text-ink-3">{i.rank}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-ink">{i.title}</span>
                {i.anchor_id && <span className="rounded border border-serious px-1 text-[10px] text-serious">anchor</span>}
              </span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {i.facts.map((f) => (
                  <span key={f} className="tnum rounded bg-sunken px-1.5 py-px text-[11px] text-ink-2">
                    {f}
                  </span>
                ))}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="flex gap-1.5">
                {i.people.map((p) => (
                  <PersonTag key={p} id={p} />
                ))}
              </span>
              <span className="flex items-center gap-2 text-[11px] text-ink-3">
                <span className="tnum">{i.n_checks} {i.n_checks === 1 ? 'check' : 'checks'}</span>
                <StrengthBar v={i.strength} />
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
