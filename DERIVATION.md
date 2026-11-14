# How Alib.ai derives what it says

This document is for engineers building or reviewing Alib.ai. It traces every statement the product makes back to its source. For each kind of finding, it covers which rows are read, what is computed, which rule turns a computation into a verdict, what the model is and isn't allowed to do, and how a reviewer can reproduce the result by hand.

For the system overview, see [ARCHITECTURE.md](ARCHITECTURE.md) (revision 3). For the input format, see [schema/case-bundle-v1/README.md](schema/case-bundle-v1/README.md).

---

## 1. The lineage of a statement

**Operating rule: agents never compute, and checks never conclude.** Every number comes from a check, and every verdict from a rule in code. Every judgement (merge, dismiss, follow up, wording) comes from an agent, and is logged.

Every sentence in a briefing, report or Ask answer has this lineage:

```
 source file line ─► stored row ─► integrity ─► check (sweep or targeted) ─► signal ─► incident ─► finding ─► statement ─► validator ─► report ─► UI
 (bundle, file,      (global id,   (ts_adj,      (code: rows in,             (signals   (triage:    (verdict   (one sentence (code rules)  (assembled  (Evidence · How we know
  line, raw JSON)     provenance)   reliability)  numbers + ids out)          table)     grouped)    by rule)   by model)                   in code)    · Verify · Sources)
       ▲                                                                                                                                              │
       └──────────────────────────────── a reviewer can walk this chain backwards from any finding ───────────────────────────────────────────────────┘
```

A finding answers an **item**: one atomic claim parsed from the investigator's brief or from a person's statement, confirmed by the investigator before any targeted check runs (§6.2).

A finding may also carry **follow-up hops**: one subagent's result triggers a targeted check by another. Each hop is a step in `derivation.steps` with `kind: "follow_up"`, naming the subagent that asked, the subagent that ran, and the check call (§6.3).

Each arrow is something an engineer can inspect:

| Link | Stored where | Shown in UI |
|---|---|---|
| Raw row → corrected row | `clock_offsets` (per phone); checks read `ts_adj` through the `v_*` views, never raw `ts` | **How we know**, step "Data read" notes any offset applied |
| Row → reliability | `reliability` windows (`ok` or `suspect`, with reasons) | Reliability badge on the finding and timeline |
| Check output → signal | `signals` row: `check, people, start, end, evidence_ids, strength, output_json, reliability_flags` | **How we know**, step "Signal" |
| Signals → incident | `incidents.signal_ids`; merge and split decisions logged by triage | **How we know**, step "Grouped with" |
| Source file → row | `EvidenceRow.provenance` (bundle, sha256, file, line, record_id, raw) | **Sources** tab, expand a row |
| Row → check input | The check's SQL is deterministic; its args are logged in `derivation.steps[kind=tool]` | **How we know**, step "Check called" |
| Check input → output | Pure Python, which can be re-run with the same args | **How we know**, steps "Data read" and "Computation" |
| Output → verdict | A named rule in `backend/checks/verdicts.py`, run by `apply_verdict_rule`; the subagent copies the result | **How we know**, step "Verdict" |
| Brief or statement → item | `items` row, with `claimant` and `status` (`proposed`, `confirmed`, `edited`, `removed`) | **How we know**, step "Brief item" or "Statement" |
| Output → statement numbers | `derivation.numbers[]` maps each number to a check-output field | **How we know**, "Where each number comes from" |
| Statement → validator | `derivation.validator[]` | **How we know**, "Report validator" |
| Statement ↔ raw rows | Recomputed in the browser by `frontend/src/lib/verify.ts` | **Verify** tab |
| Finding → review | `reviews` row; a dispute supersedes the finding (`status`, `supersedes`) | **Verify** tab; "changed" marker |

### Who does what: code or model

