import { useCase } from '../../state/caseStore'
import { PEOPLE } from '../../mock/data'
import { DeskButton, RoomTitle } from './NoirApp'

const LETTER = ['A', 'B', 'C', 'D']

export default function Locker({ next }: { next: () => void }) {
  const c = useCase()
  const r = c.ingestReport
  const running = c.stage === 'ingesting'
  const done = c.ingestStages.filter((s) => s.status === 'done').length
  return (
    <div className="px-10 py-8">
      <RoomTitle kicker="Room I · Evidence locker">Four phones, bagged and tagged</RoomTitle>

      {/* shelf */}
      <div className="relative rounded-sm bg-[#3b2817] px-8 pb-6 pt-8 shadow-[inset_0_-14px_0_#2a1c10]">
        <div className="grid grid-cols-4 gap-8">
          {PEOPLE.map((p, i) => {
            const d = r?.devices.find((x) => x.owner === p.person_id)
            return (
              <div key={p.person_id} className="relative">
                {/* evidence bag */}
                <div className="relative mx-auto h-[230px] w-[170px] rounded-md border border-white/25 bg-white/10 shadow-[0_10px_20px_rgba(0,0,0,0.5)] backdrop-blur-[1px]">
                  <div className="absolute inset-x-0 top-0 h-3 rounded-t-md bg-[#a3201e]/80" />
                  <div className="absolute left-3 top-5 text-[10px] uppercase tracking-[0.2em] text-[#f3e6c8]/80">Evidence</div>
                  {/* phone */}
                  <div className="absolute left-1/2 top-12 h-[130px] w-[66px] -translate-x-1/2 rounded-[12px] border-2 border-[#111] bg-[#1b1b1b] shadow-inner">
                    <div className="mx-auto mt-1.5 h-1 w-6 rounded-full bg-[#333]" />
                    <div className="mx-1.5 mt-2 h-[100px] rounded-md" style={{ background: `linear-gradient(160deg, ${p.color}, #0b0b0b)` }} />
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-[#f3e6c8]/80">{p.device_id}</div>
                </div>
                {/* tag */}
                <div className="paper relative mx-auto -mt-3 w-[180px] rotate-[-2deg] rounded-sm px-3 py-2 text-[12px]" style={{ fontFamily: 'var(--type-font)' }}>
                  <div className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#85745b] bg-[#f6eedb]" />
                  <div className="text-[15px] text-[#221a10]">Exhibit {LETTER[i]} · {p.name}</div>
                  <div className="text-[#594834]">{p.role}</div>
                  <div className="mt-1 border-t border-dashed border-[#c9b38a] pt-1 text-[#221a10]">
                    {d ? (
                      <>
                        {d.counts.messages.toLocaleString()} messages · {d.counts.calls} calls
                        <br />
                        {d.counts.locations.toLocaleString()} location fixes · {d.counts.transactions} payments
                      </>
                    ) : (
                      <span className="text-[#85745b]">{running ? 'logging…' : 'not yet logged'}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[1fr_auto] items-start gap-8">
        <div className="paper rounded-sm px-6 py-4" style={{ fontFamily: 'var(--type-font)' }}>
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#85745b]">Intake log</div>
          <ol className="mt-2 grid grid-cols-3 gap-x-6 gap-y-1 text-[13px] text-[#221a10]">
            {c.ingestStages.map((s, i) => (
              <li key={s.id} className={s.status === 'pending' ? 'text-[#a8977a]' : ''}>
                {s.status === 'done' ? '☑' : s.status === 'running' ? '▸' : '☐'} {i + 1}. {s.label}
              </li>
            ))}
          </ol>
          {r && (
            <p className="typed mt-3 text-[13px] text-[#594834]">
              {r.rows_checked.toLocaleString()} rows logged from {r.files_read} files · {r.errors} schema errors · {r.warnings.filter((w) => w.level === 'warn').length} notes for the file
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3 pt-2">
          {c.stage === 'empty' || running ? (
            <DeskButton disabled={running} onClick={() => c.startIngest(null)}>
              {running ? `Logging… ${done}/6` : 'Log the evidence'}
            </DeskButton>
          ) : (
            <DeskButton
              disabled={c.stage !== 'ingested' && c.stage !== 'analysing' && !c.briefing}
              onClick={() => {
                next()
                if (c.stage === 'ingested') c.startAnalysis(1)
              }}
            >
              Unlock the back room →
            </DeskButton>
          )}
          {c.stage === 'empty' && (
            <button onClick={() => c.fastForward()} className="text-[11px] text-[#8d785c] underline-offset-2 hover:underline">
              skip ahead to a solved case
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
