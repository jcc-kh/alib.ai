# Alib.ai architecture

This document covers the target design for the backend build. For a link-by-link account of how every statement is derived and traced back to its source, see [DERIVATION.md](DERIVATION.md). The front-end mock-up in `frontend/` is a placeholder: backend decisions are not made to fit it, but [`frontend/src/api/types.ts`](frontend/src/api/types.ts) is kept in step with the contract below.

![Alib.ai system architecture](docs/architecture.png)

*Diagram source: [docs/architecture-diagram.html](docs/architecture-diagram.html). To update it, edit the HTML, and render it at 1920×1440 with a device scale factor of 2 to `docs/architecture.png`, for example with headless Chrome or Edge: `msedge --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1920,1440 --virtual-time-budget=8000 --screenshot=docs/architecture.png file:///<repo>/docs/architecture-diagram.html`.*

> **Changes in revision 4** (the pinboard flow):
> - **Network first.** On load, the integrity layer runs, then discovery. The first thing the investigator sees is a **pinboard**: the case's network, front and centre, with data problems and network insights pinned to it (§2, §7.6).
> - **No up-front sweep.** Pairwise checks run **on demand**: to confirm a lead, answer a suggested question, verify a claim or answer a chat question. Cross-phone consistency checks (missing messages, calls or transfers on one phone only) moved into the integrity layer, because they ask "do the phones agree?" (§5).
> - **The network asks the questions.** Every lead and integrity issue raises a **suggested question** with a check behind it; one click runs the check (§6.6).
> - **Three ways to interact:** add a data source (a Case Bundle upload; the board highlights what's new or changed), verify claims (statements, and as a stretch interview transcripts, each answered Supported / Contradicted / Can't tell), and ask questions in a grounded chat (§2).
> - **The three-part brief is gone.** The investigator's own beliefs are claims like any other; their questions go to the chat or come from the board.
> - **Loading a Case Bundle is in scope** (validate and load, no adapters for raw phone databases), so sources can be added during an investigation (§3).
>
> **Changes in revision 3** (from the planning handoff; stage numbers here are revision 3's):
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

> **Pivot after revision 3 (mock only so far): insight discovery.** The product now leads with what the phones show rather than with testing claims. The demo case is a death (*Death at Pier 9*): five phones including the victim's, a scene and a time-of-death window as case inputs. Four checks and one subagent are added (§6.5, §7.1): `presence_window`, `activity_space`, `last_contacts`, `social_hostility`, and a `social-analyst`. Insights are filed under five **lines of inquiry** (§11). The mock no longer has hypothesis testing; stages ③–⑤ below (parse, confirm, refine against a brief and statements) are still the revision-3 design and need a team decision on whether to keep them. **Revision 4 (above) keeps claim checking as interaction B, "Verify claims", without the three-part brief.**

---

## 1. Operating rule

**Discovery finds leads; code proves facts; the model routes and phrases.** Agents never compute, checks never conclude, and a lead is never a verdict.

| | Checks and rules (code) | Discovery (network model) | Agents (model) |
|---|---|---|---|
| What they are | Plain Python functions over SQLite. Each check answers **one fixed question**; each verdict rule maps a check output to a verdict. | A combinatorial complex of the whole case, fixed topological operators over it, and unsupervised scoring (§6.4). A language model extracts entities from text into the complex. | LangChain deepagents: one orchestrator, five domain subagents |
| What they do | Return JSON with the `evidence_ids` they used and **every number** the report will contain. Compute verdicts, reliability and rankings. Run on demand, except the integrity checks, which run on every load. | Organise every row into pairs and groups. Rank the most unusual structures as **leads**, each with its rows, its drivers, and a suggested question with the check that answers it. Find patterns nobody wrote a rule for. | Parse claims and transcripts into items. Choose which checks to run with what parameters. Follow up on results. Answer chat questions with tools. Read message content. Phrase one sentence per finding. |
| What they never do | Draw a conclusion in words, rank by judgement, or phrase anything | Produce a verdict, or put a lead in the findings without a check confirming it | Do arithmetic, count rows, choose a verdict, or invent a row |

Anything that looks like arithmetic in an agent's job is a **code helper the agent calls**: ranking insights, matching a claim to existing results, applying a verdict rule. The agent decides what to do with the result: dismiss with a reason, or follow up.

`validate_report()` (code, §8.2) enforces the rule on output. It is the evidence auditor: there is no auditing agent.

---

## 2. Pipeline overview

```
                          ON LOAD (and after every new source)
 Case Bundle(s) ─► ⓪ LOAD ─► ① INTEGRITY ─► ② DISCOVER ─► ③ BOARD ─────────────► PINBOARD (home)
                  validate   clock · travel   complex ·      rank insights ·        the network, with data problems,
                  + load     GPS sources ·    propagate ·    run top leads'         insights and suggested questions
                  + resolve  cross-phone      score → leads  checks · write         pinned to it
                             consistency                     suggested questions          │
                                                                                          │
              ┌───────────────────────────────┬───────────────────────────────────────────┤
              ▼                               ▼                                           ▼
     A. ADD A SOURCE                  B. VERIFY CLAIMS                              C. ASK
     upload a Case Bundle ─►          claims / transcript ─► ④ PARSE ─►             question ─► orchestrator with tools
     rerun ⓪–③ ─► diff ─►             ⑤ CONFIRM (interrupt) ─► ⑥ CHECK ─►          ─► cited answer or "can't tell"
     highlight new / changed;         Supported / Contradicted / Can't tell
     recheck affected claims          per claim, per person

                    ⑦ REVIEW at any time: checked / disputed ─► rerun the checks that cited the row
```

| Stage | Trigger | Actor | Reads | Writes |
|---|---|---|---|---|
| ⓪ Load | Case created, or a source uploaded (A) | code | Case Bundle | evidence tables with provenance, `case_versions` |
| ① Integrity | After every load | code | evidence tables | `clock_offsets`, `reliability`, `stays`, `integrity_issues` |
| ② Discover | After integrity | code, plus a model for extracting mentions from text | case store, `stays`, `reliability` | `entities`, `cells`, `leads` |
| ③ Board | After discovery | code (checks run on demand) + a model to phrase questions | `integrity_issues`, `leads` | `insights`, `questions`, `check_calls`, promoted `findings`; with A, a `CaseDiff` |
| ④ Parse | Claims or a transcript submitted (B) | orchestrator | `statements`, transcript | proposed `items` |
| ⑤ Confirm | Items proposed | investigator (interrupt) | proposed `items` | confirmed `items` |
| ⑥ Check | Items confirmed | orchestrator + domain subagents | insights, findings, checks on demand | `findings`, per-claim verdicts |
| ⑦ Review | Investigator marks a row | code, then affected subagents | `reviews` | rerun checks, updated `findings` marked `changed` |
| Ask (C) | A chat question | orchestrator + subagents | everything above, checks on demand | an `Answer` |

Stages ⓪–③ are run by one entry point, `prepare_case()`, so discovery and every check read corrected timestamps and nothing can skip the integrity layer.

---

## 3. Loading sources (stage ⓪)

`load_bundle(case_id, bundle)` (`backend/store/load_bundle.py`) loads a Case Bundle v1 ([spec](schema/case-bundle-v1/README.md)): one or more device folders, or extra files for a device already in the case. It **validates** (required fields, timestamps with an offset, unique `record_id`s, known `event_type`s; errors name the file and line), **loads** every row with its global id, `device_owner`, timestamp and `provenance` (bundle hash, file, line, raw JSON), and **resolves** identifiers to people through `persons.jsonl` and contacts; anything unmatched is kept as `unknown:<value>`.

What stays out of scope: adapters from raw phone databases (iOS `sms.db`, Android `bugle_db` and so on) and heavy normalisation. The generator and the demo bundles are already normalised. Building `stays` belongs to the integrity stage, so it uses clock-corrected timestamps.

Each load creates a new **case version** (`case_versions`: version, source, loaded_at, bundle hash). Insights, leads, questions and findings are stamped with the version that produced them, which is what lets the board show what a new source changed (§7.7).

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
| `stays` | `segment_id, person, kind (stay\|travel\|gap), place, start, end, gap_type, evidence_ids` | ① Integrity (via `location_timeline`) |
| `integrity_issues` | `issue_id, kind (missing_message\|one_sided_call\|one_sided_transfer\|clock_skew\|impossible_travel\|source_disagreement), phones, start, end, summary, evidence_ids, case_version` | ① Integrity |
| `entities` | `entity_id, kind (person\|identifier\|account\|place\|mention), label, resolved_to?, source_row_id, quote, extractor` | ② Discover (`mention` rows come from model extraction) |
| `cells` | `cell_id, rank (0\|1\|2), kind, members[], start, end, evidence_ids, features_json` | ② Discover |
| `leads` | `lead_id, cell_id, kind, score, drivers_json, evidence_ids, proposed_check?, status (open\|promoted\|dismissed), promoted_finding_id?, dismissed_reason?, case_version` | ② Discover, ③ Board |
| `insights` | `insight_id, source (integrity\|lead\|finding), ref_id, rank, headline, why, case_version, change (new\|changed\|unchanged\|withdrawn)` | ③ Board |
| `questions` | `question_id, text, origin (lead_id\|issue_id), check, params_json, agent, status (open\|answered\|no_check), finding_id?, case_version` | ③ Board |
| `case_versions` | `version, source, loaded_at, bundle_sha256` | ⓪ Load |
| `statements` | `statement_id, person_id, text, received_at` | API (§10) |
| `items` | `item_id, source (investigator\|statement\|transcript), source_ref, claimant (person_id\|investigator), kind (claim\|question), text, people, start, end, status (proposed\|confirmed\|edited\|removed)` | ④ Parse, ⑤ Confirm |
| `check_calls` | `call_id, check, params_json, output_json, evidence_ids, excluded_ids, run_at, case_version` | every check invocation |
| `findings` | `finding_id, item_id?, question_id?, lead_id?, call_id, verdict, sentence, evidence_ids, numbers_json, reliability_note, agent, status (current\|changed\|withdrawn), supersedes?` | ③ Board, ⑥ Check, ⑦ Review |
| `reviews` | `review_id, target (finding_id\|evidence_id), kind (checked\|disputed), note, by, at` | ⑦ Review |

Verdicts and rankings are computed in code, from documented per-check rules (see DERIVATION.md §3). Agents never set them.

---

## 5. Integrity layer (`backend/integrity/`, stage ①)

All code, no model. Runs after every load (and again after a dispute that touches its inputs), before discovery and before any check or agent. It answers one question before anything else: **can these rows be taken at face value, and do the phones agree with each other?** Its results are the board's "data health" panel and its first pinned issues.

**Physical consistency:**

| Step | Logic | Output | Defaults |
|---|---|---|---|
| **Clock offset** | For each pair of phones, match calls present on both (same counterpart numbers, same direction, duration within 2 s). The offset estimate per phone is the median of `ts_b − ts_a` across matches, solved jointly against a reference phone (the one with the most matches). Runs **before** `missing_messages`, whose 2 s tolerance assumes synced clocks: without correction, every message in a skewed pair looks deleted. | `clock_offsets`; a phone with `|offset| > 5 s` gets a `clock_skew` reliability row covering its whole coverage | ≥3 matched calls; candidate window ±15 min; spread must be ≤ 2 s, otherwise status `suspect` with "offset not estimable" |
| **Impossible travel** | Consecutive location fixes on one phone (corrected time) whose implied speed exceeds a ceiling, after allowing for both fixes' `accuracy_m` | `reliability` rows `impossible_travel` over the window between the fixes | 250 km/h; ignore pairs < 60 s apart |
| **Location-source disagreement** | A GPS fix farther than allowed from the same phone's Wi-Fi or cell fix within the same time slot | `reliability` rows `source_disagreement` | slot 5 min; distance > max(1 km, 3 × combined accuracy) |
| **Stays** | `location_timeline` for every person, on corrected timestamps | `stays` | see §6 |

**Cross-phone consistency** (after clock correction; each disagreement is an `integrity_issues` row with its rows):

| Check | Logic | Defaults |
|---|---|---|
| `missing_messages(a, b)` | A message on one phone and absent from the other, plus any `thread_deleted` on the phone that lacks it. Run for every pair of case phones, **only over the period both phones cover**, so an absence is never claimed where one phone wasn't extracted | tolerance 2 s on `ts_adj` |
| `call_log_mismatch(a, b)` | A call on one phone and absent from the other (promoted from optional) | tolerance 2 s |
| `one_sided_transfers(a, b)` | A transfer on the sender's phone and absent from the receiver's, or the reverse | tolerance 2 s, same amount |

These are checks in every other respect (pure functions, verdict rules, `check_calls` rows), so a claim like "I never got that text" is answered from their results.

A reliability window is `ok` unless one of the rules above marks it `suspect`. The tool `get_reliability(person?, start, end)` returns the windows overlapping a range. It is given to every domain subagent, and §8.2 enforces that a finding whose evidence falls in a suspect window says so.

Innocent noise the pass must **not** flag: indoor GPS loss (gap, not disagreement), normal drift within accuracy, an overnight power-off, a single fix with large `accuracy_m`.

---

## 6. Checks and discovery (`backend/checks/`, `backend/discovery/`)

Every check is a pure function over the views in §4. Thresholds are named keyword arguments with the defaults below. Each returns `{check, params, results[], evidence_ids[]}` and is stored as a `check_calls` row. Each check has a matching **verdict rule** in `backend/checks/verdicts.py` that maps (item or question, check output) to `confirmed | inconsistent | cannot_tell`, shown to the investigator as **Supported / Contradicted / Can't tell**.

**When checks run.** There is no up-front sweep. The cross-phone checks run in the integrity layer (§5). Every other check runs **on demand**: to confirm a top lead while the board is built, to answer a suggested question, to verify a claim, or when the chat needs one. They are SQL over a few thousand rows, so on demand costs seconds.

### 6.1 Core checks

| Check | Owner | Logic | Defaults |
|---|---|---|---|
| `location_timeline(person, start, end)` | location | Location rows → ordered segments: **stay** (within 150 m for ≥10 min), **travel**, **gap** (with `gap_type`). Stored in `stays`. | stay radius 150 m, min stay 10 min |
| `location_gaps(person, start, end)` | location | Periods with no location rows for ≥45 min, classified (below) | min gap 45 min |
| `distance_between(a, b, start, end)` | location | Haversine per shared slot; min, median, max; label | together ≤150 m for ≥80% of slots; apart if never <1 km |
| `silent_meetings(start, end)` | location | Shared stays on repeated occasions with no message or call on any phone | ≤100 m, ≥20 min, ≥2 occasions |
| `missing_messages(a, b, start, end)` | comms | Message on one phone and absent from the other (on `ts_adj`), plus `thread_deleted` on the phone that lacks it. Runs in the integrity layer (§5) | tolerance 2 s |
| `call_log_mismatch(a, b, start, end)` | comms | A call on one phone absent from the other (on `ts_adj`). Runs in the integrity layer | tolerance 2 s |
| `one_sided_transfers(a, b, start, end)` | financial | A transfer on one side only. Runs in the integrity layer | tolerance 2 s |
| `money_chains(start, end)` | financial | A→B then B→C | ≤24 h; 80–100%; first ≥ $500 |
| `synchronised_behaviour(start, end)` | device | ≥N phones with `thread_deleted` or `power_off` in one window; returns inbound messages before it as trigger candidates | 60 min, 3 phones |
| `deletions(person?, start, end)` | device | All `thread_deleted` events, counterpart resolved | none |
| `power_events(person?, start, end)` | device | `power_off`/`power_on` pairs with durations | none |
| `identity_match()` | relationship | Links numbers, emails and handles to people across all phones; builds the **people map** | none |
| `unresolved_identifiers(start, end)` **new** | relationship | Numbers or handles that contact ≥2 case people and resolve to no person and no known org (possible burners). Returns per identifier: which phones, counts by channel, first/last contact. Supersedes the optional `shared_unknown_number`. | ≥2 case people |

**Gap classification** (`location_gaps`):

| `gap_type` | Condition | Pinned to the board? |
|---|---|---|
| `powered_off` | A `power_off` event covers the gap | Only if it overlaps another insight |
| `location_off` | The phone sent messages, made calls or made transfers **during** the gap | **Yes**, as an insight with a question |
| `unexplained` | No activity of any kind | Only if it overlaps another insight |

Wording rule: a gap is always "**no location data**", never proof of intent.

### 6.2 Optional checks (in this order if time allows)

| Check | Owner | Logic | Defaults |
|---|---|---|---|
| `transfer_after_meeting(start, end)` | financial | A transfer between two people within N hours after their phones were together | ≤6 h; ≥ $500 |
| `contact_went_quiet(start, end)` | comms | A pair with daily contact that stops | ≥3 contact days, then ≥2 silent days |
| `group_meetings(start, end)` *stretch* | location | ≥3 phones co-located at once. Framed as a multi-way pattern like `synchronised_behaviour`, not as pairwise meetings. | ≤150 m, ≥20 min, ≥3 phones |

### 6.3 Helpers (code, called by agents)

| Helper | Purpose |
|---|---|
| `prepare_case(bundles)` | ⓪ load, ① integrity, ② `discover()`, ③ `build_board()`. The only way to run discovery or build the board, so both always follow integrity. |
| `add_source(bundle)` | ⓪–③ again for the new case version, then `case_diff()` and a recheck of every confirmed claim whose checks touch the new rows (§7.7) |
| `case_diff(from_version, to_version)` | New, changed and withdrawn insights, leads, questions and findings, matched by stable keys (cell members + kind + window; check + params) |
| `build_board()` | Ranks integrity issues and leads into `insights`, runs each top lead's proposed check (promoting the confirmed ones), and writes `questions` |
| `rank_insights(relevance?)` | Sorts by kind weight → score → number of phones → recency; an agent's relevance label to the current claims, if any, comes first |
| `suggest_questions(insight_ids)` | One question per open lead or integrity issue, with its check and parameters filled in code (§6.6) |
| `answer_question(question_id)` | Runs the question's check, applies its verdict rule, and writes a finding |
| `match_claim(item_id)` | Insights, findings and open leads sharing people and dates with a claim |
| `apply_verdict_rule(item_id, call_id)` | Runs the check's verdict rule; returns the verdict the subagent must copy |
| `get_reliability(person?, start, end)` | Suspect windows overlapping the range (§5) |
| `contact_graph(people?)` | Edges by channel |
| `get_events`, `search_messages`, `get_coverage` | Raw lookups |
| `get_leads(people?, start?, end?, kind?)` | Open leads from discovery, ranked by score (§6.4) |
| `explain_lead(lead_id)` | The lead's cell, member rows, the features and neighbours that drove its score, and its proposed check |
| `promote_lead(lead_id, call_id)` | Links a lead to the check call that confirmed it; only then can a finding cite it. Refuses if the call's verdict rule did not confirm |

Every check has a unit test against `answer_key.json`: it must return the planted case and no decoy.

### 6.4 Discovery: the topological network model (`backend/discovery/`, stage ②)

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

**Leads, not findings.** Each lead carries its cell, member rows, a score, the drivers (top features and neighbouring cells), and a **proposed check** that would confirm it (for example "`money_chains` over these three phones, 15 Apr" or "`distance_between` Paul, Cara"). Leads are pinned to the board, labelled "pattern, not verified" until confirmed. A lead becomes evidence only when a deterministic check confirms it and `promote_lead()` links the two; the finding then cites the check, with the lead as its origin in the derivation. Unconfirmed leads never enter verdicts, and the validator rejects any finding that cites a lead without a confirming check call.

**What discovery must find on the demo case** (planted by the generator, §12.1): the relay (Paul → Ken → Cara within minutes, each pair unremarkable), the circulation (money leaving Paul and partly returning through Ken and Cara), a recurring three-phone group below every pairwise threshold, and the Paul–Cara hole (S5).

**On the demo, adding Cara's phone matters most to discovery.** Before it is loaded, Cara appears only through the other phones; once it is, the relay closes into a triangle, the circulation closes into a loop, and her side of S7 appears. The generator holds her phone back for exactly this (§12.1).

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

### 6.6 Suggested questions (`backend/board/questions.py`)

The board doesn't wait for the investigator to know what to ask. Every open lead and integrity issue raises a **question**, and every question has a check behind it, chosen and parameterised in code from the lead's kind:

| Origin | Example question | Check |
|---|---|---|
| Group / relay lead | "Did Paul, Ken and Cara act together on 15 April?" | `synchronised_behaviour`, `money_chains` over the cell's people and window |
| Circulation lead | "Where did Paul's $5,000 end up?" | `money_chains` from the loop's first transfer |
| Hole lead | "Do Paul and Cara know each other? Their phones meet but never contact each other." | `silent_meetings`, `distance_between` |
| Burst or gap lead | "Why did Ken's phone stop reporting location on 15 April while in use?" | `location_gaps` |
| Integrity issue | "Were messages removed from Amy's phone?" | `missing_messages` (already run; the answer is immediate) |
| Burner | "Who is behind +1 555 010 0777?" | `unresolved_identifiers`, then `search_messages` |

A template in code produces the question; a model may rephrase it for readability, and the rephrasing passes the neutral-wording rules. Clicking a question runs `answer_question()`: the check runs, its verdict rule applies, a subagent phrases one sentence, and the pin turns into a confirmed finding or stays a pattern. A lead whose kind has no matching check raises an **open question** with no run button; the investigator can ask the chat or add a source.

Questions are ranked with their insights, so the board shows a short list: "questions this case raises".

---

## 7. Agents (`backend/agents/`, LangChain deepagents)

```python
checkpointer = SqliteSaver(...)            # required by interrupt_on

agent = create_deep_agent(
    model=init_chat_model(os.environ["ORCHESTRATOR_MODEL"]),   # stronger model
    tools=[confirm_items, match_claim, rank_insights, answer_question,
           get_coverage, get_reliability, get_leads, search_case],
    subagents=[relationship_mapper, location_analyst, comms_analyst,
               financial_analyst, device_forensics, social_analyst],
    system_prompt=ORCHESTRATOR_PROMPT,
    interrupt_on={"confirm_items": True},
    checkpointer=checkpointer,
)
agent.invoke(inputs, config={"configurable": {"thread_id": run_id}})
```

There is **no `report-writer`** (it had no tools, so no context to isolate; assembly is code, §8) and **no evidence-auditor** (`validate_report()` does that). Dynamic, interpreter-based subagents are not used: the checks and discovery are already code. Building the board needs no agent except to phrase questions and promoted findings; agents do the work in **B. Verify claims** and **C. Ask**.

### 7.1 Subagents

Each is a dict with `name`, `description`, `system_prompt`, `tools`, `model` (a faster model, `SUBAGENT_MODEL`) and `response_format=FindingSet`. Every subagent also gets `get_reliability`, `apply_verdict_rule`, `get_events`, `get_coverage`, `get_leads`, `explain_lead` and `promote_lead`, so any of them can confirm a lead in its own domain.

| Subagent | Checks it may run |
|---|---|
| `relationship-mapper` | `identity_match`, `unresolved_identifiers`, `contact_graph` (its people map is read first by the others). First reader of leads: explains them and routes each proposed check to the owning subagent |
| `location-analyst` | `presence_window`, `activity_space`, `location_timeline`, `location_gaps`, `distance_between`, `silent_meetings`, `group_meetings`* |
| `comms-analyst` | `last_contacts`, `missing_messages`, `call_log_mismatch` (both already run by integrity; reads their results), `contact_went_quiet`*, `search_messages` |
| `financial-analyst` | `money_chains` (A→B→C, including round trips where C = A), `one_sided_transfers`, `transfer_after_meeting`* |
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
    item_id: str | None = None          # the claim it answers (B), or
    question_id: str | None = None      # the suggested question it answers (board, C)
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

After each round the orchestrator reads the new findings. A finding with `follow_up` (or one the orchestrator spots) becomes a **new task to a different subagent** with the parameters filled in, logged as a `follow_up` step in the finding's derivation. Required example: `location-analyst` finds Ken's `location_off` gap (15 Apr 14:00–16:30) → `financial-analyst` finds the $4,500 transfer to Cara at 15:40 (link 2 of S4) → `comms-analyst` reads Ken's 15:10 message → one merged finding citing all three.

### 7.4 Verify claims: parse and confirm (stages ④–⑤)

1. The input is claims: statements attributed to a person, the investigator's own beliefs, or (stretch) an **interview transcript**. For a transcript, the orchestrator first attributes each passage to its speaker.
2. The orchestrator splits the input into **atomic items**, each attributed to whoever made the claim (`investigator`, or a `person_id`), with people and dates resolved. A question rather than a claim is routed to Ask.
3. It calls `confirm_items(items)`. Because of `interrupt_on`, the run pauses there and the API streams the proposed items to the investigator (§10).
4. The investigator approves, edits or removes items. The run resumes on the same `thread_id` with the confirmed list. **No check runs for a claim before this point.**

### 7.5 Verify claims: check (stage ⑥)

1. For each confirmed item, call `match_claim()` **first**: an integrity issue, an answered question or a promoted lead may already settle it. Open leads sharing the item's people and dates are returned too, and the owning subagent may run their checks.
2. Route the rest to the owning subagent for checks with item-specific parameters. Dates outside coverage → `get_coverage()` → `cannot_tell`.
3. Each subagent calls `apply_verdict_rule` and `get_reliability` for the windows it cites, then returns its `FindingSet`.
4. Each claim gets **Supported / Contradicted / Can't tell**, grouped by the person who made it. The board marks the pins each verdict relied on.

### 7.6 Building the board (stage ③, on load)

1. **Insights.** Integrity issues and top leads become `insights`, ranked in code by `rank_insights()`. On the demo case, the three phones that deleted threads and powered off around **17 April 10:00** rank near the top as a group cell, without the system being told about the audit.
2. **Confirm the top leads.** For each top lead, code runs its proposed check. A confirmed lead is promoted and one subagent call phrases its one-sentence finding; the rest stay pinned as "pattern, not verified". Ordinary patterns are dismissed with a reason and rule (for example a family group chat).
3. **Questions.** `suggest_questions()` writes one question per remaining open lead and integrity issue (§6.6).
4. **Headlines.** Each insight's headline is the sentence of its finding if promoted, or a code template otherwise ("3 phones, no pair unusual, active together on 4 days"); `why` is the code-generated rank reason.

### 7.7 Adding a source (A)

1. The investigator uploads a Case Bundle (a new phone, or new files for a phone already in the case). `load_bundle()` validates and loads it as a new case version (§3).
2. Integrity, discovery and the board are rebuilt for the new version. The case is a few thousand rows, so a full rebuild is simpler than an incremental one and takes seconds.
3. `case_diff()` compares versions and marks every insight, lead, question and finding **new**, **changed** or **withdrawn**. The board highlights them, and a short summary says what the source added ("3 new insights; the relay now closes; 1 question answered").
4. Every confirmed claim whose check calls touch the new rows is re-checked with the same parameters, and any verdict that moved is marked, the same way disputes work (§9).

### 7.8 Ask (C)

The chat is the orchestrator in question-and-answer mode, with the same tools: it may answer from existing insights and findings, run a check, or search messages (`search_case`). Every claim in an answer cites rows or comes from a check; otherwise the answer is "can't tell". Suggested questions from the board can be sent to the chat with one click. See DERIVATION.md §7.

**Verdicts** (rules in code; display label in brackets):
- `confirmed` (Supported): data on at least 2 phones agrees with the claim.
- `inconsistent` (Contradicted): the data contradicts the claim.
- `cannot_tell` (Can't tell): no data settles it. The finding cites coverage rows.

---

## 8. Report assembly and validation (`backend/report/`)

### 8.1 Assembly (code)

`assemble_report(run_id)` builds the `Report` for a claim-verification run (B) from validated `findings`, `items` and the board's `insights`:
- **By person:** for each person who made claims (including the investigator), every claim with **Supported / Contradicted / Can't tell** and its finding.
- **Related on the board:** insights that share people and dates with the claims but answer none of them, so nothing relevant is left out.
- **Reliability notes:** findings resting on a suspect window are listed with the reason.
- **Leads:** open leads that touch the claims, labelled "pattern, not verified", each with its rows, drivers and suggested question. Promoted leads appear as ordinary findings, with the lead shown as their origin.
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
  3. Insights and findings from rerun calls are recomputed, and discovery reruns if the row was part of a cell. A finding whose verdict, evidence or numbers changed is superseded: the new one is `current` with `supersedes` set, the old one `changed`. A finding that no longer has evidence becomes `withdrawn`. Rephrasing goes back to the owning subagent only when the numbers changed.
  4. The report is reassembled; changed findings are marked in the UI.

---

## 10. API (FastAPI, `backend/api.py`)

| Endpoint | Returns |
|---|---|
| `POST /api/case/prepare` (bundles) | Runs `prepare_case()` (⓪–③) in the background |
| `GET /api/case` | `CaseInfo`, with the current case version |
| `GET /api/board` | The board: data health, ranked insights, leads, suggested questions, and the case version (`Briefing` in `types.ts`) |
| `GET /api/graph` | The network for the pinboard: nodes, links and rank-2 cells (groups), each with its evidence ids |
| **A.** `POST /api/sources` (a Case Bundle) | SSE: `stage` (load, integrity, discovery, board), `diff` (`CaseDiff`), then the updated board. Validation errors name the file and line |
| **B.** `POST /api/verify` (`{statements[], transcript?}`) | SSE: `todos`, `items_proposed` (then pauses), `subagent` (start, tool, done, `follow_up`), `report`, `error`. Returns `run_id` |
| **B.** `POST /api/verify/{run_id}/confirm` (`{items[]}`) | Resumes the interrupted run with confirmed or edited items; the SSE stream continues |
| **C.** `POST /api/ask` | SSE: `step`, then `answer` |
| `POST /api/questions/{id}/answer` | Runs the suggested question's check; returns the finding and the updated pin |
| `GET /api/reliability?person=&start=&end=` | `ReliabilityWindow[]`, `ClockOffset[]` and integrity issues |
| `GET /api/timeline?people=&start=&end=` | `stays` segments |
| `GET /api/run/stream` | SSE of the case-load run (load, integrity, discovery, board): `phase`, `agent`, `tool` (check, args, rows, ms), `follow_up`, `log`, `envelope` (an agent's `findings/*.json`) |
| `GET /api/stats/{activity,heatmap,contacts,money,distance,places,volume}` | Chart aggregates computed from rows (see `frontend/src/lib/aggregates.ts`) |
| `POST /api/reviews` (`Review`) | Records it; a dispute triggers §9 and streams `rerun` then an updated `report` |
| `GET /api/reviews?target=` | `Review[]` |
| `GET /api/evidence?ids=` | Rows + provenance grouped by phone; 404 lists unknown ids |
| `GET /api/leads?people=&start=&end=&status=` | `Lead[]`, ranked by score |

`backend/schemas.py` mirrors [`frontend/src/api/types.ts`](frontend/src/api/types.ts). Contract changes in this revision:
- `SubagentName` loses `report-writer`.
- New: `Statement {statement_id, person_id, text}`, `Item {item_id, source, claimant, kind, text, people, start, end, status}`, `ReliabilityWindow`, `ClockOffset`, `Review {review_id, target, kind: 'checked' | 'disputed', note, by, at}`.
- `AgentEvent` gains `items_proposed` and `rerun`.
- `Finding` gains `item_id`, `claimant`, `reliability_note?`, `status: 'current' | 'changed' | 'withdrawn'`, `supersedes?`.
- `Report` gains `by_person: {person_id, claims: {item_id, text, verdict, finding_ids}[]}[]` and `reliability_notes`.
- `CheckName` gains `unresolved_identifiers` (and `group_meetings` if built).
- New: `Lead {lead_id, kind, cell, score, drivers, evidence_ids, proposed_check?, status, promoted_finding_id?}` and `GraphCell {cell_id, rank, kind, members, start, end, evidence_ids}`. `Briefing` and `Report` gain `leads`; `Graph` gains `cells`; `Finding` gains `lead_id?`.
- Revision 4: new `IntegrityIssue`, `SuggestedQuestion` and `CaseDiff`; `Briefing` (the board) gains `integrity_issues`, `questions` and `case_version`; new `SourceEvent` for `POST /api/sources`; `Finding` gains `question_id?`; `AnalyseRequest` takes `statements` and an optional `transcript`; `Item.source` is `investigator | statement | transcript`. The mock's `Brief` type stays only until the UI moves to claims.

---

## 11. Front end (`frontend/`)

The front end is built on mocks (React, Vite, TypeScript, Tailwind v4, react-leaflet, Recharts). It is not a constraint on backend design. One dashboard (`src/ui/pro`, route `#/pro/<view>`) over one case store (`src/state/caseStore.tsx`); the Noir case-file UI and the hypothesis-testing screen were removed.

New UI the discovery contract implies: a **leads** section ("patterns, not verified") on the board and report, and **shaded group cells** in the relations graph so the higher-order structure discovery found is visible.

**Flow: a loop, not a pipeline.** The case is a set of loaded evidence sources. The home page is the **case board** (`#/pro/board`, `src/ui/pro/board/`), which is recomputed from the loaded sources (`computeBoard(loaded)` in `src/mock/sources.ts`). **Add evidence source** ingests one source with live progress, re-runs only the checks it affects, and marks what changed (`diffBoard`). There is no Ingest → Analyse → Briefing sequence.

- **Gating.** A finding is unlocked once every phone it reads is loaded (`SCENARIOS[sid].people`). Insights are re-ranked from unlocked findings only (`incidentsFor(unlocked)`). A person stays off the board, and a seized phone is shown only by its exhibit number, until that phone is examined. Ask answers "can't tell yet" when the phone that would settle a question isn't loaded.
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

**Target screens (revision 4).** The pinboard flow (§2) reuses this dashboard:

| Screen | What it is | Built from (current mock) |
|---|---|---|
| **Pinboard** (home) | The case's network front and centre, like a detective's pinboard: people, numbers, places and mentioned things as pins; links as string; groups (discovery's rank-2 cells) as shaded areas; leads highlighted; integrity problems as warning badges. Side panels: **data health**, ranked **insights** (tagged with their line of inquiry), and **questions this case raises**. Clicking any pin, string or group opens its evidence | Briefing + `RelationshipGraph` from "Who is connected, and how?" |
| **Lines of inquiry** | The five inquiry pages above, opened from the pinboard's insights | `src/ui/pro/inquiries/` |
| **A. Add a source** | Upload a Case Bundle; watch load, integrity, discovery and the board rebuild; then the board with new and changed pins highlighted and a summary of what changed | Ingest and Analyse steps |
| **B. Verify claims** | Paste statements or (stretch) an interview transcript; confirm the parsed claims; watch the agents work; get Supported / Contradicted / Can't tell per claim, grouped by person | New; the old hypothesis-testing screen was removed from the mock |
| **C. Ask** | The chat, seeded by the suggested questions | Ask panel |
| **Finding detail** | Evidence, How we know, Verify (recompute, dispute) and Sources, for any finding, lead or integrity issue | FindingDetail, envelope drawer |

---

## 12. Synthetic data, answer key and evaluation

**Decision: synthetic for now.** This build, its tests and its evaluation run on the seeded generator below. [`data/README.md`](data/README.md) surveys public multi-phone training cases and recommends **MSAB 2026** (two phones, published answer key) as a later real case, with fetch and schema-dump scripts in `data/scripts/`. Running on it needs an adapter from phone databases to Case Bundle v1, which is ingest and out of scope here (§3). If it is added later, it is scored against its published answers, which are never shown to the agents.

### 12.1 Generator (`data/generate.py`)

Seeded; writes one Case Bundle folder per phone plus `answer_key.json`, and loads them through `load_bundle()`. The mock's demo case (*Death at Pier 9*, `frontend/src/mock/data.ts` and `answerKey.ts`) is the reference: 10 plants (victim's last contacts, a powered-off phone near the scene in the window, presence in the window, deleted texts, a location-off gap while in use, post-news synchronised deletions, a round-trip payment, silent meetings, hostile posts, the scene inside routine areas) and 5 decoys (overnight power-off, an unexplained gap, one co-location, a small payment, a below-threshold post). The generator should reproduce these plants across seeds; the revision-2 plants remain valid as a second scenario. With `--hold-back <person>` (default `cara`), that phone is written as a separate bundle for the "add a source" demo; the answer key lists which insights, leads and question answers appear or change only once it is added. New plants and noise, each listed in the answer key with row ids:

| Kind | Plant | Expected |
|---|---|---|
| Tampering | Clock skew: one phone's clock offset by a configurable amount (default +90 s) | `clock_offsets` recovers it within 2 s; no false `missing_messages` after correction |
| Tampering | Spoofed GPS: GPS fixes far from the same phone's Wi-Fi/cell fixes, and a jump implying impossible speed | `source_disagreement` and `impossible_travel` windows; findings citing them carry the reliability note |
| Plant | A burner number contacting ≥2 case people, resolving to no one | `unresolved_identifiers` returns it |
| Innocent noise | Indoor GPS loss, normal drift within accuracy, deleted spam threads, overnight power-off | Not flagged by integrity; not pinned as insights (or dismissed with a rule) |
| Statements | Per-person statements for the demo case, some supported, some contradicted, one unknowable; and a short interview transcript containing several of them (for the transcript stretch) | Correct per-person verdicts |
| Higher-order | **Relay:** Paul texts Ken, and within minutes Ken texts Cara, repeatedly; each pair alone is within normal volume | A rank-2 lead on {Paul, Ken, Cara}; no pairwise check fires |
| Higher-order | **Circulation:** Cara's $1,200 "refund" to Paul on 18 Apr closes S4 (Paul → Ken → Cara) into a loop. `money_chains` sees only the A → B → C chain; the loop as a whole is new | A circulation lead from the flow decomposition |
| Higher-order | **Recurring group:** three phones briefly active together on several days (calls, messages, power events within the same hour), with every pair below the pairwise thresholds | A rank-2 lead; no pairwise check fires |
| Higher-order | **Hole:** Paul and Cara, both strongly connected to Ken and repeatedly co-located, with no direct contact (S5) | A hole lead, matching `silent_meetings` |
| Higher-order decoys | A family group chat; a weekly gym class where several phones share a place; payroll-style transfers that look circular but are routine | Low score, or dismissed with a reason |

A `noise` parameter (0–3) scales the amount of innocent noise and the tampering magnitudes. The answer key also lists each seed's items with their expected verdicts and numbers, for the evaluations below.

### 12.2 Evaluation (`eval/run_eval.py`)

- Generate 10–20 cases across seeds and noise levels; one seed (`HELD_OUT_SEED`) is never used while tuning thresholds.
- Run `prepare_case()`, then every check over every pair and the full range (an evaluation-only sweep); compare with each answer key.
- Report **precision and recall per check** and per integrity rule, plus clock-offset error, as a table and JSON.
- Score the board: do the planted patterns rank among the top insights, and does every suggested question have a check that answers it?
- An optional `--agents` mode verifies the demo claims through the full pipeline and scores verdicts per claim.

### 12.3 Plain-LLM baseline (`eval/baselines.py`, `run_eval.py --baseline`)

This answers "what can this do that an LLM can't?" with a measurement instead of an argument. The same cases and the same questions are given to a plain LLM, and all three arms are scored against the same answer key.

| Arm | What it gets | What it lacks |
|---|---|---|
| **`llm-context`** | Every row of every phone as text (per phone, per table, with row ids), the case's claims, and instructions to answer each item with a verdict, cited row ids and numbers | Checks, integrity pass, verdict rules, validator |
| **`llm-sql`** | The same items, plus a read-only SQL tool on the same case store (raw tables, not the `v_*` views) and a description of the schema | The same; it can query, but must write its own comparisons |
| **`alibai`** | The full pipeline: `prepare_case()`, then claim verification (agents, `assemble_report()`, `validate_report()`) | — |

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
schema/case-bundle-v1/        format spec + example bundle
backend/store/                schema.sql, views (ts_adj, dispute exclusion), load_bundle.py (validate, load, resolve),
                              versions.py (case versions, case_diff)
backend/integrity/            clock.py, travel.py, sources.py, crossphone.py, run.py
                              (→ clock_offsets, reliability, stays, integrity_issues)
backend/checks/               location.py, comms.py, money.py, relations.py, device.py, optional.py,
                              verdicts.py, helpers.py (prepare_case, add_source, match_claim)
backend/board/                build.py (insights, rank, confirm top leads), questions.py
backend/discovery/            entities.py (people map + model extraction), complex.py (TopoNetX),
                              propagate.py (Hodge operators), score.py (isolation forest → leads),
                              flows.py (Hodge decomposition), holes.py, leads.py (explain, promote)
backend/agents/               orchestrator.py, subagents.py, models.py (Finding), prompts/
backend/report/               assemble.py, validate.py
backend/reviews.py            disputes → rerun
backend/api.py                FastAPI + SSE
backend/tests/                load, integrity, checks vs answer key, discovery, board, add-source diff,
                              validator, reviews, e2e (slow)
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
- [ ] The demo claims yield the expected verdicts. Every id resolves and every sentence passes the hardened validator.
- [ ] "Paul met Cara in March" returns Can't tell.
- [ ] Ken's gap is pinned as `location_off`; Amy's gap is not.
- [ ] At least one finding comes from a follow-up chain across two subagents (G1 → S4).

New in revision 4:
- [ ] The pinboard appears with no input from the investigator. Its top insights include the 17 April 10:00 three-phone group and the S1 missing texts (from integrity), without the system being told about the audit.
- [ ] Every suggested question either has a check that answers it in one click or is marked as having none.
- [ ] Adding Cara's phone as a second bundle marks the relay, the circulation and her side of S7 as new or changed, re-checks affected claims, and leaves untouched insights unchanged.
- [ ] A bundle with a bad row is rejected with its file and line, and the case is unchanged.
- [ ] (Stretch) The demo transcript is parsed into claims attributed to the right speakers.

New in revision 3:
- [ ] Nothing reads uncorrected timestamps: discovery and checks run only after the integrity layer, through `prepare_case()`.
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

1. Generator and answer key (tampering, noise, higher-order patterns, statements, Cara's phone held back), and `load_bundle()` with case versions
2. Integrity layer, including the cross-phone checks; the other checks and their verdict rules; tests against the answer key
3. Discovery (§6.4), in this order: complex with group cells; fixed propagation and isolation-forest leads; flow decomposition; holes via persistent homology (optional)
4. The board: insights, confirming top leads, suggested questions; then adding a source with `case_diff()`
5. Agents on the CLI: claim verification (parse, `confirm_items` interrupt, checks, per-claim verdicts) and Ask; report assembly and the hardened validator; reviews and reruns
6. FastAPI endpoints and SSE; the pinboard front end (graph with shaded groups, data health, insights, questions), then the add-source, verify-claims and Ask screens
7. Evaluation: check precision and recall (§12.2), discovery (§12.4), then the plain-LLM baseline (§12.3)

Steps 1–4 need a model only for extracting mentions from text and phrasing questions; everything else in them is code. The board can be demoed before any agent exists. The plain-LLM baseline needs a model and step 5. Stretch goals: interview transcripts in step 5, and a trained TNN after step 7.