| Step | Actor | Why |
|---|---|---|
| Ingest, normalise, resolve people | code (upstream, out of scope for this build) | Must be reproducible |
| Estimate clock offsets; mark suspect windows (integrity pass) | **code** | Runs before every sweep; §3.12 |
| Run every check over every pair on case load (sweep) | **code** | Produces `signals` with no model involved |
| Compute signal `strength` | **code** | Per-check rule, §3.0 |
| Propose incident groupings and count agreeing checks and phones | **code** | `propose_incidents()` |
| Find anchor moments (≥3 phones clustered) | **code** | `anchor_moments()` |
| Accept, merge or split proposed incidents | model | Judgement. Logged. |
| Dismiss a signal with an ordinary explanation | model | Judgement. Must cite the rule or the row that explains it. |
| Request a follow-up from another subagent | model | Judgement. The hop is logged as a derivation step. |
| Split a brief and statements into items, attribute each to its claimant, resolve names and dates | model | Natural language |
| Approve, edit or remove items | **investigator** | `confirm_items` interrupt; no targeted check runs before it |
| Match a brief item to existing signals | **code** proposes (`match_brief_item`), model confirms | Reuse beats re-running |
| Label an incident's relevance to the brief | model | Judgement |
| Run a check | **code** | No model touches data |
| Compute any number | **code** | The model is forbidden from arithmetic |
| Apply a verdict rule | **code** | `apply_verdict_rule()`. Thresholds are named parameters; the subagent copies the verdict into its `Finding`. |
| Look up reliability for the cited windows | **code** | `get_reliability()` |
| Phrase one sentence from check output | model | Readability |
| Validate the sentence | **code** | Rejects anything uncited, untraced, worded as an accusation, with a verdict that differs from the rule, or silent about a suspect window |
| Sort incidents | **code** | `rank_incidents()`: relevance label (if a brief exists) → `n_checks` → `n_phones`. See §6. |
| Pick briefing headlines | **code** | The sentence of the incident's strongest validated finding |
| Assemble the report | **code** | `assemble_report()` from validated findings, items and incidents |
| Write the next-steps paragraph | model (orchestrator) | The only free text in the report; passes the same validator |
| Rerun checks after a dispute | **code** | Every `check_calls` row that cited the disputed row; §5 |

In the UI's derivation chain, code steps are drawn in blue and model steps in amber, so a reviewer can see exactly where judgement entered.

---

## 2. Provenance: from file to row

Ingest (upstream of this build; ARCHITECTURE.md §3) assigns every row:
- a global id `<device_owner>:<type>:<n>`, for example `amy:evt:0149`
- a `provenance` record:

```jsonc
{
  "bundle": "harbor-supply-case.zip",
  "bundle_sha256": "9f2c…a2d4",              // hash of the zip as received
  "file": "devices/amy-pixel/device_events.jsonl",
  "line": 37,                                 // 1-based line in that file
  "record_id": "e149",                        // the record_id inside the file
  "extraction_tool": "synthetic-generator 0.1",
  "extracted_at": "2026-04-21T10:02:00-04:00",
  "raw": "{\"record_id\":\"e149\", …}"          // the original line, before normalisation
}
```

**Invariants:**
- `raw` is stored as received.
- Normalisation may change *formats* but never values. Examples of format changes: `(555) 010-0202` becomes `+15550100202`, and timestamps gain a timezone object.
- A row with no provenance cannot be cited, and `/api/evidence` returns 404 for it.
- Raw `ts` is never overwritten. A clock correction lives in `clock_offsets` and is applied by the `v_*` views as `ts_adj`, so the original timestamp in `raw` always matches the stored one.

**Tracing by hand:**
1. Check the bundle hash with `shasum -a 256 harbor-supply-case.zip`.
2. Open the file at the given line.
3. Compare it to `raw`.

---

## 3. Each check: input, computation, rule, evidence

### 3.0 From check result to signal

During the sweep, each result a check returns becomes one `signals` row:

```jsonc
{ "signal_id": "sig_0042", "check": "location_gaps", "people": ["ken"],
  "start": "2026-04-15T14:00-04:00", "end": "2026-04-15T16:30-04:00",
  "evidence_ids": ["ken:msg:3311", "ken:txn:0041", "ken:loc:2203", "ken:loc:2219"],
  "strength": 0.9, "output_json": { … the check's full result … } }
```

