# Alib.ai architecture

This document covers the target design for iteration 1 and later. The front-end mock-up in `frontend/` already follows these interfaces. Each mock is meant to be replaced by the real component behind the same contract.

## 1. Design principle: code finds facts, the model routes and phrases

```
                ┌───────────── deterministic ─────────────┐   ┌──────── LLM (deepagents) ────────┐
Case Bundle ──► Ingest pipeline ──► Case Store ──► Checks ◄──── Orchestrator ──► domain subagents
 (any source)    load/validate/      (SQLite)      (pure        │ splits brief     │ choose checks,
                 normalise/resolve                  Python)      │ write_todos      │ read results,
                                                                 │ run_sweep()      │ return verdicts
                                                                 ▼                  ▼
                                                              Report writer ──► validate_report() ──► Report JSON ──► UI
                                                                                (code: citations, wording, numbers)
```

- **Checks are plain Python functions over SQLite.** They don't import LangChain. Each returns JSON that includes `evidence_ids` and any numbers a statement might need, already computed: distances, gaps, window lengths.
- **Agents never compute numbers or invent rows.** They decide which check answers which brief item and turn check output into one plain sentence.
- **`validate_report()` is code, not a prompt.** It drops any statement that:
  - has no evidence ids, or has ids that don't resolve
  - says a *person* was somewhere instead of a phone
  - uses "lied", "guilty" or similar
  - contains a number that isn't in the cited check output
  - is longer than one sentence

  It allows one repair attempt, and then drops what still fails.

## 2. Ingest pipeline (`backend/ingest/`)

Input is a Case Bundle v1 (spec: [`schema/case-bundle-v1/README.md`](schema/case-bundle-v1/README.md)). Each stage is a pure function, so stages can be tested on their own:

| Stage | Does | Output |
|---|---|---|
| `load` | Read the manifest and JSONL files | raw dicts + file/line provenance |
| `validate` | Validate each row against the pydantic models in `schema.py` | errors (fatal) and warnings |
| `normalise` | Phone numbers to E.164; timestamps to aware datetimes; handles to lowercase; geofence locations to named places | clean rows |
| `resolve` | Map identifiers to `person_id` using persons, contacts and logged-in social accounts | rows with `from_person`, `to_person` |
| `store` | Write to SQLite; every row gets `device_id`, `device_owner` and a global id `<device>:<type>:<record_id>` | case.db |
| `index` | Build a per-pair contact index and 10-minute location slots | ingest report |

New sources only need an **adapter** that writes a Case Bundle. The rest of the system never changes.

## 3. Case Store (SQLite)

The tables are `persons`, `identifiers`, `devices`, `contacts`, `messages`, `calls`, `locations`, `transactions`, `device_events`, `social_accounts` and `social_interactions`. Every evidence table carries `id` (the global id), `device_id`, `device_owner` and its timestamp. They are indexed on `(device_owner, timestamp)`.

## 4. Checks (`backend/checks/`)

Thresholds are named keyword arguments with these defaults.

| Function | Logic | Defaults |
|---|---|---|
| `missing_messages(a, b, start, end)` | Match a↔b messages across both phones on sender, recipient, body and time; return one-sided rows plus `thread_deleted` events | tolerance 2 s |
| `distance_between(a, b, start, end)` | Haversine per shared 10-minute slot; min, median and max; label | together ≤150 m for ≥80% of slots; apart if never <1 km |
| `money_chains(start, end)` | A→B then B→C | ≤24 h; 80–100% of the first amount; first ≥ $500 |
| `silent_meetings(start, end)` | Pairs within range for a sustained time on repeated occasions, with no message or call on any phone | ≤100 m, ≥20 min, ≥2 occasions |
| `synchronised_behaviour(start, end)` | ≥N phones with `thread_deleted` or `power_off` in one window; also returns inbound messages shortly before the window, as trigger candidates | 60 min, 3 phones |
| `contact_graph(people?)` | Edges by channel: message, call, transfer, social, deleted thread, co-location | none |
| `get_events`, `search_messages`, `get_coverage` | Helper lookups | none |
| `run_sweep()` | All checks over every pair and the full range | none |

`backend/tests/test_checks.py` scores every check against `data/out/answer_key.json`. Each check must return its planted scenario and must not return any decoy.

## 5. Agents (`backend/agents/`, LangChain deepagents)

```python
agent = create_deep_agent(
    model=init_chat_model(os.environ["MODEL"]),   # Anthropic or Bedrock
    tools=[run_sweep, get_coverage],
    subagents=[location_analyst, comms_analyst, relationship_mapper,
               financial_analyst, device_forensics, report_writer],
    system_prompt=ORCHESTRATOR_PROMPT,            # people table, verdict rules, wording rules
)
```

