// Single switch point between the mock and the real backend.
// When backend/api.py exists, replace these re-exports with fetch/SSE calls to /api/*.
export { getCase, getEvidence, getGraph, ask, getTimeline, getSignals, getBoard, addSource, type SourceProgress, type SourceStage } from './mock'
export type { Board, BoardDiff, EvidenceSource, Mutual, Tie, TieLevel } from '../mock/sources'
export * from './types'
