// Shared contract between the front end and the (future) FastAPI backend.
// The mock in ./mock.ts implements exactly these shapes, so the real backend can replace it.

export type PersonId = string

export interface PhoneCounts {
  messages: number
  calls: number
  locations: number
  transfers: number
  social: number
}

export interface Person {
  person_id: PersonId
  name: string
  role: string
  phone_number: string
  device_id: string
  color: string
  counts: PhoneCounts
  /** Path to a portrait under /public (GAN-generated; see public/portraits/CREDITS.md). */
  portrait: string
  /** The victim's phone, recovered at the scene. */
  is_victim?: boolean
  /** Social media handle, for the social panels. */
  handle: string
}

export interface Place {
  name: string
  kind: string
  lat: number
  lon: number
}

export interface CaseInfo {
  case_id: string
  title: string
  summary: string
  timezone: string
  coverage: { start: string; end: string }
  people: Person[]
  places: Place[]
  /** What the investigator knows going in: the scene and the time-of-death window. */
  incident: IncidentFacts
}

export interface IncidentFacts {
  kind: 'death'
  victim: PersonId
  scene: Place
  /** From the medical examiner: the earliest and latest likely time of death. */
  tod_start: string
  tod_end: string
  found_at: string
  summary: string
}

/** The revision 2 three-part brief. Kept only while the mock UI uses it; revision 4 replaces it with claims. */
export interface Brief {
  believe: string[]
  confused: string[]
  unknown: string[]
}

/** A statement attributed to a person in the case, submitted alongside the brief. */
export interface Statement {
  statement_id: string
  person_id: PersonId
  text: string
}

export type ItemStatus = 'proposed' | 'confirmed' | 'edited' | 'removed'

/** Who made a claim: the investigator (brief) or a person in the case (statement). */
export type Claimant = PersonId | 'investigator'

/** One atomic claim parsed from statements or a transcript (stage ④), confirmed by the investigator (stage ⑤). */
export interface Item {
  item_id: string
  source: 'investigator' | 'statement' | 'transcript'
  /** The statement_id, or the transcript passage it came from. */
  source_ref: string
  claimant: Claimant
  /** A question is routed to Ask rather than checked as a claim. */
  kind: 'claim' | 'question'
  text: string
  people: PersonId[]
  start: string | null
  end: string | null
  status: ItemStatus
}

/** POST /api/verify: claims to check. A transcript (stretch) is split into claims per speaker. */
export interface AnalyseRequest {
  statements: Statement[]
  transcript?: { text: string; speakers?: PersonId[] }
}

/** Display labels for verdicts. */
export const VERDICT_LABEL = { confirmed: 'Supported', inconsistent: 'Contradicted', cannot_tell: "Can't tell" } as const

// ---------- Board (revision 4) ----------

export type IntegrityIssueKind =
  | 'missing_message'
  | 'one_sided_call'
  | 'one_sided_transfer'
  | 'clock_skew'
  | 'impossible_travel'
  | 'source_disagreement'

/** A place where the data can't be taken at face value, or where two phones disagree. */
export interface IntegrityIssue {
  issue_id: string
  kind: IntegrityIssueKind
  phones: PersonId[]
  start: string
  end: string
  summary: string
  evidence_ids: string[]
  /** The check call that found it (cross-phone issues), if any. */
  call_id?: string
}

/** A question the network raises, with the check that answers it. */
export interface SuggestedQuestion {
  question_id: string
  text: string
  origin: { kind: 'lead'; lead_id: string } | { kind: 'issue'; issue_id: string }
  /** Absent when no check can answer it ("open question"). */
  check?: { check: string; params: Record<string, unknown>; agent: SubagentName }
  status: 'open' | 'answered' | 'no_check'
  finding_id?: string
}

export type ChangeMark = 'new' | 'changed' | 'withdrawn'

