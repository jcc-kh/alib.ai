import { useEffect } from 'react'
import { useCase } from '../../state/caseStore'
import { SIGNALS } from '../../mock/signals'
import { fmtDate, fmtTime } from '../../lib/format'
import { Mono, PersonTag, StrengthBar, VerdictPill } from './kit'
import { AGENT_META, EnvelopeIcon } from './steps/AnalyseStep'

/** Opens one subagent's case envelope: the content of its findings/<area>.json. */
export default function EnvelopeDrawer() {
  const c = useCase()
  const e = c.openedEnvelope
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === 'Escape' && c.openEnvelope(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [c])
  if (!e) return null
  const sigs = SIGNALS.filter((s) => e.signal_ids.includes(s.signal_id))
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={() => c.openEnvelope(null)} />
      <aside className="slide-in relative flex h-full w-[min(720px,100vw)] flex-col border-l border-line bg-surface">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <EnvelopeIcon size={30} />
          <div className="min-w-0">
            <div className="font-mono text-[13px] font-semibold text-ink">{e.file}</div>
            <div className="text-[12px] text-ink-2">
              {AGENT_META[e.agent].role} · <span className="font-mono">{e.agent}</span> · t+{(e.started_ms / 1000).toFixed(1)}–{(e.finished_ms / 1000).toFixed(1)} s
            </div>
          </div>
          <button onClick={() => c.openEnvelope(null)} className="ml-auto text-[12px] text-ink-3 hover:text-ink">
            Close ✕
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <p className="rounded-md bg-sunken px-3 py-2 text-[13px] text-ink">{e.summary}</p>

          <Section title="Findings" n={e.findings.length}>
            {e.findings.length === 0 ? (
              <None />
            ) : (
              e.findings.map((f) => (
                <button key={f.id} onClick={() => c.openFinding(f)} className="flex w-full items-start gap-2 border-b border-line px-1 py-2 text-left last:border-0 hover:bg-sunken">
                  <VerdictPill v="sweep" />
                  <span className="text-[12.5px] text-ink">{f.statement}</span>
                  {f.derivation.steps.some((s) => s.kind === 'follow_up') && <span className="ml-auto shrink-0 rounded border border-accent px-1 text-[10px] text-accent">chained</span>}
                </button>
              ))
            )}
          </Section>

          <Section title="Signals written" n={sigs.length}>
            {sigs.length === 0 ? (
              <None />
            ) : (
              <table className="w-full text-[12px]">
                <tbody>
                  {sigs.map((s) => (
                    <tr key={s.signal_id} className="border-b border-line last:border-0">
                      <td className="py-1.5 pr-2">
                        <Mono className="text-ink-2">{s.signal_id}</Mono>
                      </td>
                      <td className="pr-2">
                        <Mono className="text-ink">{s.check}</Mono>
                      </td>
                      <td className="pr-2">
                        <span className="flex gap-1.5">
                          {s.people.map((p) => (
                            <PersonTag key={p} id={p} />
                          ))}
                        </span>
                      </td>
                      <td className="tnum pr-2 text-ink-2">
                        {fmtDate(s.start)} {fmtTime(s.start)}
                      </td>
                      <td>
                        <StrengthBar v={s.strength} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Tool calls" n={e.tool_calls.length}>
            <table className="w-full text-[12px]">
              <thead className="text-left text-[11px] text-ink-3">
                <tr>
                  <th className="pb-1 font-medium">Call</th>
                  <th className="pb-1 font-medium">Result</th>
                  <th className="w-20 pb-1 pl-3 text-right font-medium">Rows</th>
                  <th className="w-14 pb-1 pl-3 text-right font-medium">ms</th>
                </tr>
              </thead>
              <tbody>
                {e.tool_calls.map((t) => (
                  <tr key={t.id} className="border-t border-line align-top">
                    <td className="py-1.5 pr-2">
                      <Mono className="text-ink">
                        {t.check}({t.args})
                      </Mono>
                      {t.follow_up_from && <div className="text-[10.5px] text-accent">on follow-up from {t.follow_up_from}</div>}
                    </td>
                    <td className="py-1.5 pr-2 text-ink-2">{t.result}</td>
                    <td className="tnum py-1.5 pl-3 text-right">{t.rows.toLocaleString()}</td>
                    <td className="tnum py-1.5 pl-3 text-right text-ink-2">{t.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Follow-ups" n={e.follow_ups_sent.length + e.follow_ups_received.length}>
            {e.follow_ups_sent.length + e.follow_ups_received.length === 0 ? (
              <None />
            ) : (
              <ul className="space-y-1.5 text-[12px]">
                {e.follow_ups_sent.map((h, i) => (
                  <li key={`s${i}`}>
                    <Mono className="text-accent">sent → {h.to}</Mono> <span className="text-ink-2">{h.note}</span>
                  </li>
                ))}
                {e.follow_ups_received.map((h, i) => (
                  <li key={`r${i}`}>
                    <Mono className="text-accent">received ← {h.from}</Mono> <span className="text-ink-2">{h.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Dismissed" n={e.dismissed.length}>
            {e.dismissed.length === 0 ? (
              <None />
            ) : (
              <ul className="space-y-2 text-[12px]">
                {e.dismissed.map((d) => (
                  <li key={d.title}>
                    <div className="text-ink">{d.title}</div>
                    <div className="text-ink-2">{d.reason}</div>
                    <Mono className="text-ink-3">{d.rule}</Mono>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </aside>
    </div>
  )
}

function Section({ title, n, children }: { title: string; n: number; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        {title} <span className="tnum rounded bg-sunken px-1.5 text-ink-2">{n}</span>
      </h4>
      {children}
    </section>
  )
}
const None = () => <div className="text-[12px] text-ink-3">None</div>
