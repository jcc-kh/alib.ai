# Alib.ai architecture

This document covers the target design for the backend build. For a link-by-link account of how every statement is derived and traced back to its source, see [DERIVATION.md](DERIVATION.md). The front-end mock-up in `frontend/` is a placeholder: backend decisions are not made to fit it, but [`frontend/src/api/types.ts`](frontend/src/api/types.ts) is kept in step with the contract below.

![Alib.ai system architecture](docs/architecture.png)

*Diagram source: [docs/architecture-diagram.html](docs/architecture-diagram.html). To update it, edit the HTML, and render it at 1920×1440 with a device scale factor of 2 to `docs/architecture.png`, for example with headless Chrome or Edge: `msedge --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1920,1440 --virtual-time-budget=8000 --screenshot=docs/architecture.png file:///<repo>/docs/architecture-diagram.html`.*

> **Changes in revision 3** (from the planning handoff):
> - **Agents:** orchestrator plus five domain subagents. The `report-writer` subagent is removed; the report is assembled in code and the orchestrator writes only the next-steps paragraph (§7, §8).
> - **Structured output:** every domain subagent returns a Pydantic `Finding`. Verdicts come from code rules and are copied, never chosen (§7.2).
> - **Integrity pass (new, stage ⓪):** clock offset, impossible travel and location-source disagreement, run in code before anything else. Writes per-phone reliability; every subagent gets `get_reliability` (§5).
> - **Statements:** claims attributed to a person are accepted alongside the brief; the report shows, per person, which claims the phones support or contradict (§7.5, §8).
> - **Human check:** a `confirm_items` interrupt lets the investigator approve or edit parsed items before any check runs (§7.4).
> - **Disputes change results:** a disputed row is excluded, the checks that cited it rerun, and changed findings are marked (§9).
> - **Names stand for phones:** the "phones, not people" wording rule is dropped. A sentence may use a case person's name for their phone ("Amy was at Northgate Mall"); the report says so once, in its assumptions (§8.1). The neutral-wording list is extended (§8.2).
> - **New check:** `unresolved_identifiers` (possible burners); stretch: group meetings (§6).
> - **Discovery layer (new, stage ①b):** the network model organises the whole case into a combinatorial complex (pairs **and** groups) and finds unusual higher-order structure without labels or training, using the mathematics topological neural networks are built on. Its output is **leads**, which become findings only when a deterministic check confirms them. A trained TNN is the roadmap (§6.4).
> - **Evaluation across seeds:** precision and recall per check over 10–20 generated cases, one seed held out (§12).
> - **Ingestion is out of scope for this build.** The case store is assumed loaded, normalised and resolved (§3).

> **Pivot after revision 3 (mock only so far): insight discovery.** The product now leads with what the phones show rather than with testing claims. The demo case is a death (*Death at Pier 9*): five phones including the victim's, a scene and a time-of-death window as case inputs. Four checks and one subagent are added (§6.5, §7.1): `presence_window`, `activity_space`, `last_contacts`, `social_hostility`, and a `social-analyst`. Insights are filed under five **lines of inquiry** (§11). The mock no longer has hypothesis testing; stages ③–⑤ below (parse, confirm, refine against a brief and statements) are still the revision-3 design and need a team decision on whether to keep them.

---

## 1. Operating rule

**Discovery finds leads; code proves facts; the model routes and phrases.** Agents never compute, checks never conclude, and a lead is never a verdict.

| | Checks and rules (code) | Discovery (network model) | Agents (model) |
|---|---|---|---|
| What they are | Plain Python functions over SQLite. Each check answers **one fixed question**; each verdict rule maps a check output to a verdict. | A combinatorial complex of the whole case, fixed topological operators over it, and unsupervised scoring (§6.4). A language model extracts entities from text into the complex. | LangChain deepagents: one orchestrator, five domain subagents |
| What they do | Return JSON with the `evidence_ids` they used and **every number** the report will contain. Compute verdicts, strengths, reliability and rankings. | Organise every row into pairs and groups. Rank the most unusual structures as **leads**, each with its rows, its drivers and a proposed confirming check. Find patterns nobody wrote a rule for. | Parse the brief and statements into items. Choose which checks to run with what parameters. Triage leads and propose checks to confirm them. Follow up on results. Read message content. Phrase one sentence per finding. Write the next-steps paragraph. |
| What they never do | Draw a conclusion in words, rank by judgement, or phrase anything | Produce a verdict, or put a lead in the findings without a check confirming it | Do arithmetic, count rows, choose a verdict, or invent a row |

Anything that looks like arithmetic in an agent's job is a **code helper the agent calls**: grouping signals by time overlap, counting agreeing checks, finding clusters of three or more phones, applying a verdict rule. The agent decides what to do with the result: merge, dismiss with a reason, or follow up.

`validate_report()` (code, §8.2) enforces the rule on output. It is the evidence auditor: there is no auditing agent.

---

## 2. Pipeline overview

```
 Case store ─► ⓪ INTEGRITY (code) ─┬─► ①  SWEEP (code) ──────► signals ─┬─► ② TRIAGE (agents) ─► incidents ─► Opening briefing
 (loaded,       clock offsets       │   every check × pair × range        │   group · rank · dismiss          + top leads
  resolved)     reliability         │                                      │   · anchor moments                      │
                stays               └─► ①b DISCOVER (code + extraction) ─► leads                                      ▼
                                        complex · propagate · score
                                                    brief + statements ─► ③ PARSE (orchestrator) ─► items
                                                                                         │
                                                                     ④ CONFIRM (interrupt: investigator approves / edits)
                                                                                         │
                                                                     ⑤ REFINE (agents) match → targeted checks → Findings
                                                                                         │
                                                                     ⑥ ASSEMBLE (code) report + validate_report()
                                                                                         │
                                                                     ⑦ REVIEW (investigator) checked / disputed ─► rerun affected checks
```

| Stage | Trigger | Actor | Reads | Writes |
|---|---|---|---|---|
| ⓪ Integrity | Case store ready | code only | evidence tables | `clock_offsets`, `reliability`, `stays` |
| ① Sweep | Integrity finished | code only | case store (corrected timestamps), `stays` | `signals` |
| ①b Discover | Integrity finished (runs alongside the sweep) | code, plus a model for entity extraction from text | case store, `stays`, `reliability` | `entities`, `cells`, `leads` |
| ② Triage | Sweep and discovery finished | agents + code helpers | `signals`, `leads`, `reliability` | `incidents`, `dismissals`, `anchors`, opening `Briefing` (with top leads) |
| ③ Parse | Investigator submits brief and/or statements | orchestrator | brief, `statements` | proposed `items` |
| ④ Confirm | Items proposed | investigator (interrupt) | proposed `items` | confirmed `items` |
| ⑤ Refine | Items confirmed | orchestrator + domain subagents | `signals`, `incidents`, targeted checks | `findings` |
| ⑥ Assemble | All tasks done | code (+ orchestrator for next steps) | `findings`, `items`, `incidents` | `Report` |
| ⑦ Review | Investigator marks a row | code, then affected subagents | `reviews` | rerun checks, updated `findings` marked `changed` |

