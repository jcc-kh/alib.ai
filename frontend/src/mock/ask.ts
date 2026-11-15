// Ask: free-form questions answered with cited findings. In the real system this is the same
// orchestrator in Q&A mode (POST /api/ask, SSE). Here questions are routed by keyword.

import type { Answer, PersonId } from '../api/types'
import { ALL_PHONES, CHAIN, GAMY, HOSTILE, MEET, MISSING, SYNC, personName } from './data'
import { LAST, PRESENCE, SPACE } from './derived'
import { fmtKm, fmtTime } from '../lib/format'
import { SCENARIOS, cannotTellFinding, route, scenarioFinding, type ScenarioId } from './findings'

const ph = (p: PersonId) => PRESENCE.phones.find((x) => x.person === p)!
const kenMin = () => Math.min(...ph('ken').slots.map((s) => s.distance_m ?? Infinity))
const ANSWERS: Record<ScenarioId, () => string> = {
  PRESENCE: () =>
    `Only Ravi's phone was at Pier 9 between 21:00 and 23:30. Paul's phone was ${fmtKm(ph('paul').closest_m!)} away at ${fmtTime(ph('paul').closest_t!)} and then off; Amy's had no location data for ${ph('amy').counts.no_data} of the ${ph('amy').slots.length} slots; Ken's and Cara's stayed more than 3 km away throughout.`,
  GPAUL: () =>
    `Paul's phone was last located ${fmtKm(ph('paul').closest_m!)} from Pier 9 at ${fmtTime(ph('paul').closest_t!)}, then powered off from 21:16 to 23:38 and came back on at home. A phone that is off leaves no location record, so where it was in between can't be told from the phones.`,
  GAMY: () => `Yes. Amy's phone had no location data from ${fmtTime(GAMY.start)} to ${fmtTime(GAMY.end)}, while it called Ravi's phone at ${fmtTime(GAMY.activity[0].t)} and ${fmtTime(GAMY.activity[1].t)}. Its fixes either side are at her home, 14 km from Pier 9.`,
  LAST: () =>
    `Ravi's phone texted Paul at 18:05 ("Pier 9, 9:30 tonight. Come alone."), took a 64-second call from Paul at 20:58, and last sent anything at ${fmtTime(LAST.last_active.t)}: a text to Amy saying he was at the warehouse. After that it only received a text and two calls from Amy.`,
  MISSING: () => `${MISSING.missing_count} texts. They are on Ravi's phone, from "We need to talk about the house" at 19:40 to "Answer your phone" at 22:15, and missing from Amy's, which deleted the thread at ${fmtTime(MISSING.deletion_events[0].t)} on 17 April.`,
  SYNC: () =>
    `Starting ${SYNC.trigger!.minutes_before_window} minutes after the ${fmtTime(SYNC.trigger!.t)} news alert, within ${SYNC.window.minutes} minutes, Paul's, Amy's and Cara's phones each deleted its thread with Ravi. Paul's and Cara's phones then powered off. Ken's phone deleted nothing; his account posted "karma." at 09:50.`,
  MEET: () => `Their phones suggest they do, though nothing on either phone says so. Paul's and Cara's phones were within ${MEET.thresholds.within_m} m of each other for 20 minutes on ${MEET.occasions.length} days, each time at a different unnamed spot (${MEET.occasions.map((o) => o.date).join(', ')}). No call, text, saved contact, payment or social tie between them exists on any phone.`,
  HOSTILE: () => `Ken's Snapline account posted ${HOSTILE.flagged} items about Ravi scored ${HOSTILE.threshold}+ for hostility, starting the evening Ravi's text ended his job. His phone, though, was at least ${fmtKm(kenMin())} from Pier 9 in every slot of the window, with no gaps.`,
  SPACE: () =>
    `Pier 9 is inside the routine areas of ${SPACE.spaces.filter((s) => s.scene_inside && s.person !== 'ravi').map((s) => `${personName(s.person)}'s`).join(' and ')} phones, which stayed there on 2+ days. It is outside Paul's and Amy's; Paul's phone stayed there on one day before the 16th.`,
}

export const SUGGESTED_QUESTIONS = [
  'Who was near the scene in the time-of-death window?',
  'Who did Ravi contact on his last evening?',
  "Was Amy's location off that night?",
  'Who reacted to the news?',
  'Do Paul and Cara know each other?',
  'Did anyone post threats about Ravi?',
  'Did Paul and Ravi argue last year?',
]

export function answerQuestion(q: string, loaded: PersonId[] = ALL_PHONES): { steps: string[]; answer: Answer } {
  const sid = route(q)
  const missing = sid ? SCENARIOS[sid].people.filter((p) => !loaded.includes(p)) : []
  if (sid && missing.length) {
    const names = missing.map((p) => `${personName(p)}'s`).join(' and ')
    const steps = ['Parsed the question and resolved people and dates', `Routed to ${SCENARIOS[sid].agent}`, `${SCENARIOS[sid].check}() needs ${names} phone${missing.length > 1 ? 's' : ''}, not yet in the case → cannot tell yet`]
    return {
      steps,
      answer: {
        question: q,
        text: `I can't tell yet. Answering this needs ${names} phone${missing.length > 1 ? 's' : ''}, which ${missing.length > 1 ? "haven't" : "hasn't"} been added to the case. Add ${missing.length > 1 ? 'them' : 'it'} as an evidence source and ask again.`,
        verdict: 'cannot_tell',
        findings: [],
        steps,
        suggestions: SUGGESTED_QUESTIONS.filter((s) => {
          const r = route(s)
          return r && SCENARIOS[r].people.every((p) => loaded.includes(p))
        }).slice(0, 3),
      },
    }
  }
  if (!sid) {
    const f = cannotTellFinding('q1', q)
    return {
      steps: ['Parsed the question and resolved people and dates', 'get_coverage() → 13–19 April 2026 on all 5 phones', 'No check can settle a question outside coverage → cannot tell'],
      answer: {
        question: q,
        text: "I can't tell from these phones. They only hold data from 13 to 19 April 2026, so I won't guess. Older carrier or bank records could settle it.",
        verdict: 'cannot_tell',
        findings: [f],
        steps: [],
        suggestions: SUGGESTED_QUESTIONS.slice(0, 3),
      },
    }
  }
  const sc = SCENARIOS[sid]
  const f = scenarioFinding(sid, 'q1')
  const steps = ['Parsed the question and resolved people and dates', `Routed to ${sc.agent}`, ...sc.tools.map((t) => `${t.split('(')[0]}(…) → ${sc.evidence.length} evidence rows`), 'Answer checked by validate_report()']
  return {
    steps,
    answer: { question: q, text: ANSWERS[sid](), verdict: f.verdict, findings: [f], steps, suggestions: SUGGESTED_QUESTIONS.filter((s) => route(s) !== sid).slice(0, 3) },
  }
}
