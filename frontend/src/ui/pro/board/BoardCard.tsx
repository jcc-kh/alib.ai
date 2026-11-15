import type { ReactNode } from 'react'

export type CardId = 'relations'

/** A card pinned to the case board: pin, short title, one-line caption, optional Expand. */
export default function BoardCard({
  id,
  title,
  caption,
  onExpand,
  expanded = false,
  lit = false,
  dim = false,
  flash,
  className = '',
  children,
  footer,
}: {
  id: CardId
  title: string
  caption?: ReactNode
  onExpand?: () => void
  /** Switches the button to "Collapse". */
  expanded?: boolean
  /** Outlined while a related insight note is hovered. */
  lit?: boolean
  /** Faded while an unrelated insight note is hovered. */
  dim?: boolean
  /** Animation delay (ms) for the "updated" flash after a source is added; undefined = no flash. */
  flash?: number
  className?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section
      data-card={id}
      className={`board-card relative flex min-w-0 flex-col rounded-lg border transition-[border-color,opacity] duration-200 ${lit ? 'border-accent' : 'border-line'} ${dim ? 'opacity-45' : ''} ${flash !== undefined ? 'card-flash' : ''} ${className}`}
      style={flash !== undefined ? { animationDelay: `${flash}ms` } : undefined}
    >
      <header className="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {caption && <span className="min-w-0 truncate text-[11.5px] text-ink-3">{caption}</span>}
        {onExpand && (
          <button onClick={onExpand} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-sunken">
            {expanded ? 'Collapse to summary' : 'Expand full network'}
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {expanded ? <path d="M9.5 2.5v4h4M6.5 13.5v-4h-4M9.5 6.5l4.5-4.5M6.5 9.5L2 14" /> : <path d="M10 2h4v4M6 14H2v-4M14 2L9 7M2 14l5-5" />}
            </svg>
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 px-3.5 pb-3">{children}</div>
      {footer}
    </section>
  )
}
