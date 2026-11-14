import { useEffect, useState } from 'react'
import { getCase, type Brief, type CaseInfo, type Finding } from './api'
import { AppContext, type Page } from './state'
import IngestPage from './pages/IngestPage'
import BriefingPage from './pages/BriefingPage'
import InvestigatePage from './pages/InvestigatePage'
import TimelinePage from './pages/TimelinePage'
import FindingDrawer from './components/FindingDrawer'
import AskDrawer from './components/AskDrawer'

const PAGES: [Page, string][] = [
  ['briefing', 'Briefing'],
  ['timeline', 'Location timeline'],
  ['investigate', 'Investigate'],
  ['ingest', 'Ingest'],
]

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const h = window.location.hash.slice(1)
    return (PAGES.find(([p]) => p === h)?.[0] ?? 'briefing') as Page
  })
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null)
  const [drawer, setDrawer] = useState<Finding | null>(null)
  const [ask, setAsk] = useState<{ open: boolean; seed?: string; nonce: number }>({ open: false, nonce: 0 })
  const [refineSeed, setRefineSeed] = useState<{ brief: Brief; nonce: number } | null>(null)

  useEffect(() => {
    getCase().then(setCaseInfo)
  }, [])
  useEffect(() => {
    window.location.hash = page
    window.scrollTo(0, 0)
  }, [page])

  const actions = {
    caseInfo,
    openFinding: (f: Finding) => setDrawer(f),
    openAsk: (q?: string) => setAsk((a) => ({ open: true, seed: q, nonce: a.nonce + 1 })),
    go: setPage,
    refine: (brief: Brief) => {
      setRefineSeed((s) => ({ brief, nonce: (s?.nonce ?? 0) + 1 }))
      setPage('investigate')
    },
  }

  return (
    <AppContext.Provider value={actions}>
      <div className="min-h-full">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
          <div className="frame mx-auto flex h-16 max-w-[1280px] items-center px-6">
            <button onClick={() => setPage('briefing')} className="flex items-baseline">
              <span className="font-serif text-[26px] leading-none text-fg">Alib</span>
              <span className="font-serif text-[26px] leading-none text-terra">.ai</span>
            </button>
            <nav className="ml-12 flex gap-8 text-sm">
              {PAGES.map(([p, label]) => (
                <button key={p} onClick={() => setPage(p)} className={`transition ${page === p ? 'text-fg' : 'text-faint hover:text-muted'}`}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-5">
              {caseInfo && <span className="hidden text-xs text-faint lg:inline">{caseInfo.title} · synthetic data</span>}
              <button onClick={() => actions.openAsk()} className="btn-primary px-4 py-2 text-sm font-medium">
                Ask Alib.ai
              </button>
            </div>
          </div>
        </header>

        <main>
          {page === 'briefing' && <BriefingPage />}
          {page === 'timeline' && caseInfo && <TimelinePage caseInfo={caseInfo} />}
          {page === 'investigate' && caseInfo && <InvestigatePage caseInfo={caseInfo} seed={refineSeed} />}
          {page === 'ingest' && <IngestPage />}
        </main>

        <footer className="dot-rule mx-auto max-w-[1280px]">
          <div className="frame flex justify-between px-6 py-6 text-xs text-faint">
            <span>Alib.ai mock-up · all people, places and data are fictional</span>
            <span>Phone data is treated as genuine. A phone's location is not proof of where its owner was.</span>
          </div>
        </footer>
      </div>

      <AskDrawer open={ask.open} seed={ask.seed} nonce={ask.nonce} onClose={() => setAsk((a) => ({ ...a, open: false }))} />
      <FindingDrawer finding={drawer} onClose={() => setDrawer(null)} />
    </AppContext.Provider>
  )
}
