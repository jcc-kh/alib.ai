// Mock implementation of the Alib.ai API. Same shapes as the planned FastAPI endpoints:
//   GET  /api/case          -> getCase
//   POST /api/ingest        -> ingest
//   POST /api/analyse (SSE) -> analyse (events delivered through onEvent)
//   GET  /api/evidence?ids= -> getEvidence
//   GET  /api/graph         -> getGraph

import type { AgentEvent, Brief, CaseInfo, EvidenceByPhone, Graph, IngestReport, IngestStage, Report } from './types'
import { GRAPH, PEOPLE, PLACES, ROWS } from '../mock/data'
import { INGEST_REPORT, INGEST_STAGES } from '../mock/ingest'
import { planRun } from '../mock/report'

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
    case_id: 'harbor-supply-2026-04',
    title: 'Harbor Supply Co. missing funds',
    summary: 'Money is missing from Harbor Supply Co. An audit was announced on 17 April at 10:00. All four people say they barely know each other.',
    timezone: '-04:00',
    coverage: { start: '2026-04-13', end: '2026-04-19' },
    people: PEOPLE,
    places: PLACES,
  }
}

export async function ingest(file: File | null, onStage: (stages: IngestStage[]) => void): Promise<IngestReport> {
  const stages = INGEST_STAGES.map((s) => ({ ...s }))
  for (const s of stages) {
    s.status = 'running'
    onStage(stages.map((x) => ({ ...x })))
    await sleep(450 + Math.random() * 300)
    s.status = 'done'
    onStage(stages.map((x) => ({ ...x })))
  }
  return { ...INGEST_REPORT, bundle_name: file?.name ?? INGEST_REPORT.bundle_name }
}

let failedOnce = false

export async function analyse(brief: Brief, onEvent: (e: AgentEvent) => void, signal?: AbortSignal): Promise<Report> {
  const plan = planRun(brief)
  const shouldFail = new URLSearchParams(window.location.search).has('fail') && !failedOnce
  let i = 0
  for (const { delay, event } of plan.events) {
    if (delay) await sleep(delay, signal)
    onEvent(event)
    if (shouldFail && ++i === 14) {
      failedOnce = true
      const err: AgentEvent = { type: 'error', message: 'financial-analyst: the model request timed out after 30 s. No partial report was saved.' }
      onEvent(err)
      throw new Error(err.message)
    }
  }
  onEvent({ type: 'report', report: plan.report })
  return plan.report
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
