import { useEffect, useMemo, useRef, useState } from 'react'
import { READ_STAGES, useCase } from '../../../state/caseStore'
import { ALL_PHONES, ROWS } from '../../../mock/data'
import { SCORING, TRANSCRIPTS, scoreClaim, transcriptOf, verifyTranscript, type CheckResult, type ClaimResult, type ClaimVerdict, type Outcome, type Transcript } from '../../../mock/interviews'
import { fmtDate, fmtTime } from '../../../lib/format'
import Portrait from '../../../components/Portrait'
import { Panel } from '../kit'

export const VERDICT_STYLE: Record<ClaimVerdict, { label: string; color: string; bg: string; rule: string }> = {
  verified: { label: 'VERIFIED', color: 'var(--good)', bg: 'color-mix(in srgb, var(--good) 14%, transparent)', rule: 'The data confirms it.' },
  unverified: { label: 'UNVERIFIED', color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 16%, transparent)', rule: 'Unable to draw a conclusion from the data examined.' },
  disproven: { label: 'DISPROVEN', color: 'var(--serious)', bg: 'color-mix(in srgb, var(--serious) 13%, transparent)', rule: 'The data shows it is false.' },
}

const OUTCOME_STYLE: Record<Outcome, { label: string; glyph: string; color: string }> = {
  supports: { label: 'Supports the claim', glyph: '✓', color: 'var(--good)' },
  contradicts: { label: 'Contradicts the claim', glyph: '✕', color: 'var(--serious)' },
  inconclusive: { label: 'Inconclusive', glyph: '–', color: 'var(--ink-3)' },
  blocked: { label: 'Can’t run yet', glyph: '…', color: 'var(--ink-3)' },
}

const pct = (x: number) => `${Math.round(x * 100)}%`
/** What to show beside a verdict: confidence when decided; which way the evidence leans when not. */
const confText = (r: ClaimResult) => (r.verdict !== 'unverified' ? pct(r.confidence) : r.p_true > 0.55 ? 'leans true' : r.p_true < 0.45 ? 'leans false' : 'no lean')

export default function InterviewsView() {
  const c = useCase()
  const active = c.reading?.id
  const [sel, setSel] = useState<string>(() => active ?? c.transcripts[0] ?? TRANSCRIPTS[0].id)
  useEffect(() => {
    if (active) setSel(active)
  }, [active])
  const t = transcriptOf(sel)
  const done = c.transcripts.includes(t.id)
  const reading = c.reading?.id === t.id ? c.reading : null

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-4 px-1 pt-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-semibold leading-snug text-ink">Interviews</h1>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">Every checkable claim in a transcript is tested against the phone data.</p>
        </div>
        <Legend />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {TRANSCRIPTS.map((x) => (
          <TranscriptCard key={x.id} t={x} selected={x.id === sel} onSelect={() => setSel(x.id)} />
        ))}
        <DropTranscript onPick={(id) => setSel(id)} />
      </div>

      {!done && !reading ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-8 text-center">
          <div className="text-[13px] text-ink-2">
            {t.file} · {t.minutes} min · {t.interviewer}
          </div>
          <button onClick={() => void c.verifyTranscript(t.id)} disabled={!!c.reading} className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-4 text-[13px] font-medium text-surface hover:opacity-90 disabled:opacity-40">
            Verify interview transcript
          </button>
          <div className="text-[11.5px] text-ink-3">Reads the transcript, picks out the claims, then checks each one against the phone data.</div>
        </div>
      ) : (
        <Verification t={t} reading={reading} />
      )}
    </div>
  )
}

function Legend() {
  return (
    <div className="hidden shrink-0 space-y-1 text-[11.5px] lg:block">
      {(Object.keys(VERDICT_STYLE) as ClaimVerdict[]).map((v) => (
        <div key={v} className="flex items-center gap-2">
          <VerdictBadge v={v} small />
          <span className="text-ink-2">{VERDICT_STYLE[v].rule}</span>
        </div>
      ))}
    </div>
  )
}

