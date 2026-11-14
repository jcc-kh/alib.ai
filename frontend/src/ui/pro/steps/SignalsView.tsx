import { useMemo, useState } from 'react'
import { useCase } from '../../../state/caseStore'
import { DISMISSALS, INCIDENTS, SIGNALS } from '../../../mock/signals'
import { fmtDate, fmtTime } from '../../../lib/format'
import { Mono, Panel, PersonTag, StrengthBar } from '../kit'

type Sort = 'signal_id' | 'check' | 'start' | 'strength'

export default function SignalsView() {
  const c = useCase()
  const [sort, setSort] = useState<Sort>('signal_id')
  const incOf = useMemo(() => new Map(INCIDENTS.flatMap((i) => i.signal_ids.map((s) => [s, i] as const))), [])
  const dis = new Set(DISMISSALS.map((d) => d.signal_id))
  const rows = [...SIGNALS].sort((a, b) => (sort === 'strength' ? b.strength - a.strength : String(a[sort]).localeCompare(String(b[sort]))))
  const H = ({ k, children, right }: { k: Sort; children: string; right?: boolean }) => (
    <th onClick={() => setSort(k)} className={`cursor-pointer py-1.5 font-medium hover:text-ink ${right ? 'text-right' : ''} ${sort === k ? 'text-ink' : ''}`}>
      {children}
      {sort === k ? ' ↓' : ''}
    </th>
  )
  return (
    <div className="p-4">
      <Panel title="Signals" count={SIGNALS.length} pad={false} sub="click a row to open its incident">
        <table className="w-full text-[12px]">
          <thead className="text-left text-[11px] text-ink-3">
            <tr className="border-b border-line">
              <th className="w-3" />
              <H k="signal_id">Signal</H>
              <H k="check">Check</H>
              <th className="py-1.5 font-medium">Phones</th>
              <H k="start">Window</H>
              <th className="py-1.5 font-medium">Summary</th>
              <H k="strength">Strength</H>
              <th className="px-3 py-1.5 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const inc = incOf.get(s.signal_id)
              return (
                <tr key={s.signal_id} onClick={() => inc && c.openFinding(inc.findings[0])} className={`border-b border-line align-top last:border-0 ${inc ? 'cursor-pointer hover:bg-sunken' : ''}`}>
                  <td />
                  <td className="py-1.5">
                    <Mono className="text-ink">{s.signal_id}</Mono>
                  </td>
                  <td className="py-1.5 pr-3">
                    <Mono className="text-ink-2">{s.check}</Mono>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="flex flex-col gap-0.5">
                      {s.people.map((p) => (
                        <PersonTag key={p} id={p} />
                      ))}
                    </div>
                  </td>
                  <td className="tnum py-1.5 pr-3 text-ink-2">
                    {fmtDate(s.start)} {fmtTime(s.start)}–{fmtTime(s.end)}
                  </td>
                  <td className="py-1.5 pr-3 text-ink">{s.summary}</td>
                  <td className="py-1.5 pr-3">
                    <StrengthBar v={s.strength} />
                  </td>
                  <td className="px-3 py-1.5">
                    {inc ? <span className="text-ink">{inc.incident_id}</span> : dis.has(s.signal_id) ? <span className="text-ink-3">dismissed</span> : <span className="text-ink-3">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
