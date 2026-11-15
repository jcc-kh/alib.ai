import { useState } from 'react'
import type { Tie } from '../../../api'
import type { View } from '../ProApp'
import { useCase, useKnown } from '../../../state/caseStore'
import { FOUND_AT, PEOPLE, SCENE, TOD, VICTIM, personOf } from '../../../mock/data'
import { DISMISSALS } from '../../../mock/signals'
import { QUEUE, START, phoneLabel, sourceOf } from '../../../mock/sources'
import { fmtDate, fmtTime } from '../../../lib/format'
import Portrait, { Unknown } from '../../../components/Portrait'
import RelationshipChart, { TIE_STYLE, type TieWeight } from '../../../components/RelationshipChart'
import TieExchanges from '../../../components/TieExchanges'
import NetworkView from '../../../components/NetworkView'
import Scorecard from '../Scorecard'
import BoardCard, { type CardId } from './BoardCard'
import InsightNote from './InsightNote'
import AgentRunPanel, { SHEET_MIN, SHEET_OPEN } from './AgentRunPanel'
import { ACTION_CLASS, ActionLabel, AddSourceMenu, ChangeToast, IngestPanel } from './AddSource'

const FLASH: Record<CardId, number> = { relations: 0 }
const NOTES_SHOWN = 4

export default function BoardView({ open, onAsk }: { open: (v: View) => void; onAsk: () => void }) {
  const c = useCase()
  const b = c.board
  const fresh = c.fresh
  const [tie, setTie] = useState<Tie | null>(null)
  const [allNotes, setAllNotes] = useState(false)
  const [full, setFull] = useState(false)
  const [runMin, setRunMin] = useState(false)
  const sheet = c.runFor && c.runStage !== 'idle' ? (runMin ? SHEET_MIN : SHEET_OPEN) : null
  const flash = (id: CardId) => (fresh ? FLASH[id] : undefined)


  const notes = allNotes ? b.incidents : b.incidents.slice(0, NOTES_SHOWN)
  const tagOf = (id: string) => (fresh?.newIncidents.includes(id) ? 'new' : fresh?.strengthened.includes(id) ? 'stronger' : undefined)

  return (
    <div className="board-surface relative min-h-full p-4" style={sheet ? { paddingBottom: `calc(${sheet} + 16px)` } : undefined}>
      <CaseStrip />
      {c.ingesting && (
        <div className="mt-3">
          <IngestPanel />
        </div>
      )}

      <div className="mt-4 grid grid-cols-12 gap-4">
        {/* Left: relationships, then the actions. Right: insight notes. */}
        <div className={`col-span-12 flex flex-col gap-4 ${full ? '' : 'xl:col-span-7'}`}>
          <BoardCard
            id="relations"
            title={full ? 'Full network' : 'Relationships'}
            caption={full ? `${b.loaded.length} phones examined · one line per channel per pair · click a line for every interaction` : `${b.loaded.length} phones examined · ${b.ties.length} ties · click a line for every exchange`}
            flash={flash('relations')}
            expanded={full}
            onExpand={() => {
              setFull((f) => !f)
              setTie(null)
            }}
            footer={
              !full && <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3.5 py-2 text-[11px] text-ink-2">
                {(Object.keys(TIE_STYLE) as TieWeight[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5" title={TIE_STYLE[k].rule}>
                    <svg width="24" height="8">
                      <line x1="1" x2="23" y1="4" y2="4" stroke={TIE_STYLE[k].stroke} strokeWidth={TIE_STYLE[k].width} strokeDasharray={TIE_STYLE[k].dash} strokeLinecap="round" />
                    </svg>
                    {TIE_STYLE[k].label}
                  </span>
                ))}
                <span className="text-line-strong">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-amber text-[10px] font-extrabold text-white">!</span>
                  something to note · hover for details
                </span>
              </div>
            }
          >
            {full ? (
              <NetworkView board={b} />
            ) : (
              <>
                <RelationshipChart board={b} fresh={fresh} onTie={setTie} height={440} selectedKey={tie?.key ?? null} />
                {tie ? (
                  <div className="rise mt-2 h-[380px]">
                    <TieExchanges key={tie.key} tie={tie} onClose={() => setTie(null)} />
                  </div>
                ) : (
                  <div className="mt-1 text-center text-[11.5px] text-ink-3">Click a line between two people to list every call, text, payment and meeting between them.</div>
                )}
              </>
            )}
          </BoardCard>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AddSourceMenu />
            <button onClick={() => open('interviews')} className={ACTION_CLASS}>
              <ActionLabel
                icon="verify"
                title="Verify interview"
                sub={c.reading ? 'Reading transcript…' : c.transcripts.length ? `${c.transcripts.length} transcript${c.transcripts.length === 1 ? '' : 's'} checked` : 'Check statements against the phones'}
              />
            </button>
            <button onClick={onAsk} className={ACTION_CLASS}>
              <ActionLabel icon="ask" title="Ask about this case" sub="Answers cite the source rows" />
            </button>
          </div>
        </div>

        <div className={`col-span-12 flex flex-col gap-3 ${full ? '' : 'xl:col-span-5'}`}>
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[13px] font-semibold text-ink">Insights</h3>
            <span className="tnum rounded bg-surface px-1.5 text-[11px] text-ink-2">{b.incidents.length}</span>
            <span className="truncate text-[11.5px] text-ink-3">ranked by how many checks agree</span>
          </div>
          {notes.map((i, k) => (
            <InsightNote key={i.incident_id} i={i} tag={tagOf(i.incident_id)} delay={800 + k * 140} active={false} onHover={() => {}} />
          ))}
          {b.incidents.length > NOTES_SHOWN && (
            <button onClick={() => setAllNotes((v) => !v)} className="rounded-md px-2 py-1 text-left text-[12px] text-ink-2 hover:text-ink">
              {allNotes ? 'Show fewer' : `Show all ${b.incidents.length} insights`}
            </button>
          )}
          <SetAside />
        </div>

      </div>

      <AgentRunPanel min={runMin} onToggle={() => setRunMin((m) => !m)} />
      <ChangeToast lift={sheet} />
    </div>
  )
}