export function VerdictBadge({ v, small = false }: { v: ClaimVerdict; small?: boolean }) {
  const s = VERDICT_STYLE[v]
  return (
    <span className={`inline-flex items-center rounded font-semibold tracking-[0.06em] ${small ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11.5px]'}`} style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}` }}>
      {s.label}
    </span>
  )
}

function TranscriptCard({ t, selected, onSelect }: { t: Transcript; selected: boolean; onSelect: () => void }) {
  const c = useCase()
  const done = c.transcripts.includes(t.id)
  const reading = c.reading?.id === t.id
  const v = done ? verifyTranscript(t, c.loaded).counts : null
  return (
    <button onClick={onSelect} className={`flex flex-col rounded-lg border bg-surface px-3 py-2.5 text-left transition ${selected ? 'border-ink shadow-sm' : 'border-line hover:border-line-strong'}`}>
      <div className="flex items-center gap-2.5">
        <Portrait id={t.person} size={30} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">{t.interviewee}</div>
          <div className="tnum text-[11.5px] text-ink-3">
            {fmtDate(t.at)} {fmtTime(t.at)} · {t.minutes} min · {t.claims.length} claims
          </div>
        </div>
      </div>
      <div className="tnum mt-2 flex min-h-5 items-center gap-2.5 text-[11.5px]">
        {v ? (
          <>
            <span style={{ color: VERDICT_STYLE.verified.color }}>{v.verified} verified</span>
            <span style={{ color: VERDICT_STYLE.unverified.color }}>{v.unverified} unverified</span>
            <span style={{ color: VERDICT_STYLE.disproven.color }}>{v.disproven} disproven</span>
          </>
        ) : reading ? (
          <span className="inline-flex items-center gap-1.5 text-ink">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" /> {READ_STAGES[c.reading!.stage]}…
          </span>
        ) : (
          <span className="text-ink-3">Not verified yet</span>
        )}
      </div>
    </button>
  )
}

function DropTranscript({ onPick }: { onPick: (id: string) => void }) {
  const c = useCase()
  const [over, setOver] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const next = TRANSCRIPTS.find((t) => !c.transcripts.includes(t.id) && c.reading?.id !== t.id)
  const go = () => {
    if (!next || c.reading) return
    onPick(next.id)
    void c.verifyTranscript(next.id)
  }
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        go()
      }}
      onClick={() => file.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-2.5 text-center text-[12px] ${over ? 'border-accent bg-accent/5 text-ink' : 'border-line-strong text-ink-2 hover:bg-surface'}`}
    >
      <span className="font-medium text-ink">+ Add transcript</span>
      <span className="text-[11px] text-ink-3">{next ? `Drop .txt / .docx / .pdf · in this mock any file loads ${next.interviewee}’s` : 'All transcripts in this case are verified'}</span>
      <input ref={file} type="file" accept=".txt,.docx,.pdf" className="hidden" onChange={go} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function Verification({ t, reading }: { t: Transcript; reading: { stage: number; shown: number; checked: number } | null }) {
  const c = useCase()
  const v = useMemo(() => verifyTranscript(t, c.loaded), [t, c.loaded])
  const [claim, setClaim] = useState<string>(t.claims[0].id)
  useEffect(() => setClaim(t.claims[0].id), [t])
  const shown = reading ? reading.shown : t.claims.length
  const checked = reading ? (reading.stage >= 3 ? reading.checked : 0) : t.claims.length
  const idx = t.claims.findIndex((x) => x.id === claim)
  const r = v.results[idx]
  const isChecked = idx < checked
  return (
    <div className="space-y-3">
      {reading && <ReadProgress t={t} reading={reading} />}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Transcript" className="col-span-12 lg:col-span-5" sub={`${t.file} · ${t.interviewer} · ${t.place}`} pad={false}>
          <TranscriptText t={t} results={v.results} shown={shown} checked={checked} selected={claim} onSelect={setClaim} showOpinions={!reading || reading.stage >= 1} />
        </Panel>
        <div className="col-span-12 space-y-3 lg:col-span-7">
          {idx < shown ? (
            <ClaimBreakdown r={r} n={idx + 1} checked={isChecked} running={!!reading && reading.stage === 3 && idx === checked} interviewee={t.interviewee.split(' ')[0]} />
          ) : (
            <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-line-strong text-[12.5px] text-ink-3">Picking out claims…</div>
          )}
        </div>
      </div>
      {!reading && <ConfidenceScorecard t={t} v={v} onSelect={setClaim} selected={claim} />}
    </div>
  )
}

