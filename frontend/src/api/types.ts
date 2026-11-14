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
}

export interface Brief {
  believe: string[]
  confused: string[]
  unknown: string[]
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
  | 'report-writer'

export interface Todo {
  id: string
  label: string
  status: 'pending' | 'in_progress' | 'done'
}

export type AgentEvent =
  | { type: 'todos'; todos: Todo[] }
  | { type: 'subagent'; agent: SubagentName; status: 'start' | 'tool' | 'done'; todo_id?: string; tool?: string; note?: string }
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
  | 'get_coverage'

export interface Finding {
  id: string
  section: Section
  brief_item: string | null
  verdict: Verdict
  statement: string
  people: PersonId[]
  check: CheckName
  agent: SubagentName
  evidence_ids: string[]
  check_output: CheckOutput
}

export interface Report {
  assumptions: string[]
  findings: Finding[]
  next_steps: string[]
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

export type CheckOutput = DistanceOutput | MissingOutput | ChainOutput | MeetingsOutput | SyncOutput | CoverageOutput

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
}

/** Rows grouped by the phone they were extracted from. */
export type EvidenceByPhone = Record<PersonId, EvidenceRow[]>

// ---------- Relations graph ----------

export type Channel = 'message' | 'call' | 'transfer' | 'social' | 'deleted_thread' | 'colocation'

export interface GraphEdge {
  source: PersonId
  target: PersonId
  channel: Channel
  label: string
  weak?: boolean
  evidence_ids: string[]
}

export interface Graph {
  nodes: { id: PersonId; label: string; color: string }[]
  edges: GraphEdge[]
}
