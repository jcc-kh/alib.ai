// Mock implementation of the Alib.ai API. Same shapes as the planned FastAPI endpoints:
//   GET  /api/case          -> getCase
//   POST /api/ingest        -> ingest
//   GET  /api/evidence?ids= -> getEvidence
//   GET  /api/graph         -> getGraph
//   GET  /api/briefing      -> getBriefing (proactive, generated at ingest)
//   POST /api/ask (SSE)     -> ask
//   GET  /api/timeline      -> getTimeline (stays: stay / travel / gap per person)
//   GET  /api/signals       -> getSignals (every sweep hit)
//   POST /api/sources (SSE) -> addSource (upload one evidence source; progress, then the board refreshes)
//   GET  /api/board?loaded= -> getBoard

import type { Answer, AskEvent, Briefing, CaseInfo, EvidenceByPhone, Graph, IngestReport, IngestStage, RunEvent, Segment, Signal } from './types'
import { GRAPH } from '../mock/derived'
import { FOUND_AT, PEOPLE, PLACES, ROWS, SCENE, TOD, VICTIM } from '../mock/data'
import { INGEST_STAGES, buildIngestReport } from '../mock/ingest'
import { buildBriefing, scopeBriefing } from '../mock/briefing'
import { answerQuestion } from '../mock/ask'
import { SCENARIOS } from '../mock/findings'
import { computeBoard, exhibitOf, sourceOf, unlockedFor, type Board } from '../mock/sources'
import type { PersonId, StageStatus } from './types'
import { SEGMENTS } from '../mock/segments'
import { SIGNALS } from '../mock/signals'
import { buildRunScript, eventTime } from '../mock/run'

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

export async function getCase(): Promise<CaseInfo> {
  await sleep(150)
  return {
    case_id: 'pier9-2026-04',
    title: 'Death at Pier 9',
    summary: 'Ravi Mehta, owner of Harbor Supply Co., was found dead at the Pier 9 warehouse on 17 April at 07:40. Five phones were seized, including his own, recovered at the scene.',
    timezone: '-04:00',
    coverage: { start: '2026-04-13', end: '2026-04-19' },
    people: PEOPLE,
    places: PLACES,
    incident: {
      kind: 'death',
      victim: VICTIM,
      scene: SCENE,
      tod_start: TOD.start,
      tod_end: TOD.end,
      found_at: FOUND_AT,
      summary: 'Medical examiner: time of death between 21:00 and 23:30 on 16 April.',
    },
  }
}

export async function ingest(file: File | null, onStage: (stages: IngestStage[]) => void, fast = false): Promise<IngestReport> {
  const stages = INGEST_STAGES.map((s) => ({ ...s }))
  for (const s of stages) {
    s.status = 'running'
    onStage(stages.map((x) => ({ ...x })))
    if (!fast) await sleep(450 + Math.random() * 300)
    s.status = 'done'
    onStage(stages.map((x) => ({ ...x })))
  }
  const report = buildIngestReport()
  return { ...report, bundle_name: file?.name ?? report.bundle_name }
}

export async function getEvidence(ids: string[]): Promise<EvidenceByPhone> {
  await sleep(120)
  const out: EvidenceByPhone = {}
  const missing: string[] = []
  for (const id of ids) {
    const row = ROWS.get(id)
    if (!row) {
      missing.push(id)
      continue
    }
    ;(out[row.device_owner] ??= []).push(row)
  }
  if (missing.length) throw new Error(`Unknown evidence ids: ${missing.join(', ')}`)
  for (const rows of Object.values(out)) rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return out
}

export async function getGraph(): Promise<Graph> {
  await sleep(100)
  return GRAPH
}

export async function getBriefing(): Promise<Briefing> {
  await sleep(200)
  return buildBriefing()
}

export async function ask(question: string, onEvent: (e: AskEvent) => void, loaded?: PersonId[]): Promise<Answer> {
  const { steps, answer } = answerQuestion(question, loaded)
  for (const text of steps) {
    await sleep(450)
    onEvent({ type: 'step', text })
  }
  await sleep(300)
  onEvent({ type: 'answer', answer })
  return answer
}

export async function getTimeline(): Promise<Segment[]> {
  await sleep(150)
  return SEGMENTS
}

export async function getSignals(): Promise<Signal[]> {
  await sleep(100)
  return SIGNALS
}

/**
 * Case-load run (sweep + triage) as a stream of agent events. In the real system this is
 * GET /api/run/stream (SSE). `speed` > 1 plays it faster; Infinity delivers everything at once.
 */
