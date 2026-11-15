import MapTimeline from './MapTimeline'

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
  return (
    <div className="space-y-3 p-4">
      <header className="px-1 pt-1">
        <h1 className="text-[19px] font-semibold leading-snug text-ink">Where everyone was around the time Ravi died</h1>
        <p className="mt-0.5 max-w-3xl text-[12.5px] leading-snug text-ink-2">Drag the time or press play to move every phone on the map. The medical examiner puts the death between 21:00 and 23:30 on Thursday 16 April.</p>
      </header>
      <MapTimeline />
    </div>
  )
}
