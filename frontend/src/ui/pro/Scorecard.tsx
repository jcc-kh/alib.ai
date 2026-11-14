import { useMemo } from 'react'
import { useCase } from '../../state/caseStore'
import { scorecard } from '../../mock/answerKey'
import { Mono, Panel } from './kit'

/** Sweep graded against the synthetic case's answer key: plants recovered, decoys wrongly raised. */
export default function Scorecard() {
  const c = useCase()
  const s = useMemo(() => (c.briefing ? scorecard(c.briefing) : null), [c.briefing])
  if (!s) return null
  if (c.range[0] > 13 || c.range[1] < 19)
    return (
      <Panel title="Scorecard" sub="vs answer key">
        <div className="text-[12px] text-ink-3">The answer key covers 13–19 Apr. Analyse the whole week to grade the run.</div>
      </Panel>
    )
  const rec = s.plants.filter((p) => p.recovered).length
  const raised = s.decoys.filter((d) => d.raised).length
  return (
    <Panel title="Scorecard" sub="vs answer key">
      <div className="grid grid-cols-2 gap-3">
        <Stat value={`${rec} / ${s.plants.length}`} label="plants recovered" ok={rec === s.plants.length} />
        <Stat value={`${raised} / ${s.decoys.length}`} label="decoys raised" ok={raised === 0} />
      </div>
      <ul className="mt-3 space-y-1 text-[12px]">
        {s.plants.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={p.recovered ? 'text-good' : 'text-serious'}>{p.recovered ? '✓' : '✕'}</span>
            <span className="text-ink">{p.label}</span>
            <Mono className="ml-auto text-ink-3">{p.incident ? `insight ${c.briefing!.incidents.find((i) => i.incident_id === p.incident)?.rank}` : 'missed'}</Mono>
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