Stages ⓪, ① and ①b are invoked by the same entry point (`prepare_case()`), so no agent run, no direct `run_sweep()` call and no discovery run can skip the integrity pass.

---

## 3. Ingest (upstream, out of scope for this build)

The case store is assumed to be already loaded, normalised and resolved: every row has its global id `<device>:<type>:<record_id>`, `device_owner`, a tz-aware timestamp and `provenance`, and identifiers are resolved to `person_id` where possible. The intended ingest pipeline (load → validate → normalise → resolve → store, from a Case Bundle v1; spec in [`schema/case-bundle-v1/README.md`](schema/case-bundle-v1/README.md)) is unchanged, but `backend/ingest/` is **not** built or changed here.

Tests and the demo load the synthetic case straight into the case-store tables with the thinnest possible loader (`backend/store/load_synthetic.py`). Building `stays` moved from ingest to the integrity stage, so it uses clock-corrected timestamps.

---

## 4. Case store (SQLite)

**Evidence tables** (one row per phone record, each with `id`, `device_id`, `device_owner`, `ts` and `provenance`):
- `persons` (plus `identifiers`, and `orgs` for known businesses)
- `devices`, `contacts`, `messages`, `calls`, `transactions`, `device_events`
- `locations`, which also carries `source` (`gps` | `wifi` | `cell`) and `accuracy_m`
- `social_accounts`, `social_interactions`

Raw `ts` is never overwritten. Checks read timestamps through the view `v_<table>` which adds `ts_adj = ts − clock_offsets.offset_s` for that device and excludes disputed rows (§9).

**Derived tables**, written by code and read by checks and agents:

| Table | Columns | Written by |
|---|---|---|
| `clock_offsets` | `device_id, offset_s, n_pairs, spread_s, method, evidence_ids` | ⓪ Integrity |
| `reliability` | `device_id, person, start, end, status (ok\|suspect), reasons[] (clock_skew\|impossible_travel\|source_disagreement), metrics_json, evidence_ids` | ⓪ Integrity |
| `stays` | `segment_id, person, kind (stay\|travel\|gap), place, start, end, gap_type, evidence_ids` | ⓪ Integrity (via `location_timeline`) |
| `signals` | `signal_id, check, people, start, end, evidence_ids, strength, output_json, reliability_flags` | ① Sweep |
| `entities` | `entity_id, kind (person\|identifier\|account\|place\|mention), label, resolved_to?, source_row_id, quote, extractor` | ①b Discover (`mention` rows come from model extraction) |
| `cells` | `cell_id, rank (0\|1\|2), kind, members[], start, end, evidence_ids, features_json` | ①b Discover |
| `leads` | `lead_id, cell_id, kind, score, drivers_json, evidence_ids, proposed_check?, status (open\|promoted\|dismissed), promoted_finding_id?` | ①b Discover, ⑤ Refine |
| `incidents` | `incident_id, signal_ids, people, start, end, n_checks, n_phones, rank, headline, anchor_id?` | ② Triage |
| `dismissals` | `signal_id, reason, rule` | ② Triage |
| `anchors` | `anchor_id, start, end, phones, signal_ids` | ② Triage (via code helper) |
| `statements` | `statement_id, person_id, text, received_at` | API (§10) |
| `items` | `item_id, source (brief\|statement), source_ref, claimant (person_id\|investigator), kind (belief\|question\|claim), text, people, start, end, status (proposed\|confirmed\|edited\|removed)` | ③ Parse, ④ Confirm |
| `check_calls` | `call_id, check, params_json, output_json, evidence_ids, excluded_ids, run_at` | every check invocation |
| `findings` | `finding_id, item_id, call_id, verdict, sentence, evidence_ids, numbers_json, reliability_note, agent, status (current\|changed\|withdrawn), supersedes?` | ⑤ Refine, ⑦ Review |
| `reviews` | `review_id, target (finding_id\|evidence_id), kind (checked\|disputed), note, by, at` | ⑦ Review |

`strength` and verdicts are computed in code, from documented per-check rules (see DERIVATION.md §3). Agents never set them. `reliability_flags` on a signal lists the suspect windows its evidence falls in.

---

## 5. Integrity pass (`backend/integrity/`, stage ⓪)

All code, no model. Runs once per case (and again after a dispute that touches its inputs), before any sweep or agent run.

| Step | Logic | Output | Defaults |
|---|---|---|---|
| **Clock offset** | For each pair of phones, match calls present on both (same counterpart numbers, same direction, duration within 2 s). The offset estimate per phone is the median of `ts_b − ts_a` across matches, solved jointly against a reference phone (the one with the most matches). Runs **before** `missing_messages`, whose 2 s tolerance assumes synced clocks: without correction, every message in a skewed pair looks deleted. | `clock_offsets`; a phone with `|offset| > 5 s` gets a `clock_skew` reliability row covering its whole coverage | ≥3 matched calls; candidate window ±15 min; spread must be ≤ 2 s, otherwise status `suspect` with "offset not estimable" |
| **Impossible travel** | Consecutive location fixes on one phone (corrected time) whose implied speed exceeds a ceiling, after allowing for both fixes' `accuracy_m` | `reliability` rows `impossible_travel` over the window between the fixes | 250 km/h; ignore pairs < 60 s apart |
| **Location-source disagreement** | A GPS fix farther than allowed from the same phone's Wi-Fi or cell fix within the same time slot | `reliability` rows `source_disagreement` | slot 5 min; distance > max(1 km, 3 × combined accuracy) |
| **Stays** | `location_timeline` for every person, on corrected timestamps | `stays` | see §6 |

A reliability window is `ok` unless one of the rules above marks it `suspect`. The tool `get_reliability(person?, start, end)` returns the windows overlapping a range. It is given to every domain subagent, and §8.2 enforces that a finding whose evidence falls in a suspect window says so.

Innocent noise the pass must **not** flag: indoor GPS loss (gap, not disagreement), normal drift within accuracy, an overnight power-off, a single fix with large `accuracy_m`.