/** What a newly added source changed on the board. */
export interface CaseDiff {
  from_version: number
  to_version: number
  source: { bundle: string; devices: string[] }
  summary: string
  insights: { id: string; mark: ChangeMark }[]
  leads: { id: string; mark: ChangeMark }[]
  questions: { id: string; mark: ChangeMark }[]
  findings: { id: string; mark: ChangeMark; supersedes?: string }[]
  /** Claims re-checked because their checks touch the new rows, and whether the verdict moved. */
  rechecked_claims: { item_id: string; before: Verdict; after: Verdict }[]
}

/** SSE events from POST /api/sources. */
export type SourceEvent =
  | { type: 'stage'; stage: 'load' | 'integrity' | 'discovery' | 'board'; status: StageStatus; detail?: string }
  | { type: 'error'; message: string; file?: string; line?: number }
  | { type: 'diff'; diff: CaseDiff }

// ---------- Integrity pass (stage ⓪) ----------

export type ReliabilityReason = 'clock_skew' | 'impossible_travel' | 'source_disagreement'

export interface ReliabilityWindow {
  device_id: string
  person: PersonId
  start: string
  end: string
  status: 'ok' | 'suspect'
  reasons: ReliabilityReason[]
  /** Numbers behind the flag, e.g. { speed_kmh: 640 } or { distance_m: 4200 }. */
  metrics: Record<string, number>
  evidence_ids: string[]
}

export interface ClockOffset {
  device_id: string
  offset_s: number
  n_pairs: number
  spread_s: number
  evidence_ids: string[]
}

// ---------- Investigator review (stage ⑦) ----------

export interface Review {
  review_id: string
  /** A finding id or an evidence row id. */
  target: string
  kind: 'checked' | 'disputed'
  note: string
  by: string
  at: string
}

// ---------- Ingest ----------

export type StageStatus = 'pending' | 'running' | 'done'

export interface IngestStage {
  id: 'load' | 'validate' | 'normalise' | 'resolve' | 'store' | 'index'
  label: string
  detail: string
  status: StageStatus
}

export interface IngestDevice {
  device_id: string
  owner: PersonId
  model: string
  extraction_tool: string
  extracted_at: string
  coverage_start: string
  coverage_end: string
  counts: Record<string, number>
}

export interface IngestReport {
  bundle_name: string
  schema_version: string
  files_read: number
  rows_checked: number
  errors: number
  devices: IngestDevice[]
  warnings: { level: 'info' | 'warn'; message: string }[]
}

// ---------- Agent run ----------

export type SubagentName =
  | 'orchestrator'
  | 'location-analyst'
  | 'comms-analyst'
  | 'relationship-mapper'
  | 'financial-analyst'
  | 'device-forensics'
  | 'social-analyst'

export interface Todo {
  id: string
  label: string
  status: 'pending' | 'in_progress' | 'done'
}

export type AgentEvent =
  | { type: 'todos'; todos: Todo[] }
  /** The run pauses at confirm_items; resume with POST /api/analyse/{run_id}/confirm. */
  | { type: 'items_proposed'; run_id: string; items: Item[] }
  | { type: 'subagent'; agent: SubagentName; status: 'start' | 'tool' | 'done' | 'follow_up'; todo_id?: string; tool?: string; note?: string; to?: SubagentName }
  /** After a dispute: the check calls being rerun. An updated `report` event follows. */
  | { type: 'rerun'; review_id: string; call_ids: string[]; checks: string[] }
  | { type: 'report'; report: Report }
  | { type: 'error'; message: string }

// ---------- Report ----------

export type Section = 'confirmed' | 'inconsistent' | 'answers' | 'unprompted'
export type Verdict = 'confirmed' | 'inconsistent' | 'cannot_tell'
export type CheckName =
  | 'missing_messages'
  | 'distance_between'
  | 'money_chains'
  | 'silent_meetings'
  | 'synchronised_behaviour'
  | 'location_gaps'
  | 'unresolved_identifiers'
  | 'group_meetings'
  | 'get_coverage'
  | 'presence_window'
  | 'activity_space'
  | 'social_hostility'
  | 'last_contacts'

