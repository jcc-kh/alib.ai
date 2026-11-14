import type { DerivationStepKind, Finding } from '../api'
import { PEOPLE, personName } from '../mock/data'
import { Eyebrow } from './ui'

const KIND_LABEL: Record<DerivationStepKind, string> = {
  question: 'Question',
  signal: 'Sweep',
  grouped: 'Triage',
  route: 'Routing',
  follow_up: 'Follow-up',
  tool: 'Check',
  data: 'Data',
  compute: 'Compute',
  rule: 'Rule',
  statement: 'Statement',
}

const CELL: Record<string, { label: string; cls: string }> = {
  present: { label: '●', cls: 'text-sage' },
  deleted: { label: '⊘', cls: 'text-terra-soft' },
  absent: { label: '○', cls: 'text-faint' },
  'n/a': { label: '–', cls: 'text-line-strong' },
}

export default function DerivationView({ finding }: { finding: Finding }) {
  const d = finding.derivation
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <Eyebrow>Derivation chain</Eyebrow>
          <div className="flex gap-4 text-[11px] text-faint">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-azure-soft" /> deterministic code</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber" /> language model</span>
          </div>
        </div>
        <ol className="relative space-y-0">
          {d.steps.map((s, i) => (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {i < d.steps.length - 1 && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-line" />}
              <span
                className="relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold"
                style={{ borderColor: s.actor === 'code' ? '#6b9bff' : '#e8a33d', color: s.actor === 'code' ? '#6b9bff' : '#e8a33d' }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-faint">{KIND_LABEL[s.kind]}</span>
                  <span className="text-sm font-medium text-fg">{s.title}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.detail}</p>
                {s.code && <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-panel px-3 py-2 font-mono text-[11.5px] leading-relaxed text-fg/90">{s.code}</pre>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <Eyebrow className="mb-3">Where each number comes from</Eyebrow>
        <div className="overflow-hidden rounded-lg border border-line">
          {d.numbers.map((n, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line px-4 py-2.5 text-sm last:border-0">
              <span className="rounded bg-raised px-2 py-0.5 font-medium text-fg">{n.text}</span>
              <span className="font-mono text-[11.5px] text-azure-soft">{n.field}</span>
              <span className="font-mono text-[11.5px] text-muted">{n.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">The model never computes numbers. Each one above was copied from the check output named beside it.</p>
      </section>

      <section>
        <Eyebrow className="mb-3">Which phones hold it</Eyebrow>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="pb-2 font-normal">Fact</th>
              {PEOPLE.map((p) => (
                <th key={p.person_id} className="w-16 pb-2 text-center font-normal">
                  {personName(p.person_id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.corroboration.map((c, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-2 pr-2 text-muted">{c.fact}</td>
                {PEOPLE.map((p) => {
                  const cell = CELL[c.phones[p.person_id] ?? 'n/a']
                  return (
                    <td key={p.person_id} className={`text-center text-base ${cell.cls}`} title={c.phones[p.person_id]}>
                      {cell.label}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex gap-4 text-[11px] text-faint">
          <span><span className="text-sage">●</span> on this phone</span>
          <span><span className="text-terra-soft">⊘</span> deleted from this phone</span>
          <span>○ checked, not there</span>
          <span>– not relevant</span>
        </div>
      </section>

      <section>
        <Eyebrow className="mb-3">Report validator</Eyebrow>
        <ul className="space-y-2">
          {d.validator.map((v) => (
            <li key={v.rule} className="flex gap-3 text-sm">
              <span className={v.passed ? 'text-sage' : 'text-terra-soft'}>{v.passed ? '✓' : '✗'}</span>
              <span className="w-56 shrink-0 text-fg">{v.rule}</span>
              <span className="text-muted">{v.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