---

## 6. Checks and discovery (`backend/checks/`, `backend/discovery/`)

Every check is a pure function over the views in §4. Thresholds are named keyword arguments with the defaults below. Each returns `{check, params, results[], evidence_ids[]}`; each result can be written as one `signals` row. Each check has a matching **verdict rule** in `backend/checks/verdicts.py` that maps (item, check output) to `confirmed | inconsistent | cannot_tell`.

### 6.1 Core checks

| Check | Owner | Logic | Defaults |
|---|---|---|---|
| `location_timeline(person, start, end)` | location | Location rows → ordered segments: **stay** (within 150 m for ≥10 min), **travel**, **gap** (with `gap_type`). Stored in `stays`. | stay radius 150 m, min stay 10 min |
| `location_gaps(person, start, end)` | location | Periods with no location rows for ≥45 min, classified (below) | min gap 45 min |
| `distance_between(a, b, start, end)` | location | Haversine per shared slot; min, median, max; label | together ≤150 m for ≥80% of slots; apart if never <1 km |
| `silent_meetings(start, end)` | location | Shared stays on repeated occasions with no message or call on any phone | ≤100 m, ≥20 min, ≥2 occasions |
| `missing_messages(a, b, start, end)` | comms | Message on one phone and absent from the other (on `ts_adj`), plus `thread_deleted` on the phone that lacks it | tolerance 2 s |
| `money_chains(start, end)` | financial | A→B then B→C | ≤24 h; 80–100%; first ≥ $500 |
| `synchronised_behaviour(start, end)` | device | ≥N phones with `thread_deleted` or `power_off` in one window; returns inbound messages before it as trigger candidates | 60 min, 3 phones |
| `deletions(person?, start, end)` | device | All `thread_deleted` events, counterpart resolved | none |
| `power_events(person?, start, end)` | device | `power_off`/`power_on` pairs with durations | none |
| `identity_match()` | relationship | Links numbers, emails and handles to people across all phones; builds the **people map** | none |
| `unresolved_identifiers(start, end)` **new** | relationship | Numbers or handles that contact ≥2 case people and resolve to no person and no known org (possible burners). Returns per identifier: which phones, counts by channel, first/last contact. Supersedes the optional `shared_unknown_number`. | ≥2 case people |

**Gap classification** (`location_gaps`):

| `gap_type` | Condition | Raised by default? |
|---|---|---|
| `powered_off` | A `power_off` event covers the gap | Only if it overlaps another signal |
| `location_off` | The phone sent messages, made calls or made transfers **during** the gap | **Yes** |
| `unexplained` | No activity of any kind | Only if it overlaps another signal |

Wording rule: a gap is always "**no location data**", never proof of intent.

### 6.2 Optional checks (in this order if time allows)

| Check | Owner | Logic | Defaults |
|---|---|---|---|
| `call_log_mismatch(a, b, start, end)` | comms | A call on one phone absent from the other (on `ts_adj`) | tolerance 2 s |
| `transfer_after_meeting(start, end)` | financial | A transfer between two people within N hours after their phones were together | ≤6 h; ≥ $500 |
| `contact_went_quiet(start, end)` | comms | A pair with daily contact that stops | ≥3 contact days, then ≥2 silent days |
| `group_meetings(start, end)` *stretch* | location | ≥3 phones co-located at once. Framed as a multi-way pattern like `synchronised_behaviour`, not as pairwise meetings. | ≤150 m, ≥20 min, ≥3 phones |

### 6.3 Helpers (code, called by agents)

| Helper | Purpose |
|---|---|
| `prepare_case()` | ⓪ integrity pass, then ① `run_sweep()` and ①b `discover()`. The only way to start either. |
| `run_sweep()` | Every check × every pair × full range → `signals`. Refuses to run if the integrity pass has not completed for the current case version. |
| `propose_incidents(signal_ids?)` | Groups signals sharing people and overlapping in time; returns candidates with `n_checks`, `n_phones` |
| `anchor_moments(window_min=60, min_phones=3)` | Times where signals from ≥3 phones cluster |
| `rank_incidents(incident_ids, relevance?)` | Sorts by relevance (agent label, if a brief exists) → `n_checks` → `n_phones` → strength |
| `match_brief_item(item_id)` | Signals and incidents sharing people and dates with an item |
| `apply_verdict_rule(item_id, call_id)` | Runs the check's verdict rule; returns the verdict the subagent must copy |
| `get_reliability(person?, start, end)` | Suspect windows overlapping the range (§5) |
| `contact_graph(people?)` | Edges by channel |
| `get_events`, `search_messages`, `get_coverage` | Raw lookups |
| `get_leads(people?, start?, end?, kind?)` | Open leads from discovery, ranked by score (§6.4) |
| `explain_lead(lead_id)` | The lead's cell, member rows, the features and neighbours that drove its score, and its proposed check |
| `promote_lead(lead_id, call_id)` | Links a lead to the check call that confirmed it; only then can a finding cite it. Refuses if the call's verdict rule did not confirm |

Every check has a unit test against `answer_key.json`: it must return the planted case and no decoy.

### 6.4 Discovery: the topological network model (`backend/discovery/`, stage ①b)

Checks find what someone wrote a rule for. Discovery finds what nobody did. It organises the whole case into one structure, pairs **and** groups, and ranks the higher-order patterns that are hardest for a person to see in the mass of rows: three phones acting together when no pair looks unusual, money going round in a circle, two people strongly connected through others who never contact each other.

It uses the mathematics topological neural networks (TNNs) are built on, the combinatorial complex and its Hodge Laplacians, **without training**. A TNN is learned message passing over these operators; discovery uses the operators directly with fixed weights. That gives the same properties (unsupervised, higher-order, reproducible with a fixed seed) at hackathon cost. A trained TNN is the roadmap, below.

**Pipeline:**