| Subagent | Question it answers | Tools |
|---|---|---|
| `location-analyst` | Were these phones together? Where? Repeated co-location? | distance_between, silent_meetings, get_events(locations) |
| `comms-analyst` | What was said? Is anything missing from one phone? | missing_messages, search_messages, get_events(messages, calls) |
| `relationship-mapper` | Who contacted whom, on which channel? Did X likely know Y? (contacts, social follows and likes, co-location, deleted threads) | contact_graph, silent_meetings, get_events(contacts, social) |
| `financial-analyst` | Where did money go next? | money_chains, get_events(transactions) |
| `device-forensics` | Deletions, power-offs, coordinated behaviour, triggers, data coverage | synchronised_behaviour, search_messages, get_coverage |
| `report-writer` | Assemble sections, write next steps (no data tools) | none |

**Run:**
1. The orchestrator splits the brief into items and resolves people and dates.
2. It calls `write_todos`, with one entry per item plus "sweep" and "write report".
3. It dispatches subagents through `task`, in parallel. An item may go to several subagents. For example, "X and Y don't know each other" goes to `relationship-mapper` and `location-analyst`.
4. Each subagent returns `{verdict, statement, people, check, evidence_ids, check_output}`.
5. The orchestrator calls `run_sweep()`. Code de-duplicates the sweep against the brief findings by evidence-id overlap, and whatever is left becomes "What you didn't ask about".
6. `report-writer` assembles the report, and then `validate_report()` runs.

**Verdicts:**
- `confirmed`: data on at least 2 phones agrees.
- `inconsistent`: the data contradicts the item.
- `cannot_tell`: no data settles the item. It cites coverage rows rather than guessing.

## 6. API (FastAPI, `backend/api.py`)

| Endpoint | Returns |
|---|---|
| `POST /api/ingest` (zip) | `IngestReport` |
| `GET /api/case` | `CaseInfo`: people, per-phone counts, places |
| `POST /api/analyse` (Brief) | SSE stream: `todos`, `subagent` (start, tool, done) and `report` events, with `error` on failure. The last report is cached by brief hash for instant demo reloads. |
| `GET /api/evidence?ids=` | `EvidenceByPhone`: full rows grouped by phone; 404 lists unknown ids |
| `GET /api/graph` | `Graph` for the relations view |

The TypeScript versions of these shapes are in [`frontend/src/api/types.ts`](frontend/src/api/types.ts), and that file is the contract. `backend/schemas.py` should mirror it.

## 7. Front end (`frontend/`)

It is built with React, Vite, TypeScript, Tailwind v4 and react-leaflet. The map uses no base tiles, because the city is invented.

- **Ingest page:** a drop zone, the six pipeline stages, a per-device counts table, and warnings.
- **Case page:**
  - **Left:** the people and their phones, plus the brief.
  - **Middle:** the to-do list and subagent lanes while a run is going, then the report.
  - **Right:** evidence, with a view chosen by `finding.check_output.kind`.

| `kind` | View |
|---|---|
| `missing` | Two-column thread diff, gaps marked, deletion event beneath |
| `distance` | Map with both tracks, a per-slot distance bar |
| `chain` | Person → person → person with amounts and times |
| `meetings` | Occasions table, map pins, "0 contacts" line |
| `sync` | Timeline per phone with the shared window shaded and the trigger marked |
| `coverage` | Per-phone first and last rows (for `cannot_tell`) |

A **Relations graph** tab shows `contact_graph` for the whole case.

The swap point between the mock and the real backend is [`frontend/src/api/index.ts`](frontend/src/api/index.ts).

## 8. Repository layout (target)

```
data/generate.py            seeded synthetic Case Bundle + answer_key.json
schema/case-bundle-v1/      format spec + example bundle
backend/ingest/             load, validate, normalise, resolve, store
backend/checks/             messages, location, money, relations, device, sweep
backend/agents/             orchestrator, subagents, writer, validator
backend/api.py              FastAPI
backend/tests/              checks vs answer key, ingest, validator, e2e (slow)
frontend/                   the UI (currently running on mocks)
```

## 9. Build order

1. Generator and answer key
2. Ingest pipeline and checks, with tests passing (no model needed)
3. `/api/case`, `/api/evidence` and `/api/graph`
4. Agents on the CLI
5. SSE `/api/analyse`
6. Swap the front-end mocks for the real API
7. Cached demo run

Steps 1–3 can run in parallel with front-end work, because the contract in `types.ts` is fixed.
