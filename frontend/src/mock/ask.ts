// Ask: free-form questions answered with cited findings. In the real system this is the same
// orchestrator in Q&A mode (POST /api/ask, SSE). Here questions are routed by keyword.

import type { Answer } from '../api/types'
import { S2 } from './data'
import { fmtKm } from '../lib/format'
import { SCENARIOS, cannotTellFinding, route, scenarioFinding, type ScenarioId } from './findings'

const ANSWERS: Record<ScenarioId, (q: string) => string> = {
  S2: () => `No, not according to the phones. Paul's phone was at Sunset Park and Amy's at Northgate Mall all evening, never closer than ${fmtKm(S2.min_m)}.`,
  S5: () => "Their phones suggest they do. Paul's and Cara's phones were at Dock Cafe together on 4 days, though no text or call between them exists on any phone.",
  S4a: () => "Yes. The $5,000 transfer from Paul to Ken at 11:05 on 15 April is on both phones, with no memo.",
  S4b: () => "Ken's phone sent $4,500 of it to Cara 4 h 35 min later, with the memo \"materials\". Cara's phone shows it arriving. No other onward transfer above $500 exists in the data.",
  S7: () => "Yes. Starting 20 minutes after the 10:00 audit notice, within one 50-minute window, Paul's, Ken's and Cara's phones each deleted a WhatsApp thread and powered off, coming back on at 13:05, 13:30 and 14:00. Amy's phone did neither.",
  G1: () => "Yes, once. Ken's phone had no location data from 14:00 to 16:30 on 15 April, but in that window it sent a message at 15:10 and the $4,500 transfer to Cara at 15:40. Other gaps in the data are explained by the phone being off, or show no activity, so they are not raised.",
  S1: () => "Three texts. Paul's phone sent them to Amy at 18:32 on 14 April, asking her to come to Sunset Park. They are not on Amy's phone, which deleted the thread on 17 April at 20:15.",
}

export const SUGGESTED_QUESTIONS = [
  'Did anyone react to the audit announcement?',
  'Do Paul and Cara know each other?',
  'Where did the missing money end up?',
  'What did Paul text Amy on 14 April?',
  "Was any phone's location off while it was in use?",
  'Did Paul meet Cara in March?',
]

export function answerQuestion(q: string): { steps: string[]; answer: Answer } {
  const sid = route(q)
  if (!sid) {
    const f = cannotTellFinding('q1', q)
    return {
      steps: ['Parsed the question and resolved people and dates', 'get_coverage() → 13–19 April 2026 on all 4 phones', 'No check can settle a question outside coverage → cannot tell'],
      answer: {
        question: q,
        text: "I can't tell from these phones. They only hold data from 13 to 19 April 2026, so I won't guess. Bank or carrier records for that period could settle it.",
        verdict: 'cannot_tell',
        findings: [f],
        steps: [],
        suggestions: SUGGESTED_QUESTIONS.slice(0, 3),
      },
    }
  }
  const sc = SCENARIOS[sid]
  const f = scenarioFinding(sid, { id: 'q1', section: 'answers', brief_item: q })
  const steps = ['Parsed the question and resolved people and dates', `Routed to ${sc.agent}`, ...sc.tools.map((t) => `${t.split('(')[0]}(…) → ${sc.evidence.length} evidence rows`), 'Answer checked by validate_report()']
  return {
    steps,
    answer: {
      question: q,
      text: ANSWERS[sid](q),
      verdict: f.verdict,
      findings: [f],
      steps,
      suggestions: SUGGESTED_QUESTIONS.filter((s) => route(s) !== sid).slice(0, 3),
    },
  }
}
