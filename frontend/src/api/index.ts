// Single switch point between the mock and the real backend.
// When backend/api.py exists, replace these re-exports with fetch/SSE calls to /api/*.
export { getCase, ingest, analyse, getEvidence, getGraph } from './mock'
export * from './types'
