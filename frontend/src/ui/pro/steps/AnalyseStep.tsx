import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentEnvelope, SubagentName, ToolCall } from '../../../api'
import { useCase } from '../../../state/caseStore'
import { Btn, Kpi, Mono, Panel, Empty } from '../kit'

export const AGENT_META: Record<SubagentName, { role: string; owns: string }> = {
  orchestrator: { role: 'Orchestrator', owns: 'run_sweep · triage · follow-ups · assemble_report' },
  'relationship-mapper': { role: 'Relationship mapper', owns: 'identity_match · contact_graph' },
  'location-analyst': { role: 'Location analyst', owns: 'presence_window · activity_space · location_gaps · silent_meetings' },
  'comms-analyst': { role: 'Comms analyst', owns: 'last_contacts · missing_messages · search_messages' },
  'financial-analyst': { role: 'Financial analyst', owns: 'money_chains · get_events' },
  'device-forensics': { role: 'Device forensics', owns: 'deletions · power_events · synchronised_behaviour' },
  'social-analyst': { role: 'Social analyst', owns: 'social_profile · social_hostility' },
}
const TRACE_ORDER: SubagentName[] = ['orchestrator', 'relationship-mapper', 'location-analyst', 'comms-analyst', 'financial-analyst', 'device-forensics', 'social-analyst']
const TRIAGE_CHECKS = ['propose_incidents', 'anchor_moments', 'rank_incidents']
const WRITE_CHECKS = ['assemble_report', 'validate_report']

export default function AnalyseStep({ next }: { next: () => void }) {
  const c = useCase()
  const r = c.run
  // Local clock so running bars grow smoothly between events.
  const [now, setNow] = useState(0)
  const t0 = useRef<number | null>(null)
  useEffect(() => {
    if (c.stage !== 'analysing') return
    t0.current = performance.now() - r.elapsed_ms
    let raf = 0
    const tick = () => {
      setNow(performance.now() - (t0.current ?? 0))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.stage])
  const clock = c.stage === 'analysing' ? Math.max(now, r.elapsed_ms) : r.elapsed_ms

  const rowsRead = r.calls.reduce((n, x) => n + x.rows, 0)
  const signals = new Set(Object.values(r.envelopes).flatMap((e) => (e && e.agent !== 'orchestrator' ? e.signal_ids : [])))
  const idle = c.stage === 'ingested'

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <PhaseBar phase={r.phase} />
        <span className="tnum ml-auto text-[12px] text-ink-2">{(clock / 1000).toFixed(1)} s</span>
        {idle && (
          <Btn kind="primary" onClick={() => c.startAnalysis(1)}>
            Run analysis
          </Btn>
        )}
        {c.stage === 'analysing' && (
          <Btn onClick={() => c.startAnalysis(Infinity)} title="Skip the animation">
            Skip to result
          </Btn>
        )}
        {c.stage !== 'ingested' && c.stage !== 'analysing' && (
          <Btn kind="primary" onClick={next}>
            Review results →
          </Btn>
        )}
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Kpi label="Tool calls" value={r.calls.length} />
        <Kpi label="Rows read" value={rowsRead.toLocaleString()} />
        <Kpi label="Signals" value={signals.size} />
        <Kpi label="Follow-ups" value={r.hops.length} />
        <Kpi label="Agents done" value={`${Object.keys(r.envelopes).length} / 7`} />
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Agents" className="col-span-8" sub="click a finished agent to open its envelope">
          <AgentNetwork clock={clock} onReview={next} />
        </Panel>
        <Panel title="Run log" count={r.logs.length + r.calls.length} className="col-span-4" pad={false}>
          <RunLog clock={clock} />
        </Panel>
      </div>

      <Panel title="What each agent did, over time" sub="hover a bar for the exact call and result">
        {r.calls.length ? <Trace clock={clock} /> : <Empty>{idle ? 'Run the analysis to see every call on a timeline.' : 'Starting…'}</Empty>}
      </Panel>
    </div>
  )
}

