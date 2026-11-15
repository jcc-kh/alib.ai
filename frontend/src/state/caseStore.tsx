// One case store for the dashboard. There is no fixed pipeline: the case is a set of loaded evidence
// sources, the board is recomputed from them, and adding a source shows what it changed.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addSource as addSourceApi, ask as askApi, type Answer, type Board, type BoardDiff, type Finding, type PersonId, type SourceProgress } from '../api'
import { QUEUE, START, computeBoard, diffBoard } from '../mock/sources'
import { VICTIM } from '../mock/data'
import { transcriptOf } from '../mock/interviews'

export const DEMO_CASE_NAME = 'Death at Pier 9'
/** How long "new" markers stay on the board after a source is added. */
const FRESH_MS = 15000

export interface AskTurn {
  q: string
  steps: string[]
  answer: Answer | null
}

export interface Ingesting extends SourceProgress {
  source: PersonId
}

/** Progress of a transcript being read: the stage, how many claims are highlighted and how many are checked. */
export interface Reading {
  id: string
  stage: number
  shown: number
  checked: number
}
/** Anything worth showing the evidence for: a readable summary plus the source rows behind it. */
export interface EvidenceItem {
  title: string
  people: PersonId[]
  /** Plain-language points: what the rows show. */
  points: string[]
  ids: string[]
}

export const READ_STAGES = ['Read transcript', 'Extract claims', 'Plan checks', 'Run checks', 'Score'] as const

interface CaseStore {
  caseName: string
  loaded: PersonId[]
  /** Sources not yet added, in demo order. */
  queue: PersonId[]
  board: Board
  ingesting: Ingesting | null
  /** What the last added source changed; null once the markers have faded. */
  fresh: BoardDiff | null
  finding: Finding | null
  askTurns: AskTurn[]
  askBusy: boolean
  /** Transcripts that have been read and verified. */
  transcripts: string[]
  reading: Reading | null
  // actions
  verifyTranscript: (id: string) => Promise<void>
  addSource: (id: PersonId) => Promise<void>
  dismissFresh: () => void
  openFinding: (f: Finding | null) => void
  evidence: EvidenceItem | null
  openEvidence: (e: EvidenceItem | null) => void
  ask: (q: string) => Promise<void>
  reset: () => void
}

const Ctx = createContext<CaseStore | null>(null)

export function CaseProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<PersonId[]>(START)
  const board = useMemo(() => computeBoard(loaded), [loaded])
  const [ingesting, setIngesting] = useState<Ingesting | null>(null)
  const [fresh, setFresh] = useState<BoardDiff | null>(null)
  const [finding, setFinding] = useState<Finding | null>(null)
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null)
  const [askTurns, setAskTurns] = useState<AskTurn[]>([])
  const [askBusy, setAskBusy] = useState(false)
  const [transcripts, setTranscripts] = useState<string[]>([])
  const [reading, setReading] = useState<Reading | null>(null)
  const readAbort = useRef<AbortController | null>(null)
  const abort = useRef<AbortController | null>(null)
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded

  useEffect(() => () => {
    abort.current?.abort()
    if (freshTimer.current) clearTimeout(freshTimer.current)
  }, [])

  const dismissFresh = useCallback(() => {
    if (freshTimer.current) clearTimeout(freshTimer.current)
    setFresh(null)
  }, [])

  const addSource = useCallback(async (id: PersonId) => {
    const before = loadedRef.current
    if (before.includes(id)) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    dismissFresh()
    try {
      await addSourceApi(id, before, (p) => setIngesting({ source: id, ...p }), ctrl.signal)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      throw err
    }
    const after = [...before, id]
    setFresh(diffBoard(computeBoard(before), computeBoard(after), id))
    setLoaded(after)
    setIngesting(null)
    freshTimer.current = setTimeout(() => setFresh(null), FRESH_MS)
  }, [dismissFresh])

  const ask = useCallback(async (q: string) => {
    const question = q.trim()
    if (!question) return
    setAskBusy(true)
    setAskTurns((t) => [...t, { q: question, steps: [], answer: null }])
    const upd = (fn: (t: AskTurn) => AskTurn) => setAskTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)))
    await askApi(
      question,
      (e) => {
        if (e.type === 'step') upd((t) => ({ ...t, steps: [...t.steps, e.text] }))
        if (e.type === 'answer') upd((t) => ({ ...t, answer: e.answer }))
      },
      loadedRef.current,
    )
    setAskBusy(false)
  }, [])

  const verifyTranscript = useCallback(async (id: string) => {
    readAbort.current?.abort()
    const ctrl = new AbortController()
    readAbort.current = ctrl
    const t = transcriptOf(id)
    const wait = (ms: number) =>
      new Promise<void>((res, rej) => {
        const h = setTimeout(res, ms)
        ctrl.signal.addEventListener('abort', () => {
          clearTimeout(h)
          rej(new DOMException('Aborted', 'AbortError'))
        })
      })
    try {
      let r: Reading = { id, stage: 0, shown: 0, checked: 0 }
      setReading(r)
      await wait(900)
      r = { ...r, stage: 1 }
      for (let k = 1; k <= t.claims.length; k++) {
        setReading((r = { ...r, shown: k }))
        await wait(420)
      }
      setReading((r = { ...r, stage: 2 }))
      await wait(700)
      setReading((r = { ...r, stage: 3 }))
      for (let k = 1; k <= t.claims.length; k++) {
        await wait(520)
        setReading((r = { ...r, checked: k }))
      }
      setReading((r = { ...r, stage: 4 }))
      await wait(500)
      setTranscripts((x) => (x.includes(id) ? x : [...x, id]))
      setReading(null)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err
    }
  }, [])

  const reset = useCallback(() => {
    readAbort.current?.abort()
    setReading(null)
    setTranscripts([])
    abort.current?.abort()
    dismissFresh()
    setIngesting(null)
    setLoaded(START)
    setAskTurns([])
    setFinding(null)
  }, [dismissFresh])

  const queue = useMemo(() => QUEUE.filter((p) => !loaded.includes(p)), [loaded])

  const value = useMemo<CaseStore>(
    () => ({ caseName: DEMO_CASE_NAME, loaded, queue, board, ingesting, fresh, finding, evidence, askTurns, askBusy, transcripts, reading, addSource, dismissFresh, openFinding: (f: Finding | null) => {
      setEvidence(null)
      setFinding(f)
    }, openEvidence: (e: EvidenceItem | null) => {
      setFinding(null)
      setEvidence(e)
    }, ask, verifyTranscript, reset }),
    [loaded, queue, board, ingesting, fresh, finding, evidence, askTurns, askBusy, transcripts, reading, addSource, dismissFresh, ask, verifyTranscript, reset],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Whether a person's identity can be shown. A person is identified once their phone has been examined
 * (the victim always is). Before that they appear as a question mark with the first name other phones
 * use for them, and a seized phone is shown only by its exhibit number.
 */
export function useKnown() {
  const c = useContext(Ctx)
  const loaded = c?.loaded
  return useCallback((id: PersonId) => !loaded || id === VICTIM || loaded.includes(id), [loaded])
}

export function useCase() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCase outside CaseProvider')
  return c
}