`strength` is computed in code from a fixed rule per check, and is used only for ordering ties inside an incident:

| Check | Strength rule (0–1) |
|---|---|
| `missing_messages` | 0.6, +0.3 if a `thread_deleted` explains it |
| `distance_between` | 0.8 if label contradicts a co-location claim or exceeds 5 km; else 0.3 |
| `silent_meetings` | min(1, occasions / 4) |
| `money_chains` | 0.5 + 0.5 × ratio |
| `synchronised_behaviour` | min(1, phones / 4) + 0.2 if a trigger candidate exists |
| `location_gaps` | `location_off` 0.9 · `powered_off` 0.4 · `unexplained` 0.2 |
| `unresolved_identifiers` | min(1, case people contacted / 3) |
| optional checks | 0.5 by default, documented with the check |

All thresholds are keyword arguments with these defaults. Evidence ids are always the rows the computation actually used. No check cites a row "for context".

Every check reads through the `v_*` views, so it sees clock-corrected timestamps (`ts_adj`) and never sees a disputed row. After the sweep, code sets each signal's `reliability_flags` to the suspect windows its evidence falls in. Every check invocation, in the sweep or targeted, is stored in `check_calls` (`check`, `params_json`, `output_json`, `evidence_ids`, `excluded_ids`), which is what a dispute reruns.

### 3.1 `missing_messages(a, b, start, end)`: scenario S1

| | |
|---|---|
| **Reads** | `messages` and `calls` on a's phone and b's phone where {from, to} = {a, b} and the timestamp is in range; `device_events` of type `thread_deleted` on either phone whose counterpart is the other person |
| **Computes** | For each message on one phone, look for a counterpart on the other phone with the same sender, recipient and body and \|Δt\| ≤ `tolerance_s` (2 s), comparing `ts_adj`. Calls are matched the same way and serve as anchors: if calls match but messages don't, the phones are in sync and the gap is specific. The 2 s tolerance assumes synced clocks, which is why the clock offset (§3.12) is applied first. |
| **Output** | `items[]` (with `on_a` and `on_b` ids, or null), `missing_count`, `deletion_events[]`, `tolerance_s` |
| **Rule** | Report if `missing_count > 0`. Attach any `thread_deleted` on the phone that lacks the messages whose timestamp is later than the missing messages. |
| **Evidence** | Every unmatched message, every matched call (both copies), and the deletion event |
| **Verify recomputes** | Unmatched count by body and time; call pairs; deletion timestamp later than every missing message |

### 3.2 `distance_between(a, b, start, end)`: scenario S2

| | |
|---|---|
| **Reads** | `locations` for both phones in range |
| **Computes** | Join slots on identical timestamp (slots are 10-minute aligned on `ts_adj`, after the clock offset is applied). For each pair: `d = 2R·asin(√(sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2)))`, R = 6,371,000 m. Then min, median and max. |
| **Rule** | `together` if d ≤ 150 m in ≥ 80% of slots; `apart` if min d ≥ 1,000 m; otherwise `mixed`. Against a belief of "together", `apart` gives **inconsistent**, `together` gives **confirmed**, and `mixed` or no shared slots gives **cannot tell**. |
| **Evidence** | Every location row in every compared slot, on both phones |
| **Verify recomputes** | Slot pair count, min, max, label |

### 3.3 `money_chains(start, end)`: scenario S4

| | |
|---|---|
| **Reads** | `transactions` on all phones |
| **Computes** | De-duplicate transfers seen on both phones by (from, to, amount, currency, \|Δt\| ≤ 2 s), keeping both row ids. For each A→B transfer with amount ≥ `min_amount` (500), find B→C with `0 < t₂ − t₁ ≤ window_h` (24 h) and `ratio_min ≤ amount₂ / amount₁ ≤ ratio_max` (0.8 to 1.0). |
| **Output** | `links[]`, `gap_minutes`, `gap_label` (preformatted, e.g. "4 h 35 min"), `ratio` |
| **Rule** | Any match is a chain. A transfer seen on both phones is **confirmed**. |
| **Evidence** | Both copies of each link |
| **Verify recomputes** | Presence on sender and receiver, gap in minutes, ratio |

