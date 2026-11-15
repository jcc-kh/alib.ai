import { useMemo, useState } from 'react'
import type { PersonId } from '../../../api'
import { HOSTILE, HOSTILITY_MODEL, personName } from '../../../mock/data'
import { THEMES, statementsFor, type Statement, type ThemeId } from '../../../mock/semantics'
import { fmtDate, fmtTime } from '../../../lib/format'
import Portrait from '../../../components/Portrait'
import { Panel } from '../kit'
import { useCase } from '../../../state/caseStore'
import { InquiryHeader } from './meta'

const T = HOSTILE.threshold
const themeOf = (id: ThemeId) => THEMES.find((t) => t.id === id)!
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Semantic analysis: themes across everything people wrote, the statements behind each, and tone over the week. */
export default function MotiveView() {
  const c = useCase()
  const loaded = c.board.loaded
  const all = useMemo(() => statementsFor(loaded), [loaded])
  // one theme is always open: the list on the right is never the unfiltered pile
  const [theme, setTheme] = useState<ThemeId>(THEMES[0].id)
  const [person, setPerson] = useState<PersonId | null>(null)
  const tagged = all.filter((s) => s.themes.length)
  const shown = tagged.filter((s) => s.themes.includes(theme) && (!person || s.speaker === person))

  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="motive" />

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Tone over the week" className="col-span-12 lg:col-span-7" sub={`public posts · daily highest hostility score`}>
          <ToneByPerson loaded={loaded} selected={person} onSelect={(p) => setPerson(person === p ? null : p)} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: 'var(--serious)' }} /> hostile ({T} or more)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: 'var(--warning)' }} /> sharper (0.4 to {T})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: 'var(--ink-3)' }} /> neutral (below 0.4)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-ink-3" /> flag line at {T}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Scores from {HOSTILITY_MODEL}, 0 to 1; the line marks {T}. A change in someone’s tone is often more telling than the score itself. Pick a person to see, on the right, only what they wrote.
          </p>
        </Panel>
        <Panel
          title="Matched a theme"
          className="col-span-12 lg:col-span-5"
          sub={`${tagged.length} of ${all.length} statements`}
          actions={
            person && (
              <button onClick={() => setPerson(null)} className="rounded px-1.5 py-0.5 text-[11px] text-ink-2 hover:bg-sunken">
                Only {personName(person)} · show everyone
              </button>
            )
          }
          pad={false}
        >
          {/* the themes are the filter: pick one, and the list below is its statements */}
          <div role="tablist" aria-label="Theme" className="flex flex-wrap gap-1.5 border-b border-line px-3 pb-2.5 pt-3">
            {THEMES.map((th) => {
              // counts follow the person picked in Tone over the week, so a theme and its list always agree
              const n = tagged.filter((s) => s.themes.includes(th.id) && (!person || s.speaker === person)).length
              const on = theme === th.id
              return (
                <button key={th.id} role="tab" aria-selected={on} onClick={() => setTheme(th.id)} title={th.what} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition ${on ? 'border-ink bg-surface font-semibold text-ink shadow-sm' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'} ${n ? '' : 'opacity-50'}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: th.color }} />
                  {th.label}
                  <span className="tnum text-ink-3">{n}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-baseline gap-2 border-b border-line px-4 py-2">
            <span className="tnum text-[20px] font-semibold leading-none text-ink">{shown.length}</span>
            <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-2">
              {shown.length === 1 ? 'statement' : 'statements'} {themeOf(theme).what}
              {person ? `, by ${personName(person)}` : ''}
            </span>
            <span className="flex -space-x-1.5">
              {[...new Set(shown.map((s) => s.speaker))].map((p) => (
                <Portrait key={p} id={p} size={20} ring={false} />
              ))}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {shown.map((s) => (
              <StatementRow key={s.id} s={s} />
            ))}
            {!shown.length && <li className="px-4 py-6 text-center text-[12px] text-ink-3">{person ? `Nothing by ${personName(person)} matched this theme.` : 'Nothing matched this theme.'}</li>}
          </ul>
          <p className="border-t border-line px-4 py-2 text-[11px] text-ink-3">Underlined words are what matched each theme. Themes come from fixed phrase rules, so a match is a pointer to read the statement, not a judgement. Themes cover private texts as well as public posts; the tone chart on the left covers public posts only, and a post that was scored shows its score here.</p>
        </Panel>

      </div>
    </div>
  )
}

function StatementRow({ s }: { s: Statement }) {
  const c = useCase()
  const parts = useMemo<{ text: string; theme?: ThemeId }[]>(() => {
    if (!s.matches.length) return [{ text: s.text }]
    const re = new RegExp(`(${s.matches.map((m) => escape(m.phrase)).join('|')})`, 'gi')
    return s.text.split(re).map((text) => {
      const m = s.matches.find((x) => x.phrase.toLowerCase() === text.toLowerCase())
      return { text, theme: m?.theme }
    })
  }, [s])
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <span className="tnum w-20 shrink-0 pt-0.5 text-[11.5px] text-ink-3">
        {fmtDate(s.t)} {fmtTime(s.t)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-2">
          <Portrait id={s.speaker} size={18} ring={false} label />
          <span className="text-ink-3">· {s.audience}</span>
          {s.about.length > 0 && <span className="text-ink-3">· about {s.about.map(personName).join(', ')}</span>}
        </div>
        <div className="mt-0.5 text-[13px] leading-snug text-ink">
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
        <div className="mt-1 flex flex-wrap gap-1">
          {s.themes.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded bg-sunken px-1.5 py-px text-[10.5px] text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: themeOf(t).color }} />
              {themeOf(t).label}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={() =>
          c.openEvidence({
            title: `${personName(s.speaker)}, ${s.audience}, ${fmtDate(s.t)} ${fmtTime(s.t)}`,
            people: [s.speaker, ...s.about],
            points: [
              `“${s.text}”`,
              ...s.themes.map((t) => `${themeOf(t).label}: matched “${s.matches.filter((m) => m.theme === t).map((m) => m.phrase).join('”, “')}”.`),
              ...(s.score !== null ? [`Hostility score ${s.score.toFixed(2)} (flagged at ${T} or more).`] : []),
            ],
            ids: [s.id],
          })
        }
        className="h-fit shrink-0 self-start rounded-md border border-line px-2 py-0.5 text-[11.5px] text-ink hover:bg-sunken"
      >
        Evidence
      </button>
      {s.score !== null && (
        <span className="w-12 shrink-0 text-right">
          <span className="tnum text-[12.5px] font-medium" style={{ color: s.score >= T ? 'var(--serious)' : s.score >= 0.4 ? 'var(--warning)' : 'var(--ink-3)' }}>
            {s.score.toFixed(2)}
          </span>
          <span className="block text-[10px] text-ink-3">hostility</span>
        </span>
      )}
    </li>
  )
}

const DAYS = [13, 14, 15, 16, 17, 18, 19]

/** Per person, the highest hostility score of their posts each day, and a one-line read of the change. */
function ToneByPerson({ loaded, selected, onSelect }: { loaded: PersonId[]; selected: PersonId | null; onSelect: (p: PersonId) => void }) {
  const rows = useMemo(() => {
    const posts = statementsFor(loaded).filter((s) => s.channel === 'post' && s.score !== null)
    return loaded
      .map((p) => {
        const mine = posts.filter((s) => s.speaker === p)
        const days = DAYS.map((d) => {
          const xs = mine.filter((s) => Number(s.t.slice(8, 10)) === d)
          return xs.length ? Math.max(...xs.map((s) => s.score!)) : null
        })
        const firstHot = days.findIndex((x) => x !== null && x >= T)
        const before = firstHot > 0 ? Math.max(0, ...days.slice(0, firstHot).map((x) => x ?? 0)) : 0
        const peak = Math.max(0, ...days.map((x) => x ?? 0))
        const peakDay = DAYS[days.findIndex((x) => x === peak)]
        const hot = mine.filter((s) => s.score! >= T).length
        const note =
          firstHot >= 0
            ? `Turns on ${DAYS[firstHot]} Apr: nothing above ${before.toFixed(2)} before, then ${hot} posts at ${T} or more.`
            : peak >= 0.4
              ? `One sharper post (${peak.toFixed(2)}) on ${peakDay} Apr, below the line.`
              : mine.length
                ? 'Neutral all week.'
                : 'No posts.'
        return { p, days, note, n: mine.length, peak }
      })
      .sort((a, b) => b.peak - a.peak)
  }, [loaded])
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.p}>
          <button onClick={() => onSelect(r.p)} className={`w-full rounded-md px-1.5 py-1 text-left ${selected === r.p ? 'bg-sunken' : 'hover:bg-sunken'}`}>
            <div className="flex items-center justify-between">
              <Portrait id={r.p} size={20} ring={false} label />
              <span className="tnum text-[10.5px] text-ink-3">{r.n} post{r.n === 1 ? '' : 's'}</span>
            </div>
            <div className="relative mt-1 flex h-14 items-end gap-1">
              <span className="absolute inset-x-0 border-t border-dashed border-ink-3/60" style={{ bottom: `${T * 68}%` }} />
              {r.days.map((x, i) => (
                <span key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }} title={`${DAYS[i]} Apr: ${x === null ? 'no posts' : x.toFixed(2)}`}>
                  {/* a coloured column says what its colour means and the score behind it */}
                  {x !== null && x >= 0.4 && (
                    <span className="tnum relative z-10 mb-0.5 whitespace-nowrap rounded-sm bg-surface px-1 text-[10px] leading-[13px] text-ink-2">
                      <span className="font-semibold text-ink">{x >= T ? 'hostile' : 'sharper'}</span> {x.toFixed(2)}
                    </span>
                  )}
                  <span className="w-full shrink-0 rounded-t-[2px]" style={{ height: x === null ? 1 : `${Math.max(4, x * 68)}%`, background: x === null ? 'var(--line)' : x >= T ? 'var(--serious)' : x >= 0.4 ? 'var(--warning)' : 'var(--ink-3)' }} />
                </span>
              ))}
            </div>
            <div className="mt-0.5 flex text-[9.5px] text-ink-3">
              {DAYS.map((d) => (
                <span key={d} className="flex-1 text-center">
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-ink-2">{r.note}</div>
          </button>
        </li>
      ))}
    </ul>
  )
}
