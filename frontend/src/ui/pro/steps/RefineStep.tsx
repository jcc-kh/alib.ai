import type { Brief, Section, SubagentName } from '../../../api'
import { useCase } from '../../../state/caseStore'
import { Btn, Mono, Panel, PersonTag, VerdictPill, Empty } from '../kit'
import { AGENT_META } from './AnalyseStep'

const BOXES: { key: keyof Brief; label: string }[] = [
  { key: 'believe', label: 'Believe' },
  { key: 'confused', label: 'Confused by' },
  { key: 'unknown', label: "Don't know" },
]
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'inconsistent', label: 'Inconsistent with the brief' },
  { key: 'answers', label: 'Answers to open questions' },
  { key: 'unprompted', label: 'Not asked about' },
]

export default function RefineStep({ next }: { next: () => void }) {
  const c = useCase()
  const r = c.refine
  const running = c.stage === 'refining'
  const done = r.todos.filter((t) => t.status === 'done').length
  return (
    <div className="grid grid-cols-12 gap-3 p-4">
      <div className="col-span-4 space-y-3">
        <Panel title="Investigator brief" sub="one item per line">
          <div className="space-y-3">
            {BOXES.map((b) => (
              <label key={b.key} className="block">
                <div className="mb-1 text-[11px] font-medium text-ink-2">{b.label}</div>
                <textarea
                  value={r.brief[b.key].join('\n')}
                  onChange={(e) => c.setBrief({ ...r.brief, [b.key]: e.target.value.split('\n') })}
                  rows={3}
                  className="w-full resize-y rounded-md border border-line bg-page p-2 text-[12.5px] leading-relaxed text-ink focus:border-line-strong focus:outline-none"
                />
              </label>
            ))}
            <div className="flex items-center gap-2">
              <Btn kind="primary" disabled={running} onClick={() => c.runRefine()}>
                {running ? 'Running…' : r.report ? 'Re-run' : 'Run against incidents'}
              </Btn>
              <span className="text-[11px] text-ink-3">Try adding “Paul met Cara in March.”</span>
            </div>
            {r.error && <div className="rounded-md border border-serious px-2 py-1.5 text-[12px] text-serious">{r.error}</div>}
          </div>
        </Panel>
        <Panel title="Progress" sub={r.todos.length ? `${done} / ${r.todos.length}` : undefined}>
          {r.todos.length === 0 ? (
            <Empty>Matched to existing signals first.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {r.todos.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-[12px]">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${t.status === 'done' ? 'bg-good' : t.status === 'in_progress' ? 'pulse-dot bg-accent' : 'bg-line-strong'}`} />
                  <span className={t.status === 'done' ? 'text-ink-2' : 'text-ink'}>{t.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="col-span-8 space-y-3">
        {(running || (r.report && Object.keys(r.lanes).length > 0)) && (
          <Panel title="Agents" sub={running ? 'matching brief items' : 'last run'}>
            <div className="grid grid-cols-2 gap-x-6">
              {(Object.keys(AGENT_META) as SubagentName[]).map((a) => {
                const l = r.lanes[a]
                return (
                  <div key={a} className="flex items-center gap-2 border-b border-line py-1.5 text-[12px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${l?.status === 'running' ? 'pulse-dot bg-accent' : l?.status === 'done' ? 'bg-good' : 'bg-line-strong'}`} />
                    <Mono className="w-36 shrink-0 text-ink">{a}</Mono>
                    <Mono className="truncate text-ink-2">{l?.current ?? '—'}</Mono>
                  </div>
                )
              })}
            </div>
            {r.hops.length > 0 && (
              <div className="mt-3 space-y-1">
                {r.hops.map((h, i) => (
                  <div key={i} className="rise text-[12px]">
                    <Mono className="text-accent">
                      {h.from} → {h.to}
                    </Mono>{' '}
                    <span className="text-ink-2">{h.note}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        <Panel title="Results" count={r.report?.findings.length} pad={false} sub={r.report ? 'click a row for evidence' : undefined}>
          {!r.report ? (
            <div className="p-3">
              <Empty>{running ? 'Matching…' : 'Run the brief to see each item checked against the phones.'}</Empty>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <tbody>
                {SECTIONS.map((s) => {
                  const fs = r.report!.findings.filter((f) => f.section === s.key)
                  if (!fs.length) return null
                  return [
                    <tr key={s.key} className="border-b border-line bg-sunken">
                      <td colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">
                        {s.label} <span className="tnum text-ink-3">{fs.length}</span>
                      </td>
                    </tr>,
                    ...fs.map((f) => (
                      <tr key={f.id} onClick={() => c.openFinding(f)} className="cursor-pointer border-b border-line align-top hover:bg-sunken">
                        <td className="w-32 px-3 py-2">
                          <VerdictPill v={f.section === 'unprompted' ? 'sweep' : f.verdict} />
                        </td>
                        <td className="py-2 pr-3">
                          {f.brief_item && <div className="text-[11px] italic text-ink-3">“{f.brief_item}”</div>}
                          <div className="text-ink">{f.statement}</div>
                          {f.derivation.steps.some((st) => st.kind === 'follow_up') && <span className="mt-0.5 inline-block rounded border border-accent px-1 text-[10px] text-accent">follow-up chain</span>}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-col gap-0.5">
                            {f.people.map((p) => (
                              <PersonTag key={p} id={p} />
                            ))}
                          </div>
                        </td>
                        <td className="tnum py-2 pr-3 text-right text-ink-2">
                          <Mono>{f.check}</Mono>
                          <div>{f.evidence_ids.length} rows</div>
                        </td>
                      </tr>
                    )),
                  ]
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {r.report && (
          <Panel title="Suggested next steps" count={r.report.next_steps.length}>
            <ol className="list-decimal space-y-1 pl-4 text-[12.5px] text-ink">
              {r.report.next_steps.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ol>
            <div className="mt-3 flex justify-end">
              <Btn kind="primary" onClick={next}>
                Ask follow-up questions →
              </Btn>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