### 3.4 `silent_meetings(start, end)`: scenario S5

| | |
|---|---|
| **Reads** | `locations` for every pair of phones; `messages` and `calls` on **all** phones |
| **Computes** | Per pair, a slot is "close" if d ≤ `within_m` (100 m). Consecutive close slots form an episode, with duration = (last − first) + 10 min. Keep episodes ≥ `min_minutes` (20). Contact count = messages ∪ calls on any phone where {from, to} = the pair. |
| **Rule** | Flag if episodes ≥ `min_occasions` (2) **and** contact count = 0. Against "X and Y don't know each other", this gives **inconsistent**. |
| **Evidence** | Location rows for every slot of every episode, on both phones |
| **Absence** | A zero count can't be shown by citing rows. The output records the query and the tables searched (`channels_checked`), and Verify shows the query to re-run. |
| **Verify recomputes** | Close-slot count, distinct days, shortest occasion |

### 3.5 `synchronised_behaviour(start, end)`: scenario S7

| | |
|---|---|
| **Reads** | `device_events` of type `thread_deleted`, `power_off` and `power_on` on all phones; inbound `messages` in the 2 h before each candidate window |
| **Computes** | Slide a `window_min` (60) window over deletion and power-off events. Keep windows with ≥ `min_phones` (3) distinct phones. Report the tightest span (first to last event) as `window.minutes`. For trigger candidates, list inbound messages before the window with `minutes_before_window` precomputed. |
| **Rule** | Flag any qualifying window. The **model** may pick a trigger from the candidates, but only one returned by the check, and the minutes come from the output. |
| **Evidence** | Trigger message, every deletion and power-off in the window, and the matching power-on |
| **Verify recomputes** | Phone count, window length, minutes after trigger |

### 3.6 `location_timeline(person, start, end)`: stays, travel, gaps

| | |
|---|---|
| **Reads** | `locations` for one phone, in time order |
| **Computes** | Walk the rows. A **stay** starts when consecutive points remain within `stay_radius_m` (150) of their running centroid for ≥ `min_stay_min` (10). Its place is the nearest named place within its radius, or "unnamed". A **travel** segment joins two stays. A **gap** is any interval between consecutive rows longer than `min_gap_min` (45); it is classified by `location_gaps`. |
| **Output** | Ordered `segments[]`: `{kind, place?, from?, to?, start, end, gap_type?, evidence_ids}` |
| **Stored** | `stays` table, built by the integrity pass on corrected timestamps. `distance_between` and `silent_meetings` read stays instead of raw slots. |
| **Rule** | None. This check describes; it never raises a signal by itself. |
| **Evidence** | The first and last location row of each stay or travel; for a gap, the rows on either side of it |
| **Verify recomputes** | Segment boundaries from raw rows; every gap's length |

### 3.7 `location_gaps(person, start, end)`: G1

| | |
|---|---|
| **Reads** | `stays` gap segments for the phone; `device_events` (power), `messages`, `calls` and `transactions` on **that phone** inside each gap |
| **Computes** | For each gap ≥ 45 min, check in this order: (1) a `power_off` … `power_on` pair covers it → `powered_off`; (2) any outgoing or incoming message, call or transfer falls inside it → `location_off`; (3) otherwise → `unexplained`. |
| **Output** | `{start, end, minutes, gap_type, activity_ids[], bounding_location_ids[2], power_event_ids[]}` |
| **Rule** | Raise `location_off` always. Raise `powered_off` or `unexplained` **only** if the gap overlaps another signal. On the demo case: Ken 15 Apr 14:00–16:30 is `location_off` and raised. Amy 16 Apr 09:10–10:00 is `unexplained` with no overlap, so it is **not** raised. Ken overnight 15→16 Apr is `powered_off` with no overlap, so it is not raised. The S7 power-offs are `powered_off` but overlap S7, so they are raised as part of that incident. |
| **Wording** | Always "no location data from X to Y". Never "turned off location to hide", never a claim about intent. For `location_off`: "…while the phone sent a message at 15:10 and a transfer at 15:40". |
| **Evidence** | The two bounding location rows, every activity row inside the gap, and any power events |
| **Verify recomputes** | Gap minutes from the bounding rows; that each activity row's timestamp is inside the gap; the gap type |

