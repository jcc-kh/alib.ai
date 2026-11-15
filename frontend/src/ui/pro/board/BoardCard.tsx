import type { ReactNode } from 'react'

export type CardId = 'relations'

/** A card pinned to the case board: pin, short title, one-line caption, optional Expand. */
export default function BoardCard({
  id,
  title,
  caption,
  onExpand,
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
          <button onClick={onExpand} className="ml-auto shrink-0 rounded-md px-2 py-0.5 text-[11.5px] text-ink-2 hover:bg-sunken hover:text-ink">
            Expand ↗
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 px-3.5 pb-3">{children}</div>
      {footer}
    </section>
  )
}
