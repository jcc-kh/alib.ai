import type { Incident } from '../../../api'
import { useCase } from '../../../state/caseStore'
import Portrait from '../../../components/Portrait'

/** A short insight pinned to the board: title, two facts, who is involved, and the evidence. */
export default function InsightNote({
  i,
  tag,
  delay,
  active,
  dim = false,
  onHover,
}: {
  i: Incident
  tag?: 'new' | 'stronger'
  /** Drop-in animation delay (ms) when the note is new or stronger. */
  delay?: number
  active: boolean
  dim?: boolean
  onHover: (id: string | null) => void
}) {
  const c = useCase()
  return (
    <article
      data-note={i.incident_id}
      onMouseEnter={() => onHover(i.incident_id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => c.openFinding(i.findings[0])}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), c.openFinding(i.findings[0]))}
      role="button"
      tabIndex={0}
      className={`board-card relative cursor-pointer rounded-lg border px-3.5 py-3 transition-[border-color,opacity] duration-200 hover:border-line-strong ${active ? 'border-accent' : 'border-line'} ${dim ? 'opacity-45' : ''} ${tag ? 'note-drop' : ''}`}
      style={tag && delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-start gap-2">
        <span className="tnum mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10.5px] font-semibold text-surface">{i.rank}</span>
        <h4 className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-ink">{i.title}</h4>
        {tag === 'new' && <span className="shrink-0 rounded bg-accent px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">New</span>}
        {tag === 'stronger' && <span className="shrink-0 rounded border border-accent px-1.5 py-px text-[10px] font-semibold text-accent">+ evidence</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {i.facts.slice(0, 2).map((f) => (
          <span key={f} className="tnum rounded bg-sunken px-1.5 py-px text-[11px] text-ink-2">
            {f}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {i.people.map((p) => (
          <Portrait key={p} id={p} size={20} ring={false} />
        ))}
        <span className="ml-1.5 text-[11px] text-ink-3">
          {i.findings.length} finding{i.findings.length === 1 ? '' : 's'} · {i.n_checks} check{i.n_checks === 1 ? '' : 's'}
        </span>
        <span className="ml-auto text-[13px] text-ink-3">›</span>
      </div>
    </article>
  )
}
