import { useMemo, useState } from 'react'
import type { PersonId } from '../../../api'
import { HOSTILE, HOSTILITY_MODEL, TOD, personName } from '../../../mock/data'
import { THEMES, statementsFor, type Statement, type ThemeId } from '../../../mock/semantics'
import { caseMinutes, fmtDate, fmtTime } from '../../../lib/format'
import Portrait from '../../../components/Portrait'
import { useCase } from '../../../state/caseStore'
import { InquiryHeader } from './meta'

const T = HOSTILE.threshold
const SHARP = 0.4
const WEEK = 7 * 1440
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAYS = [13, 14, 15, 16, 17, 18, 19]
const themeOf = (id: ThemeId) => THEMES.find((t) => t.id === id)!
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The three readings of a hostility score. Every coloured mark on this page uses these, and the key names them. */
const BANDS = [
  { id: 'hostile', label: 'Hostile', range: `${T} or more, flagged`, color: 'var(--serious)' },
  { id: 'sharper', label: 'Sharper than usual', range: `${SHARP} to ${T}`, color: 'var(--warning)' },
  { id: 'neutral', label: 'Neutral', range: `below ${SHARP}`, color: 'var(--ink-3)' },
] as const
const bandOf = (score: number) => (score >= T ? BANDS[0] : score >= SHARP ? BANDS[1] : BANDS[2])
const x = (iso: string) => (caseMinutes(iso) / WEEK) * 100

