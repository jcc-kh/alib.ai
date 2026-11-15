import { useMemo, useState, type ReactNode } from 'react'
import type { PersonId } from '../../../api'
import { DAYS, eventsFor, exchangesIn, staysFor, type Block, type Exchange, type PhoneEvent, type Stay } from '../../../lib/caseTimeline'
import { ALL_PHONES, personColor, personName } from '../../../mock/data'
import { fmtDate, fmtKm, fmtTime } from '../../../lib/format'
import Portrait from '../../../components/Portrait'
import { useCase, type EvidenceItem } from '../../../state/caseStore'
import { InquiryHeader } from './meta'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HATCH = 'repeating-linear-gradient(45deg, var(--line-strong) 0 1.5px, transparent 1.5px 6px)'
/** Columns never get narrower than this; with many people the timeline scrolls sideways instead. */
const COL_MIN = 210

/**
 * Timeline of events: one timeline of the week leading up to it. Each day is split into blocks of a few
 * hours; each column is a phone on the board. A cell says where that phone was (or that it was dark),
 * what it deleted, and who it was with; under each block, every exchange between the people.
 * Anything in the timeline opens its evidence.
 */
export default function WindowView() {
  const c = useCase()
  const loaded = c.board.loaded
  const [hidden, setHidden] = useState<Set<PersonId>>(new Set())
  const people = loaded.filter((p) => !hidden.has(p))
  const [open, setOpen] = useState<Set<number>>(() => new Set([16, 17]))
  const toggleDay = (d: number) => setOpen((s) => (s.has(d) ? new Set([...s].filter((x) => x !== d)) : new Set([...s, d])))
  const togglePerson = (p: PersonId) =>
    setHidden((s) => {
      const n = new Set(s)
      if (n.has(p)) n.delete(p)
      else if (loaded.length - n.size > 1) n.add(p)
      return n
    })
  const cols = `9rem repeat(${people.length}, minmax(${COL_MIN}px, 1fr))`

  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="window" />
      <HowToRead />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] text-ink-2">Show:</span>
        {loaded.map((p) => (
          <button key={p} onClick={() => togglePerson(p)} className={`rounded-full border py-0.5 pl-0.5 pr-2.5 transition ${hidden.has(p) ? 'border-line opacity-45' : 'border-line-strong bg-surface'}`}>
            <Portrait id={p} size={22} label />
          </button>
        ))}
        <span className="ml-2 text-[11.5px] text-ink-3">Hide people to give the others more room. Click anything in the timeline for its evidence.</span>
      </div>

      <section className="max-h-[78vh] overflow-auto rounded-lg border border-line bg-surface">
        <div style={{ minWidth: `calc(9rem + ${people.length * COL_MIN}px)` }}>
          <div className="sticky top-0 z-20 grid gap-2 border-b border-line bg-surface px-3 py-2" style={{ gridTemplateColumns: cols }}>
            <div className="sticky left-0 z-10 self-end bg-surface text-[11px] text-ink-3">time</div>
            {people.map((p) => (
              <div key={p}>
                <Portrait id={p} size={26} label />
              </div>
            ))}
          </div>
          {DAYS.map((d) => {
            const isOpen = open.has(d.day)
            return (
              <div key={d.day} className="border-t border-line">
                <button onClick={() => toggleDay(d.day)} className="sticky left-0 flex items-center gap-2 px-3 py-2 text-left hover:bg-sunken">
                  <span className="w-3 text-ink-3">{isOpen ? '▾' : '▸'}</span>
                  <span className="text-[13px] font-semibold text-ink">
                    {DOW[d.day - 13]} {d.day} April
                  </span>
                  {d.title && <span className={`text-[12px] ${d.day === 16 ? 'font-medium text-serious' : 'text-ink-2'}`}>· {d.title}</span>}
                  {!isOpen && <DaySummary blocks={d.blocks} people={people} />}
                </button>
                {isOpen && d.blocks.map((b) => <BlockRow key={b.id} b={b} people={people} cols={cols} />)}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** The key, drawn with the same chips the timeline uses. */
function HowToRead() {
  const Item = ({ sample, text }: { sample: ReactNode; text: string }) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="w-60 shrink-0 whitespace-nowrap">{sample}</div>
      <span className="text-[12px] text-ink-2">{text}</span>
    </div>
  )
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">How to read the timeline</div>
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
        <Item sample={<Chip tone="scene" title="Pier 9 Warehouse" sub="21:25–23:30" />} text="The phone was at the scene" />
        <Item sample={<Chip tone="near" title="Harbor Rd lot" sub="950 m from Pier 9" />} text="Within 2 km of the scene" />
        <Item sample={<Chip tone="place" title="Dock Cafe" sub="with Cara" />} text="Another place; “with” = another phone there too" />
        <Item sample={<Chip tone="home" title="Home" sub="18:00–21:00" />} text="At home" />
        <Item sample={<Chip tone="dark" title="Phone switched off" sub="21:16–23:38" />} text="No location: switched off, or location turned off" />
        <Item sample={<span className="text-[12px] font-medium text-serious">✕ Deleted SMS thread</span>} text="Something deleted, or the phone switched off" />
      </div>
      <div className="mt-2 text-[12px] text-ink-2">
        Under each block, a box lists the <span className="font-medium text-ink">exchanges</span> between the people shown: calls, texts and payments. The red band is the medical examiner’s time-of-death window.
      </div>
    </div>
  )
}

type Tone = 'scene' | 'near' | 'place' | 'home' | 'dark'

function Chip({ tone, title, sub, extra, onClick }: { tone: Tone; title: string; sub?: string; extra?: ReactNode; onClick?: () => void }) {
  const style =
    tone === 'scene'
      ? { background: 'var(--serious)', color: 'var(--surface)' }
      : tone === 'near'
        ? { background: 'color-mix(in srgb, var(--warning) 24%, transparent)' }
        : tone === 'place'
          ? { background: 'var(--sunken)' }
          : tone === 'dark'
            ? { background: HATCH, border: '1px solid var(--line-strong)' }
            : { border: '1px solid var(--line)' }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`block w-full rounded px-2 py-1 text-left text-[12px] leading-snug ${onClick ? 'transition hover:ring-2 hover:ring-ink/30' : ''}`} style={style}>
      <span className={tone === 'dark' ? 'rounded bg-surface/90 px-0.5 font-medium text-ink' : tone === 'home' ? 'text-ink-2' : 'font-semibold'}>{title}</span>
      {sub && <span className={`ml-1.5 tnum text-[11px] ${tone === 'scene' ? 'opacity-90' : tone === 'dark' ? 'rounded bg-surface/90 px-0.5 text-ink-2' : 'text-ink-2'}`}>{sub}</span>}
      {extra}
    </Tag>
  )
}

