// Noir: the same case, presented as an investigation you unlock room by room.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { atLeast, useCase, type Stage } from '../../state/caseStore'
import FindingDetail from '../../components/FindingDetail'
import Locker from './Locker'
import BackRoom from './BackRoom'
import Board from './Board'
import Theory from './Theory'
import Interrogate from './Interrogate'
import EnvelopeModal from './EnvelopeModal'

export type Room = 'locker' | 'backroom' | 'board' | 'theory' | 'interrogate'
const ROOMS: { id: Room; n: string; label: string; needs: Stage }[] = [
  { id: 'locker', n: 'I', label: 'Evidence locker', needs: 'empty' },
  { id: 'backroom', n: 'II', label: 'Back room', needs: 'ingested' },
  { id: 'board', n: 'III', label: 'Evidence board', needs: 'analysed' },
  { id: 'theory', n: 'IV', label: 'Your theory', needs: 'analysed' },
  { id: 'interrogate', n: 'V', label: 'Interrogation', needs: 'analysed' },
]

export default function NoirApp({ view, go, switchSkin }: { view: string; go: (v: string) => void; switchSkin: () => void }) {
  const c = useCase()
  const room: Room = (ROOMS.find((r) => r.id === view)?.id ?? 'locker') as Room
  const open = (r: Room) => atLeast(c.stage, ROOMS.find((x) => x.id === r)!.needs)
  const ff = useRef(false)
  useEffect(() => {
    if (!open(room) && c.stage === 'empty' && room !== 'locker' && !ff.current) {
      ff.current = true
      c.fastForward()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, c.stage])

  // Remember which doors were already unlocked so newly opened ones can animate.
  const [seen, setSeen] = useState<Set<Room>>(new Set(['locker']))
  useEffect(() => {
    const t = setTimeout(() => setSeen(new Set(ROOMS.filter((r) => open(r.id)).map((r) => r.id))), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.stage])

  return (
    <div className="noir-desk flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-6 border-b border-black/40 px-8 py-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#c9b38a]">Case file № 2026-0417</div>
          <div style={{ fontFamily: 'var(--display-font)' }} className="text-[26px] font-semibold leading-tight text-[#f3e6c8]">
            Harbor Supply Co. — the missing funds
          </div>
        </div>
        <nav className="ml-auto flex items-end gap-2">
          {ROOMS.map((r) => {
            const ok = open(r.id)
            const fresh = ok && !seen.has(r.id)
            return (
              <button
                key={r.id}
                disabled={!ok}
                onClick={() => go(r.id)}
                className={`relative flex h-[62px] w-[110px] flex-col items-center justify-end rounded-t-[40px] border-2 px-2 pb-1.5 text-center transition ${room === r.id ? 'border-[#e9c46a] bg-[#3a2716]' : ok ? 'border-[#6b4f33] bg-[#2a1c11] hover:border-[#a8825a]' : 'border-[#3d2c1d] bg-[#1e140c] opacity-70'} ${fresh ? 'unlock' : ''}`}
              >
                <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-[13px]">{ok ? <span className="text-[#e9c46a]">{r.n}</span> : <Padlock />}</span>
                <span className={`text-[10.5px] leading-tight ${ok ? 'text-[#efe3c8]' : 'text-[#7d6a52]'}`}>{r.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="flex flex-col gap-1 text-[11px]">
          <button onClick={switchSkin} className="text-[#c9b38a] underline-offset-2 hover:underline">
            Analyst dashboard
          </button>
          <button
            onClick={() => {
              c.reset()
              go('locker')
            }}
            className="text-[#8d785c] underline-offset-2 hover:underline"
          >
            Reset case
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {room === 'locker' && <Locker next={() => go('backroom')} />}
        {room === 'backroom' && <BackRoom next={() => go('board')} />}
        {room === 'board' && <Board next={() => go('theory')} />}
        {room === 'theory' && <Theory next={() => go('interrogate')} />}
        {room === 'interrogate' && <Interrogate />}
      </main>

      <EnvelopeModal />
      {c.finding && (
        <Modal onClose={() => c.openFinding(null)} wide>
          <div className="mb-3 flex items-center gap-3">
            <span className="stamp text-[12px] text-[#a3201e]">Dossier</span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#85745b]">{c.finding.id} · {c.finding.check}</span>
          </div>
          <FindingDetail finding={c.finding} />
        </Modal>
      )}
    </div>
  )
}

export function Padlock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 14 16">
      <path d="M3.5 7V4.8a3.5 3.5 0 0 1 7 0V7" fill="none" stroke="#9a8263" strokeWidth="1.6" />
      <rect x="1" y="7" width="12" height="8.5" rx="1.5" fill="#9a8263" />
      <circle cx="7" cy="11" r="1.3" fill="#2a1c11" />
    </svg>
  )
}

export function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`paper drop-in relative max-h-[90vh] w-full overflow-y-auto rounded-sm px-9 py-7 ${wide ? 'max-w-[860px]' : 'max-w-[640px]'}`} style={{ fontFamily: 'var(--ui-font)' }}>
        <button onClick={onClose} className="absolute right-4 top-3 text-[12px] text-[#85745b] hover:text-[#221a10]">
          close ✕
        </button>
        {children}
      </div>
    </div>
  )
}

/** Typewritten heading used across rooms. */
export function RoomTitle({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[11px] uppercase tracking-[0.3em] text-[#c9b38a]">{kicker}</div>
      <h2 style={{ fontFamily: 'var(--display-font)' }} className="text-[30px] font-semibold text-[#f3e6c8]">
        {children}
      </h2>
    </div>
  )
}

export function DeskButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-sm border-2 border-[#e9c46a] bg-[#3a2716] px-5 py-2 text-[14px] text-[#f3e6c8] shadow-[0_4px_0_#1a110a] transition hover:bg-[#4a321c] active:translate-y-0.5 active:shadow-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