export type FindingStatus = 'current' | 'changed' | 'withdrawn'

export interface Finding {
  id: string
  section: Section
  /** The confirmed item this finding answers; null for unprompted findings. */
  item_id: string | null
  /** The item's text, for display. */
  brief_item: string | null
  claimant: Claimant | null
  /** Copied from apply_verdict_rule; the validator rejects any other value. */
  verdict: Verdict
  statement: string
  people: PersonId[]
  check: CheckName
  agent: SubagentName
  evidence_ids: string[]
  check_output: CheckOutput
  derivation: Derivation
  /** Set when any cited evidence falls in a suspect reliability window. */
  reliability_note?: string
  /** 'changed' or 'withdrawn' after a dispute; the replacement finding sets `supersedes`. */
  status: FindingStatus
  supersedes?: string
  /** Set when this finding confirms a discovery lead. */
  lead_id?: string
  /** Set when this finding answers a suggested question from the board. */
  question_id?: string
}

// ---------- Transparency: how a finding was derived ----------

export type DerivationStepKind = 'question' | 'signal' | 'grouped' | 'route' | 'tool' | 'follow_up' | 'data' | 'compute' | 'rule' | 'statement'

export interface DerivationStep {
  kind: DerivationStepKind
  title: string
  detail: string
  /** Exact call, query or formula, shown in monospace. */
  code?: string
  actor: 'code' | 'model'
}

/** Ties each number in the statement to the check-output field it came from. */
export interface NumberTrace {
  text: string
  field: string
  value: string
}

export interface ValidatorCheck {
  rule: string
  passed: boolean
  detail: string
}

/** Which phones hold the data behind each fact in the finding. */
export interface Corroboration {
  fact: string
  phones: Record<PersonId, 'present' | 'absent' | 'deleted' | 'n/a'>
}

export interface Derivation {
  steps: DerivationStep[]
  numbers: NumberTrace[]
  validator: ValidatorCheck[]
  corroboration: Corroboration[]
}

/** Per person who made statements: each claim and whether the phones support it. */
export interface PersonClaims {
  person_id: PersonId
  claims: { item_id: string; text: string; verdict: Verdict; finding_ids: string[] }[]
}

export interface Report {
  assumptions: string[]
  findings: Finding[]
  /** Written by the orchestrator: the only free text in the report. */
  next_steps: string[]
  by_person: PersonClaims[]
  reliability_notes: { finding_id: string; note: string; window: ReliabilityWindow }[]
  /** Open leads, shown as "pattern, not verified". */
  leads: Lead[]
}

// Raw outputs from the deterministic checks. Every number shown in a statement comes from here.

export interface TrackPoint { id: string; t: string; lat: number; lon: number }

export interface DistanceOutput {
  kind: 'distance'
  person_a: PersonId
  person_b: PersonId
  start: string
  end: string
  slots: { t: string; a: TrackPoint; b: TrackPoint; distance_m: number }[]
  min_m: number
  median_m: number
  max_m: number
  label: 'together' | 'apart' | 'mixed'
  thresholds: { together_m: number; together_share: number; apart_m: number }
}

export interface MissingOutput {
  kind: 'missing'
  person_a: PersonId
  person_b: PersonId
  items: { t: string; channel: 'message' | 'call'; from: PersonId; to: PersonId; body: string; on_a: string | null; on_b: string | null }[]
  deletion_events: { id: string; device_owner: PersonId; t: string; counterpart: PersonId }[]
  missing_count: number
  tolerance_s: number
}

export interface ChainOutput {
  kind: 'chain'
  links: { from: PersonId; to: PersonId; amount: number; currency: string; t: string; memo: string; row_ids: string[] }[]
  gap_minutes: number
  gap_label: string
  ratio: number
  thresholds: { window_h: number; ratio_min: number; ratio_max: number; min_amount: number }
}

