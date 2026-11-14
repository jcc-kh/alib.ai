// One case-flow store shared by both UIs (Pro and Noir).
// Stages: empty → ingesting → ingested → analysing → analysed → refining → refined.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  analyse,
  analyseCase,
  ask as askApi,
  getCase,
  ingest as ingestApi,
  type AgentEnvelope,
  type AgentEvent,
  type Answer,
  type Brief,
  type Briefing,
  type CaseInfo,
  type Finding,
  type FollowUp,
  type IngestReport,
  type IngestStage,
  type Report,
  type SubagentName,
  type Todo,
  type ToolCall,
} from '../api'
import { INGEST_STAGES } from '../mock/ingest'

export type Stage = 'empty' | 'ingesting' | 'ingested' | 'analysing' | 'analysed' | 'refining' | 'refined'
export const STAGE_ORDER: Stage[] = ['empty', 'ingesting', 'ingested', 'analysing', 'analysed', 'refining', 'refined']
export const atLeast = (s: Stage, min: Stage) => STAGE_ORDER.indexOf(s) >= STAGE_ORDER.indexOf(min)

export const DEMO_BRIEF: Brief = {
  believe: ['Paul and Amy were together on the evening of 14 April.', "Paul and Cara don't know each other."],
  confused: ["Paul sent Ken $5,000 on 15 April and can't explain why."],
  unknown: ['Where did the missing money end up?', 'Did anyone react to the audit announcement?'],
}

export interface AgentLive {
  status: 'idle' | 'running' | 'done'
  current: string
  calls: number
}

export interface RunState {
  phase: 'idle' | 'sweep' | 'triage' | 'done'
  elapsed_ms: number
  agents: Record<SubagentName, AgentLive>
  calls: ToolCall[]
  hops: FollowUp[]
  logs: { at_ms: number; agent: SubagentName; text: string }[]
  envelopes: Partial<Record<SubagentName, AgentEnvelope>>
}

export interface RefineState {
  brief: Brief
  todos: Todo[]
  lanes: Partial<Record<SubagentName, AgentLive>>
  hops: { from: SubagentName; to: SubagentName; note: string }[]
  report: Report | null
  error: string | null
}

export interface AskTurn {
  q: string
  steps: string[]
  answer: Answer | null
}

const AGENTS: SubagentName[] = ['orchestrator', 'relationship-mapper', 'location-analyst', 'comms-analyst', 'financial-analyst', 'device-forensics', 'report-writer']
const idleAgents = () => Object.fromEntries(AGENTS.map((a) => [a, { status: 'idle', current: '', calls: 0 }])) as Record<SubagentName, AgentLive>
const emptyRun = (): RunState => ({ phase: 'idle', elapsed_ms: 0, agents: idleAgents(), calls: [], hops: [], logs: [], envelopes: {} })

interface CaseStore {
  stage: Stage
  caseInfo: CaseInfo | null
  ingestStages: IngestStage[]
  ingestReport: IngestReport | null
  run: RunState
  briefing: Briefing | null
  refine: RefineState
  finding: Finding | null
  openedEnvelope: AgentEnvelope | null
  askTurns: AskTurn[]
  askBusy: boolean
  // actions
  startIngest: (file?: File | null, fast?: boolean) => Promise<void>
  startAnalysis: (speed?: number) => Promise<void>
  fastForward: () => Promise<void>
  setBrief: (b: Brief) => void
  runRefine: (b?: Brief) => Promise<void>
  openFinding: (f: Finding | null) => void
  openEnvelope: (e: AgentEnvelope | null) => void
  ask: (q: string) => Promise<void>
  reset: () => void
}

const Ctx = createContext<CaseStore | null>(null)