| Step | What it does | Actor |
|---|---|---|
| **1. Entities** | Structured identities (people, numbers, accounts, places) from the people map, plus **mentions** a language model extracts from message, note, mail and search text: aliases ("Minnie E"), organisations, products, chemicals, places. Each mention stores its source row and the exact quote; code checks the quote appears in that row and drops it otherwise | code + model |
| **2. Complex** | A combinatorial complex built with TopoNetX. **Rank 0:** entities. **Rank 1:** pairwise links (message, call, transfer, co-location, mention), each with time and rows. **Rank 2:** groups: sets of ≥3 entities active together within a sliding window (default 60 min), group chats, transfer chains, activity bursts | code |
| **3. Features** | Per cell: channel mix, volume, time of day, duration, reliability flags, and how it deviates from that entity's own baseline over the week | code |
| **4. Propagation** | Features are passed up and down the ranks *k* times (default 2) through the incidence matrices and normalised Hodge Laplacians, with fixed weights. This is a TNN layer without learned parameters, in the spirit of training-free graph methods (SGC, SIGN) | code |
| **5. Scoring** | An isolation forest (fixed seed) over every cell's propagated features. The most unusual cells, mostly rank 2, become **leads** | code |
| **6. Flows** | Hodge decomposition of transfer and message flows into gradient (source → sink), curl (local cycles) and harmonic (global loops) parts. A large cycle component is a **circulation** lead, with no rule written for it | code |
| **7. Holes** | Pairs strongly connected through shared neighbours and shared places but with no direct link: a missing face in the complex. `silent_meetings` is one hand-written case of this. Persistent homology is the optional general method | code |

**Leads, not findings.** Each lead carries its cell, member rows, a score, the drivers (top features and neighbouring cells), and a **proposed check** that would confirm it (for example "`money_chains` over these three phones, 15 Apr" or "`distance_between` Paul, Cara"). Leads are shown in the briefing and report under their own heading, labelled "pattern, not verified". A lead becomes evidence only when a deterministic check confirms it and `promote_lead()` links the two; the finding then cites the check, with the lead as its origin in the derivation. Unconfirmed leads never enter verdicts, and the validator rejects any finding that cites a lead without a confirming check call.

**What discovery must find on the demo case** (planted by the generator, §12.1): the relay (Paul → Ken → Cara within minutes, each pair unremarkable), the circulation (money leaving Paul and partly returning through Ken and Cara), a recurring three-phone group below every pairwise threshold, and the Paul–Cara hole (S5).

**Roadmap: a trained TNN (stretch).** The generator produces labelled cases at scale, which is the training data a TNN needs. Train a message-passing TNN (TopoModelX) on generator seeds to score cells, then compare it with the training-free pipeline on held-out seeds: planted higher-order patterns found at the same false-lead rate (§12.4). Risk: the network learns the generator's quirks, so it must also be checked on a real case before it is trusted. Not part of this build.

### 6.5 Incident checks (new with the pivot)

These take the **case facts** as input: `incident(victim_person_id, scene_place_id, tod_start, tod_end, found_at)`, entered by the investigator (the time-of-death window comes from the medical examiner).

| Check | Owner | Logic | Defaults |
|---|---|---|---|
| `presence_window(scene, start, end)` | location | For every phone and every slot in the window: the location row at that slot and its haversine distance to the scene → `scene` / `near` / `away`, or `no_data` with the covering gap's `gap_type`. Also the closest fix from 30 min before the window. **No data is never read as presence or absence.** | slot 10 min; scene ≤150 m; near ≤2 km |
| `activity_space(min_days, buffer_m, scene)` | location | Per phone: anchor = home (longest night-time stay); routine places = stays on ≥`min_days` separate days; radius = distance to the farthest routine place + buffer. Returns whether the scene is inside, days with fixes at the scene, and the share of the circle overlapping the victim's. Context, not evidence: a single trip does not widen a circle. | 2 days; 500 m |
| `last_contacts(person, start, end)` | comms | Every message and call on the victim's phone in the range; for each, whether the same row exists on the counterpart's phone or a later `thread_deleted` there removed it; the last outgoing activity. | from 17:00 on the day of death |
| `social_profile(person)` | social | Posts, comments, replies, likes and follows by the person's resolved handles. | none |
| `social_hostility(threshold, targets)` | social | Items that name or reply to a case person, scored 0–1 by a fixed local classifier (model and version recorded in the output, so the same text always gets the same score). Flags items ≥ threshold. **Reported as tension, never as placement**; the social analyst always asks the location analyst for `presence_window` on the same person. | 0.7; targets = case people |

`contact_graph()` gains two channels: `hostile` (flagged social items) and `colocation` (from `silent_meetings`), and each edge carries its interaction count and first/last time, so the front end can filter the graph by a time window.

---

## 7. Agents (`backend/agents/`, LangChain deepagents)

```python
checkpointer = SqliteSaver(...)            # required by interrupt_on

agent = create_deep_agent(
    model=init_chat_model(os.environ["ORCHESTRATOR_MODEL"]),   # stronger model
    tools=[confirm_items, match_brief_item, propose_incidents, anchor_moments,
           rank_incidents, get_coverage, get_reliability, get_leads],
    subagents=[relationship_mapper, location_analyst, comms_analyst,
               financial_analyst, device_forensics, social_analyst],
    system_prompt=ORCHESTRATOR_PROMPT,
    interrupt_on={"confirm_items": True},
    checkpointer=checkpointer,
)
agent.invoke(inputs, config={"configurable": {"thread_id": run_id}})
```

There is **no `report-writer`** (it had no tools, so no context to isolate; assembly is code, §8) and **no evidence-auditor** (`validate_report()` does that). Dynamic, interpreter-based subagents are not used: the sweep is already code.

### 7.1 Subagents

Each is a dict with `name`, `description`, `system_prompt`, `tools`, `model` (a faster model, `SUBAGENT_MODEL`) and `response_format=FindingSet`. Every subagent also gets `get_reliability`, `apply_verdict_rule`, `get_events`, `get_coverage`, `get_leads`, `explain_lead` and `promote_lead`, so any of them can confirm a lead in its own domain.

| Subagent | Checks it may run |
|---|---|
| `relationship-mapper` | `identity_match`, `unresolved_identifiers`, `contact_graph` (its people map is read first by the others). First reader of leads: explains them and routes each proposed check to the owning subagent |
| `location-analyst` | `presence_window`, `activity_space`, `location_timeline`, `location_gaps`, `distance_between`, `silent_meetings`, `group_meetings`* |
| `comms-analyst` | `last_contacts`, `missing_messages`, `call_log_mismatch`*, `contact_went_quiet`*, `search_messages` |
| `financial-analyst` | `money_chains` (A→B→C, including round trips where C = A), `transfer_after_meeting`* |
| `device-forensics` | `deletions`, `power_events`, `synchronised_behaviour` |
| `social-analyst` | `social_profile`, `social_hostility` |

\* optional or stretch.

### 7.2 Structured output