/** A collapsed day: a one-line count of what happened. */
function DaySummary({ blocks, people }: { blocks: Block[]; people: PersonId[] }) {
  const n = blocks.reduce((a, b) => a + exchangesIn(b, people).length, 0)
  const meets = new Set(blocks.flatMap((b) => people.flatMap((p) => staysFor(p, b, people).filter((s) => s.with.length).map((s) => [p, ...s.with].sort().join('+')))))
  return (
    <span className="ml-2 text-[11.5px] text-ink-3">
      {n} exchange{n === 1 ? '' : 's'}
      {meets.size > 0 && ` · together: ${[...meets].map((k) => k.split('+').map(personName).join(' & ')).join(', ')}`}
    </span>
  )
}

function BlockRow({ b, people, cols }: { b: Block; people: PersonId[]; cols: string }) {
  const ex = useMemo(() => exchangesIn(b, people), [b, people])
  const bg = b.tod ? 'color-mix(in srgb, var(--serious) 6%, var(--surface))' : 'var(--surface)'
  return (
    <div className={b.tod ? 'border-y-2 border-serious/60' : 'border-t border-line/70'} style={{ background: bg }}>
      <div className="grid gap-2 px-3 py-2.5" style={{ gridTemplateColumns: cols }}>
        <div className="sticky left-0 z-10" style={{ background: bg }}>
          <div className={`text-[13px] font-medium ${b.tod ? 'text-serious' : 'text-ink'}`}>{b.label}</div>
          <div className="tnum text-[11.5px] text-ink-3">
            {fmtTime(b.start)}–{fmtTime(b.end)}
          </div>
          {b.tod && <div className="mt-0.5 text-[11px] text-ink-3">medical examiner’s window</div>}
        </div>
        {people.map((p) => (
          <Cell key={p} p={p} b={b} people={people} />
        ))}
      </div>
      {ex.length > 0 && <Exchanges ex={ex} />}
    </div>
  )
}

