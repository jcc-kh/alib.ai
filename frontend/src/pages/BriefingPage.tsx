import { useEffect, useState } from 'react'
import { getBriefing, type Brief, type Briefing, type Finding } from '../api'
import { useApp } from '../state'
import { Eyebrow, Mono, PersonChip, Stat, Title, VerdictBadge } from '../components/ui'
import WeekTimeline from '../components/WeekTimeline'
import RelationsGraph from '../components/evidence/RelationsGraph'
import { DEMO_BRIEF } from './InvestigatePage'
import { fmtDate, fmtTime } from '../lib/format'

export default function BriefingPage() {
  const { openFinding, openAsk, refine, go } = useApp()
  const [b, setB] = useState<Briefing | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [brief, setBrief] = useState<Brief>(DEMO_BRIEF)

  useEffect(() => {
    getBriefing().then(setB)
  }, [])

  if (!b) return <div className="pulse-dot py-40 text-center text-faint">Sweeping the phones and triaging signals…</div>
  const allFindings = b.incidents.flatMap((i) => i.findings)
  const byId = (id: string): Finding | undefined => allFindings.find((f) => f.id === id)

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Hero */}
      <section className="frame glow px-6 pb-16 pt-20 text-center">
        <Eyebrow>Opening briefing · no brief needed</Eyebrow>
        <Title size="xl" className="mx-auto mt-4 max-w-3xl">
          {b.headline}
        </Title>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
          When the case loaded, every check ran across every pair of phones. The {b.signals_total} signals were grouped into incidents, ranked by how many
          checks agree and how many phones are involved, and the ordinary ones were dismissed with a reason. Your brief sharpens this. It doesn't start it.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <a href="#sharpen" className="btn-primary px-5 py-2.5 text-sm font-medium">
            Sharpen with your brief ↓
          </a>
          <button onClick={() => go('timeline')} className="btn-ghost px-5 py-2.5 text-sm">
            Location timeline
          </button>
          <button onClick={() => openAsk()} className="btn-ghost px-5 py-2.5 text-sm">
            Ask a question
          </button>
        </div>
      </section>

      <div className="dot-rule" />
      <section className="frame grid grid-cols-4 gap-6 px-12 py-10">
        {b.stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </section>

      {/* Anchor moments */}
      <div className="dot-rule" />
      <section className="frame px-12 py-14">
        <Eyebrow>Anchor moments</Eyebrow>
        {b.anchors.map((a) => {
          const f = byId(a.finding_id)
          return (
            <div key={a.anchor_id} className="mt-4 grid grid-cols-[1fr_auto] items-end gap-10">
              <div>
                <Title size="lg">{a.label}: signals from {a.phones.length} phones cluster in one hour.</Title>
                <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">
                  Between {fmtTime(a.start)} and {fmtTime(a.end)} on {fmtDate(a.start)}, the phones of {a.phones.map((p) => p[0].toUpperCase() + p.slice(1)).join(', ')} each
                  deleted a thread and went dark. anchor_moments() found this from the data alone, without being told about the audit. The audit notice was
                  then found as the latest message before the window.
                </p>
                <div className="mt-3 flex gap-2">
                  {a.signal_ids.map((s) => (
                    <Mono key={s} className="rounded border border-line px-1.5 py-0.5">
                      {s}
                    </Mono>
                  ))}
                </div>
              </div>
              {f && (
                <button onClick={() => openFinding(f)} className="btn-ghost px-4 py-2 text-sm">
                  Evidence and how we know →
                </button>
              )}
            </div>
          )
        })}
      </section>

      {/* Timeline */}
      <div className="dot-rule" />
      <section className="frame px-12 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <Eyebrow>The week at a glance</Eyebrow>
            <Title size="lg" className="mt-2">
              13 to 19 April, phone by phone
            </Title>
          </div>
          <p className="max-w-sm text-right text-sm text-faint">Hover an incident to light up its events. Faint hatched blocks are gaps that were checked and not raised.</p>
        </div>
        <WeekTimeline events={b.timeline} highlight={hover} onPick={(id) => byId(id) && openFinding(byId(id)!)} />
      </section>

      {/* Incidents */}
      <div className="dot-rule" />
      <section className="frame px-12 py-14">
        <Eyebrow>Top incidents</Eyebrow>
        <Title size="lg" className="mt-2 mb-10">
          {b.incidents.length} incidents from {b.signals_total} signals, ranked
        </Title>
        <div className="divide-y divide-line border-y border-line">
          {b.incidents.map((inc) => (
            <article
              key={inc.incident_id}
              onMouseEnter={() => setHover(inc.findings[0].id)}
              onMouseLeave={() => setHover(null)}
              className="grid grid-cols-[5rem_1fr_17rem] gap-8 py-9 transition hover:bg-panel/60"
            >
              <div className="pl-2 font-serif text-5xl text-faint">{String(inc.rank).padStart(2, '0')}</div>
              <div className="space-y-4">
                <h3 className="font-serif text-[27px] leading-tight text-fg">{inc.headline}</h3>
                <p className="text-sm leading-relaxed text-faint">
                  <span className="text-muted">Why it matters.</span> {inc.why_it_matters}
                </p>
                <div className="space-y-2">
                  {inc.findings.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => openFinding(f)}
                      onMouseEnter={() => setHover(f.id)}
                      className="flex w-full items-start gap-3 rounded-lg border border-line px-4 py-3 text-left transition hover:border-line-strong"
                    >
                      <VerdictBadge v="sweep" />
                      <span className="text-[14px] leading-snug text-fg/90">{f.statement}</span>
                      {f.derivation.steps.some((s) => s.kind === 'follow_up') && (
                        <span className="ml-auto shrink-0 rounded-full border border-amber/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber">chained</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {inc.follow_ups.map((q) => (
                    <button key={q} onClick={() => openAsk(q)} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-line-strong hover:text-fg">
                      Ask: {q}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 pr-2">
                <div className="flex flex-wrap gap-1.5">
                  {inc.people.map((p) => (
                    <PersonChip key={p} id={p} small />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="font-serif text-3xl text-fg">{inc.n_checks}</div>
                    <div className="text-[11px] text-faint">checks agree</div>
                  </div>
                  <div>
                    <div className="font-serif text-3xl text-fg">{inc.n_phones}</div>
                    <div className="text-[11px] text-faint">phones</div>
                  </div>
                </div>
                <div className="text-xs leading-relaxed text-faint">{inc.rank_reason}</div>
                <div className="flex flex-wrap gap-1">
                  {inc.signal_ids.map((s) => (
                    <Mono key={s} className="rounded border border-line px-1.5 py-0.5">
                      {s}
                    </Mono>
                  ))}
                  {inc.anchor_id && <span className="rounded border border-terra/50 px-1.5 py-0.5 text-[10px] text-terra-soft">anchor {inc.anchor_id}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Sharpen with a brief */}
      <div className="dot-rule" />
      <section id="sharpen" className="frame scroll-mt-20 px-12 py-14">
        <Eyebrow>Sharpen the briefing</Eyebrow>
        <Title size="lg" className="mt-2">
          Tell Alib.ai what you believe and what you need to know.
        </Title>
        <p className="mt-3 max-w-2xl text-sm text-faint">
          Each line is matched to the incidents above first. New checks run only for lines the sweep didn't cover, and the report is re-ranked by relevance to
          your brief.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          {(
            [
              ['believe', 'What we believe'],
              ['confused', 'What confuses us'],
              ['unknown', "What we don't know"],
            ] as [keyof Brief, string][]
          ).map(([k, label]) => (
            <label key={k} className="block">
              <div className="mb-2 font-serif text-xl text-fg">{label}</div>
              <textarea
                value={brief[k].join('\n')}
                onChange={(e) => setBrief({ ...brief, [k]: e.target.value.split('\n') })}
                rows={4}
                className="w-full resize-y rounded-xl border border-line bg-panel p-3 text-sm leading-relaxed text-fg focus:border-line-strong focus:outline-none"
              />
            </label>
          ))}
        </div>
        <button onClick={() => refine(brief)} className="btn-primary mt-6 px-6 py-2.5 text-sm font-medium">
          Refine with my brief →
        </button>
      </section>

      {/* Relations */}
      <div className="dot-rule" />
      <section className="frame grid grid-cols-[1fr_1.3fr] gap-12 px-12 py-14">
        <div>
          <Eyebrow>Who is connected</Eyebrow>
          <Title size="lg" className="mt-2">
            The people map
          </Title>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Built first by the relationship mapper and used by every other subagent. An edge for every call, message, transfer, social interaction, deleted
            thread and repeated co-location. Dashed edges are links without direct contact.
          </p>
        </div>
        <RelationsGraph />
      </section>

      {/* Dismissed */}
      <div className="dot-rule" />
      <section className="frame px-12 py-14">
        <Eyebrow>Checked and dismissed</Eyebrow>
        <Title size="lg" className="mt-2 mb-3">
          What looked odd but has an ordinary explanation
        </Title>
        <p className="mb-8 max-w-2xl text-sm text-faint">Every dismissal records its reason and the rule behind it, so nothing is silently dropped.</p>
        <div className="grid grid-cols-2 gap-5">
          {b.dismissed.map((d) => (
            <div key={d.title} className="rounded-xl border border-line p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="text-[15px] text-fg">{d.title}</div>
                {d.signal_id ? <Mono className="shrink-0">{d.signal_id}</Mono> : <span className="shrink-0 text-[10.5px] text-faint">never a signal</span>}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-muted">{d.reason}</div>
              <div className="mt-3 font-mono text-[11px] text-faint">{d.rule}</div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-faint">
          Gaps in location data are reported as "no location data", never as proof of intent. Only gaps where the phone was
          clearly in use, or that overlap another signal, are raised.
        </p>
      </section>
    </div>
  )
}