function CaseStrip() {
  const c = useCase()
  const known = useKnown()
  const v = personOf(VICTIM)
  return (
    <div className="board-card flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-line px-4 py-3">
      <div className="flex items-center gap-3">
        <Portrait id={VICTIM} size={44} />
        <dl className="tnum grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px] leading-snug">
          <dt className="text-ink-3">Victim</dt>
          <dd className="font-semibold text-ink">{v.name}</dd>
          <dt className="text-ink-3">Found</dt>
          <dd className="text-ink">
            {fmtDate(FOUND_AT)} {fmtTime(FOUND_AT)} · {SCENE.name}
          </dd>
          <dt className="text-ink-3">Time of death</dt>
          <dd className="text-ink">
            {fmtDate(TOD.start)} {fmtTime(TOD.start)}–{fmtTime(TOD.end)}
          </dd>
        </dl>
      </div>
      <div className="h-12 w-px bg-line" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Evidence</span>
        {[...START, ...QUEUE].map((id) => {
          const on = c.loaded.includes(id)
          const busy = c.ingesting?.source === id
          return (
            <span
              key={id}
              title={on ? `${sourceOf(id).rows.toLocaleString()} rows` : busy ? 'Adding…' : 'Seized, not yet examined: owner not confirmed'}
              className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12px] ${on ? 'border-line-strong bg-surface text-ink' : busy ? 'border-accent text-ink' : 'border-dashed border-line-strong text-ink-3'}`}
            >
              {on ? <Portrait id={id} size={20} ring={false} /> : <Unknown size={20} />}
              {phoneLabel(id, known(id))}
              {on ? <span className="text-good">✓</span> : busy ? <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" /> : null}
            </span>
          )
        })}
        <span className="tnum ml-2 text-[11.5px] text-ink-3">
          {c.board.rows.toLocaleString()} rows · {c.board.incidents.length} insight{c.board.incidents.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}

function SetAside() {
  const c = useCase()
  const [open, setOpen] = useState(false)
  // Only what was actually checked: every person a dismissal names must have a loaded phone.
  const names = PEOPLE.map((p) => [p.person_id, p.name.split(' ')[0]] as const)
  const list = DISMISSALS.filter((d) => names.every(([id, n]) => !d.title.includes(n) || c.loaded.includes(id)))
  return (
    <div className="board-card rounded-lg border border-line">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left">
        <span className="text-[12.5px] font-medium text-ink">Checked and set aside</span>
        <span className="tnum rounded bg-sunken px-1.5 text-[11px] text-ink-2">{list.length}</span>
        <span className="text-[11.5px] text-ink-3">· scorecard vs answer key</span>
        <span className="ml-auto text-ink-3">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3">
          <ul className="space-y-1.5">
            {list.map((d) => (
              <li key={d.title} className="text-[12px]">
                <div className="text-ink">{d.title}</div>
                <div className="text-[11.5px] text-ink-3">{d.rule}</div>
              </li>
            ))}
          </ul>
          <Scorecard />
        </div>
      )}
    </div>
  )
}