type Item = { t: string; s?: Stay; e?: PhoneEvent }

function Cell({ p, b, people }: { p: PersonId; b: Block; people: PersonId[] }) {
  const items = useMemo<Item[]>(() => {
    const stays = staysFor(p, b, people).map((s) => ({ t: s.start, s }))
    const evs = eventsFor(p, b).map((e) => ({ t: e.t, e }))
    return [...stays, ...evs].sort((x, y) => x.t.localeCompare(y.t))
  }, [p, b, people])
  if (!items.length) return <div className="text-[12px] text-ink-3">no data</div>
  return <div className="min-w-0 space-y-1">{items.map((it, k) => (it.s ? <StayChip key={k} p={p} s={it.s} /> : <EventLine key={k} p={p} e={it.e!} />))}</div>
}

function StayChip({ p, s }: { p: PersonId; s: Stay }) {
  const c = useCase()
  const range = `${fmtTime(s.start)}–${fmtTime(s.end)}`
  const day = fmtDate(s.start)
  const open = (item: EvidenceItem) => c.openEvidence(item)
  if (s.kind === 'gap') {
    const what = s.gap_type === 'powered_off' ? 'Phone switched off' : s.gap_type === 'location_off' ? 'Location off, phone in use' : 'No location data'
    return (
      <Chip
        tone="dark"
        title={what}
        sub={range}
        onClick={() =>
          open({
            title: `${personName(p)}'s phone: ${what.toLowerCase()}, ${day} ${range}`,
            people: [p],
            points: [
              s.gap_type === 'powered_off' ? 'The phone recorded a shutdown and later a start-up; no location in between.' : s.gap_type === 'location_off' ? 'The phone kept making calls or sending texts but reported no location.' : 'No location and no other activity in this period.',
              ...(s.last_fix ? [`Last location before it went dark: ${s.last_fix.place} at ${fmtTime(s.last_fix.t)}, ${fmtKm(s.last_fix.scene_m)} from Pier 9.`] : []),
            ],
            ids: s.ids,
          })
        }
        extra={
          s.last_fix && (
            <div className="mt-0.5">
              <span className="rounded bg-surface/90 px-0.5 text-[11px] text-ink-2">
                last seen {fmtTime(s.last_fix.t)} at <span className="font-medium text-ink">{s.last_fix.place}</span>
                {s.last_fix.scene_m < 2000 && <span className="font-medium text-serious">, {fmtKm(s.last_fix.scene_m)} from Pier 9</span>}
              </span>
            </div>
          )
        }
      />
    )
  }
  const tone: Tone = s.scene ? 'scene' : s.near_m !== undefined ? 'near' : s.home ? 'home' : 'place'
  const notable = tone !== 'home'
  return (
    <Chip
      tone={tone}
      title={s.home ? 'Home' : s.place!}
      sub={range}
      onClick={
        notable
          ? () =>
              open({
                title: `${personName(p)}${s.with.length ? ` and ${s.with.map(personName).join(', ')}` : ''} at ${s.place}, ${day} ${range}`,
                people: [p, ...s.with],
                points: [
                  `${personName(p)}'s phone reported its location at ${s.place} from ${fmtTime(s.start)} to ${fmtTime(s.end)}.`,
                  ...(s.scene ? ['This is the scene, Pier 9 Warehouse.'] : s.near_m !== undefined ? [`${s.place} is ${fmtKm(s.near_m)} from Pier 9.`] : []),
                  ...s.with.map((o) => `${personName(o)}'s phone was at the same place at the same time.`),
                ],
                ids: s.ids,
              })
          : undefined
      }
      extra={
        <>
          {s.near_m !== undefined && <div className="text-[11px] text-ink-2">{fmtKm(s.near_m)} from Pier 9</div>}
          {s.with.length > 0 && <div className="text-[11px] font-medium">with {s.with.map(personName).join(', ')}</div>}
        </>
      }
    />
  )
}