/** Semantic analysis: how each person's tone moved over the week, with the statements that matched a theme beside it. */
export default function MotiveView() {
  const c = useCase()
  const loaded = c.board.loaded
  const all = useMemo(() => statementsFor(loaded), [loaded])
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [person, setPerson] = useState<PersonId | null>(null)
  const tagged = all.filter((s) => s.themes.length)
  const shown = tagged.filter((s) => (!theme || s.themes.includes(theme)) && (!person || s.speaker === person))
  const open = (s: Statement) =>
    c.openEvidence({
      title: `${personName(s.speaker)}, ${s.audience}, ${fmtDate(s.t)} ${fmtTime(s.t)}`,
      people: [s.speaker, ...s.about],
      points: [
        `“${s.text}”`,
        ...s.themes.map((t) => `${themeOf(t).label}: matched “${s.matches.filter((m) => m.theme === t).map((m) => m.phrase).join('”, “')}”.`),
        ...(s.score !== null ? [`Hostility score ${s.score.toFixed(2)}: ${bandOf(s.score).label.toLowerCase()} (flagged at ${T} or more).`] : []),
      ],
      ids: [s.id],
    })

  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="motive" />
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Tone loaded={loaded} posts={all.filter((s) => s.channel === 'post' && s.score !== null)} selected={person} onSelect={(p) => setPerson(person === p ? null : p)} onOpen={open} />

        {/* ---------------- themes, on the side ---------------- */}
        <aside className="flex min-w-0 flex-col rounded-lg border border-line bg-surface lg:sticky lg:top-3 lg:max-h-[calc(100vh-7rem)]">
          <div className="px-3.5 pb-2 pt-3">
            <h3 className="text-[13.5px] font-semibold text-ink">What matched a theme</h3>
            <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">
              {tagged.length} of {all.length} posts and texts. Pick a theme to narrow the list.
            </p>
          </div>
          <ul className="border-y border-line">
            {THEMES.map((th, k) => {
              const xs = tagged.filter((s) => s.themes.includes(th.id) && (!person || s.speaker === person))
              const on = theme === th.id
              return (
                <li key={th.id} className={k ? 'border-t border-line/70' : ''}>
                  <button onClick={() => setTheme(on ? null : th.id)} aria-pressed={on} title={th.what} className={`flex w-full items-center gap-2 px-3.5 py-1.5 text-left transition ${on ? 'bg-sunken' : 'hover:bg-sunken'} ${xs.length ? '' : 'opacity-45'}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: th.color }} />
                    <span className={`min-w-0 flex-1 truncate text-[12.5px] ${on ? 'font-semibold text-ink' : 'text-ink'}`}>{th.label}</span>
                    <span className="flex -space-x-1.5">
                      {[...new Set(xs.map((s) => s.speaker))].map((p) => (
                        <Portrait key={p} id={p} size={16} ring={false} />
                      ))}
                    </span>
                    <span className="tnum w-5 text-right text-[12.5px] font-medium text-ink">{xs.length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {(theme || person) && (
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-1.5 text-[11.5px] text-ink-2">
              <span className="min-w-0 flex-1 truncate">
                {shown.length} shown{theme ? `: ${themeOf(theme).label.toLowerCase()}` : ''}
                {person ? `, by ${personName(person)}` : ''}
              </span>
              <button
                onClick={() => {
                  setTheme(null)
                  setPerson(null)
                }}
                className="rounded px-1.5 py-0.5 text-ink hover:bg-sunken"
              >
                Show all
              </button>
            </div>
          )}
          <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-auto">
            {shown.map((s) => (
              <StatementRow key={s.id} s={s} onOpen={() => open(s)} />
            ))}
            {!shown.length && <li className="px-4 py-6 text-center text-[12px] text-ink-3">Nothing matched.</li>}
          </ul>
          <p className="border-t border-line px-3.5 py-2 text-[11px] leading-snug text-ink-3">Underlined words are what matched. Themes come from fixed phrase rules, so a match is a pointer to read the statement, not a judgement.</p>
        </aside>
      </div>
    </div>
  )
}

function StatementRow({ s, onOpen }: { s: Statement; onOpen: () => void }) {
  const parts = useMemo<{ text: string; theme?: ThemeId }[]>(() => {
    if (!s.matches.length) return [{ text: s.text }]
    const re = new RegExp(`(${s.matches.map((m) => escape(m.phrase)).join('|')})`, 'gi')
    return s.text.split(re).map((text) => {
      const m = s.matches.find((m) => m.phrase.toLowerCase() === text.toLowerCase())
      return { text, theme: m?.theme }
    })
  }, [s])
  return (
    <li>
      <button onClick={onOpen} title="Open the evidence for this statement" className="block w-full px-3.5 py-2 text-left transition hover:bg-sunken">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <Portrait id={s.speaker} size={16} ring={false} />
          <span className="font-medium text-ink-2">{personName(s.speaker)}</span>
          <span className="min-w-0 flex-1 truncate">{s.audience}</span>
          <span className="tnum shrink-0">
            {fmtDate(s.t)} {fmtTime(s.t)}
          </span>
        </div>
        <div className="mt-1 text-[12.5px] leading-snug text-ink">
          “
          {parts.map((p, i) =>
            p.theme ? (
              <span key={i} className="font-medium" style={{ textDecoration: `underline 2px ${themeOf(p.theme).color}`, textUnderlineOffset: 3 }}>
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
          ”
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-ink-2">
          {s.themes.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: themeOf(t).color }} />
              {themeOf(t).label}
            </span>
          ))}
          {s.score !== null && (
            <span className="ml-auto inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: bandOf(s.score).color }} />
              <span className="tnum font-medium text-ink">{s.score.toFixed(2)}</span> {bandOf(s.score).label.toLowerCase()}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

const PLOT_H = 124
/** Someone whose posts never leave the neutral band gets a thin strip: when they posted, nothing more. */
const STRIP_H = 22
const NAME_W = 132

/**
 * Tone over the week: one row per person who posted, every public post placed by when it was written
 * (across) and how hostile it scored (up). The colour of a post is the band its score falls in.
 */
function Tone({ loaded, posts, selected, onSelect, onOpen }: { loaded: PersonId[]; posts: Statement[]; selected: PersonId | null; onSelect: (p: PersonId) => void; onOpen: (s: Statement) => void }) {
  const [hover, setHover] = useState<Statement | null>(null)
  const rows = useMemo(
    () =>
      loaded
        .map((p) => {
          const mine = posts.filter((s) => s.speaker === p)
          const days = DAYS.map((d) => Math.max(-1, ...mine.filter((s) => Number(s.t.slice(8, 10)) === d).map((s) => s.score!)))
          const firstHot = days.findIndex((v) => v >= T)
          const before = firstHot > 0 ? Math.max(0, ...days.slice(0, firstHot)) : 0
          const peak = Math.max(0, ...days)
          const hot = mine.filter((s) => s.score! >= T).length
          const note =
            firstHot >= 0
              ? `Turns hostile on ${DOW[firstHot]} ${DAYS[firstHot]}: ${before ? `nothing above ${before.toFixed(2)} before` : 'no posts before'}, then ${hot} post${hot === 1 ? '' : 's'} at ${T} or more.`
              : peak >= SHARP
                ? `One sharper post (${peak.toFixed(2)}) on ${DOW[days.indexOf(peak)]} ${DAYS[days.indexOf(peak)]}, below the flag line.`
                : 'Neutral all week.'
          return { p, mine, note, peak, hot, flat: peak < SHARP }
        })
        .sort((a, b) => b.peak - a.peak),
    [loaded, posts],
  )
  const active = rows.filter((r) => r.mine.length)
  const silent = rows.filter((r) => !r.mine.length)
  const fired = loaded.includes(HOSTILE.actor) && loaded.includes(HOSTILE.target) ? HOSTILE.context : null
  const tod = { a: x(TOD.start), b: x(TOD.end) }

  /** Shared by every row so the days, the dismissal and the time-of-death window line up down the page. */
  const guides = (
    <>
      {DAYS.map((d, i) => i > 0 && <span key={d} className="absolute inset-y-0 w-px bg-line" style={{ left: `${(i / 7) * 100}%` }} />)}
      <span className="absolute inset-y-0" style={{ left: `${tod.a}%`, width: `max(3px, ${tod.b - tod.a}%)`, background: 'color-mix(in srgb, var(--ink) 13%, transparent)' }} />
      {fired && <span className="absolute inset-y-0 border-l border-dashed border-ink-2" style={{ left: `${x(fired.t)}%` }} />}
    </>
  )

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface">
      <header className="px-4 pb-3 pt-3.5">
        <h3 className="text-[17px] font-semibold leading-tight text-ink">Tone over the week</h3>
        <p className="mt-1 max-w-[70ch] text-[12.5px] leading-snug text-ink-2">
          Each dot is one public post. The higher it sits, the more hostile it scored, from 0 to 1. A change in someone’s tone is often more telling than any single score.
        </p>
        {/* the key: what each colour and mark means */}
        <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px]">
          {BANDS.map((b) => (
            <div key={b.id} className="flex items-center gap-1.5">
              <dt className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
              <dd className="text-ink">
                {b.label} <span className="text-ink-3">({b.range})</span>
              </dd>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <dt className="w-4 border-t-[1.5px] border-dashed border-serious" />
            <dd className="text-ink">Flag line at {T}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="h-3 w-2" style={{ background: 'color-mix(in srgb, var(--ink) 16%, transparent)' }} />
            <dd className="text-ink">Time-of-death window</dd>
          </div>
        </dl>
      </header>

      {active.length === 0 && <p className="border-t border-line px-4 py-8 text-center text-[12.5px] text-ink-3">None of the phones added so far has a scored public post.</p>}

      {active.length > 0 && (
        <div className="border-t border-line px-4 pb-3 pt-2">
          {/* what the vertical marks are, named once above the first row */}
          <div className="relative h-5 text-[11px]" style={{ marginLeft: NAME_W + 28 }}>
            {fired && (
              <span className="absolute bottom-0.5 -translate-x-full whitespace-nowrap pr-1.5 text-ink-2" style={{ left: `${x(fired.t)}%` }}>
                Ravi ends Ken’s job, {fmtTime(fired.t)}
              </span>
            )}
            <span className="absolute bottom-0.5 whitespace-nowrap pl-1 text-ink-2" style={{ left: `${tod.b}%` }}>
              time of death
            </span>
          </div>

          {active.map((r) => (
            <div key={r.p} className={`flex border-t border-line/70 first:border-t-0 ${r.flat ? 'py-1.5' : 'py-3'} ${selected && selected !== r.p ? 'opacity-45' : ''}`}>
              <button onClick={() => onSelect(r.p)} aria-pressed={selected === r.p} title={`Show only ${personName(r.p)}’s statements in the list`} className={`shrink-0 self-start rounded-md py-1 pr-2 text-left transition hover:bg-sunken ${selected === r.p ? 'bg-sunken' : ''}`} style={{ width: NAME_W }}>
                <Portrait id={r.p} size={r.flat ? 20 : 26} label />
                {r.flat && <div className="text-[10.5px] leading-snug text-ink-3">{r.mine.length} post{r.mine.length === 1 ? '' : 's'}, all neutral</div>}
                {!r.flat && (
                  <div className="mt-1 text-[11px] leading-snug text-ink-3">
                    {r.mine.length} post{r.mine.length === 1 ? '' : 's'}
                    {r.hot > 0 && <span className="font-medium text-serious">, {r.hot} flagged</span>}
                  </div>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="relative ml-7" style={{ height: r.flat ? STRIP_H : PLOT_H }}>
                  {/* the score scale, labelled on every full row */}
                  {(r.flat ? [] : [
                    [1, '1'],
                    [T, String(T)],
                    [0, '0'],
                  ]).map(([v, label]) => (
                    <span key={label} className={`tnum absolute -left-7 w-6 -translate-y-1/2 text-right text-[10.5px] ${v === T ? 'font-medium text-serious' : 'text-ink-3'}`} style={{ top: `${(1 - Number(v)) * 100}%` }}>
                      {label}
                    </span>
                  ))}
                  <div className="absolute inset-0 overflow-hidden rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                    {!r.flat && <span className="absolute inset-x-0 top-0" style={{ height: `${(1 - T) * 100}%`, background: 'color-mix(in srgb, var(--serious) 8%, transparent)' }} />}
                    {guides}
                    {!r.flat && <span className="absolute inset-x-0 border-t-[1.5px] border-dashed border-serious/70" style={{ top: `${(1 - T) * 100}%` }} />}
                  </div>
                  {r.mine.map((s) => {
                    const b = bandOf(s.score!)
                    const on = hover === s
                    return (
                      <button key={s.id} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s)} onBlur={() => setHover(null)} onClick={() => onOpen(s)} aria-label={`${personName(s.speaker)}, ${fmtDate(s.t)} ${fmtTime(s.t)}, hostility ${s.score!.toFixed(2)}, ${b.label}: ${s.text}`} className="group absolute bottom-0 w-5 -translate-x-1/2 cursor-pointer outline-none" style={{ left: `${x(s.t)}%`, height: r.flat ? '50%' : `${Math.max(6, s.score! * 100)}%`, zIndex: on ? 3 : 1 }}>
                        {!r.flat && <span className="absolute bottom-0 left-1/2 top-1 w-[1.5px] -translate-x-1/2" style={{ background: b.color, opacity: 0.55 }} />}
                        <span className="absolute left-1/2 top-0 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform group-hover:scale-125 group-focus-visible:scale-125" style={{ background: b.color, boxShadow: `0 0 0 2px var(--surface)${on ? ', 0 0 0 3.5px var(--ink)' : ''}` }} />
                      </button>
                    )
                  })}
                  {hover && hover.speaker === r.p && (
                    <div className="pointer-events-none absolute z-10 w-64 rounded-md border border-line bg-surface px-3 py-2 shadow-lg" style={{ bottom: r.flat ? 'calc(50% + 12px)' : `calc(${hover.score! * 100}% + 12px)`, ...(x(hover.t) > 55 ? { right: `${100 - x(hover.t)}%` } : { left: `${x(hover.t)}%` }) }}>
                      <div className="flex items-center gap-1.5 text-[11.5px]">
                        <span className="h-2 w-2 rounded-full" style={{ background: bandOf(hover.score!).color }} />
                        <span className="tnum font-semibold text-ink">{hover.score!.toFixed(2)}</span>
                        <span className="text-ink-2">{bandOf(hover.score!).label}</span>
                        <span className="tnum ml-auto text-ink-3">
                          {fmtDate(hover.t)} {fmtTime(hover.t)}
                        </span>
                      </div>
                      <div className="mt-1 text-[12.5px] leading-snug text-ink">“{hover.text}”</div>
                      <div className="mt-1 text-[10.5px] text-ink-3">{hover.audience}. Click for the evidence.</div>
                    </div>
                  )}
                </div>
                {!r.flat && <p className="ml-7 mt-2 text-[12px] leading-snug text-ink-2">{r.note}</p>}
              </div>
            </div>
          ))}

          <div className="relative h-4 text-[10.5px] text-ink-3" style={{ marginLeft: NAME_W + 28 }}>
            {DAYS.map((d, i) => (
              <span key={d} className="absolute pl-1" style={{ left: `${(i / 7) * 100}%` }}>
                {DOW[i]} {d}
              </span>
            ))}
          </div>
        </div>
      )}

      <footer className="border-t border-line px-4 py-2.5 text-[11.5px] leading-snug text-ink-3">
        {silent.length > 0 && (
          <span className="text-ink-2">
            No scored public posts from {silent.map((r) => personName(r.p)).join(', ')}.{' '}
          </span>
        )}
        Only public posts are scored, not private texts. Scores from {HOSTILITY_MODEL}.
      </footer>
    </section>
  )
}
