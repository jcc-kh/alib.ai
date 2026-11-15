import type { ReactNode } from 'react'
import type { InquiryId, Incident } from '../../../api'
import { useCase } from '../../../state/caseStore'
import Portrait from '../../../components/Portrait'

/** The questions the dashboard is organised around, with the policing method each one borrows. */
export const INQUIRIES: { id: InquiryId; label: string; question: string; method: string; answers: string }[] = [
  {
    id: 'connections',
    label: 'Connections',
    question: 'Who is connected, and how?',
    method: 'Link chart (as in i2 Analyst’s Notebook / Cellebrite Pathfinder), synced to a timeline',
    answers: 'Every call, text, payment, follow, deleted thread and meeting between the five phones, counted once even when it is on both phones.',
  },
  {
    id: 'radius',
    label: 'Routine areas',
    question: 'Whose routine area includes the scene?',
    method: 'Activity space from geographic profiling: anchor point plus the places a phone returns to',
    answers: 'Each phone’s usual area around home, whether Pier 9 sits inside it, and how far each phone was from the scene through the evening.',
  },
  {
    id: 'window',
    label: 'Timeline of events',
    question: 'What was everyone doing in the days and hours before Ravi died?',
    method: 'One timeline built from location fixes, device logs and the calls, texts and payments between the people in the case',
    answers: 'Each day in blocks of a few hours: where each phone was, when it went dark, what it deleted, who it was with, and every exchange between them. The medical examiner’s window (21:00–23:30 on 16 April) is outlined in red.',
  },
  {
    id: 'changes',
    label: 'What changed',
    question: 'What broke from routine?',
    method: 'Pattern-of-life comparison and synchronised-behaviour detection',
    answers: 'That night against a normal night for each phone, location gaps, and what the phones did after the news broke.',
  },
  {
    id: 'motive',
    label: 'Semantic analysis',
    question: 'What are people saying, to whom, and about whom?',
    method: 'Posts, comments and texts between the people in the case, tagged by theme with fixed phrase rules; posts also scored by a hostility classifier',
    answers: 'Themes across everything written: threats, grievances, plans to meet, money, pressure. Each statement shows the words that matched. On the right, how each person’s tone changed over the week. Words are leads for interview, not evidence of where anyone was.',
  },
]

export const inquiryOf = (id: InquiryId) => INQUIRIES.find((q) => q.id === id)!

export function InquiryHeader({ id, right }: { id: InquiryId; right?: ReactNode }) {
  const q = inquiryOf(id)
  const c = useCase()
  const insights = c.board.incidents.filter((i) => i.inquiry === id)
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{q.label}</div>
          <h1 className="mt-0.5 text-[19px] font-semibold leading-snug text-ink">{q.question}</h1>
          <p className="mt-1 max-w-3xl text-[12.5px] text-ink-2">{q.answers}</p>
          <p className="mt-1 text-[11.5px] text-ink-3">Method: {q.method}</p>
        </div>
        {right}
      </div>
      {insights.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(insights.length, 3)}, minmax(0, 1fr))` }}>
          {insights.map((i) => (
            <InsightCard key={i.incident_id} i={i} />
          ))}
        </div>
      )}
    </div>
  )
}

export function InsightCard({ i, showInquiry = false, onInquiry }: { i: Incident; showInquiry?: boolean; onInquiry?: (id: InquiryId) => void }) {
  const c = useCase()
  return (
    <div
      onClick={() => c.openFinding(i.findings[0])}
      onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), c.openFinding(i.findings[0]))}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer flex-col rounded-lg border border-line bg-surface px-3.5 py-3 hover:border-line-strong"
    >
      <div className="flex items-center gap-2">
        <span className="tnum grid h-5 w-5 place-items-center rounded-full bg-ink text-[10.5px] font-semibold text-surface">{i.rank}</span>
        <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-ink">{i.title}</span>
        {i.anchor_id && <span className="rounded border border-serious px-1 text-[10px] text-serious">anchor</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {i.facts.map((f) => (
          <span key={f} className="tnum rounded bg-sunken px-1.5 py-px text-[11px] text-ink-2">
            {f}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {i.people.map((p) => (
          <Portrait key={p} id={p} size={22} />
        ))}
        <span className="ml-2 text-[11px] text-ink-3">{i.n_checks} {i.n_checks === 1 ? 'check' : 'checks'}</span>
        <span className="ml-auto flex gap-1">
          {showInquiry && onInquiry && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onInquiry(i.inquiry)
              }}
              className="rounded-md px-2 py-1 text-[11.5px] text-ink-2 hover:bg-sunken">
              {inquiryOf(i.inquiry).label} →
            </button>
          )}
          <span className="px-1 text-[13px] text-ink-3">›</span>
        </span>
      </div>
      {i.findings.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
          {i.findings.map((f, k) => (
            <button
              key={f.id}
              onClick={(e) => {
                e.stopPropagation()
                c.openFinding(f)
              }}
              className="rounded px-1.5 py-0.5 text-[11px] text-ink-2 hover:bg-sunken" title={f.statement}>
              {k + 1}. {f.heading ?? f.check.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
