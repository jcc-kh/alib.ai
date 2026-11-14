import { createContext, useContext } from 'react'
import type { Brief, CaseInfo, Finding } from './api'

/** App-wide actions: open a finding in the side drawer, or open Ask with an optional question. */
export interface AppActions {
  caseInfo: CaseInfo | null
  openFinding: (f: Finding) => void
  openAsk: (question?: string) => void
  go: (page: Page) => void
  /** Hand a brief from the briefing page to Investigate and run it. */
  refine: (brief: Brief) => void
}

export type Page = 'briefing' | 'timeline' | 'investigate' | 'ingest'

export const AppContext = createContext<AppActions>({
  caseInfo: null,
  openFinding: () => {},
  openAsk: () => {},
  go: () => {},
  refine: () => {},
})

export const useApp = () => useContext(AppContext)