export interface MeetingsOutput {
  kind: 'meetings'
  person_a: PersonId
  person_b: PersonId
  occasions: { date: string; place: string; start: string; end: string; duration_min: number; min_distance_m: number; lat: number; lon: number; row_ids: string[] }[]
  contact_rows_found: number
  channels_checked: string[]
  thresholds: { within_m: number; min_minutes: number; min_occasions: number }
}

export interface SyncOutput {
  kind: 'sync'
  window: { start: string; end: string; minutes: number }
  view: { start: string; end: string }
  trigger: { id: string; device_owner: PersonId; t: string; from_label: string; body: string; minutes_before_window: number } | null
  events: { id: string; device_owner: PersonId; event_type: 'thread_deleted' | 'power_off' | 'power_on'; t: string; detail: string }[]
  phones: PersonId[]
  thresholds: { window_min: number; min_phones: number }
}

export interface CoverageOutput {
  kind: 'coverage'
  item: string
  start: string
  end: string
  devices: { owner: PersonId; first: { id: string; t: string }; last: { id: string; t: string } }[]
}

export type GapType = 'powered_off' | 'location_off' | 'unexplained'

export interface GapOutput {
  kind: 'gap'
  person: PersonId
  start: string
  end: string
  minutes: number
  gap_type: GapType
  raised: boolean
  /** The last location row before and the first after the gap. */
  bounding: { before: { id: string; t: string }; after: { id: string; t: string } }
  /** Messages, calls or transfers on this phone that fall inside the gap. */
  activity: { id: string; t: string; table: EvidenceTable; label: string }[]
  power_event_ids: string[]
  thresholds: { min_gap_min: number; interval_min: number }
}

export type PresenceStatus = 'scene' | 'near' | 'away' | 'no_data'

/** presence_window(): where every phone was, slot by slot, during the time-of-death window. */
export interface PresenceOutput {
  kind: 'presence'
  scene: Place
  window: { start: string; end: string }
  thresholds: { scene_m: number; near_m: number; slot_min: number }
  phones: {
    person: PersonId
    slots: { t: string; status: PresenceStatus; distance_m: number | null; row_id: string | null; gap_type?: GapType }[]
    closest_m: number | null
    closest_t: string | null
    counts: Record<PresenceStatus, number>
  }[]
}

/** activity_space(): each phone's routine area, as an anchor point plus the radius holding most of its fixes. */
export interface SpaceOutput {
  kind: 'space'
  scene: Place
  victim: PersonId
  /** A routine place is one the phone stayed at on at least `min_days` separate days. */
  rule: { min_days: number; buffer_m: number }
  spaces: {
    person: PersonId
    anchor: Place
    /** Distance to the farthest routine place, plus the buffer. */
    radius_m: number
    fixes: number
    routine: { name: string; days: number; distance_m: number }[]
    scene_distance_m: number
    scene_inside: boolean
    /** Share of this phone's circle that overlaps the victim's circle (0–1). */
    overlap_with_victim: number
    /** Location rows within 150 m of the scene, by day. */
    scene_visits: { date: string; fixes: number; first: string; last: string }[]
    top_places: { name: string; minutes: number }[]
  }[]
}

/** social_hostility(): posts and comments by one account about another, scored by a fixed classifier. */
export interface HostilityOutput {
  kind: 'hostility'
  actor: PersonId
  target: PersonId
  platform: string
  threshold: number
  model: string
  items: { id: string; t: string; kind: 'post' | 'comment' | 'reply'; text: string; score: number; where: string }[]
  flagged: number
  /** The event the posts started after, if any (e.g. a dismissal). */
  context: { id: string; t: string; label: string } | null
}