function PhaseBar({ phase }: { phase: string }) {
  const steps = [
    ['sweep', 'Sweep', ''],
    ['triage', 'Triage', ''],
    ['done', 'Briefing ready', ''],
  ]
  const idx = steps.findIndex((s) => s[0] === phase)
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {steps.map(([k, label, sub], i) => (
        <div key={k} className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${i < idx || phase === 'done' ? 'border-line bg-sunken text-ink-2' : i === idx ? 'border-ink text-ink' : 'border-line text-ink-3'}`}>
            {i < idx || phase === 'done' ? '✓' : i === idx ? <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" /> : null}
            {label}
            {sub && <span className="text-ink-3">· {sub}</span>}
          </span>
          {i < steps.length - 1 && <span className="text-ink-3">→</span>}
        </div>
      ))}
    </div>
  )
}

// ---- Agent network: bundle → dispatch → people map → 5 domain agents → triage → write-up → main findings ----
type NodeKey = 'bundle' | 'dispatch' | 'relationship-mapper' | 'location-analyst' | 'comms-analyst' | 'financial-analyst' | 'device-forensics' | 'social-analyst' | 'triage' | 'writeup'
type NodeStatus = 'idle' | 'running' | 'done'
const NW = 700
const NH = 445
const NODES: { k: NodeKey; x: number; y: number; label: string; agent?: SubagentName }[] = [
  { k: 'bundle', x: 34, y: 210, label: 'Case bundle' },
  { k: 'dispatch', x: 130, y: 210, label: 'Orchestrator', agent: 'orchestrator' },
  { k: 'relationship-mapper', x: 240, y: 210, label: 'People map', agent: 'relationship-mapper' },
  { k: 'location-analyst', x: 370, y: 42, label: 'Location', agent: 'location-analyst' },
  { k: 'comms-analyst', x: 370, y: 126, label: 'Messages', agent: 'comms-analyst' },
  { k: 'financial-analyst', x: 370, y: 210, label: 'Money', agent: 'financial-analyst' },
  { k: 'device-forensics', x: 370, y: 294, label: 'Device', agent: 'device-forensics' },
  { k: 'social-analyst', x: 370, y: 378, label: 'Social', agent: 'social-analyst' },
  { k: 'triage', x: 500, y: 210, label: 'Triage', agent: 'orchestrator' },
  { k: 'writeup', x: 610, y: 210, label: 'Write-up', agent: 'orchestrator' },
]
const DOMAIN: NodeKey[] = ['location-analyst', 'comms-analyst', 'financial-analyst', 'device-forensics', 'social-analyst']
const EDGES: [NodeKey, NodeKey][] = [
  ['bundle', 'dispatch'],
  ['dispatch', 'relationship-mapper'],
  ...DOMAIN.map((d) => ['relationship-mapper', d] as [NodeKey, NodeKey]),
  ...DOMAIN.map((d) => [d, 'triage'] as [NodeKey, NodeKey]),
  ['triage', 'writeup'],
]
const NODE = Object.fromEntries(NODES.map((n) => [n.k, n])) as Record<NodeKey, (typeof NODES)[number]>
const R = 17

type Pt = { x: number; y: number }
const bez = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y })
const straightCtl = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const arcCtl = (a: Pt, b: Pt, bend = 70): Pt => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: (a.x + b.x) / 2 + (dy / len) * bend, y: (a.y + b.y) / 2 - (dx / len) * bend }
}
const nodeOf = (a: SubagentName): NodeKey => (a === 'orchestrator' ? 'dispatch' : (a as NodeKey))

function AgentNetwork({ clock, onReview }: { clock: number; onReview: () => void }) {
  const c = useCase()
  const r = c.run
  const orch = r.calls.filter((x) => x.agent === 'orchestrator')
  const dispatchEnd = orch[0] ? orch[0].start_ms + orch[0].ms : Infinity
  const triageCalls = orch.filter((x) => TRIAGE_CHECKS.includes(x.check))
  const writeCalls = orch.filter((x) => WRITE_CHECKS.includes(x.check))
  const triageStart = triageCalls[0]?.start_ms ?? Infinity
  const triageEnd = triageCalls.length === TRIAGE_CHECKS.length ? triageCalls[triageCalls.length - 1].start_ms + triageCalls[triageCalls.length - 1].ms : Infinity
  const writeStart = writeCalls[0]?.start_ms ?? Infinity
  const writeEnd = writeCalls.length === WRITE_CHECKS.length ? writeCalls[writeCalls.length - 1].start_ms + writeCalls[writeCalls.length - 1].ms : Infinity
  const finished = c.stage !== 'analysing' && c.stage !== 'ingested' && !!c.briefing

  const status = (k: NodeKey): NodeStatus => {
    if (k === 'bundle') return c.stage === 'ingested' && !r.calls.length ? 'idle' : 'done'
    if (finished) return 'done'
    if (k === 'dispatch') return clock >= dispatchEnd ? 'done' : r.agents.orchestrator.status === 'running' ? 'running' : 'idle'
    if (k === 'triage') return clock >= triageEnd ? 'done' : clock >= triageStart ? 'running' : 'idle'
    if (k === 'writeup') return clock >= writeEnd ? 'done' : clock >= writeStart ? 'running' : 'idle'
    const a = k as SubagentName
    return r.envelopes[a] ? 'done' : r.agents[a].status === 'running' ? 'running' : 'idle'
  }
  const st = Object.fromEntries(NODES.map((n) => [n.k, status(n.k)])) as Record<NodeKey, NodeStatus>
  const calls = (k: NodeKey) => (k === 'dispatch' ? orch.slice(0, 1) : k === 'triage' ? triageCalls : k === 'writeup' ? writeCalls : NODE[k].agent ? r.calls.filter((x) => x.agent === NODE[k].agent) : [])
  const current = (k: NodeKey) => [...calls(k)].reverse().find((x) => x.start_ms <= clock && clock < x.start_ms + x.ms)
  const envOf = (k: NodeKey) => (NODE[k].agent ? r.envelopes[NODE[k].agent!] : undefined)
  const done = Object.keys(r.envelopes).length
  const b = c.briefing

  return (
    <div className="flex items-stretch gap-3">
      <svg viewBox={`0 0 ${NW} ${NH}`} className="min-w-0 flex-1" style={{ maxHeight: 445 }}>
        {/* edges */}
        {EDGES.map(([u, v], i) => {
          const a = NODE[u]
          const z = NODE[v]
          const ctl = straightCtl(a, z)
          const used = st[u] !== 'idle' && st[v] !== 'idle'
          const live = st[v] === 'running' && st[u] !== 'idle'
          return (
            <g key={`${u}-${v}`}>
              <path d={`M${a.x},${a.y} Q${ctl.x},${ctl.y} ${z.x},${z.y}`} fill="none" stroke={used ? 'var(--ink-3)' : 'var(--line)'} strokeWidth={used ? 1.6 : 1.2} />
              {live &&
                [0, 0.33, 0.66].map((o) => {
                  const p = bez(a, ctl, z, (clock / 1200 + o + i * 0.11) % 1)
                  return <circle key={o} cx={p.x} cy={p.y} r={2.8} fill="var(--accent)" />
                })}
            </g>
          )
        })}
        {/* out edge to the conclusion */}
        <path d={`M${NODE.writeup.x},210 L${NW},210`} stroke={finished ? 'var(--ink)' : 'var(--line)'} strokeWidth={finished ? 2 : 1.2} strokeDasharray={finished ? undefined : '3 4'} />
        {/* follow-ups between agents */}
        {r.hops.map((h, i) => {
          const a = NODE[nodeOf(h.from)]
          const z = NODE[nodeOf(h.to)]
          const ctl = arcCtl(a, z)
          const t = (clock - h.at_ms) / 900
          if (t < 0) return null
          const p = t < 1 ? bez(a, ctl, z, t) : null
          return (
            <g key={i}>
              <path d={`M${a.x},${a.y} Q${ctl.x},${ctl.y} ${z.x},${z.y}`} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.85}>
                <title>{`${h.from} → ${h.to}: ${h.note}`}</title>
              </path>
              {p && (
                <>
                  <circle cx={p.x} cy={p.y} r={9} fill="var(--accent)" opacity={0.18} />
                  <circle cx={p.x} cy={p.y} r={4.5} fill="var(--accent)" />
                </>
              )}
            </g>
          )
        })}
        {/* nodes */}
        {NODES.map((n) => {
          const s = st[n.k]
          const env = envOf(n.k)
          const cur = s === 'running' ? current(n.k) : undefined
          const nCalls = calls(n.k).filter((x) => x.start_ms <= clock || finished).length
          const click = env && s === 'done' ? () => c.openEnvelope(env) : undefined
          if (n.k === 'bundle')
            return (
              <g key={n.k}>
                <rect x={n.x - 22} y={n.y - 16} width={44} height={32} rx={5} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.4} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={10.5} fill="var(--ink-2)" style={{ fontFamily: 'var(--mono-font)' }}>
                  .json
                </text>
                <text x={n.x} y={n.y + 33} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
                  {n.label}
                </text>
              </g>
            )
          return (
            <g key={n.k} onClick={click} className={click ? 'cursor-pointer' : ''}>
              {s === 'running' && <circle cx={n.x} cy={n.y} r={R + 7} fill="var(--accent)" opacity={0.15} className="pulse-dot" />}
              <circle cx={n.x} cy={n.y} r={R} fill={s === 'done' ? 'var(--ink)' : 'var(--surface)'} stroke={s === 'idle' ? 'var(--line-strong)' : s === 'running' ? 'var(--accent)' : 'var(--ink)'} strokeWidth={s === 'running' ? 2.2 : 1.5} />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={s === 'done' ? 'var(--surface)' : 'var(--ink-2)'} className="tnum">
                {s === 'done' ? '✓' : nCalls || ''}
              </text>
              <text x={n.x} y={n.y + R + 15} textAnchor="middle" fontSize={12.5} fontWeight={500} fill="var(--ink)" stroke="var(--surface)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
                {n.label}
              </text>
              <text x={n.x} y={n.y + R + 29} textAnchor="middle" fontSize={11} fill="var(--ink-3)" className="tnum" stroke="var(--surface)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
                {s === 'idle' ? 'waiting' : `${nCalls} call${nCalls === 1 ? '' : 's'}`}
                {env && s === 'done' ? ' · open' : ''}
              </text>
              {cur && (
                <text x={n.x} y={n.y - R - 9} textAnchor="middle" fontSize={11} fill="var(--accent)" style={{ fontFamily: 'var(--mono-font)' }} stroke="var(--surface)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
                  {cur.check}
                </text>
              )}
              {click && <circle cx={n.x} cy={n.y} r={R + 10} fill="transparent" />}
            </g>
          )
        })}
      </svg>

      {/* main findings */}
      <div className={`flex w-[220px] shrink-0 flex-col rounded-md border px-3 py-2.5 ${finished ? 'rise border-ink bg-surface' : 'border-dashed border-line-strong'}`}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">Main findings</div>
        {!finished || !b ? (
          <div className="mt-auto mb-auto text-center text-[12px] text-ink-3">
            <div className="tnum text-[22px] font-semibold text-ink-2">{done} / 7</div>
            agents done
          </div>
        ) : (
          <>
            <div className="tnum mt-1 text-[12px] text-ink-2">
              {b.incidents.length} insights · {b.anchors.length} anchor · {b.dismissed.length} set aside
            </div>
            <ol className="mt-2 space-y-1.5">
              {b.incidents.map((i) => (
                <li key={i.incident_id}>
                  <button onClick={() => c.openFinding(i.findings[0])} className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-sunken">
                    <span className="tnum mt-px text-[11px] text-ink-3">{i.rank}</span>
                    <span className="text-[12px] leading-snug text-ink">
                      {i.title}
                      {i.anchor_id && <span className="ml-1 text-[10px] text-serious">● anchor</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <Btn kind="primary" className="mt-auto justify-center" onClick={onReview}>
              Review →
            </Btn>
          </>
        )}
      </div>
    </div>
  )
}

export function EnvelopeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 24 17" className="shrink-0">
      <rect x="0.75" y="0.75" width="22.5" height="15.5" rx="2" fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="1.5" />
      <path d="M1.5 1.5 L12 9.5 L22.5 1.5" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
    </svg>
  )
}

function RunLog({ clock }: { clock: number }) {
  const c = useCase()
  const ref = useRef<HTMLDivElement>(null)
  const lines = useMemo(() => {
    const out: { t: number; agent: string; text: string; kind: 'call' | 'log' | 'hop' }[] = []
    for (const x of c.run.calls) {
      if (x.start_ms + x.ms <= clock) out.push({ t: x.start_ms + x.ms, agent: x.agent, text: `${x.check}(${x.args}) → ${x.result} · ${x.rows.toLocaleString()} rows · ${x.ms} ms`, kind: 'call' })
    }
    for (const l of c.run.logs) out.push({ t: l.at_ms, agent: l.agent, text: l.text, kind: 'log' })
    for (const h of c.run.hops) out.push({ t: h.at_ms, agent: h.from, text: `follow-up → ${h.to}: ${h.note}`, kind: 'hop' })
    return out.sort((a, b) => a.t - b.t)
  }, [c.run.calls, c.run.logs, c.run.hops, clock])
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [lines.length])
  return (
    <div ref={ref} className="h-[420px] overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
      {lines.length === 0 && <div className="text-ink-3">No events yet.</div>}
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[3.2rem_8.5rem_1fr] gap-2">
          <span className="tnum text-ink-3">{(l.t / 1000).toFixed(2)}s</span>
          <span className="truncate text-ink-2">{l.agent}</span>
          <span className={l.kind === 'hop' ? 'text-accent' : l.kind === 'log' ? 'text-ink' : 'text-ink-2'}>{l.text}</span>
        </div>
      ))}
    </div>
  )
}

const AGENT_SHORT: Record<SubagentName, string> = {
  orchestrator: 'Orchestrator',
  'relationship-mapper': 'People map',
  'location-analyst': 'Location',
  'comms-analyst': 'Messages',
  'financial-analyst': 'Money',
  'device-forensics': 'Device',
  'social-analyst': 'Social',
}
const PLAIN: Record<string, string> = {
  run_sweep: 'hand out work',
  presence_window: 'place every phone in the window',
  activity_space: 'draw routine areas',
  last_contacts: "victim's last contacts",
  social_profile: 'read social profiles',
  social_hostility: 'score posts for hostility',
  assemble_report: 'assemble the report',
  identity_match: 'match numbers to people',
  contact_graph: 'who contacts whom',
  location_timeline: 'build location timelines',
  location_gaps: 'find location gaps',
  distance_between: 'distance per pair',
  silent_meetings: 'meetings with no contact',
  missing_messages: 'compare message threads',
  search_messages: 'search messages',
  deletions: 'find deletions',
  power_events: 'power on/off',
  synchronised_behaviour: 'phones acting together',
  money_chains: 'trace money',
  get_events: 'look up events',
  propose_incidents: 'group into insights',
  anchor_moments: 'find anchor moments',
  rank_incidents: 'rank insights',
  write_headlines: 'write headlines',
  validate_report: 'check every number',
}

const SHORT: Record<string, string> = {
  run_sweep: 'dispatch',
  presence_window: 'presence',
  activity_space: 'routine areas',
  last_contacts: 'last contacts',
  social_profile: 'profiles',
  social_hostility: 'hostility',
  assemble_report: 'assemble',
  identity_match: 'identities',
  contact_graph: 'contacts',
  location_timeline: 'timelines',
  location_gaps: 'gaps',
  distance_between: 'distances',
  silent_meetings: 'meetings',
  missing_messages: 'missing texts',
  search_messages: 'search',
  deletions: 'deletions',
  power_events: 'power',
  synchronised_behaviour: 'in sync',
  money_chains: 'money trail',
  get_events: 'look-up',
  propose_incidents: 'group',
  anchor_moments: 'anchors',
  rank_incidents: 'rank',
  write_headlines: 'headlines',
  validate_report: 'verify',
}

type Group = { agent: SubagentName; check: string; start: number; end: number; calls: ToolCall[]; follow: boolean }

function Trace({ clock }: { clock: number }) {
  const c = useCase()
  const calls = c.run.calls.filter((x) => x.start_ms <= clock)
  const total = Math.max(clock, ...c.run.calls.map((x) => x.start_ms + x.ms), 1000)
  const W = 1180
  const L = 120
  const TOP = 28
  const row = 32
  const H = TOP + TRACE_ORDER.length * row + 22
  const x = (ms: number) => L + (ms / total) * (W - L - 10)
  const y = (a: SubagentName) => TOP + TRACE_ORDER.indexOf(a) * row + 6
  const [hover, setHover] = useState<Group | null>(null)

  // Merge back-to-back runs of the same check into one bar ("build location timelines ×4").
  const groups: Group[] = []
  for (const cl of [...calls].sort((a, b) => a.start_ms - b.start_ms)) {
    const end = Math.min(clock, cl.start_ms + cl.ms)
    const g = [...groups].reverse().find((g) => g.agent === cl.agent)
    if (g && g.check === cl.check && !!cl.follow_up_from === g.follow && cl.start_ms - g.end < 60) {
      g.end = end
      g.calls.push(cl)
    } else groups.push({ agent: cl.agent, check: cl.check, start: cl.start_ms, end, calls: [cl], follow: !!cl.follow_up_from })
  }

  // Phases: sweep until triage starts, triage until the write-up starts, then the write-up.
  const orch = c.run.calls.filter((x) => x.agent === 'orchestrator')
  const triStart = orch.find((x) => TRIAGE_CHECKS.includes(x.check))?.start_ms
  const rw = c.run.calls.find((x) => WRITE_CHECKS.includes(x.check))?.start_ms
  const phases = [
    { label: '1 · Sweep: every check on every pair of phones', a: 0, b: triStart ?? total },
    ...(triStart !== undefined ? [{ label: '2 · Triage', a: triStart, b: rw ?? total }] : []),
    ...(rw !== undefined ? [{ label: '3 · Write-up', a: rw, b: total }] : []),
  ]
  const hops = c.run.hops.filter((h) => h.at_ms <= clock)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <marker id="tr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {phases.map((p, i) => (
          <g key={p.label}>
            <rect x={x(p.a)} y={0} width={Math.max(0, x(p.b) - x(p.a) - 2)} height={H - 22} fill={i % 2 ? 'var(--sunken)' : 'transparent'} />
            <text x={x(p.a) + 6} y={16} fontSize={11.5} fontWeight={600} fill="var(--ink-2)">
              {p.label}
            </text>
          </g>
        ))}
        {TRACE_ORDER.map((a) => (
          <g key={a}>
            <line x1={L} x2={W - 10} y1={y(a) + 10} y2={y(a) + 10} stroke="var(--line)" />
            <text x={0} y={y(a) + 14} fontSize={12} fill="var(--ink)">
              {AGENT_SHORT[a]}
            </text>
          </g>
        ))}
        {groups.map((g, k) => {
          const w = Math.max(3, x(g.end) - x(g.start) - 2)
          const full = `${SHORT[g.check] ?? g.check}${g.calls.length > 1 ? ` ×${g.calls.length}` : ''}`
          const label = full.length * 6 + 10 < w ? full : (SHORT[g.check] ?? g.check).length * 6 + 10 < w ? SHORT[g.check] ?? g.check : ''
          const fits = !!label
          return (
            <g key={k} onMouseEnter={() => setHover(g)} onMouseLeave={() => setHover(null)} className="cursor-default">
              <rect x={x(g.start)} y={y(g.agent)} width={w} height={20} rx={4} fill={g.follow ? 'var(--accent)' : 'var(--ink-2)'} opacity={hover === g ? 1 : 0.85} />
              {fits && (
                <text x={x(g.start) + 6} y={y(g.agent) + 14} fontSize={11} fill="var(--surface)">
                  {label}
                </text>
              )}
            </g>
          )
        })}
        {hops.map((h, i) => {
          const hx = x(h.at_ms)
          const y1 = y(h.from) + 10
          const y2 = y(h.to) + 10
          return (
            <g key={i}>
              <path d={`M${hx},${y1} C${hx + 30},${y1} ${hx + 10},${y2} ${hx + 36},${y2}`} fill="none" stroke="var(--accent)" strokeWidth={1.6} markerEnd="url(#tr-arrow)" />
              <circle cx={hx} cy={y1} r={8} fill="var(--accent)" />
              <text x={hx} y={y1 + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--surface)">
                {i + 1}
              </text>
            </g>
          )
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={x(total * f)} y={H - 5} fontSize={10.5} textAnchor={f === 1 ? 'end' : 'middle'} fill="var(--ink-3)">
            {((total * f) / 1000).toFixed(1)} s
          </text>
        ))}
        {c.stage === 'analysing' && <line x1={x(clock)} x2={x(clock)} y1={0} y2={H - 18} stroke="var(--ink)" strokeDasharray="3 3" />}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute right-2 top-8 max-w-md rounded-md border border-line bg-surface px-3 py-2 text-[12px] shadow-lg">
          <div className="font-medium text-ink">
            {AGENT_SHORT[hover.agent]}: {PLAIN[hover.check] ?? hover.check}
          </div>
          {hover.calls.map((cl) => (
            <div key={cl.id} className="mt-1">
              <Mono className="text-ink-2">
                {cl.check}({cl.args})
              </Mono>
              <div className="tnum text-ink-3">
                → {cl.result} · {cl.rows.toLocaleString()} rows · {cl.ms} ms
              </div>
            </div>
          ))}
        </div>
      )}
      {hops.length > 0 && (
        <ol className="mt-3 space-y-1 text-[12px]">
          {hops.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-surface">{i + 1}</span>
              <span className="text-ink">
                {AGENT_SHORT[h.from]} asked {AGENT_SHORT[h.to]}: <span className="text-ink-2">{h.note}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-2 flex gap-5 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-ink-2" /> a check run on the phone data (longer = slower)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-accent" /> a check run because another agent asked
        </span>
      </div>
    </div>
  )
}
