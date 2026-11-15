import { useMemo } from 'react'
import { useCase } from '../../state/caseStore'
import { scorecard } from '../../mock/answerKey'
import { SCENARIOS, type ScenarioId } from '../../mock/findings'
import { personName } from '../../mock/data'
import { Mono, Panel } from './kit'

/** Sweep graded against the synthetic case's answer key: plants recovered, decoys wrongly raised. */
export default function Scorecard() {
  const c = useCase()
  const s = useMemo(() => scorecard(c.board), [c.board])
  const needs = (sid: ScenarioId) => SCENARIOS[sid].people.filter((p) => !c.loaded.includes(p))
  const rec = s.plants.filter((p) => p.recovered).length
  const raised = s.decoys.filter((d) => d.raised).length
  return (
    <Panel title="Scorecard" sub="vs answer key">
      <div className="grid grid-cols-2 gap-3">
        <Stat value={`${rec} / ${s.plants.length}`} label="plants recovered" ok={s.plants.every((p) => p.recovered || needs(p.sid).length > 0)} />
        <Stat value={`${raised} / ${s.decoys.length}`} label="decoys raised" ok={raised === 0} />
      </div>
      <ul className="mt-3 space-y-1 text-[12px]">
        {s.plants.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={p.recovered ? 'text-good' : needs(p.sid).length ? 'text-ink-3' : 'text-serious'}>{p.recovered ? '✓' : needs(p.sid).length ? '○' : '✕'}</span>
            <span className="text-ink">{p.label}</span>
            <Mono className="ml-auto text-ink-3">{p.incident ? `insight ${c.board.incidents.find((i) => i.incident_id === p.incident)?.rank}` : needs(p.sid).length ? `needs ${needs(p.sid).map(personName).join(', ')}` : 'missed'}</Mono>
          </li>
        ))}
        {s.decoys.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className={d.raised ? 'text-serious' : 'text-good'}>{d.raised ? '✕' : '✓'}</span>
            <span className="text-ink-2">Decoy: {d.label}</span>
            <span className="ml-auto text-[11px] text-ink-3">{d.raised ? 'raised' : 'not raised'}</span>
          </li>
        ))}
      </ul>
      {s.unexplained.length > 0 && <div className="mt-2 text-[11px] text-serious">Insights with no plant: {s.unexplained.join(', ')}</div>}
    </Panel>
  )
}

function Stat({ value, label, ok }: { value: string; label: string; ok: boolean }) {
  return (
    <div className="rounded-md bg-sunken px-2.5 py-2">
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-[20px] font-semibold text-ink">{value}</span>
        <span className={`text-[12px] ${ok ? 'text-good' : 'text-serious'}`}>{ok ? '✓' : '▲'}</span>
      </div>
      <div className="text-[11px] text-ink-2">{label}</div>
    </div>
  )
}