### 3.8 Optional checks

| Check | Reads | Rule | Evidence |
|---|---|---|---|
| `call_log_mismatch(a, b)` | `calls` on both phones (`ts_adj`) | Unmatched within ±2 s → signal | The one-sided call row(s) |
| `transfer_after_meeting()` | `transactions`, shared `stays` | Transfer ≥ $500 between a pair within 6 h after a shared stay ends | Transfer rows + stay bounding rows |
| `contact_went_quiet()` | `messages`, `calls` | ≥3 consecutive days with contact, then ≥2 days with none, inside coverage | Last contact rows + coverage rows |
| `group_meetings()` *stretch* | shared `stays` on all phones | ≥3 phones within 150 m of each other for ≥20 min at once. A multi-way pattern, like `synchronised_behaviour`; not a set of pairwise meetings. | Stay bounding rows for every phone in the group |

`shared_unknown_number()` is superseded by the core check `unresolved_identifiers` (§3.11).

### 3.9 `get_coverage()`: cannot tell

Returns the first and last row per phone. If a brief item or question names a period outside every phone's coverage, the verdict is **cannot tell**, and those boundary rows are cited. The model must use this verdict instead of guessing.

### 3.10 `contact_graph(people?)`: relations view

Edges are built by channel:

| Channel | Source |
|---|---|
| call | `calls` |
| message | `messages` |
| transfer | `transactions` |
| social | `social_interactions` between resolved handles |
| deleted_thread | `thread_deleted` whose counterpart is a case person |
| colocation | `silent_meetings` episodes, including weak (below-threshold) ones, which are drawn faded |

Each edge carries its own evidence ids. The graph is descriptive and produces no verdicts.

### 3.11 `unresolved_identifiers(start, end)`: possible burners

| | |
|---|---|
| **Reads** | `messages`, `calls`, `social_interactions` on all phones; `identifiers`, `persons`, `orgs` |
| **Computes** | Group every counterpart number or handle that resolves to no person and no `orgs` row. Keep those that contacted ≥ `min_people` (2) case people. Per identifier: which phones, counts by channel, first and last contact. |
| **Output** | `identifiers[]`: `{identifier, phones[], counts{message, call, social}, first, last}` |
| **Rule** | Flag every kept identifier. Against "X and Y have no contact in common", a kept identifier shared by X's and Y's phones gives **inconsistent**. The wording is "a number that resolves to no one in the case"; never "burner". |
| **Evidence** | One row per phone per channel: the first and last contact with the identifier |
| **Verify recomputes** | Distinct case people per identifier; that it resolves to no person or org |

### 3.12 Integrity pass (stage ⓪, before any check)

All code. Its outputs are inputs to the checks, so a wrong offset or a missed suspect window changes findings; it is traced the same way.

| Step | Reads | Computes | Output | Evidence |
|---|---|---|---|---|
| **Clock offset** | `calls` on every pair of phones | Match calls present on both phones (same counterpart numbers, same direction, duration within 2 s, candidate window ±15 min). Per phone, the median of `ts_b − ts_a` across matches, solved against the reference phone with the most matches. Needs ≥3 matches with spread ≤2 s. | `clock_offsets {device_id, offset_s, n_pairs, spread_s}`; a phone with \|offset\| > 5 s gets a `clock_skew` reliability row over its coverage. Too few matches or too much spread → `suspect`, "offset not estimable". | Both copies of every matched call |
| **Impossible travel** | `locations` on one phone, in `ts_adj` order | Implied speed between consecutive fixes, after subtracting both fixes' `accuracy_m`; pairs < 60 s apart are skipped | `reliability` row `impossible_travel` over the window between the fixes if speed > 250 km/h | The two fixes |
| **Source disagreement** | `locations` on one phone with `source` and `accuracy_m` | Per 5-min slot, distance from each GPS fix to the same phone's Wi-Fi or cell fix | `reliability` row `source_disagreement` if distance > max(1 km, 3 × combined accuracy) | The GPS fix and the fix it disagrees with |