function EventLine({ p, e }: { p: PersonId; e: PhoneEvent }) {
  const c = useCase()
  return (
    <button
      onClick={() => c.openEvidence({ title: `${personName(p)}'s phone: ${e.label.toLowerCase()}, ${fmtDate(e.t)} ${fmtTime(e.t)}`, people: [p], points: [`Recorded in ${personName(p)}'s device log at ${fmtTime(e.t)}.`], ids: [e.id] })}
      className={`block text-left text-[12px] hover:underline ${e.serious ? 'font-medium text-serious' : 'text-ink-2'}`}
    >
      <span className="tnum text-[11px] font-normal text-ink-3">{fmtTime(e.t)}</span> {e.serious ? '✕ ' : ''}
      {e.label}
    </button>
  )
}

function Exchanges({ ex }: { ex: Exchange[] }) {
  const c = useCase()
  const [all, setAll] = useState(false)
  const shown = all ? ex : ex.slice(0, 6)
  const toName = (x: Exchange) => (ALL_PHONES.includes(x.to) ? personName(x.to) : `the ${x.to} group`)
  return (
    <div className="sticky left-3 mx-3 mb-2.5 max-w-[calc(100vw-5rem)] rounded-md border border-line bg-surface px-3 py-2">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Exchanges · {ex.length}</div>
      <ul className="space-y-0.5">
        {shown.map((x) => (
          <li key={x.ids[0]}>
            <button
              onClick={() =>
                c.openEvidence({
                  title: `${personName(x.from)} → ${toName(x)}: ${x.kind}, ${fmtDate(x.t)} ${fmtTime(x.t)}`,
                  people: ALL_PHONES.includes(x.to) ? [x.from, x.to] : [x.from],
                  points: [x.text, x.ids.length > 1 ? 'The same record is on both phones.' : `Only on one phone; the other copy is missing.`],
                  ids: x.ids,
                })
              }
              className="flex w-full items-baseline gap-2.5 rounded px-1 py-0.5 text-left text-[12.5px] hover:bg-sunken"
            >
              <span className="tnum w-11 shrink-0 text-[11.5px] text-ink-3">{fmtTime(x.t)}</span>
              <span className="shrink-0 font-medium">
                <Name p={x.from} /> <span className="text-ink-3">→</span> {ALL_PHONES.includes(x.to) ? <Name p={x.to} /> : <span className="text-ink-2">{x.to} (group)</span>}
              </span>
              <span className="w-12 shrink-0 text-[11px] uppercase tracking-[0.04em] text-ink-3">{x.kind}</span>
              <span className="min-w-0 truncate text-ink" title={x.text}>
                {x.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {ex.length > 6 && (
        <button onClick={() => setAll((v) => !v)} className="mt-0.5 text-[11.5px] text-ink-2 underline decoration-line-strong underline-offset-2">
          {all ? 'Show fewer' : `Show all ${ex.length}`}
        </button>
      )}
    </div>
  )
}

function Name({ p }: { p: PersonId }) {
  return <span style={{ color: personColor(p) }}>{personName(p)}</span>
}
