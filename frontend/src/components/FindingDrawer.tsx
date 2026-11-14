import { useEffect } from 'react'
import type { Finding } from '../api'
import FindingDetail from './FindingDetail'

export default function FindingDrawer({ finding, onClose }: { finding: Finding | null; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!finding) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="slide-in relative h-full w-[min(760px,100vw)] overflow-y-auto border-l border-line bg-canvas px-8 py-7">
        <button onClick={onClose} className="absolute right-6 top-6 text-sm text-faint hover:text-fg">
          Close ✕
        </button>
        <FindingDetail finding={finding} />
      </aside>
    </div>
  )
}