export function CaseProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('empty')
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null)
  const [ingestStages, setIngestStages] = useState<IngestStage[]>(INGEST_STAGES)
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null)
  const [run, setRun] = useState<RunState>(emptyRun)
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [refine, setRefine] = useState<RefineState>({ brief: DEMO_BRIEF, todos: [], lanes: {}, hops: [], report: null, error: null })
  const [finding, setFinding] = useState<Finding | null>(null)
  const [openedEnvelope, setOpenedEnvelope] = useState<AgentEnvelope | null>(null)
  const [askTurns, setAskTurns] = useState<AskTurn[]>([])
  const [askBusy, setAskBusy] = useState(false)
  const runAbort = useRef<AbortController | null>(null)

  const startIngest = useCallback(async (file?: File | null, fast = false) => {
    setStage('ingesting')
    setIngestReport(null)
    const r = await ingestApi(file ?? null, setIngestStages, fast)
    setIngestReport(r)
    setCaseInfo(await getCase())
    setStage('ingested')
  }, [])

  const startAnalysis = useCallback(async (speed = 1) => {
    runAbort.current?.abort()
    const ctrl = new AbortController()
    runAbort.current = ctrl
    setStage('analysing')
    setRun(emptyRun())
    const t0 = performance.now()
    try {
      const b = await analyseCase(
        (e) =>
          setRun((r) => {
            const next = { ...r, elapsed_ms: Number.isFinite(speed) ? (performance.now() - t0) * speed : r.elapsed_ms }
            if (e.type === 'phase') next.phase = e.phase
            if (e.type === 'agent') next.agents = { ...r.agents, [e.agent]: { ...r.agents[e.agent], status: e.status, current: e.status === 'done' ? 'finished' : r.agents[e.agent].current } }
            if (e.type === 'tool') {
              next.calls = [...r.calls, e.call]
              const a = r.agents[e.call.agent]
              next.agents = { ...r.agents, [e.call.agent]: { ...a, status: a.status === 'done' ? 'done' : 'running', current: `${e.call.check}(${e.call.args})`, calls: a.calls + 1 } }
            }
            if (e.type === 'follow_up') next.hops = [...r.hops, e.hop]
            if (e.type === 'log') next.logs = [...r.logs, { at_ms: e.at_ms, agent: e.agent, text: e.text }]
            if (e.type === 'envelope') next.envelopes = { ...r.envelopes, [e.envelope.agent]: e.envelope }
            if (!Number.isFinite(speed)) {
              const t = e.type === 'tool' ? e.call.start_ms + e.call.ms : e.type === 'follow_up' ? e.hop.at_ms : e.type === 'envelope' ? e.envelope.finished_ms : e.at_ms
              next.elapsed_ms = Math.max(r.elapsed_ms, t)
            }
            return next
          }),
        speed,
        ctrl.signal,
      )
      setBriefing(b)
      setStage('analysed')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err
    }
  }, [])

  const fastForward = useCallback(async () => {
    await startIngest(null, true)
    await startAnalysis(Infinity)
  }, [startIngest, startAnalysis])

  const setBrief = useCallback((b: Brief) => setRefine((r) => ({ ...r, brief: b })), [])

  const runRefine = useCallback(async (b?: Brief) => {
    const brief = b ?? refine.brief
    setStage('refining')
    setRefine({ brief, todos: [], lanes: {}, hops: [], report: null, error: null })
    const onEvent = (e: AgentEvent) =>
      setRefine((r) => {
        if (e.type === 'todos') return { ...r, todos: e.todos }
        if (e.type === 'subagent' && e.status === 'follow_up' && e.to) return { ...r, hops: [...r.hops, { from: e.agent, to: e.to, note: e.note ?? '' }] }
        if (e.type === 'subagent') {
          const cur = r.lanes[e.agent] ?? { status: 'idle', current: '', calls: 0 }
          return {
            ...r,
            lanes: { ...r.lanes, [e.agent]: { status: e.status === 'done' ? 'done' : 'running', current: e.tool ?? e.note ?? cur.current, calls: cur.calls + (e.status === 'tool' ? 1 : 0) } },
          }
        }
        return r
      })
    try {
      const report = await analyse(brief, onEvent)
      setRefine((r) => ({ ...r, report }))
      setStage('refined')
    } catch (err) {
      setRefine((r) => ({ ...r, error: (err as Error).message }))
      setStage('analysed')
    }
  }, [refine.brief])

  const ask = useCallback(async (q: string) => {
    const question = q.trim()
    if (!question) return
    setAskBusy(true)
    setAskTurns((t) => [...t, { q: question, steps: [], answer: null }])
    const upd = (fn: (t: AskTurn) => AskTurn) => setAskTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)))
    await askApi(question, (e) => {
      if (e.type === 'step') upd((t) => ({ ...t, steps: [...t.steps, e.text] }))
      if (e.type === 'answer') upd((t) => ({ ...t, answer: e.answer }))
    })
    setAskBusy(false)
  }, [])

  const reset = useCallback(() => {
    runAbort.current?.abort()
    setStage('empty')
    setIngestStages(INGEST_STAGES)
    setIngestReport(null)
    setRun(emptyRun())
    setBriefing(null)
    setRefine({ brief: DEMO_BRIEF, todos: [], lanes: {}, hops: [], report: null, error: null })
    setAskTurns([])
  }, [])

  const value = useMemo<CaseStore>(
    () => ({
      stage,
      caseInfo,
      ingestStages,
      ingestReport,
      run,
      briefing,
      refine,
      finding,
      openedEnvelope,
      askTurns,
      askBusy,
      startIngest,
      startAnalysis,
      fastForward,
      setBrief,
      runRefine,
      openFinding: setFinding,
      openEnvelope: setOpenedEnvelope,
      ask,
      reset,
    }),
    [stage, caseInfo, ingestStages, ingestReport, run, briefing, refine, finding, openedEnvelope, askTurns, askBusy, startIngest, startAnalysis, fastForward, setBrief, runRefine, ask, reset],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCase() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCase outside CaseProvider')
  return c
}