Innocent noise must **not** be flagged: indoor GPS loss (a gap, not a disagreement), drift within accuracy, an overnight power-off, a single fix with large `accuracy_m`. The thresholds are starting values, tuned in the multi-seed evaluation (ARCHITECTURE.md §12).

A finding whose evidence falls in a `suspect` window must say so (§4). The UI shows the reliability window and its own evidence rows next to the finding.

---

## 4. From check output to sentence

1. The subagent receives the check output (JSON), calls `apply_verdict_rule(item_id, call_id)` and `get_reliability()` for the windows its evidence covers, and writes **one sentence**.
2. It returns a structured `Finding` (the subagent's `response_format`; ARCHITECTURE.md §7.2): `item_id`, `check`, `verdict` (copied from the rule), `sentence`, `evidence_ids`, `numbers[]` and an optional `follow_up`. Each `numbers[]` entry pairs a number as it appears in the sentence with the output field it was copied from:

   ```jsonc
   { "text": "4 h 35 min", "field": "money_chains.gap_label" }
   ```

   Code adds the field's `value` when it stores the finding, so the UI can show it.

3. `validate_report()` (code) then checks:

| Rule | Check |
|---|---|
| Cites evidence | `evidence_ids` is non-empty, every id resolves, and none is disputed |
| Neutral wording | No word from the banned list: `lied`, `lying`, `liar`, `guilty`, `innocent`, `criminal`, `confessed`, `admitted`, `caught`, `covered up`, `cover-up`, `fraud`, `stole`, `suspicious`, `obviously`, `clearly`, `proves`, `proof` |
| Numbers traced | Every number token in the sentence appears in `numbers[].text`, and each `field` exists in the check output with an equal value |
| Verdict copied | `verdict` equals the stored `apply_verdict_rule` result for that item and check call |
| Reliability disclosed | If any cited evidence falls in a `suspect` window, the sentence says so ("…, though this phone's clock/location data in that window is flagged as unreliable") |
| One sentence | Exactly one terminal punctuation mark |

There is no "phones, not people" rule. A case person's name may stand for their phone ("Amy was at Northgate Mall"), and every report states this once in its assumptions (ARCHITECTURE.md §8.1).

A statement that fails gets one repair round-trip with the failure reason. If it fails again, it is **dropped** and logged. The orchestrator's next-steps paragraph goes through the same rules except "one sentence".

---

## 5. Fact-checking in the UI (Verify tab)

`frontend/src/lib/verify.ts` recomputes each finding from the **raw rows returned by `/api/evidence`**. It deliberately ignores the check's own output, then compares:

```
claim            report says    recomputed    ✓/✗
Closest distance 23.1 km        23.1 km       ✓
```

- This catches bugs where a check's output and its cited rows disagree.
- It also lets an investigator see for themselves that the number follows from the rows.
- A ✗ means the finding must not be relied on. In the real build, a ✗ also files an automatic issue.

The Verify tab also records the investigator's own review ("I checked this, it holds" or "I dispute this", with a note, who and when) as a `reviews` row, so the report shows who checked what.

- **Checked** is recorded and shown. It changes nothing.
- **Disputed** (on an evidence row, or on a finding, meaning all its rows) changes results (ARCHITECTURE.md §9):
  1. The row is excluded from the `v_*` views.
  2. Code finds every `check_calls` row whose `evidence_ids` include it and reruns those calls with the same params. If the row fed the integrity pass (a matched call or a location fix), the affected integrity steps rerun first.
  3. A finding whose verdict, evidence or numbers changed is superseded: the new one is `current` with `supersedes` set, and the old one is `changed`. A finding left with no evidence is `withdrawn`. The sentence goes back to the owning subagent only when the numbers changed.
  4. The report is reassembled, and changed findings are marked. The derivation of a superseded finding shows the dispute as a step.

---

## 6. Triage, the briefing, and brief refinement

### 6.1 Triage (stage ②, on case load, no brief)

Triage starts only after `prepare_case()` has run the integrity pass and the sweep. `run_sweep()` refuses to run before the integrity pass.


1. **Propose (code).** `propose_incidents()` groups signals that share at least one person and overlap in time, padded by ±2 h. Each candidate carries `n_checks` (distinct checks) and `n_phones` (distinct device owners across its evidence).
2. **Review (model, logged).** Agents accept, merge or split candidates. Every merge or split is written to the incident's derivation with a one-line reason.
3. **Dismiss (model, logged).** A signal with an ordinary explanation goes to `dismissals` with `reason` and `rule`. The reason must point at a row or a threshold, for example "memo 'lunch' and $50 < $500 minimum". Dismissals are shown in "Checked and dismissed"; they are never silently dropped.
4. **Anchors (code).** `anchor_moments(window_min=60, min_phones=3)` returns windows where signals from ≥3 phones cluster. On the demo case it returns 17 Apr 10:00–11:10 (S7 deletions and power-offs on 3 phones, plus the audit message as a trigger candidate). No knowledge of the audit is needed: the cluster comes from the data.
5. **Rank (code).** `rank_incidents()` sorts by `n_checks`, then `n_phones`, then maximum `strength`. The top 5 form the briefing. `rank_reason` is generated from those numbers, for example "3 checks agree across 3 phones".
6. **Headlines (code).** Each incident's `headline` is the sentence of its strongest validated finding, picked in code. `why_it_matters` is the code-generated `rank_reason`. No model writes free text for the briefing, so there is nothing new to validate.

### 6.2 Parse, confirm and refine (stages ③–⑤)

1. **Split (model).** The orchestrator splits the brief and each statement into atomic **items**. Each item is attributed to its claimant (`investigator` for the brief, the statement's `person_id` otherwise), with people and dates resolved, and these are logged.
2. **Confirm (investigator).** The orchestrator calls `confirm_items(items)`. Because of `interrupt_on`, the run pauses and the API streams `items_proposed`. The investigator approves, edits or removes items, and the run resumes on the same `thread_id`. **No targeted check runs before this point**, and edited items are what get checked. The derivation records whether an item was edited.
3. **Match first (code proposes, model confirms).** `match_brief_item(item)` returns signals and incidents sharing the item's people and overlapping its dates. If they settle the item, they are reused and no new check runs. The derivation shows "matched existing signal sig_…".
4. **Targeted checks for gaps only.** If nothing matches, the routed subagent runs a check with item-specific parameters. If the item's dates fall outside coverage, the result is `cannot_tell`.
5. **Re-rank.** The model labels each incident `high`, `medium` or `low` relevance to the brief, with the brief item quoted. `rank_incidents(relevance=…)` re-sorts in code.
6. **Assemble (code).** `assemble_report()` places each item's verdict in Confirmed or Inconsistent (beliefs) or Answers (questions). Items from statements also go in **By person**: each claim with its verdict, shown as supported (`confirmed`), contradicted (`inconsistent`) or cannot tell. Incidents matched to no item go to "What you didn't ask about". Findings resting on a suspect window are listed under reliability notes. The orchestrator then writes the next-steps paragraph.

### 6.3 Follow-up chains

A subagent may set the optional `follow_up` field on a `Finding`: `{to: "<subagent>", check: "<name>", params: {...}, reason}`. The orchestrator dispatches it as a new `task` and appends the hop to the finding's derivation:

```
step 4  follow_up   location-analyst → financial-analyst
        "Activity on Ken's phone during the location gap 14:00–16:30?"
        get_events(person='ken', table='transactions', start='…14:00', end='…16:30')  →  ken:txn:0041 ($4,500 → Cara, 15:40),
        which is link 2 of money_chains signal sig_0017 (S4)
step 5  follow_up   orchestrator → comms-analyst
        search_messages(person='ken', start='…14:00', end='…16:30')    →  ken:msg:3311 (15:10)
```

The merged finding cites the evidence of every hop. It must stay one sentence, with every number traced. Chains are capped at 3 hops per finding.

### 6.4 Timeline and dismissed lists

- The **week timeline** and the **location timeline** are drawn purely from `stays` and finding evidence. Each mark is a row id or a segment id, and clicking one opens its finding.
- **Checked and dismissed** lists every dismissal with its reason and rule. This is how decoys stay visible without being flagged.

---

## 7. Ask: questions with cited answers

`POST /api/ask` runs the orchestrator in Q&A mode:

1. **Parse.** The model resolves people and dates, and logs them as steps.
2. **Route.** The model picks a subagent and check, and logs the reason.
3. **Run.** The checks run in code.
4. **Answer.** The model writes 1–3 sentences. The answer is valid only if every claim in it is backed by a returned finding. The findings are attached and open in the same drawer with Evidence, How we know, Verify and Sources.
5. **Cannot tell.** If no check settles the question, the answer is `cannot_tell`, citing coverage. No free-text speculation is allowed.
6. **Stream.** Steps are streamed to the UI as they happen (`event: step`), so the user sees what was done before seeing the answer.

---

## 8. Data shapes

The TypeScript contract is [`frontend/src/api/types.ts`](frontend/src/api/types.ts). The relevant types are:
- `Finding.derivation`: `{ steps, numbers, validator, corroboration }`
- `EvidenceRow.provenance`: see §2
- `Signal`: `{ signal_id, check, people, start, end, evidence_ids, strength, output }`
- `Incident`: `{ incident_id, signal_ids, people, start, end, n_checks, n_phones, rank, headline, anchor_id? }`
- `Anchor`: `{ anchor_id, start, end, phones, signal_ids }`
- `Dismissal`: `{ signal_id, reason, rule }`
- `Segment`: `{ kind: stay|travel|gap, person, place?, from?, to?, start, end, gap_type?, evidence_ids }`
- `Briefing`: `{ anchors[], items[{ incident, finding, headline, why_it_matters, rank_reason, follow_ups }], timeline[], dismissed[] }`
- `DerivationStep.kind` gains `signal`, `grouped` and `follow_up`
- `Answer`: `{ text, verdict, findings[], steps[], suggestions[] }`

New in revision 3:
- `Statement`: `{ statement_id, person_id, text }`
- `Item`: `{ item_id, source: brief|statement, source_ref, claimant, kind: belief|question|claim, text, people, start, end, status }`
- `ReliabilityWindow`: `{ device_id, person, start, end, status: ok|suspect, reasons[], evidence_ids }`; `ClockOffset`: `{ device_id, offset_s, n_pairs, spread_s }`
- `Review`: `{ review_id, target, kind: checked|disputed, note, by, at }`
- `Finding` gains `item_id`, `claimant`, `reliability_note?`, `status: current|changed|withdrawn`, `supersedes?`
- `Report` gains `by_person[]` and `reliability_notes[]`
- `AgentEvent` gains `items_proposed` and `rerun`; `SubagentName` loses `report-writer`

`backend/schemas.py` must mirror these exactly.

---

## 9. Engineering checklist when adding a new check

1. Make it a pure function over the `v_*` views (and `stays`, for location checks), so it sees corrected timestamps and no disputed rows, with thresholds as named keyword arguments. It answers one fixed question and never concludes.
2. Return `evidence_ids` containing only rows the computation used.
3. Return every number a sentence could need, preformatted where the format matters (e.g. `gap_label`).
4. Write the verdict rule as code in `backend/checks/verdicts.py` so `apply_verdict_rule` can run it, and add it to §3 of this file.
5. Add a `verify.ts` case that recomputes the key numbers from raw rows.
6. Add an evidence view keyed by `check_output.kind`.
7. Define how each result becomes a `signals` row, including its `strength` rule (§3.0).
8. Add a unit test against the answer key, covering one planted positive and one decoy in the generator, and add the check to the precision and recall table in `eval/run_eval.py`.
9. Give it to exactly one subagent, and add its `CheckName` to `types.ts` and `backend/schemas.py`.
