import type { Finding, Report, Section, Verdict } from '../api'
import { personColor, personName } from '../mock/data'

const SECTIONS: { key: Section; title: string; empty: string }[] = [
  { key: 'confirmed', title: 'Confirmed', empty: 'Nothing in the brief was confirmed by two or more phones.' },
  { key: 'inconsistent', title: 'Inconsistent with what you believe', empty: 'No belief was contradicted by the data.' },
  { key: 'answers', title: 'Answers to your open questions', empty: 'No open questions were asked.' },
  { key: 'unprompted', title: "What you didn't ask about", empty: 'The sweep found nothing outside the brief.' },
]

export const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-100 text-emerald-800' },
  inconsistent: { label: 'Inconsistent', cls: 'bg-red-100 text-red-800' },
  cannot_tell: { label: 'Cannot tell', cls: 'bg-slate-200 text-slate-700' },
}

function FindingCard({ f, selected, onSelect }: { f: Finding; selected: boolean; onSelect: () => void }) {
  const v = f.section === 'unprompted' ? { label: 'Found in sweep', cls: 'bg-violet-100 text-violet-800' } : VERDICT_STYLE[f.verdict]
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border bg-white p-3.5 text-left transition ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-400'}`}
    >
      {f.brief_item && <div className="mb-1.5 text-xs italic text-slate-500">“{f.brief_item}”</div>}
      <div className="flex items-start gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${v.cls}`}>{v.label}</span>
        <p className="text-sm leading-snug">{f.statement}</p>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        {f.people.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: personColor(p) }} />
            {personName(p)}
          </span>
        ))}
        <span className="ml-auto font-mono text-[10px]">{f.check}</span>
        <span>· {f.evidence_ids.length} evidence rows</span>
      </div>
    </button>
  )
}

export default function ReportPanel({ report, selectedId, onSelect }: { report: Report; selectedId: string | null; onSelect: (f: Finding) => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg bg-slate-200/60 px-3 py-2 text-xs text-slate-600">
        <b>Assumptions:</b> {report.assumptions.join(' ')}
      </div>
      {SECTIONS.map((s) => {
        const fs = report.findings.filter((f) => f.section === s.key)
        return (
          <section key={s.key}>
            <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              {s.title} <span className="text-xs font-normal text-slate-400">{fs.length}</span>
            </h3>
            {fs.length === 0 ? (
              <div className="text-sm text-slate-400">{s.empty}</div>
            ) : (
              <div className="space-y-2">
                {fs.map((f) => (
                  <FindingCard key={f.id} f={f} selected={f.id === selectedId} onSelect={() => onSelect(f)} />
                ))}
              </div>
            )}
          </section>
        )
      })}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Suggested next steps</h3>
        <ol className="list-decimal space-y-1 rounded-xl border border-slate-200 bg-white p-4 pl-8 text-sm">
          {report.next_steps.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
