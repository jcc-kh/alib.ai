import MapTimeline from './MapTimeline'

/** Time of death: the map over time, under a plain title. */
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