function ReadProgress({ t, reading }: { t: Transcript; reading: { stage: number; shown: number; checked: number } }) {
  const detail = [
    `${t.turns.length} speaker turns · ${t.interviewer} and ${t.interviewee}`,
    `${reading.shown} of ${t.claims.length} checkable claims found · opinions set aside`,
    `${t.claims.reduce((n, x) => n + x.checks.length, 0)} checks across calls, messages, locations, payments, device logs and social posts`,
    `claim ${Math.min(reading.checked + 1, t.claims.length)} of ${t.claims.length}`,
    'verdicts and confidence',
  ][reading.stage]
  const p = (reading.stage + (reading.stage === 1 ? reading.shown / t.claims.length : reading.stage === 3 ? reading.checked / t.claims.length : 0.5)) / READ_STAGES.length
  return (
    <div className="rise rounded-lg border border-accent/60 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[13px] font-semibold text-ink">Reading {t.file}</div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {READ_STAGES.map((s, i) => (
            <span key={s} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${i < reading.stage ? 'border-line text-ink-2' : i === reading.stage ? 'border-accent text-ink' : 'border-line text-ink-3/70'}`}>
              {i < reading.stage ? <span className="text-good">✓</span> : i === reading.stage ? <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-sunken">
        <div className="bar-live h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <div className="mt-1.5 font-mono text-[11px] text-ink-3">
        {READ_STAGES[reading.stage]}: {detail}
      </div>
    </div>
  )
}

function TranscriptText({ t, results, shown, checked, selected, onSelect, showOpinions }: { t: Transcript; results: ClaimResult[]; shown: number; checked: number; selected: string; onSelect: (id: string) => void; showOpinions: boolean }) {
  const order = new Map(t.claims.map((x, i) => [x.id, i]))
  return (
    <div className="max-h-[620px] space-y-2.5 overflow-y-auto p-3 text-[13px] leading-relaxed">
      {t.turns.map((turn, k) => (
        <div key={k} className="flex gap-2.5">
          <span className={`w-14 shrink-0 pt-px text-[11px] font-semibold uppercase tracking-[0.04em] ${turn.who === 'Q' ? 'text-ink-3' : 'text-ink'}`}>{turn.who === 'Q' ? 'Det.' : t.interviewee.split(' ')[0]}</span>
          <p className={turn.who === 'Q' ? 'text-ink-2' : 'text-ink'}>
            {turn.parts.map((p, j) => {
              if (typeof p === 'string') return <span key={j}>{p}</span>
              if ('opinion' in p)
                return (
                  <span key={j} title={showOpinions ? 'Opinion or feeling: not checkable against phone data' : undefined} className={showOpinions ? 'underline decoration-ink-3 decoration-dotted underline-offset-4' : ''}>
                    {p.opinion}
                  </span>
                )
              const i = order.get(p.claim)!
              const claim = t.claims[i]
              if (i >= shown) return <span key={j}>{claim.quote}</span>
              const done = i < checked
              const vs = done ? VERDICT_STYLE[results[i].verdict] : null
              const on = selected === claim.id
              return (
                <button
                  key={j}
                  onClick={() => onSelect(claim.id)}
                  className={`mark-in rounded px-0.5 text-left transition ${on ? 'ring-2 ring-ink/70' : ''}`}
                  style={{ background: vs ? vs.bg : 'color-mix(in srgb, var(--accent) 14%, transparent)', boxShadow: `inset 0 -2px 0 ${vs ? vs.color : 'var(--accent)'}` }}
                >
                  <sup className="mr-0.5 text-[9.5px] font-semibold" style={{ color: vs ? vs.color : 'var(--accent)' }}>
                    {claim.id}
                  </sup>
                  {claim.quote}
                </button>
              )
            })}
          </p>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-[11px] text-ink-3">
        <span>
          <span className="rounded px-1" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', boxShadow: 'inset 0 -2px 0 var(--accent)' }}>
            highlighted
          </span>{' '}
          = claim being checked
        </span>
        <span>
          <span className="underline decoration-dotted underline-offset-4">dotted</span> = opinion, not checkable
        </span>
      </div>
    </div>
  )
}

function ClaimBreakdown({ r, n, checked, running, interviewee }: { r: ClaimResult; n: number; checked: boolean; running: boolean; interviewee: string }) {
  return (
    <Panel title={`Claim ${n} of the interview`} sub={r.claim.id} pad={false}>
      <div className="border-b border-line px-4 py-3">
        <div className="text-[11px] text-ink-3">{interviewee} said</div>
        <blockquote className="mt-0.5 text-[16px] font-medium leading-snug text-ink">“{r.claim.quote}”</blockquote>
        <div className="mt-1.5 text-[12.5px] text-ink-2">
          <span className="text-ink-3">What is checked: </span>
          {r.claim.tests}
        </div>
      </div>
      <ol className="divide-y divide-line">
        {r.checks.map((ch, i) => (
          <CheckRow key={ch.id} ch={ch} i={i} hidden={!checked} running={running} />
        ))}
      </ol>
      {checked ? (
        <Conclusion r={r} />
      ) : (
        <div className="border-t border-line px-4 py-3 text-[12.5px] text-ink-3">{running ? 'Running checks…' : 'Waiting to be checked.'}</div>
      )}
    </Panel>
  )
}

function CheckRow({ ch, i, hidden, running }: { ch: CheckResult; i: number; hidden: boolean; running: boolean }) {
  const c = useCase()
  const o = OUTCOME_STYLE[ch.result.outcome]
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <span className="tnum grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong text-[10.5px] text-ink-2">{i + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{ch.label}</span>
          <span className="rounded border border-line px-1 text-[10px] text-ink-3" title={ch.strength === 'strong' ? 'Could settle the claim on its own' : 'Only shifts the claim one way or the other'}>
            {ch.strength} check
          </span>
          {!hidden ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium" style={{ color: o.color }}>
              <span className="grid h-4 w-4 place-items-center rounded-full text-[10px]" style={{ border: `1.5px solid ${o.color}` }}>
                {o.glyph}
              </span>
              {o.label}
            </span>
          ) : running ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-ink-3">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" /> running
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-3">{ch.method}</div>
        {!hidden && <div className={`mt-1 text-[12.5px] ${ch.result.outcome === 'blocked' ? 'text-ink-3' : 'text-ink'}`}>{ch.result.found}</div>}
        {!hidden && ch.result.evidence_ids.length > 0 && (
          <button
            onClick={() => c.openEvidence({ title: ch.label, people: [...new Set(ch.result.evidence_ids.map((id) => ROWS.get(id)!.device_owner))], points: [ch.method, ch.result.found], ids: ch.result.evidence_ids })}
            className="mt-1 rounded-md border border-line px-2 py-0.5 text-[11.5px] text-ink hover:bg-sunken"
          >
            Evidence · {ch.result.evidence_ids.length} row{ch.result.evidence_ids.length > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </li>
  )
}

/** Odds as a ratio a person can read: "3 : 1 for" or "1 : 10 against". */
function oddsText(p: number) {
  const o = p / (1 - p)
  const r = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10)
  if (Math.abs(o - 1) < 0.01) return 'even, 1 : 1'
  return o > 1 ? `${r(o)} : 1 for` : `1 : ${r(1 / o)} against`
}

/** A 0–100% track with the verdict zones, the previous position (hollow) and the new one (solid). */
function Track({ p, prev, color }: { p: number; prev?: number; color: string }) {
  const lo = SCORING.disproven_at * 100
  const hi = SCORING.verified_at * 100
  return (
    <span className="relative block h-3 w-full rounded-sm">
      <span className="absolute inset-y-0 left-0 rounded-l-sm" style={{ width: `${lo}%`, background: VERDICT_STYLE.disproven.bg }} />
      <span className="absolute inset-y-0" style={{ left: `${lo}%`, width: `${hi - lo}%`, background: 'var(--sunken)' }} />
      <span className="absolute inset-y-0 right-0 rounded-r-sm" style={{ width: `${100 - hi}%`, background: VERDICT_STYLE.verified.bg }} />
      {prev !== undefined && Math.abs(prev - p) > 0.005 && (
        <>
          <span className="absolute top-1/2 h-px -translate-y-1/2" style={{ left: `${Math.min(prev, p) * 100}%`, width: `${Math.abs(prev - p) * 100}%`, background: color }} />
          <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface" style={{ left: `${prev * 100}%`, borderColor: 'var(--ink-3)' }} />
        </>
      )}
      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p * 100}%`, background: color, boxShadow: '0 0 0 2px var(--surface)' }} />
    </span>
  )
}

/**
 * How the confidence was worked out, one row per check: start undecided at 50%, each check shifts
 * the odds by a fixed amount, the verdict rule is applied, and confidence is read off the result.
 */
function Conclusion({ r }: { r: ClaimResult }) {
  const s = VERDICT_STYLE[r.verdict]
  const clamp = (x: number) => Math.min(SCORING.cap, Math.max(1 - SCORING.cap, x))
  let odds = SCORING.prior / (1 - SCORING.prior)
  let prev = SCORING.prior
  const steps = r.checks.map((ch, i) => {
    const f = SCORING.factor[ch.strength]
    const o = ch.result.outcome
    const before = prev
    if (o === 'supports') odds *= f
    if (o === 'contradicts') odds /= f
    const p = clamp(odds / (1 + odds))
    prev = p
    const effect =
      o === 'supports' ? `odds × ${f}` : o === 'contradicts' ? `odds ÷ ${f}` : o === 'blocked' ? 'couldn’t run: no change' : 'no change'
    return { i, ch, o, before, p, effect }
  })
  const final = r.p_true
  const capped = Math.abs(final - odds / (1 + odds)) > 0.001
  const lo = pct(SCORING.disproven_at)
  const hi = pct(SCORING.verified_at)
  const rule =
    r.verdict === 'verified'
      ? `${pct(final)} is at or above ${hi}, and a strong check supports it.`
      : r.verdict === 'disproven'
        ? `${pct(final)} is at or below ${lo}, and a strong check contradicts it.`
        : r.ran === 0
          ? 'No check could run on the phones examined so far, so it stays at 50%.'
          : final > SCORING.disproven_at && final < SCORING.verified_at
            ? `${pct(final)} is between ${lo} and ${hi}: not enough either way.`
            : `${pct(final)} is past the line, but no strong check decided it, only weak ones.`
  const conf =
    r.verdict === 'verified'
      ? `Confidence = chance the claim is true = ${pct(final)}`
      : r.verdict === 'disproven'
        ? `Confidence = chance the claim is false = 100% − ${pct(final)} = ${pct(1 - final)}`
        : `No confidence score: the evidence ${confText(r)} (${pct(final)} chance true)`
  return (
    <div className="border-t border-line">
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">How the score was reached</span>
        <span className="text-[11px] text-ink-3">chance the claim is true, after each check</span>
      </div>
      <table className="mt-1.5 w-full text-[12px]">
        <tbody>
          <tr className="border-b border-line">
            <td className="w-8 py-1.5 pl-4 text-ink-3">0</td>
            <td className="py-1.5 pr-3 text-ink-2">Before any check: no evidence either way</td>
            <td className="w-36 py-1.5 pr-3 text-ink-3">start</td>
            <td className="w-[32%] py-1.5 pr-3">
              <Track p={SCORING.prior} color="var(--ink-3)" />
            </td>
            <td className="tnum w-24 py-1.5 pr-4 text-right">
              <span className="font-semibold text-ink">{pct(SCORING.prior)}</span>
              <div className="text-[10.5px] text-ink-3">{oddsText(SCORING.prior)}</div>
            </td>
          </tr>
          {steps.map((x) => {
            const os = OUTCOME_STYLE[x.o]
            const moved = x.o === 'supports' || x.o === 'contradicts'
            return (
              <tr key={x.ch.id} className={`border-b border-line ${moved ? '' : 'text-ink-3'}`}>
                <td className="py-1.5 pl-4 text-ink-3">{x.i + 1}</td>
                <td className="py-1.5 pr-3">
                  <span className={moved ? 'text-ink' : ''}>{x.ch.label}</span>
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: os.color }}>
                    {os.glyph} {os.label.toLowerCase()}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-[11.5px]">
                  <span className={moved ? 'text-ink' : ''}>{x.ch.strength} check</span>
                  <div className={moved ? 'font-medium' : ''} style={{ color: moved ? os.color : undefined }}>
                    {x.effect}
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <Track p={x.p} prev={x.before} color={moved ? os.color : 'var(--ink-3)'} />
                </td>
                <td className="tnum py-1.5 pr-4 text-right">
                  <span className={`font-semibold ${moved ? 'text-ink' : ''}`}>{pct(x.p)}</span>
                  <div className="text-[10.5px] text-ink-3">{oddsText(x.p)}</div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-4 pb-1 pt-1.5 text-[11px] text-ink-3">
        A strong check makes the odds {SCORING.factor.strong} times more (or less) in the claim’s favour; a weak check {SCORING.factor.weak} times. Odds of 1 : 10 against mean 1 chance in 11, which is 9%.
        {capped && ` Scores are capped at ${pct(SCORING.cap)} either way.`}
      </div>
      <div className="mt-2 px-4 py-3" style={{ background: s.bg }}>
        <div className="flex flex-wrap items-center gap-3">
          <VerdictBadge v={r.verdict} />
          <span className="text-[13px] text-ink">{rule}</span>
          {r.verdict !== 'unverified' && (
            <span className="tnum ml-auto text-[12.5px] text-ink-2">
              Confidence <span className="text-[17px] font-semibold text-ink">{pct(r.confidence)}</span>
            </span>
          )}
        </div>
        <div className="mt-1 text-[12px] text-ink-2">
          {conf}.{r.checks.length - r.ran > 0 && ` ${r.checks.length - r.ran} check${r.checks.length - r.ran > 1 ? 's' : ''} couldn’t run yet; adding phones may change this.`}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function ConfidenceScorecard({ t, v, selected, onSelect }: { t: Transcript; v: ReturnType<typeof verifyTranscript>; selected: string; onSelect: (id: string) => void }) {
  const key = useMemo(() => t.claims.map((x) => scoreClaim(x, ALL_PHONES).verdict === x.expected).filter(Boolean).length, [t])
  const nowMatch = v.results.filter((r) => r.verdict === r.claim.expected).length
  return (
    <Panel title="Model confidence" sub={`${t.interviewee} · ${t.claims.length} claims`}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 grid grid-cols-2 gap-2 md:col-span-4">
          {(Object.keys(VERDICT_STYLE) as ClaimVerdict[]).map((k) => (
            <div key={k} className="rounded-md border border-line px-3 py-2">
              <div className="text-[10.5px] font-semibold tracking-[0.06em]" style={{ color: VERDICT_STYLE[k].color }}>
                {VERDICT_STYLE[k].label}
              </div>
              <div className="tnum text-[22px] font-semibold leading-tight text-ink">{v.counts[k]}</div>
            </div>
          ))}
          <div className="rounded-md border border-line px-3 py-2">
            <div className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-3">MEAN CONFIDENCE</div>
            <div className="tnum text-[22px] font-semibold leading-tight text-ink">{v.mean_confidence === null ? '—' : pct(v.mean_confidence)}</div>
            <div className="text-[10.5px] text-ink-3">over verified and disproven claims</div>
          </div>
          <div className="col-span-2 rounded-md border border-line px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-3">CHECKS RUN</span>
              <span className="tnum text-[13px] font-semibold text-ink">
                {v.ran} of {v.planned}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-ink-2" style={{ width: `${(v.ran / v.planned) * 100}%` }} />
            </div>
            <div className="mt-1 text-[10.5px] text-ink-3">{v.ran < v.planned ? 'the rest need phones not examined yet' : 'every planned check ran'}</div>
          </div>
          <div className="col-span-2 rounded-md border border-line px-3 py-2 text-[11.5px] text-ink-2">
            <span className="font-medium text-ink">Answer key:</span> {nowMatch} of {t.claims.length} verdicts match now; {key} of {t.claims.length} match with every phone examined.
          </div>
        </div>

        <div className="col-span-12 md:col-span-8">
          <ProbabilityStrip results={v.results} selected={selected} onSelect={onSelect} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px] leading-snug text-ink-2">
            <div className="rounded-md bg-sunken px-3 py-2">
              <div className="font-medium text-ink">1 · Start undecided</div>
              Every claim starts at {pct(SCORING.prior)}: even odds, 1 : 1.
            </div>
            <div className="rounded-md bg-sunken px-3 py-2">
              <div className="font-medium text-ink">2 · Each check shifts the odds</div>
              Strong check ×{SCORING.factor.strong}, weak ×{SCORING.factor.weak}; divided instead if it contradicts. Inconclusive: no change.
            </div>
            <div className="rounded-md bg-sunken px-3 py-2">
              <div className="font-medium text-ink">3 · Apply the verdict rule</div>
              ≥ {pct(SCORING.verified_at)} + a strong supporting check: VERIFIED. ≤ {pct(SCORING.disproven_at)} + a strong contradicting check: DISPROVEN. Otherwise UNVERIFIED.
            </div>
          </div>
          <div className="mt-1.5 text-[11px] text-ink-3">Click a claim to see its step-by-step score. Check strengths are fixed before the check runs; nothing scores above {pct(SCORING.cap)}.</div>
        </div>
      </div>
    </Panel>
  )
}

/** Every claim on one 0–100% "chance it is true" axis, with the verdict zones shaded. */
function ProbabilityStrip({ results, selected, onSelect }: { results: ClaimResult[]; selected: string; onSelect: (id: string) => void }) {
  const lo = SCORING.disproven_at * 100
  const hi = SCORING.verified_at * 100
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-ink-3">
        <span>Chance each claim is true, from the checks that ran</span>
      </div>
      <div className="space-y-1">
        {results.map((r) => {
          const s = VERDICT_STYLE[r.verdict]
          const on = r.claim.id === selected
          return (
            <button key={r.claim.id} onClick={() => onSelect(r.claim.id)} className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left ${on ? 'bg-sunken' : 'hover:bg-sunken'}`}>
              <span className="w-7 shrink-0 text-[11px] font-semibold" style={{ color: s.color }}>
                {r.claim.id}
              </span>
              <span className="w-52 shrink-0 truncate text-[12px] text-ink" title={r.claim.quote}>
                “{r.claim.quote}”
              </span>
              <span className="relative h-5 min-w-0 flex-1 rounded-sm">
                <span className="absolute inset-y-0 left-0 rounded-l-sm" style={{ width: `${lo}%`, background: VERDICT_STYLE.disproven.bg }} />
                <span className="absolute inset-y-0" style={{ left: `${lo}%`, width: `${hi - lo}%`, background: 'var(--sunken)' }} />
                <span className="absolute inset-y-0 right-0 rounded-r-sm" style={{ width: `${100 - hi}%`, background: VERDICT_STYLE.verified.bg }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${r.p_true * 100}%`, background: s.color, boxShadow: '0 0 0 2px var(--surface)' }} title={`${pct(r.p_true)} chance true`} />
              </span>
              <span className="tnum flex w-44 shrink-0 items-center justify-end gap-2 whitespace-nowrap text-[11.5px] text-ink-2">
                <VerdictBadge v={r.verdict} small />
                <span className="w-16 text-right">{confText(r)}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex text-[10.5px] text-ink-3">
        <span className="w-7 shrink-0" />
        <span className="w-52 shrink-0" />
        <span className="relative h-4 flex-1">
          {[0, lo, 50, hi, 100].map((x) => (
            <span key={x} className="tnum absolute -translate-x-1/2" style={{ left: `${x}%` }}>
              {x}%
            </span>
          ))}
        </span>
        <span className="w-44 shrink-0" />
      </div>
      <div className="mt-0.5 flex text-[10.5px] text-ink-3">
        <span className="w-7 shrink-0" />
        <span className="w-52 shrink-0" />
        <span className="flex flex-1 justify-between">
          <span>← disproven zone</span>
          <span>verified zone →</span>
        </span>
        <span className="w-44 shrink-0" />
      </div>
    </div>
  )
}
