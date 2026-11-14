import type { PersonId } from '../api'
import { personColor, personName, personOf } from '../mock/data'

/** Round portrait with the person's colour as a ring. The victim gets a small marker. GAN faces; see public/portraits/CREDITS.md. */
export default function Portrait({ id, size = 32, ring = true, label = false, dim = false }: { id: PersonId; size?: number; ring?: boolean; label?: boolean; dim?: boolean }) {
  const p = personOf(id)
  return (
    <span className={`inline-flex items-center gap-2 ${dim ? 'opacity-40' : ''}`}>
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        <img
          src={p.portrait}
          alt={`${p.name} (generated portrait)`}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
          style={{ boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 ${size > 40 ? 4 : 3.5}px ${personColor(id)}` : undefined, filter: p.is_victim ? 'grayscale(0.85)' : undefined }}
        />
        {p.is_victim && (
          <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-ink text-surface" style={{ width: Math.max(12, size * 0.36), height: Math.max(12, size * 0.36), fontSize: Math.max(8, size * 0.22) }} title="Victim">
            ✝
          </span>
        )}
      </span>
      {label && <span className="text-[12.5px] text-ink">{personName(id)}</span>}
    </span>
  )
}
