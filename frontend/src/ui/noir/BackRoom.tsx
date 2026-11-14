import { useEffect, useRef, useState } from 'react'
import type { SubagentName } from '../../api'
import { useCase } from '../../state/caseStore'
import { DeskButton, RoomTitle } from './NoirApp'

const DESKS: { a: SubagentName; title: string }[] = [
  { a: 'orchestrator', title: 'The lead' },
  { a: 'relationship-mapper', title: 'Who knows whom' },
  { a: 'location-analyst', title: 'Where the phones were' },
  { a: 'comms-analyst', title: 'What was said' },
  { a: 'financial-analyst', title: 'Follow the money' },
  { a: 'device-forensics', title: 'What the phones did' },
  { a: 'report-writer', title: 'The write-up' },
]

export default function BackRoom({ next }: { next: () => void }) {
  const c = useCase()
  const r = c.run
  // live clock so the ticker only shows calls that have started
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
  const clock = c.stage === 'analysing' ? Math.max(now, r.elapsed_ms) : Number.POSITIVE_INFINITY

  return (
    <div className="px-10 py-8">
      <div className="flex items-start justify-between">
        <RoomTitle kicker="Room II · The back room">Seven investigators, one case</RoomTitle>
        <div className="flex flex-col items-end gap-2 pt-2">
          {c.stage === 'ingested' && <DeskButton onClick={() => c.startAnalysis(1)}>Put them to work</DeskButton>}
          {c.stage === 'analysing' && (
            <button onClick={() => c.startAnalysis(Infinity)} className="text-[12px] text-[#c9b38a] underline-offset-2 hover:underline">
              skip to the envelopes
            </button>
          )}
          {c.briefing && c.stage !== 'analysing' && <DeskButton onClick={next}>Unlock the evidence board →</DeskButton>}
          <div className="text-[12px] text-[#c9b38a]">
            {r.phase === 'idle' ? 'waiting for orders' : r.phase === 'sweep' ? 'sweeping every phone pair…' : r.phase === 'triage' ? 'sorting what matters…' : `${Object.keys(r.envelopes).length} envelopes on the desks`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {DESKS.map(({ a, title }, i) => {
          const calls = r.calls.filter((x) => x.agent === a && x.start_ms <= clock)
          const env = r.envelopes[a]
          const live = r.agents[a]
          const notesIn = r.hops.filter((h) => h.to === a && h.at_ms <= clock)
          return (
            <div key={a} className={`relative rounded-sm bg-[#4a3220] p-3 shadow-[0_12px_24px_rgba(0,0,0,0.5)] ${i <= 1 ? 'col-span-2' : ''} ${i === 6 ? 'col-span-4' : ''}`}>
              {/* lamp glow */}
              {live.status === 'running' && <div className="pointer-events-none absolute -top-6 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-[#ffd27a]/20 blur-2xl" />}
              <div className="flex items-baseline gap-2">
                <span className="text-[16px] text-[#f3e6c8]" style={{ fontFamily: 'var(--display-font)' }}>
                  {title}
                </span>
                <span className="text-[11px] text-[#c9b38a]">{a}</span>
                <span className={`ml-auto text-[11px] ${live.status === 'running' ? 'pulse-dot text-[#ffd27a]' : env ? 'text-[#9fd08a]' : 'text-[#8d785c]'}`}>
                  {env ? 'done' : live.status === 'running' ? 'working' : 'idle'}
                </span>
              </div>
              {/* typewriter paper */}
              <div className="paper mt-2 h-[112px] overflow-hidden rounded-sm px-3 py-2 text-[11.5px] leading-snug" style={{ fontFamily: 'var(--type-font)' }}>
                {calls.length === 0 ? (
                  <span className="text-[#a8977a]">…</span>
                ) : (
                  calls.slice(-4).map((cl) => (
                    <div key={cl.id} className="typed truncate text-[#221a10]">
                      {cl.follow_up_from ? '✎ ' : '› '}
                      {cl.check} — {cl.start_ms + cl.ms <= clock ? cl.result : '…'}
                    </div>
                  ))
                )}
              </div>
              {/* notes slid across */}
              {notesIn.map((h, k) => (
                <div key={k} className="drop-in absolute -right-3 top-10 w-44 rotate-[4deg] bg-[#fff6a8] px-2 py-1.5 text-[11px] text-[#221a10] shadow-lg" style={{ fontFamily: 'var(--type-font)' }}>
                  Note from {h.from}: {h.note}
                </div>
              ))}
              {/* envelope */}
              <div className="mt-3 h-[64px]">
                {env && (
                  <button onClick={() => c.openEnvelope(env)} className="manila drop-in relative flex h-full w-full items-center gap-3 rounded-sm px-3 text-left">
                    <span className="text-[13px] text-[#3a2a12]" style={{ fontFamily: 'var(--type-font)' }}>
                      {env.file}
                    </span>
                    <span className="text-[11px] text-[#6b5328]">
                      {env.findings.length} findings · {env.signal_ids.length} signals
                    </span>
                    <span className="stamp ml-auto text-[11px] text-[#a3201e]">Sealed</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