/** last_contacts(): the victim's final interactions before and during the time-of-death window. */
export interface LastContactsOutput {
  kind: 'last_contacts'
  person: PersonId
  window: { start: string; end: string }
  items: { id: string; t: string; table: 'messages' | 'calls'; direction: 'in' | 'out'; counterpart: PersonId | 'other'; label: string; body?: string; on_counterpart: 'present' | 'deleted' | 'n/a' }[]
  last_active: { id: string; t: string; label: string }
}

export type CheckOutput = DistanceOutput | MissingOutput | ChainOutput | MeetingsOutput | SyncOutput | CoverageOutput | GapOutput | PresenceOutput | SpaceOutput | HostilityOutput | LastContactsOutput

// ---------- Evidence ----------

export type EvidenceTable =
  | 'messages'
  | 'calls'
  | 'locations'
  | 'transactions'
  | 'device_events'
  | 'social_interactions'
  | 'contacts'

export interface EvidenceRow {
  id: string
  device_owner: PersonId
  table: EvidenceTable
  timestamp: string
  summary: string
  fields: Record<string, string | number | null>
  provenance: Provenance
}

/** Where a row came from, so anyone can open the source file and find it. */
export interface Provenance {
  bundle: string
  bundle_sha256: string
  file: string
  line: number
  record_id: string
  extraction_tool: string
  extracted_at: string
  /** The original JSONL line as ingested. */
  raw: string
}

/** Rows grouped by the phone they were extracted from. */
export type EvidenceByPhone = Record<PersonId, EvidenceRow[]>

// ---------- Relations graph ----------

export type Channel = 'message' | 'call' | 'transfer' | 'social' | 'hostile' | 'deleted_thread' | 'colocation'

export interface GraphEdge {
  source: PersonId
  target: PersonId
  channel: Channel
  label: string
  weak?: boolean
  /** Number of interactions behind the edge (rows de-duplicated across phones). */
  count: number
  first?: string
  last?: string
  evidence_ids: string[]
}

/** A cell of the discovery complex: rank 0 an entity, rank 1 a pairwise link, rank 2 a group. */
export interface GraphCell {
  cell_id: string
  rank: 0 | 1 | 2
  /** e.g. 'group_window', 'group_chat', 'chain', 'burst', 'message', 'transfer', 'mention' */
  kind: string
  /** Entity ids: person ids, identifiers, accounts, places or mentions. */
  members: string[]
  start: string
  end: string
  evidence_ids: string[]
}

export interface Graph {
  nodes: { id: PersonId; label: string; color: string }[]
  edges: GraphEdge[]
  /** Rank-2 cells (groups) from discovery, so the relations panel can shade them. */
  cells: GraphCell[]
}

// ---------- Discovery leads ----------

export type LeadKind = 'relay' | 'circulation' | 'recurring_group' | 'hole' | 'burst' | 'alias' | 'other'

/** A pattern discovery found. Never a verdict: it becomes a finding only once its proposed check confirms it. */
export interface Lead {
  lead_id: string
  kind: LeadKind
  cell: GraphCell
  /** Unsupervised score (isolation forest), higher is more unusual. */
  score: number
  /** Why it scored: top features and the neighbouring cells that contributed through propagation. */
  drivers: { feature: string; detail: string }[]
  evidence_ids: string[]
  proposed_check?: { check: CheckName | string; params: Record<string, unknown>; agent: SubagentName }
  status: 'open' | 'promoted' | 'dismissed'
  promoted_finding_id?: string
  dismissed_reason?: string
}

// ---------- Sweep, triage, briefing ----------

/** One hit from a check during the sweep. */
export interface Signal {
  signal_id: string
  check: CheckName | 'deletions' | 'power_events'
  people: PersonId[]
  start: string
  end: string
  evidence_ids: string[]
  /** 0–1, computed by the check in code. */
  strength: number
  summary: string
  /** Reasons from suspect reliability windows that this signal's evidence falls in. */
  reliability_flags?: ReliabilityReason[]
}

/** The investigative questions the product is organised around. */
export type InquiryId = 'connections' | 'radius' | 'window' | 'changes' | 'motive'

