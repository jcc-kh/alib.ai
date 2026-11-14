import { createContext, useContext } from 'react'
import type { CaseInfo, Finding } from './api'

/** App-wide actions: open a finding in the side drawer, or open Ask with an optional question. */
export interface AppActions {
  caseInfo: CaseInfo | null
  openFinding: (f: Finding) => void
  openAsk: (question?: string) => void
  go: (page: Page) => void
}

export type Page = 'ingest' | 'briefing' | 'investigate'

export const AppContext = createContext<AppActions>({
  caseInfo: null,
  openFinding: () => {},
  openAsk: () => {},
  go: () => {},
})

export const useApp = () => useContext(AppContext)