export async function analyseCase(onEvent: (e: RunEvent) => void, speed = 1, signal?: AbortSignal, range: [number, number] = [13, 19], phones?: PersonId[]): Promise<Briefing> {
  const script = buildRunScript(range, phones)
  let last = 0
  for (const e of script.events) {
    const t = eventTime(e)
    if (Number.isFinite(speed) && t > last) await sleep((t - last) / speed, signal)
    last = Math.max(last, t)
    onEvent(e)
  }
  return scopeBriefing(buildBriefing(), range)
}

// ---------------------------------------------------------------------------------------------
// Evidence sources: add one at a time; the board is recomputed from the loaded sources
// ---------------------------------------------------------------------------------------------

export interface SourceStage {
  id: string
  label: string
  detail: string
  status: StageStatus
}
export interface SourceProgress {
  stages: SourceStage[]
  /** 0–1 across all stages. */
  pct: number
  /** Rows read so far from the new source. */
  rows: number
}

export async function getBoard(loaded: PersonId[]): Promise<Board> {
  await sleep(80)
  return computeBoard(loaded)
}

/**
 * Ingest one source, then re-run the checks it affects. Calls onProgress throughout (about 1 s, plus the subagent re-run).
 * `rerun`, if given, plays the subagent run during the "Re-run checks" stage instead of a fixed wait.
 */
export async function addSource(id: PersonId, loaded: PersonId[], onProgress: (p: SourceProgress) => void, signal?: AbortSignal, rerun?: () => Promise<void>): Promise<void> {
  const src = sourceOf(id)
  const files = Object.values(src.tables).filter((n) => n > 0).length
  const before = new Set(unlockedFor(loaded))
  const fresh = unlockedFor([...loaded, id]).filter((sid) => !before.has(sid))
  const checks = [...new Set(['identity_match', 'contact_graph', 'location_timeline', ...fresh.map((sid) => SCENARIOS[sid].check)])]
  const stages: SourceStage[] = [
    { id: 'load', label: 'Load', detail: `${files} JSONL files from ${exhibitOf(id)} (${src.model})`, status: 'pending' },
    { id: 'validate', label: 'Validate', detail: `${src.rows.toLocaleString()} rows against Case Bundle v1`, status: 'pending' },
    { id: 'normalise', label: 'Normalise', detail: 'Numbers to E.164, timestamps to ISO 8601, places geofenced', status: 'pending' },
    { id: 'resolve', label: 'Identify owner', detail: 'Own number, accounts and saved name matched to people already in the case', status: 'pending' },
    { id: 'store', label: 'Store', detail: 'Rows written to the case store with device_owner', status: 'pending' },
    { id: 'checks', label: 'Re-run subagents', detail: checks.join(' · '), status: 'pending' },
    { id: 'board', label: 'Update board', detail: fresh.length ? `${fresh.length} new finding${fresh.length > 1 ? 's' : ''}` : 'No new findings; ties refreshed', status: 'pending' },
  ]
  // Ingest stages are quick; the time goes to the subagent re-run in the 'checks' stage.
  const DUR: Record<string, number> = { load: 220, validate: 160, normalise: 140, resolve: 180, store: 140, checks: 1100, board: 160 }
  const total = Object.values(DUR).reduce((a, b) => a + b, 0)
  const rowStages = ['load', 'validate', 'normalise', 'resolve', 'store']
  const rowSpan = rowStages.reduce((a, k) => a + DUR[k], 0)
  let done = 0
  const emit = (inStage: number) => {
    const t = done + inStage
    onProgress({ stages: stages.map((s) => ({ ...s })), pct: Math.min(1, t / total), rows: Math.round(src.rows * Math.min(1, t / rowSpan)) })
  }
  for (const s of stages) {
    s.status = 'running'
    if (s.id === 'checks' && rerun) {
      // The bar keeps creeping forward while the agents run, then completes the stage.
      let finished = false
      const run = rerun().finally(() => (finished = true))
      for (let k = 0; !finished; k++) {
        emit(DUR.checks * (1 - Math.pow(0.88, k)))
        await sleep(200, signal)
      }
      await run
      s.status = 'done'
      done += DUR[s.id]
      emit(0)
      continue
    }
    const steps = 6
    for (let k = 0; k < steps; k++) {
      emit((DUR[s.id] * k) / steps)
      await sleep(DUR[s.id] / steps, signal)
    }
    s.status = 'done'
    done += DUR[s.id]
    emit(0)
  }
}
