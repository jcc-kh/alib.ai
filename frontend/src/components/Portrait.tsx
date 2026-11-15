import type { PersonId } from '../api'
import { personColor, personName, personOf } from '../mock/data'
import { useKnown } from '../state/caseStore'

/**
 * Round portrait with the person's colour as a ring. The victim gets a small marker. GAN faces; see public/portraits/CREDITS.md.
 * Until a person's phone has been examined they are not identified: a question mark and the first name other phones use.
 */
export default function Portrait({ id, size = 32, ring = true, label = false, dim = false }: { id: PersonId; size?: number; ring?: boolean; label?: boolean; dim?: boolean }) {
  const known = useKnown()(id)
  const p = personOf(id)
  return (
    <span className={`inline-flex items-center gap-2 ${dim ? 'opacity-40' : ''}`}>
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {known ? (
          <img
            src={p.portrait}
            alt={`${p.name} (generated portrait)`}
            width={size}
            height={size}
            className="h-full w-full rounded-full object-cover"
            style={{ boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 ${size > 40 ? 4 : 3.5}px ${personColor(id)}` : undefined, filter: p.is_victim ? 'grayscale(0.85)' : undefined }}
          />
        ) : (
          <Unknown size={size} title={`${personName(id)}: not identified yet`} />
        )}
        {known && p.is_victim && (
          <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-ink text-surface" style={{ width: Math.max(12, size * 0.36), height: Math.max(12, size * 0.36), fontSize: Math.max(8, size * 0.22) }} title="Victim">
            ✝
          </span>
        )}
      </span>
      {label && <span className={`text-[12.5px] ${known ? 'text-ink' : 'text-ink-2'}`}>{personName(id)}</span>}
    </span>
  )
}

/** Placeholder for someone not identified yet (also used for a seized phone with no owner shown). */
export function Unknown({ size, title }: { size: number; title?: string }) {
  return (
    <span
      title={title}
      className="grid h-full w-full place-items-center rounded-full border border-dashed border-line-strong bg-sunken font-semibold text-ink-3"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.48), lineHeight: 1 }}
    >
      ?
    </span>
  )
}