```python
class NumberTrace(BaseModel):
    text: str    # number as written in the sentence
    field: str   # check-output field it was copied from

class FollowUp(BaseModel):
    to: Literal["relationship-mapper", "location-analyst", "comms-analyst",
                "financial-analyst", "device-forensics"]
    check: str
    params: dict
    reason: str

class Finding(BaseModel):
    item_id: str
    check: str
    verdict: Literal["confirmed", "inconsistent", "cannot_tell"]  # copied from apply_verdict_rule
    sentence: str
    evidence_ids: list[str]
    numbers: list[NumberTrace]
    follow_up: FollowUp | None = None   # addition to the handoff model; keeps §7.3 chaining
    lead_id: str | None = None          # set when this finding confirms a discovery lead (§6.4)

class FindingSet(BaseModel):
    findings: list[Finding]
```

Code persists each returned `Finding` to `findings`, linking it to the `check_calls` row that produced it. The validator rejects a finding whose `verdict` differs from the recorded `apply_verdict_rule` result for that item and call.

### 7.3 Chaining

After each round the orchestrator reads the new findings. A finding with `follow_up` (or one the orchestrator spots) becomes a **new task to a different subagent** with the parameters filled in, logged as a `follow_up` step in the finding's derivation. Required example: `location-analyst` finds Ken's `location_off` gap (15 Apr 14:00–16:30) → `financial-analyst` finds the $4,500 transfer to Cara at 15:40 (link 2 of S4) → `comms-analyst` reads Ken's 15:10 message → one merged incident citing all three.

### 7.4 Parse and confirm (stages ③–④)

