import { useRef, useState } from 'react'
import { analyse, type AgentEvent, type Brief, type CaseInfo, type Finding, type Report, type SubagentName, type Todo } from '../api'
import BriefPanel from '../components/BriefPanel'
import AgentProgress, { type LaneState } from '../components/AgentProgress'
import ReportPanel from '../components/ReportPanel'
import EvidencePanel from '../components/EvidencePanel'

export const DEMO_BRIEF: Brief = {
  believe: ['Paul and Amy were together on the evening of 14 April.', "Paul and Cara don't know each other."],
  confused: ['Paul sent Ken $5,000 on 15 April and can\'t explain why.'],
  unknown: ['Where did the missing money end up?', 'Did anyone react to the audit announcement?'],
}

type RunState = 'empty' | 'running' | 'done' | 'error'

export default function CasePage({ caseInfo }: { caseInfo: CaseInfo }) {
  const [brief, setBrief] = useState<Brief>(DEMO_BRIEF)
  const [state, setState] = useState<RunState>('empty')
  const [todos, setTodos] = useState<Todo[]>([])
  const [lanes, setLanes] = useState<Partial<Record<SubagentName, LaneState>>>({})
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Finding | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function onEvent(e: AgentEvent) {
    if (e.type === 'todos') setTodos(e.todos)
    if (e.type === 'subagent')
      setLanes((prev) => {
        const cur = prev[e.agent] ?? { status: 'idle', calls: 0, log: [] }
        const line = e.tool ? `→ ${e.tool}` : e.note ?? ''
        return {
          ...prev,
          [e.agent]: {
            status: e.status === 'done' ? 'done' : 'working',
            calls: cur.calls + (e.status === 'tool' ? 1 : 0),
            log: line ? [...cur.log, line].slice(-3) : cur.log,
          },
        }
      })
    if (e.type === 'report') setReport(e.report)
  }

  async function run() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState('running')
    setTodos([])
    setLanes({})
    setReport(null)
    setSelected(null)
    setError(null)
    try {
      const r = await analyse(brief, onEvent, ctrl.signal)
      setReport(r)
      setState('done')
      setSelected(r.findings[0] ?? null)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
      setState('error')
    }
  }

  return (
    <div className="grid h-full grid-cols-[330px_minmax(0,1fr)_minmax(0,520px)]">
      <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white">
        <BriefPanel caseInfo={caseInfo} brief={brief} onChange={setBrief} onAnalyse={run} running={state === 'running'} />
      </aside>

      <section className="min-h-0 overflow-y-auto p-5">
        {state === 'empty' && (
          <div className="grid h-full place-items-center text-center text-slate-500">
            <div>
              <div className="text-4xl">⇠</div>
              <p className="mt-2">Review the brief on the left, then select <b>Analyse</b> to check it against all four phones.</p>
            </div>
          </div>
        )}
        {state === 'running' && <AgentProgress todos={todos} lanes={lanes} />}
        {state === 'error' && (
          <div className="mx-auto mt-16 max-w-md rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="font-semibold text-red-800">The analysis did not finish</div>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button onClick={run} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
              Retry
            </button>
          </div>
        )}
        {state === 'done' && report && <ReportPanel report={report} selectedId={selected?.id ?? null} onSelect={setSelected} />}
      </section>

      <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white">
        <EvidencePanel finding={state === 'done' ? selected : null} caseInfo={caseInfo} />
      </aside>
    </div>
  )
}
