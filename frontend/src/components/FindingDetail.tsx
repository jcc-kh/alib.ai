import { useEffect, useState } from 'react'
import { getEvidence, type CheckOutput, type EvidenceByPhone, type Finding } from '../api'
import { PLACES, personName } from '../mock/data'
import { fmtDate, fmtKm, fmtTime } from '../lib/format'
import { Mono, PersonChip, Tabs, Title, VerdictBadge } from './ui'
import SourcesView from './SourcesView'
import { ReadableRows } from './FindingDrawer'
import MessagesDiff from './evidence/MessagesDiff'
import TrackMap from './evidence/TrackMap'
import MoneyChain from './evidence/MoneyChain'
import MeetingsList from './evidence/MeetingsList'
import SyncTimeline from './evidence/SyncTimeline'
import CoverageView from './evidence/CoverageView'
import GapView from './evidence/GapView'
import { HostilityList, LastContactsList } from './evidence/SocialEvidence'
import PresenceGrid from './PresenceGrid'
import RadiusMap from './RadiusMap'

type Tab = 'evidence' | 'sources'

export default function FindingDetail({ finding }: { finding: Finding }) {
  const [tab, setTab] = useState<Tab>('evidence')
  const [rows, setRows] = useState<EvidenceByPhone | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setRows(null)
    setErr(null)
    setTab('evidence')
    let live = true
    getEvidence(finding.evidence_ids)
      .then((r) => live && setRows(r))
      .catch((e) => live && setErr(String(e.message ?? e)))
    return () => {
      live = false
    }
  }, [finding])

  const phones = rows ? Object.keys(rows).length : 0
  const o = finding.check_output

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <VerdictBadge v={finding.verdict === 'cannot_tell' ? 'cannot_tell' : 'sweep'} />
          <Mono>
            {finding.check} · {finding.agent}
          </Mono>
        </div>
        {finding.brief_item && <div className="text-sm italic text-faint">“{finding.brief_item}”</div>}
        <Title size="md">{finding.heading ?? finding.statement}</Title>
        {finding.points && finding.points.length > 0 && (
          <ul className="space-y-1">
            {finding.points.map((p) => (
              <li key={p} className="flex gap-2 text-[14px] leading-snug text-ink">
                <span className="text-ink-3">•</span>
                {p}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {finding.people.map((p) => (
            <PersonChip key={p} id={p} />
          ))}
          <span className="ml-auto text-xs text-faint">
            {finding.evidence_ids.length} rows{rows ? ` from ${phones} phone${phones === 1 ? '' : 's'}` : ''}
          </span>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ['evidence', 'Evidence'],
          ['sources', 'Raw logs'],
        ]}
      />

      {err && <div className="rounded-lg border border-terra/40 p-3 text-sm text-terra-soft">{err}</div>}

      <div className="rise" key={tab}>
        {tab === 'evidence' && <h3 className="mb-4 text-[15px] font-semibold leading-snug text-ink">{conclusion(o)}</h3>}
        {tab === 'evidence' &&
          (o.kind === 'missing' ? (
            <MessagesDiff out={o} />
          ) : o.kind === 'distance' ? (
            <TrackMap out={o} places={PLACES} />
          ) : o.kind === 'chain' ? (
            <MoneyChain out={o} />
          ) : o.kind === 'meetings' ? (
            <MeetingsList out={o} places={PLACES} />
          ) : o.kind === 'sync' ? (
            <SyncTimeline out={o} />
          ) : o.kind === 'gap' ? (
            <GapView out={o} caption={caption(o)} />
          ) : o.kind === 'presence' ? (
            <PresenceGrid out={o} compact />
          ) : o.kind === 'space' ? (
            <RadiusMap space={o} show={o.spaces.map((s) => s.person)} height={360} />
          ) : o.kind === 'hostility' ? (
            <HostilityList out={o} />
          ) : o.kind === 'last_contacts' ? (
            <LastContactsList out={o} />
          ) : (
            <CoverageView out={o} />
          ))}
        {tab === 'evidence' && o.kind !== 'gap' && <p className="mt-3 text-[12.5px] leading-snug text-ink-3">{caption(o)}</p>}
        {tab === 'sources' && (rows ? <SourcesView rows={rows} /> : <Loading />)}
      </div>

      {tab === 'evidence' && rows && (
        <div className="border-t border-line pt-4">
          <ReadableRows rows={rows} />
        </div>
      )}
    </div>
  )
}

const n = (p: string) => personName(p as never)
/** "Paul's", "Paul's and Amy's", "Paul's, Amy's and Cara's" */
const owners = (ps: string[]) => {
  const xs = ps.map((p) => `${n(p)}'s`)
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
/** ['calls', 'calls', 'messages'] → "2 calls and 1 text" */
const activity = (tables: string[]) => {
  const word: Record<string, string> = { calls: 'call', messages: 'text', transactions: 'payment' }
  const counts = new Map<string, number>()
  for (const t of tables) counts.set(word[t] ?? 'event', (counts.get(word[t] ?? 'event') ?? 0) + 1)
  const parts = [...counts].map(([w, k]) => plural(k, w))
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** "16 Apr 21:00–23:30", or "16 Apr 17:00 – 17 Apr 01:52" when the range crosses midnight. */
const span = (a: string, b: string) => (fmtDate(a) === fmtDate(b) ? `${fmtDate(a)} ${fmtTime(a)}–${fmtTime(b)}` : `${fmtDate(a)} ${fmtTime(a)} – ${fmtDate(b)} ${fmtTime(b)}`)

/** One-line figure caption: what the figure shows and how its marks read. */
function caption(o: CheckOutput): string {
  switch (o.kind) {
    case 'gap':
      return `${n(o.person)}'s phone location on ${fmtDate(o.start)}, 4 hours either side of the gap. Hatched: no location data; dots: calls, texts or payments.`
    case 'presence':
      return `Each phone's distance from ${o.scene.name} in ${o.thresholds.slot_min}-minute slots, ${span(o.window.start, o.window.end)}. Hatched: no location data.`
    case 'sync':
      return `Thread deletions and power-offs on each phone, ${span(o.view.start, o.view.end)}. Shaded: the ${o.window.minutes}-minute window.`
    case 'missing':
      return `The ${n(o.person_a)}–${n(o.person_b)} thread as stored on each phone, matched by time. A blank cell is a message missing from that phone.`
    case 'meetings':
      return `Where the two phones met, the contacts found between them, and how long each meeting lasted.`
    case 'hostility':
      return `Each post scored from 0 to 1 for hostility by ${o.model}; ▲ marks ${o.threshold} or higher.`
    case 'last_contacts':
      return `Every text and call on ${n(o.person)}'s phone, ${span(o.window.start, o.window.end)}. The tag shows whether the other phone still has it.`
    case 'space':
      return `Each phone's routine area: a circle around home covering places it stayed on ${o.rule.min_days}+ days. Dashed: the victim.`
    case 'coverage':
      return 'First and last row on each phone.'
    case 'distance':
      return `Both phones' tracks, ${span(o.start, o.end)}, compared slot by slot.`
    case 'chain':
      return 'Each step is one transfer, with amount, time and memo.'
  }
}

/** The one thing to take away from the figure, stated from its own numbers. */
function conclusion(o: CheckOutput): string {
  switch (o.kind) {
    case 'gap': {
      const when = `${fmtTime(o.start)}–${fmtTime(o.end)} on ${fmtDate(o.start)}`
      if (o.gap_type === 'powered_off') return `${n(o.person)}'s phone was switched off for ${o.minutes} min, ${when}${o.activity.length ? '' : ', and nothing was sent or received'}`
      if (o.gap_type === 'location_off') return `${n(o.person)}'s phone reported no location for ${o.minutes} min, ${when}, while it was in use: ${activity(o.activity.map((a) => a.table))}`
      return `${n(o.person)}'s phone has no location data for ${o.minutes} min, ${when}, and nothing on the phone explains it`
    }
    case 'presence': {
      const at = o.phones.filter((p) => p.counts.scene > 0).map((p) => p.person)
      const unknown = o.phones.filter((p) => !at.includes(p.person) && p.counts.no_data > 0).map((p) => p.person)
      const head = at.length ? `Only ${owners(at)} phone ${at.length === 1 ? 'was' : 'were'} at ${o.scene.name}` : `No phone was at ${o.scene.name}`
      return `${head} between ${fmtTime(o.window.start)} and ${fmtTime(o.window.end)}${unknown.length ? `; ${owners(unknown)} ${unknown.length === 1 ? 'phone' : 'phones'} can't be placed for part of that time` : ''}`
    }
    case 'sync':
      return `${owners(o.phones)} phones each deleted a thread within ${o.window.minutes} min of each other${o.trigger ? `, starting ${o.trigger.minutes_before_window} min after the ${fmtTime(o.trigger.t)} news alert` : ''}`
    case 'missing': {
      const goneB = o.items.filter((i) => i.on_a && !i.on_b).length
      const goneA = o.items.filter((i) => i.on_b && !i.on_a).length
      const [has, lacks, k] = goneB >= goneA ? [o.person_a, o.person_b, goneB] : [o.person_b, o.person_a, goneA]
      return `${plural(k, `${n(o.person_a)}–${n(o.person_b)} message`)} ${k === 1 ? 'is' : 'are'} still on ${n(has)}'s phone but gone from ${n(lacks)}'s`
    }
    case 'meetings':
      return `${n(o.person_a)}'s and ${n(o.person_b)}'s phones met ${plural(o.occasions.length, 'time')}, ${o.contact_rows_found ? `with ${plural(o.contact_rows_found, 'contact')} between them` : 'yet never called, texted or paid each other'}`
    case 'hostility': {
      const flagged = o.items.filter((i) => i.score >= o.threshold)
      const after = o.context && flagged.every((i) => i.t > o.context!.t)
      return `${flagged.length} of ${n(o.actor)}'s ${o.items.length} posts about ${n(o.target)} score as hostile${after ? `, all posted after ${o.context!.label} on ${fmtDate(o.context!.t)}` : ''}`
    }
    case 'last_contacts': {
      const gone = o.items.filter((i) => i.on_counterpart === 'deleted')
      const who = [...new Set(gone.map((i) => i.counterpart).filter((p) => p !== 'other'))]
      return `${n(o.person)}'s phone last sent anything at ${fmtTime(o.last_active.t)}, a ${lower(o.last_active.label)}${gone.length ? `; ${activity(gone.map((i) => i.table))} from that evening ${gone.length === 1 ? 'is' : 'are'} gone from ${owners(who)} ${who.length === 1 ? 'phone' : 'phones'}` : ''}`
    }
    case 'space': {
      const others = o.spaces.filter((x) => x.person !== o.victim)
      const inside = others.filter((x) => x.scene_inside).map((x) => x.person)
      const outside = others.filter((x) => !x.scene_inside).map((x) => x.person)
      return `${o.scene.name} is part of ${inside.length ? `${owners(inside)} routine` : "no one's routine"}${outside.length ? `, not ${owners(outside)}` : ''}`
    }
    case 'coverage':
      return `The phones only hold data from ${fmtDate(o.start)} to ${fmtDate(o.end)}, so this period can't be checked`
    case 'distance':
      return `${n(o.person_a)}'s and ${n(o.person_b)}'s phones were ${o.label === 'together' ? 'together' : o.label === 'apart' ? 'apart' : 'sometimes together'}, at least ${fmtKm(o.min_m)} apart`
    case 'chain':
      return `Money moved ${o.links.map((l) => n(l.from)).join(' → ')} → ${n(o.links[o.links.length - 1].to)} within ${o.gap_label}`
  }
}

function Loading() {
  return <div className="pulse-dot text-sm text-faint">Loading source rows…</div>
}