1. The orchestrator splits the brief and each statement into **atomic items**, each attributed to whoever made the claim (`investigator` for the brief, the statement's `person_id` otherwise), with people and dates resolved.
2. It calls `confirm_items(items)`. Because of `interrupt_on`, the run pauses there and the API streams the proposed items to the investigator (§10).
3. The investigator approves, edits or removes items. The run resumes on the same `thread_id` with the confirmed list. **No targeted check runs before this point.** The sweep and triage ran earlier and are not tied to any item.

### 7.5 Refine (stage ⑤)

1. For each confirmed item, call `match_brief_item()` **first**; reuse existing signals where they settle it. It also returns open leads sharing the item's people and dates, which the owning subagent may confirm with the lead's proposed check.
2. Route uncovered items to the owning subagent for targeted checks. Dates outside coverage → `get_coverage()` → `cannot_tell`.
3. Each subagent calls `apply_verdict_rule` and `get_reliability` for the windows it cites, then returns its `FindingSet`.
4. The orchestrator labels each incident's relevance to the items; `rank_incidents(relevance=…)` re-sorts in code.

### 7.6 Triage (stage ②, no brief)

1. `propose_incidents()` → candidates. 2. Agents merge or split (logged), and dismiss signals with an ordinary explanation (reason + rule). 3. `anchor_moments()`: on the demo case **17 April around 10:00** is flagged without the system being told about the audit. 4. `rank_incidents()` → top 5. 5. Each incident's `headline` is the sentence of its strongest validated finding (picked in code); `why_it_matters` is the code-generated rank reason (for example "3 checks agree across 3 phones"). 6. `get_leads()`: the top leads from discovery are attached to the incidents they overlap, or listed on their own. For each, `relationship-mapper` runs or routes the proposed check; confirmed leads are promoted, the rest stay in the briefing as "patterns, not verified".

**Verdicts** (rules in code):
- `confirmed`: data on at least 2 phones agrees with the item.
- `inconsistent`: the data contradicts the item.
- `cannot_tell`: no data settles it. The finding cites coverage rows.

---

## 8. Report assembly and validation (`backend/report/`)

### 8.1 Assembly (code)

`assemble_report(run_id)` builds the `Report` from validated `findings`, `items` and `incidents`:
- **By item:** Confirmed / Inconsistent (beliefs), Answers (questions).
- **By person (new):** for each person who made statements, their claims with the verdict per claim: supported (`confirmed`), contradicted (`inconsistent`) or `cannot_tell`.
- **Unprompted:** incidents matched to no item.
- **Reliability notes:** findings resting on a suspect window are listed with the reason.
- **Leads (new):** open leads from discovery, labelled "pattern, not verified", each with its rows, drivers and proposed check. Promoted leads appear as ordinary findings, with the lead shown as their origin.
- **Next steps:** the only free text the orchestrator writes. It is one short paragraph, given the assembled report as input, and passes the same validator.
- **Assumptions:** fixed text from code. It always includes: "Names stand for each person's phone. 'Amy was at Northgate Mall' means Amy's phone was there; a phone's location is not proof of where its owner was."

### 8.2 `validate_report()` (hardened)

Drops any statement that fails a rule below, after one repair attempt:

| Rule | Check |
|---|---|
| Cites evidence | `evidence_ids` non-empty and all resolve; none is disputed |
| Neutral wording | No word from the banned list: `lied`, `lying`, `liar`, `guilty`, `innocent`, `criminal`, `confessed`, `admitted`, `caught`, `covered up`, `cover-up`, `fraud`, `stole`, `suspicious`, `obviously`, `clearly`, `proves`, `proof` |
| Numbers traced | Every number token appears in `numbers[].text`; each `field` exists in the cited check output with an equal value |
| Verdict copied | `verdict` equals the stored `apply_verdict_rule` result |
| Reliability disclosed | If any cited evidence falls in a `suspect` window, the sentence contains the reliability phrase ("…, though this phone's clock/location data in that window is flagged as unreliable") |
| One sentence | Exactly one terminal punctuation mark |
| Leads are not verdicts | A finding with `lead_id` must have a `check_calls` row that `promote_lead()` linked to that lead, and its verdict comes from that call; leads themselves never carry a verdict |

There is no "phones, not people" rule: a case person's name may stand for their phone, and the report's assumptions say so (§8.1). The old `<Name> (was|were) (at|in|near)` regex is removed.

---

## 9. Investigator review and disputes (stage ⑦)

The Verify tab's "I checked this" / "I dispute this" are stored as `reviews` (`note`, `by`, `at`).

- **Checked** is recorded and shown; it changes nothing.
- **Disputed** (on an evidence row, or on a finding meaning all its rows):
  1. The row is excluded from the `v_*` views.
  2. Code finds every `check_calls` row whose `evidence_ids` include it and reruns those calls with the same params. If the row fed the integrity pass (a matched call, a location fix), the affected integrity steps rerun first.
  3. Signals and findings from rerun calls are recomputed. A finding whose verdict, evidence or numbers changed is superseded: the new one is `current` with `supersedes` set, the old one `changed`. A finding that no longer has evidence becomes `withdrawn`. Rephrasing goes back to the owning subagent only when the numbers changed.
  4. The report is reassembled; changed findings are marked in the UI.

---

## 10. API (FastAPI, `backend/api.py`)

| Endpoint | Returns |
|---|---|
| `POST /api/case/prepare` | Runs `prepare_case()` (⓪ + ① + ①b) and triage ② in the background |
| `GET /api/case` | `CaseInfo` |
| `POST /api/sources` (one evidence source) | SSE: stage progress (`load` … `store`, `checks`, `board`), rows read, checks re-run; then the board is refetched |
| `GET /api/board?loaded=` | The case board computed from the loaded sources: ties, ghosts, mutuals, filtered spaces, presence and stays, ranked insights |
| `GET /api/reliability?person=&start=&end=` | `ReliabilityWindow[]` and `ClockOffset[]` |
| `GET /api/briefing` | `Briefing` |
| `GET /api/signals?people=&check=&start=&end=` | `signals` rows |
| `GET /api/timeline?people=&start=&end=` | `stays` segments |
| `GET /api/run/stream` | SSE of the case-load run (sweep + triage): `phase`, `agent`, `tool` (check, args, rows, ms), `follow_up`, `log`, `envelope` (an agent's `findings/*.json`) |
| `GET /api/stats/{activity,heatmap,contacts,money,distance,places,volume}` | Chart aggregates computed from rows (see `frontend/src/lib/aggregates.ts`) |
| `POST /api/analyse` (`{brief, statements[]}`) | SSE: `todos`, `items_proposed` (then pauses), `subagent` (start, tool, done, `follow_up`), `report`, `error`. Returns `run_id`. |
| `POST /api/analyse/{run_id}/confirm` (`{items[]}`) | Resumes the interrupted run with confirmed or edited items; the SSE stream continues |
| `POST /api/reviews` (`Review`) | Records it; a dispute triggers §9 and streams `rerun` then an updated `report` |
| `GET /api/reviews?target=` | `Review[]` |
| `GET /api/timeline?people=&start=&end=` | `stays` segments per person (stay, travel, gap with `gap_type`) for the location timeline |
| `POST /api/ask` | SSE: `step`, then `answer` |
| `GET /api/evidence?ids=` | Rows + provenance grouped by phone; 404 lists unknown ids |
| `GET /api/graph` | Contact graph, plus rank-2 cells (groups) so the relations panel can shade them |
| `GET /api/leads?people=&start=&end=&status=` | `Lead[]`, ranked by score |

`backend/schemas.py` mirrors [`frontend/src/api/types.ts`](frontend/src/api/types.ts). Contract changes in this revision:
- `SubagentName` loses `report-writer`.
- New: `Statement {statement_id, person_id, text}`, `Item {item_id, source, claimant, kind, text, people, start, end, status}`, `ReliabilityWindow`, `ClockOffset`, `Review {review_id, target, kind: 'checked' | 'disputed', note, by, at}`.
- `AgentEvent` gains `items_proposed` and `rerun`.
- `Finding` gains `item_id`, `claimant`, `reliability_note?`, `status: 'current' | 'changed' | 'withdrawn'`, `supersedes?`.
- `Report` gains `by_person: {person_id, claims: {item_id, text, verdict, finding_ids}[]}[]` and `reliability_notes`.
- `CheckName` gains `unresolved_identifiers` (and `group_meetings` if built).
- New: `Lead {lead_id, kind, cell, score, drivers, evidence_ids, proposed_check?, status, promoted_finding_id?}` and `GraphCell {cell_id, rank, kind, members, start, end, evidence_ids}`. `Briefing` and `Report` gain `leads`; `Graph` gains `cells`; `Finding` gains `lead_id?`.

---

## 11. Front end (`frontend/`)

The front end is built on mocks (React, Vite, TypeScript, Tailwind v4, react-leaflet, Recharts). It is not a constraint on backend design. One dashboard (`src/ui/pro`, route `#/pro/<view>`) over one case store (`src/state/caseStore.tsx`); the Noir case-file UI and the hypothesis-testing screen were removed.

New UI the discovery contract implies: a **leads** section ("patterns, not verified") on the board and report, and **shaded group cells** in the relations graph so the higher-order structure discovery found is visible.

**Flow: a loop, not a pipeline.** The case is a set of loaded evidence sources. The home page is the **case board** (`#/pro/board`, `src/ui/pro/board/`), which is recomputed from the loaded sources (`computeBoard(loaded)` in `src/mock/sources.ts`). **Add evidence source** ingests one source with live progress, re-runs only the checks it affects, and marks what changed (`diffBoard`). There is no Ingest → Analyse → Briefing sequence.

- **Gating.** A finding is unlocked once every phone it reads is loaded (`SCENARIOS[sid].people`). Insights are re-ranked from unlocked findings only (`incidentsFor(unlocked)`). People referenced by loaded phones but without their own phone appear as ghost nodes. Ask answers "can't tell yet" when the phone that would settle a question isn't loaded.
- **Relationship ties** (board chart): one tie per pair from the loaded rows. Its level comes from calls and texts in the week: close (8 or more), regular (3–7), occasional (fewer, or a saved number), or hidden (co-located with no contact). The label is the relationship declared in the case file (`RELATIONS`), or what the rows show. Badges mark money, meetings without contact, deleted threads and hostile posts. Pairs with no tie show their **mutual connections** when a person is selected.
- **Board cards:** relationships, insight notes (hover draws threads to the cards holding their evidence), waiting on evidence, routine areas, time-of-death window, location timeline, routes in the window, and routine vs that night. Each card expands to its line of inquiry.
- **Demo order:** the board opens with Ravi's and Paul's phones; Amy's, Ken's and Cara's are added one at a time (1 → 2 → 3 → 6 insights).
- **Real backend:** `POST /api/sources` (upload plus an SSE progress stream: stages, rows, checks re-run) and `GET /api/board`, mirrored by `addSource()` and `getBoard()` in `src/api/mock.ts`.

**Lines of inquiry** (`src/ui/pro/inquiries/`, one page each; every page leads with its question, the method it borrows and the insights filed under it):

| Inquiry | Method borrowed | Visuals |
|---|---|---|
| Who is connected, and how? | Link chart (i2 Analyst's Notebook, Cellebrite Pathfinder) synced to a timeline | `RelationshipGraph` (portraits as nodes, one styled line per channel, width = interactions), channel filters, a per-day strip that sets the graph's window, a panel listing every interaction behind a link |
| Whose routine area includes the scene? | Activity space / anchor points (geographic profiling) | `RadiusMap` (routine circles, anchors, the scene), per-phone cards (radius, scene inside, overlap with the victim), distance to the scene through the evening |
| Where was every phone in the time-of-death window? | Alibi grid; suspect-journey map | `PresenceGrid` (phone × 10-min slot), journeys through the window on the map, the location lanes for that night, the victim's last contacts |
| What broke from routine? | Pattern of life; synchronised behaviour | That night against the median of other nights, the post-news deletions, the week's activity with gaps shaded, every gap with why it was or wasn't raised |
| Who had a grievance? | Social media review for leakage and grievance | Every post on a timeline coloured by hostility score, the flagged items, each account's highest score next to its phone's status in the window |

**Shared:** FindingDetail (Evidence · How we know · Verify · Sources) with evidence views keyed by `check_output.kind` (now including `presence`, `space`, `hostility`, `last_contacts`); `lib/verify.ts` recomputes every new check from the cited rows; `lib/aggregates.ts` computes every chart series from rows.

**Portraits** are GAN-generated faces of people who do not exist (public domain, Wikimedia Commons; `public/portraits/CREDITS.md`). Real people's photos must not be used for case persons.

**Data realism:** `src/mock/background.ts` generates a seeded week for every phone (diurnal messaging in bursts, log-normal call durations, 10-minute location fixes from the stays table, card spend, ordinary social posts). No activity falls inside gaps, nothing is generated on the victim's phone after his last evening, and every count and chart is computed from the rows.

The swap point between the mock and the real backend is [`frontend/src/api/index.ts`](frontend/src/api/index.ts).

---

## 12. Synthetic data, answer key and evaluation

**Decision: synthetic for now.** This build, its tests and its evaluation run on the seeded generator below. [`data/README.md`](data/README.md) surveys public multi-phone training cases and recommends **MSAB 2026** (two phones, published answer key) as a later real case, with fetch and schema-dump scripts in `data/scripts/`. Running on it needs an adapter from phone databases to Case Bundle v1, which is ingest and out of scope here (§3). If it is added later, it is scored against its published answers, which are never shown to the agents.

### 12.1 Generator (`data/generate.py`)

Seeded; writes the case straight into the case-store tables (via the thin loader) plus `answer_key.json`. The mock's demo case (*Death at Pier 9*, `frontend/src/mock/data.ts` and `answerKey.ts`) is the reference: 10 plants (victim's last contacts, a powered-off phone near the scene in the window, presence in the window, deleted texts, a location-off gap while in use, post-news synchronised deletions, a round-trip payment, silent meetings, hostile posts, the scene inside routine areas) and 5 decoys (overnight power-off, an unexplained gap, one co-location, a small payment, a below-threshold post). The generator should reproduce these plants across seeds; the revision-2 plants remain valid as a second scenario. New plants and noise, each listed in the answer key with row ids:

| Kind | Plant | Expected |
|---|---|---|
| Tampering | Clock skew: one phone's clock offset by a configurable amount (default +90 s) | `clock_offsets` recovers it within 2 s; no false `missing_messages` after correction |
| Tampering | Spoofed GPS: GPS fixes far from the same phone's Wi-Fi/cell fixes, and a jump implying impossible speed | `source_disagreement` and `impossible_travel` windows; findings citing them carry the reliability note |
| Plant | A burner number contacting ≥2 case people, resolving to no one | `unresolved_identifiers` returns it |
| Innocent noise | Indoor GPS loss, normal drift within accuracy, deleted spam threads, overnight power-off | Not flagged by integrity; not raised as signals (or dismissed with a rule) |
| Statements | Per-person statements for the demo case, some supported, some contradicted, one unknowable | Correct per-person verdicts |
| Higher-order | **Relay:** Paul texts Ken, and within minutes Ken texts Cara, repeatedly; each pair alone is within normal volume | A rank-2 lead on {Paul, Ken, Cara}; no pairwise check fires |
| Higher-order | **Circulation:** Cara's $1,200 "refund" to Paul on 18 Apr closes S4 (Paul → Ken → Cara) into a loop. `money_chains` sees only the A → B → C chain; the loop as a whole is new | A circulation lead from the flow decomposition |
| Higher-order | **Recurring group:** three phones briefly active together on several days (calls, messages, power events within the same hour), with every pair below the pairwise thresholds | A rank-2 lead; no pairwise check fires |
| Higher-order | **Hole:** Paul and Cara, both strongly connected to Ken and repeatedly co-located, with no direct contact (S5) | A hole lead, matching `silent_meetings` |
| Higher-order decoys | A family group chat; a weekly gym class where several phones share a place; payroll-style transfers that look circular but are routine | Low score, or dismissed with a reason |

A `noise` parameter (0–3) scales the amount of innocent noise and the tampering magnitudes. The answer key also lists each seed's items with their expected verdicts and numbers, for the evaluations below.

### 12.2 Evaluation (`eval/run_eval.py`)

- Generate 10–20 cases across seeds and noise levels; one seed (`HELD_OUT_SEED`) is never used while tuning thresholds.
- Run `prepare_case()` and every check; compare with each answer key.
- Report **precision and recall per check** and per integrity rule, plus clock-offset error, as a table and JSON.
- An optional `--agents` mode runs the full pipeline on the demo brief and scores verdicts per item.

### 12.3 Plain-LLM baseline (`eval/baselines.py`, `run_eval.py --baseline`)

This answers "what can this do that an LLM can't?" with a measurement instead of an argument. The same cases and the same questions are given to a plain LLM, and all three arms are scored against the same answer key.

| Arm | What it gets | What it lacks |
|---|---|---|
| **`llm-context`** | Every row of every phone as text (per phone, per table, with row ids), the case's items (brief + statements), and instructions to answer each item with a verdict, cited row ids and numbers | Checks, integrity pass, verdict rules, validator |
| **`llm-sql`** | The same items, plus a read-only SQL tool on the same case store (raw tables, not the `v_*` views) and a description of the schema | The same; it can query, but must write its own comparisons |
| **`alibai`** | The full pipeline: `prepare_case()`, agents, `assemble_report()`, `validate_report()` | — |

**Fairness rules**, so the baseline is a real competitor, not a strawman:
- The same model as the orchestrator (`ORCHESTRATOR_MODEL`) for both baseline arms.
- The same confirmed items for every arm, taken from the answer key, so parsing differences don't count.
- The baseline prompts state the same reporting rules: cite row ids, give numbers, answer `cannot_tell` when the data doesn't settle it.
- The answer key is never in any prompt. `llm-context` cases are sized to fit the model's context window; if a case doesn't fit, that is reported, not silently truncated.
- Both baseline arms return the same structured output as a subagent (`item_id`, `verdict`, `sentence`, `evidence_ids`, `numbers`), so scoring is identical.

**Metrics, per arm:**

| Metric | How it is scored |
|---|---|
| Verdict accuracy | Per item, against the answer key's expected verdict |
| Planted-fact recall | Share of plants found: the deleted texts (S1), silent meetings (S5), money chain (S4), synchronised window (S7), gap type (G1), burner |
| Decoy false positives | Decoys and innocent noise reported as findings |
| Absence claims | Items whose correct answer rests on something being absent (missing texts, no contact); scored separately, because this is where a plain LLM is expected to fail |
| Tampering | False `missing_messages` hits on the clock-skewed pair; findings on spoofed windows that don't mention the problem |
| Citation validity | Share of cited ids that exist and are in the answer key's evidence for that item |
| Number accuracy | Share of numbers that match the answer key's values |
| Consistency | The same verdict across 3 runs of the same case |
| Cost and time | Tokens and wall-clock time per case |

**Runs:** at least 5 seeds including `HELD_OUT_SEED`, at noise levels 0 and 2, with 3 runs per arm. Every model response is cached under `eval/runs/` so the tables can be regenerated without calling the model again. The output is one table per metric and a single summary table for the pitch.

### 12.4 Discovery evaluation (`run_eval.py --discovery`)

Shows that discovery finds structure the rules can't, without overclaiming.
- **Higher-order recall:** share of the planted higher-order patterns (§12.1) that appear among the top *k* leads (default *k* = 10), per seed.
- **False-lead rate:** share of the top *k* leads that match no plant and no known decoy.
- **Rules vs discovery:** the same planted patterns, scored for the pairwise checks alone. The expected result is that the checks miss the relay, circulation and recurring group, and discovery finds them.
- **Promotion rate:** share of leads whose proposed check confirmed them.
- **Ablation:** propagation off (*k* = 0) vs on, to show the higher-order operators are what find the group patterns.
- **Stretch:** a trained TNN (§6.4), scored on the same metrics on held-out seeds.

---

## 13. Repository layout (target)

```
data/generate.py              seeded case + answer_key.json (tampering, noise, statements)  [planned]
data/datasets/, data/scripts/ real-dataset inventory, schema dumps, fetch scripts  [exists]
schema/case-bundle-v1/        format spec + example bundle (ingest is upstream)
backend/store/                schema.sql, views (ts_adj, dispute exclusion), load_synthetic.py
backend/integrity/            clock.py, travel.py, sources.py, run.py (→ clock_offsets, reliability, stays)
backend/checks/               location.py, comms.py, money.py, relations.py, device.py, optional.py,
                              verdicts.py, helpers.py (prepare_case, sweep, incidents, anchors, rank)
backend/discovery/            entities.py (people map + model extraction), complex.py (TopoNetX),
                              propagate.py (Hodge operators), score.py (isolation forest → leads),
                              flows.py (Hodge decomposition), holes.py, leads.py (explain, promote)
backend/agents/               orchestrator.py, subagents.py, models.py (Finding), prompts/
backend/report/               assemble.py, validate.py
backend/reviews.py            disputes → rerun
backend/api.py                FastAPI + SSE
backend/tests/                integrity, checks vs answer key, validator, reviews, triage, e2e (slow)
eval/run_eval.py              multi-seed precision/recall; --baseline compares with a plain LLM
eval/baselines.py             llm-context and llm-sql arms
eval/score.py                 shared scoring against answer_key.json
eval/runs/                    cached model responses, so tables can be regenerated
frontend/                     placeholder UI on mocks
```

---

## 14. Acceptance criteria

Carried forward:
- [ ] `generate.py` is deterministic. Every non-deleted message is on both phones.
- [ ] pytest passes: each check returns its plant and no decoy.
- [ ] The demo brief yields the expected findings. Every id resolves and every statement passes the hardened validator.
- [ ] "Paul met Cara in March" returns `cannot_tell`.
- [ ] The opening briefing exists with no brief entered and flags **17 April around 10:00** as an anchor.
- [ ] Ken's gap is raised as `location_off`; Amy's gap is not.
- [ ] At least one finding comes from a follow-up chain across two subagents (G1 → S4).

New in revision 3:
- [ ] `run_sweep()` refuses to run before the integrity pass.
- [ ] With planted clock skew, the offset is recovered within 2 s and `missing_messages` returns no false positives on that pair.
- [ ] Spoofed GPS produces suspect windows; innocent noise produces none.
- [ ] Any finding citing a suspect window says so (validator-enforced).
- [ ] No targeted check runs before the investigator confirms items; edited items are what get checked.
- [ ] The report shows, per person who made statements, which claims the phones support or contradict.
- [ ] Disputing a row reruns exactly the checks that cited it and marks changed findings.
- [ ] Every report's assumptions state that names stand for phones.
- [ ] `unresolved_identifiers` returns the planted burner and not the known org's line.
- [ ] `eval/run_eval.py` reports precision and recall per check over ≥10 seeds, with the held-out seed reported separately.
- [ ] Discovery ranks the relay, the circulation and the recurring group among the top 10 leads on the demo case, none of which any pairwise check returns; each lead cites its rows and a proposed check.
- [ ] No finding cites a lead without a confirming check call (validator-enforced).
- [ ] Discovery is reproducible: the same seed gives the same leads in the same order.
- [ ] `run_eval.py --baseline` scores `llm-context`, `llm-sql` and `alibai` on the same items over ≥5 seeds, including the held-out seed, and regenerates its tables from cached responses.

---

## 15. Build order

1. Generator and answer key, including planted tampering, innocent noise and higher-order patterns, loaded straight into the case store
2. Integrity pass; checks and verdict rules; tests against the answer key
2b. Discovery (§6.4), in this order: complex with group cells; fixed propagation and isolation-forest leads; flow decomposition; the relations panel's shaded groups; holes via persistent homology (optional)
3. Agents on the CLI: orchestrator, five subagents with structured output, `confirm_items` interrupt
4. Report assembly and hardened `validate_report()`; reviews and reruns
5. FastAPI endpoints and SSE
6. Multi-seed evaluation script, then the plain-LLM baseline (§12.3)

Steps 1–2 and the check-level part of step 6 need no model. Step 2b needs one only for extracting mentions from text; the complex, propagation and scoring are code. A trained TNN is a stretch beyond step 6. The baseline in step 6 does, and it needs step 3 for the `alibai` arm.
