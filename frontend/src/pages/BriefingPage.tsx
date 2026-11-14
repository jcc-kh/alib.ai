import { useEffect, useState } from 'react'
import { getBriefing, type Briefing } from '../api'
import { useApp } from '../state'
import { Eyebrow, PersonChip, Stat, Title } from '../components/ui'
import WeekTimeline from '../components/WeekTimeline'
import RelationsGraph from '../components/evidence/RelationsGraph'

export default function BriefingPage() {
  const { openFinding, openAsk, go } = useApp()
  const [b, setB] = useState<Briefing | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    getBriefing().then(setB)
  }, [])

  if (!b) return <div className="pulse-dot py-40 text-center text-faint">Preparing your briefing…</div>
  const byId = (id: string) => b.items.find((i) => i.finding.id === id)?.finding

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Hero */}
      <section className="frame glow px-6 pb-20 pt-24 text-center">
        <Eyebrow>Proactive briefing</Eyebrow>
        <Title size="xl" className="mx-auto mt-4 max-w-3xl">
          {b.headline}
        </Title>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
          Alib.ai swept every pair of phones as soon as the data arrived, before anyone wrote a brief. Each item below is a pattern the checks found and can
          prove, ranked by how many phones it involves and whether it contradicts what people have said.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={() => go('investigate')} className="btn-primary px-5 py-2.5 text-sm font-medium">
            Test your own account →
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

      {/* Timeline */}
      <div className="dot-rule" />
      <section className="frame px-12 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <Eyebrow>The week at a glance</Eyebrow>
            <Title size="lg" className="mt-2">
              13 to 19 April, phone by phone
            </Title>
          </div>
          <p className="max-w-sm text-right text-sm text-faint">Hover a finding below to light up its events. Click any marker to see how we know.</p>
        </div>
        <WeekTimeline events={b.timeline} highlight={hover} onPick={(id) => byId(id) && openFinding(byId(id)!)} />
      </section>

      {/* Items */}
      <div className="dot-rule" />
      <section className="frame px-12 py-16">
        <Eyebrow>What stands out</Eyebrow>
        <Title size="lg" className="mt-2 mb-10">
          Five patterns, each provable from the rows
        </Title>
        <div className="divide-y divide-line border-y border-line">
          {b.items.map((it, i) => (
            <article
              key={it.finding.id}
              onMouseEnter={() => setHover(it.finding.id)}
              onMouseLeave={() => setHover(null)}
              className="grid grid-cols-[5rem_1fr_17rem] gap-8 py-9 transition hover:bg-panel/60"
            >
              <div className="pl-2 font-serif text-5xl text-faint">{String(i + 1).padStart(2, '0')}</div>
              <div className="space-y-3">
                <h3 className="font-serif text-[28px] leading-tight text-fg">{it.headline}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{it.finding.statement}</p>
                <p className="text-sm leading-relaxed text-faint">
                  <span className="text-muted">Why it matters.</span> {it.why_it_matters}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {it.follow_ups.map((q) => (
                    <button key={q} onClick={() => openAsk(q)} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-line-strong hover:text-fg">
                      Ask: {q}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 pr-2">
                <div className="flex flex-wrap gap-1.5">
                  {it.finding.people.map((p) => (
                    <PersonChip key={p} id={p} small />
                  ))}
                </div>
                <div className="text-xs leading-relaxed text-faint">{it.rank_reason}</div>
                <button onClick={() => openFinding(it.finding)} className="btn-ghost w-full px-3 py-2 text-sm">
                  Evidence and how we know →
                </button>
                <div className="text-center text-[11px] text-faint">
                  {it.finding.evidence_ids.length} rows · {it.finding.derivation.validator.filter((v) => v.passed).length}/{it.finding.derivation.validator.length} validator checks
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Relations */}
      <div className="dot-rule" />
      <section className="frame grid grid-cols-[1fr_1.3fr] gap-12 px-12 py-16">
        <div>
          <Eyebrow>Who is connected</Eyebrow>
          <Title size="lg" className="mt-2">
            Every channel between the four phones
          </Title>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            The relationship mapper draws an edge for every call, message, transfer, social interaction, deleted thread and repeated co-location. Dashed edges
            are links without any direct contact, which is often where the story and the data part ways.
          </p>
        </div>
        <RelationsGraph />
      </section>

      {/* Dismissed */}
      <div className="dot-rule" />
      <section className="frame px-12 py-16">
        <Eyebrow>Checked and dismissed</Eyebrow>
        <Title size="lg" className="mt-2 mb-3">
          What looked odd but did not meet a rule
        </Title>
        <p className="mb-8 max-w-2xl text-sm text-faint">Shown so you can see what the checks ignored and why. Every threshold is a named parameter you can change.</p>
        <div className="grid grid-cols-3 gap-6">
          {b.dismissed.map((d) => (
            <div key={d.title} className="rounded-xl border border-line p-5">
              <div className="text-sm text-fg">{d.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-faint">{d.why}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