/** Signals grouped by triage (shared people, overlapping time). */
export interface Incident {
  /** Which line of inquiry this insight answers. */
  inquiry: InquiryId
  incident_id: string
  signal_ids: string[]
  people: PersonId[]
  start: string
  end: string
  n_checks: number
  n_phones: number
  strength: number
  rank: number
  headline: string
  /** Short label for tables and graphs. */
  title: string
  /** Two or three key numbers, straight from check output. */
  facts: string[]
  why_it_matters: string
  rank_reason: string
  anchor_id?: string
  findings: Finding[]
  follow_ups: string[]
}

/** A time where signals from three or more phones cluster. */
export interface Anchor {
  anchor_id: string
  start: string
  end: string
  phones: PersonId[]
  signal_ids: string[]
  label: string
  finding_id: string
}

export interface Dismissal {
  signal_id: string | null
  title: string
  reason: string
  rule: string
  by: 'code rule' | 'agent'
}

export interface TimelineEvent {
  id: string
  owner: PersonId
  t: string
  end?: string
  kind: 'location' | 'meeting' | 'message' | 'transfer' | 'deletion' | 'power_off' | 'trigger' | 'gap'
  label: string
  finding_id?: string
  gap_type?: GapType
  /** For transfers and meetings: draw a link to another phone's row. */
  link_to?: PersonId
}

export interface Briefing {
  generated_from: string
  headline: string
  stats: { label: string; value: string }[]
  anchors: Anchor[]
  incidents: Incident[]
  timeline: TimelineEvent[]
  dismissed: Dismissal[]
  signals_total: number
  /** Top leads from discovery: promoted ones link to their findings; open ones are "pattern, not verified". */
  leads: Lead[]
  /** Revision 4 board: data problems found by the integrity layer. */
  integrity_issues: IntegrityIssue[]
  /** Revision 4 board: questions this case raises. */
  questions: SuggestedQuestion[]
  case_version: number
}

/** Location timeline segment (the `stays` table). */
export interface Segment {
  segment_id: string
  person: PersonId
  kind: 'stay' | 'travel' | 'gap'
  start: string
  end: string
  place?: string
  from?: string
  to?: string
  gap_type?: GapType
  raised?: boolean
  finding_id?: string
}

// ---------- Ask (questions with cited answers) ----------

export type AskEvent =
  | { type: 'step'; text: string }
  | { type: 'answer'; answer: Answer }

export interface Answer {
  question: string
  text: string
  verdict: Verdict | null
  findings: Finding[]
  steps: string[]
  suggestions: string[]
}

// ---------- Case-load agent run (sweep + triage) ----------

export interface ToolCall {
  id: string
  agent: SubagentName
  check: string
  args: string
  /** Rows the check read, counted from the case store. */
  rows: number
  /** Milliseconds since the run started. */
  start_ms: number
  ms: number
  result: string
  /** Set when this call was made because another agent asked for it. */
  follow_up_from?: SubagentName
}

export interface FollowUp {
  from: SubagentName
  to: SubagentName
  note: string
  at_ms: number
}

/** What one subagent hands back: the content of its findings/<area>.json. */
export interface AgentEnvelope {
  agent: SubagentName
  file: string
  started_ms: number
  finished_ms: number
  summary: string
  tool_calls: ToolCall[]
  signal_ids: string[]
  findings: Finding[]
  follow_ups_sent: FollowUp[]
  follow_ups_received: FollowUp[]
  dismissed: Dismissal[]
}

export type RunEvent =
  | { type: 'phase'; phase: 'sweep' | 'triage' | 'done'; at_ms: number }
  | { type: 'agent'; agent: SubagentName; status: 'running' | 'done'; at_ms: number }
  | { type: 'tool'; call: ToolCall }
  | { type: 'follow_up'; hop: FollowUp }
  | { type: 'log'; agent: SubagentName; text: string; at_ms: number }
  | { type: 'envelope'; envelope: AgentEnvelope }
