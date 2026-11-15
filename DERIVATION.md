# How Alib.ai derives what it says

This document is for engineers building or reviewing Alib.ai. It traces every statement the product makes back to its source. For each kind of finding, it covers which rows are read, what is computed, which rule turns a computation into a verdict, what the model is and isn't allowed to do, and how a reviewer can reproduce the result by hand.

For the system overview, see [ARCHITECTURE.md](ARCHITECTURE.md) (revision 3). For the input format, see [schema/case-bundle-v1/README.md](schema/case-bundle-v1/README.md).

---

## 1. The lineage of a statement

**Operating rule: discovery finds leads, code proves facts, agents never compute.** Every number comes from a check, and every verdict from a rule in code. Every judgement (dismiss, follow up, wording) comes from an agent, and is logged.

Every sentence on the board, in a claim report or in an Ask answer has this lineage:

```
 source file line ─► stored row ─► integrity ─► check (on demand) ─► finding ─► statement ─► validator ─► board / report ─► UI
 (bundle, file,      (global id,   (ts_adj,      (code: rows in,      (verdict    (one sentence (code rules)  (assembled       (Evidence · How we know
  line, raw JSON)     provenance)   reliability)  numbers + ids out)   by rule)    by model)                   in code)         · Verify · Sources)
       ▲                                                                                                                              │
       └──────────────────────── a reviewer can walk this chain backwards from any finding ──────────────────────────────────────────┘
```

A finding answers one of three things: a **claim** (an item parsed from a statement, a transcript or the investigator's own belief, and confirmed by the investigator before its check runs, §6.2), a **suggested question** from the board (§6.1), or a **lead** that a check confirmed (§6.4).

A finding can also start as a **lead** from discovery, the topological network model (ARCHITECTURE.md §6.4). A lead has its own lineage, but it joins the chain above only through a check:

```
 stored rows ─► entities + mentions ─► complex (pairs, groups) ─► fixed propagation ─► unusual cell ─► lead ─► proposed check ─► finding
               (model quotes checked   (code)                      (code)             (isolation      (shown as     (code: confirms   (cites the check,
                against their row)                                                     forest, code)   "pattern,     or not)           lead as origin)
                                                                                                       not verified")
```

A finding may also carry **follow-up hops**: one subagent's result triggers a targeted check by another. Each hop is a step in `derivation.steps` with `kind: "follow_up"`, naming the subagent that asked, the subagent that ran, and the check call (§6.3).

Each arrow is something an engineer can inspect:

| Link | Stored where | Shown in UI |
|---|---|---|
| Raw row → corrected row | `clock_offsets` (per phone); checks read `ts_adj` through the `v_*` views, never raw `ts` | **How we know**, step "Data read" notes any offset applied |
| Row → reliability | `reliability` windows (`ok` or `suspect`, with reasons) | Reliability badge on the finding and timeline |
| Check call → stored result | `check_calls` row: `check, params_json, output_json, evidence_ids, excluded_ids, case_version` | **How we know**, step "Check called" |
| Lead or issue → question | `questions` row: its origin, check and parameters | **How we know**, step "Question" |
| Source file → row | `EvidenceRow.provenance` (bundle, sha256, file, line, record_id, raw) | **Sources** tab, expand a row |
| Row → check input | The check's SQL is deterministic; its args are logged in `derivation.steps[kind=tool]` | **How we know**, step "Check called" |
| Check input → output | Pure Python, which can be re-run with the same args | **How we know**, steps "Data read" and "Computation" |
| Output → verdict | A named rule in `backend/checks/verdicts.py`, run by `apply_verdict_rule`; the subagent copies the result | **How we know**, step "Verdict" |
| Statement or transcript → item | `items` row, with `claimant`, `source` and `status` (`proposed`, `confirmed`, `edited`, `removed`) | **How we know**, step "Claim" |
| Output → statement numbers | `derivation.numbers[]` maps each number to a check-output field | **How we know**, "Where each number comes from" |
| Statement → validator | `derivation.validator[]` | **How we know**, "Report validator" |
| Statement ↔ raw rows | Recomputed in the browser by `frontend/src/lib/verify.ts` | **Verify** tab |
| Finding → review | `reviews` row; a dispute supersedes the finding (`status`, `supersedes`) | **Verify** tab; "changed" marker |
| Case version → change | `case_versions`; every insight, lead, question and finding records the version that produced it | "New" and "changed" markers after a source is added |

### Who does what: code or model

| Step | Actor | Why |
|---|---|---|
| Validate, load and resolve a Case Bundle | **code** | Must be reproducible. Adapters from raw phone databases are out of scope |
| Estimate clock offsets; mark suspect windows; compare phones (integrity) | **code** | Runs after every load, before discovery and any check; §3.12 |
| Extract mentions (aliases, organisations, products, places) from text | model | Natural language. Each mention keeps its source row and exact quote; code drops any quote not found in its row |
| Build the complex, propagate features, score cells, decompose flows | **code** | Fixed operators and a seeded isolation forest, so leads are reproducible |
| Rank insights | **code** | `rank_insights()`; §6.1 |
| Run each top lead's proposed check | **code** | Confirmed leads are promoted (`promote_lead`); §6.4 |
| Choose a suggested question's check and parameters | **code** | From the lead's kind; §6.1 |
| Phrase a suggested question | model | Readability; passes the neutral-wording rules |
| Dismiss a lead with an ordinary explanation | model | Judgement. Must cite the rule or the row that explains it |
| Request a follow-up from another subagent | model | Judgement. The hop is logged as a derivation step |
| Split statements or a transcript into claims, attribute each to its claimant, resolve names and dates | model | Natural language |
| Approve, edit or remove claims | **investigator** | `confirm_items` interrupt; no check runs for a claim before it |
| Match a claim to existing results | **code** proposes (`match_claim`), model confirms | Reuse beats re-running |
| Run a check | **code** | No model touches data |
| Compute any number | **code** | The model is forbidden from arithmetic |
| Apply a verdict rule | **code** | `apply_verdict_rule()`. Thresholds are named parameters; the subagent copies the verdict into its `Finding` |
| Look up reliability for the cited windows | **code** | `get_reliability()` |
| Phrase one sentence from check output | model | Readability |
| Validate the sentence | **code** | Rejects anything uncited, untraced, worded as an accusation, with a verdict that differs from the rule, or silent about a suspect window |
| Pick insight headlines | **code** | The promoted finding's sentence, or a code template |
| Assemble the claim report | **code** | `assemble_report()` from validated findings, items and insights |
| Write the next-steps paragraph | model (orchestrator) | The only free text in the report; passes the same validator |
| Compare case versions after a new source | **code** | `case_diff()`; §6.6 |
| Rerun checks after a dispute or a new source | **code** | Every `check_calls` row that cited the row, or whose claim touches the new rows; §5 |

In the UI's derivation chain, code steps are drawn in blue and model steps in amber, so a reviewer can see exactly where judgement entered.

---

## 2. Provenance: from file to row

Loading a Case Bundle (ARCHITECTURE.md §3) assigns every row:
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

### 3.0 How a check result is stored

There is no up-front sweep (ARCHITECTURE.md §6). A check runs in the integrity layer (the cross-phone checks) or on demand: to confirm a lead, answer a suggested question, verify a claim, or answer a chat question. Every run is one `check_calls` row:

```jsonc
{ "call_id": "call_0042", "check": "location_gaps",
  "params": { "person": "ken", "start": "2026-04-15", "end": "2026-04-15", "min_gap_min": 45 },
  "evidence_ids": ["ken:msg:3311", "ken:txn:0041", "ken:loc:2203", "ken:loc:2219"],
  "output_json": { … the check's full result … }, "case_version": 2 }
```

All thresholds are keyword arguments with documented defaults. Evidence ids are always the rows the computation actually used. No check cites a row "for context".

Every check reads through the `v_*` views, so it sees clock-corrected timestamps (`ts_adj`) and never sees a disputed row. A finding that cites rows in a suspect window must say so (§4). `check_calls` is what a dispute or a new source reruns.

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
| **Rule** | None. This check describes; it never pins anything to the board by itself. |
| **Evidence** | The first and last location row of each stay or travel; for a gap, the rows on either side of it |
| **Verify recomputes** | Segment boundaries from raw rows; every gap's length |

### 3.7 `location_gaps(person, start, end)`: G1

| | |
|---|---|
| **Reads** | `stays` gap segments for the phone; `device_events` (power), `messages`, `calls` and `transactions` on **that phone** inside each gap |
| **Computes** | For each gap ≥ 45 min, check in this order: (1) a `power_off` … `power_on` pair covers it → `powered_off`; (2) any outgoing or incoming message, call or transfer falls inside it → `location_off`; (3) otherwise → `unexplained`. |
| **Output** | `{start, end, minutes, gap_type, activity_ids[], bounding_location_ids[2], power_event_ids[]}` |
| **Rule** | Pin `location_off` always. Pin `powered_off` or `unexplained` **only** if the gap overlaps another insight. On the demo case: Ken 15 Apr 14:00–16:30 is `location_off` and pinned. Amy 16 Apr 09:10–10:00 is `unexplained` with no overlap, so it is **not** pinned. Ken overnight 15→16 Apr is `powered_off` with no overlap, so it is not pinned. The S7 power-offs are `powered_off` but overlap the S7 group, so they are shown as part of it. |
| **Wording** | Always "no location data from X to Y". Never "turned off location to hide", never a claim about intent. For `location_off`: "…while the phone sent a message at 15:10 and a transfer at 15:40". |
| **Evidence** | The two bounding location rows, every activity row inside the gap, and any power events |
| **Verify recomputes** | Gap minutes from the bounding rows; that each activity row's timestamp is inside the gap; the gap type |

### 3.8 Optional checks

| Check | Reads | Rule | Evidence |
|---|---|---|---|
| `call_log_mismatch(a, b)` | `calls` on both phones (`ts_adj`). Runs in the integrity layer | Unmatched within ±2 s → integrity issue | The one-sided call row(s) |
| `transfer_after_meeting()` | `transactions`, shared `stays` | Transfer ≥ $500 between a pair within 6 h after a shared stay ends | Transfer rows + stay bounding rows |
| `contact_went_quiet()` | `messages`, `calls` | ≥3 consecutive days with contact, then ≥2 days with none, inside coverage | Last contact rows + coverage rows |
| `group_meetings()` *stretch* | shared `stays` on all phones | ≥3 phones within 150 m of each other for ≥20 min at once. A multi-way pattern, like `synchronised_behaviour`; not a set of pairwise meetings. | Stay bounding rows for every phone in the group |

`shared_unknown_number()` is superseded by the core check `unresolved_identifiers` (§3.11).

### 3.9 `get_coverage()`: cannot tell

Returns the first and last row per phone. If a claim or question names a period outside every phone's coverage, the verdict is **cannot tell**, and those boundary rows are cited. The model must use this verdict instead of guessing.

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

### 3.12 Integrity layer (after every load, before discovery and any check)

All code. Its outputs are inputs to discovery and the checks, so a wrong offset or a missed suspect window changes findings; it is traced the same way. It also runs the cross-phone checks (`missing_messages`, `call_log_mismatch`, `one_sided_transfers`, §3.1 and §3.8) after clock correction, and only over periods both phones cover; each disagreement becomes an integrity issue on the board with its rows.

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

## 6. The board, claims and questions

### 6.1 The board (on load, and after every new source)

The board is built in code after the integrity layer and discovery (ARCHITECTURE.md §7.6). No agent is needed except to phrase.

1. **Insights (code).** Integrity issues (for example "3 texts on Paul's phone are missing from Amy's") and the top leads are ranked by `rank_insights()`: kind weight, then score, then number of phones, then recency. On the demo case the three phones that deleted threads and powered off around 17 Apr 10:00 rank near the top as a group cell, with the audit message as the latest inbound message before it. No knowledge of the audit is needed: the group comes from the data.
2. **Confirm top leads (code).** Each top lead's proposed check runs. If its verdict rule confirms the pattern, `promote_lead()` links them and a subagent phrases one sentence; otherwise the lead stays pinned as "pattern, not verified".
3. **Dismiss (model, logged).** A lead with an ordinary explanation goes to `dismissed` with a `reason` and `rule` that point at a row or a threshold, for example "family group chat: same 3 members every day for the whole week". Dismissals are listed, never silently dropped.
4. **Questions (code, phrased by a model).** Every open lead and integrity issue raises a suggested question. Code picks its check and parameters from the lead's kind (ARCHITECTURE.md §6.6); a model may rephrase the wording, which passes the neutral-wording rules. Clicking it runs `answer_question()`, and the finding's derivation starts with the question as a step. A lead with no matching check raises an open question with no run button.
5. **Headlines (code).** An insight's headline is its promoted finding's sentence, or a code template with numbers from the cell ("3 phones, no pair unusual, active together on 4 days").

### 6.2 Verifying claims

1. **Split (model).** The orchestrator splits statements, the investigator's own beliefs, or (stretch) a transcript into atomic **claims**, each attributed to its claimant, with people and dates resolved, and logs them. For a transcript it first attributes each passage to a speaker.
2. **Confirm (investigator).** The orchestrator calls `confirm_items(items)`. Because of `interrupt_on`, the run pauses and the API streams `items_proposed`. The investigator approves, edits or removes claims, and the run resumes on the same `thread_id`. **No check runs for a claim before this point**, and edited claims are what get checked.
3. **Match first (code proposes, model confirms).** `match_claim(item)` returns integrity issues, answered questions, promoted leads and open leads sharing the claim's people and dates. If they settle it, they are reused. The derivation shows "matched existing result call_…".
4. **Check.** Otherwise the routed subagent runs a check with claim-specific parameters. If the claim's dates fall outside coverage, the result is Can't tell.
5. **Assemble (code).** `assemble_report()` lists every claim under the person who made it, with **Supported / Contradicted / Can't tell** (`confirmed`, `inconsistent`, `cannot_tell`). Board insights touching the claims but answering none are listed as related. Findings resting on a suspect window are listed under reliability notes. The orchestrator then writes the next-steps paragraph.

### 6.3 Follow-up chains

A subagent may set the optional `follow_up` field on a `Finding`: `{to: "<subagent>", check: "<name>", params: {...}, reason}`. The orchestrator dispatches it as a new `task` and appends the hop to the finding's derivation:

```
step 4  follow_up   location-analyst → financial-analyst
        "Activity on Ken's phone during the location gap 14:00–16:30?"
        get_events(person='ken', table='transactions', start='…14:00', end='…16:30')  →  ken:txn:0041 ($4,500 → Cara, 15:40),
        which is link 2 of the money_chains result call_0017 (S4)
step 5  follow_up   orchestrator → comms-analyst
        search_messages(person='ken', start='…14:00', end='…16:30')    →  ken:msg:3311 (15:10)
```

The merged finding cites the evidence of every hop. It must stay one sentence, with every number traced. Chains are capped at 3 hops per finding.

### 6.4 Leads from discovery

A lead is a hypothesis with its working shown, never a verdict.

| Part of a lead | What it holds | Shown in UI |
|---|---|---|
| Cell | The group or link that scored as unusual: its members, time span and kind (relay, circulation, recurring group, hole, burst) | Shaded group in the relations panel |
| Rows | Every evidence row in the cell | **Evidence** and **Sources**, as for a finding |
| Score and drivers | The isolation-forest score, the features that drove it (for example "3 phones, 5 days, each pair below threshold") and the neighbouring cells that contributed through propagation | **How we know**, marked as code steps |
| Mentions | Any model-extracted mention it relies on, with the quote and its row | **How we know**, marked as a model step |
| Proposed check | The deterministic check that would confirm it, with parameters | A "Check this" action |

**Promotion.** The owning subagent runs the proposed check. If the check's verdict rule confirms the pattern, `promote_lead()` links the lead to that check call and the subagent writes a finding in the usual way: one sentence, numbers traced, verdict copied from the rule. The finding's derivation starts with the lead as a step ("found by discovery, score 0.91, drivers …") and then follows the normal chain. If the check doesn't confirm it, the lead stays open, labelled "pattern, not verified", or is dismissed with a reason.

**Why this is safe.** Discovery is free to find patterns that may not be real, because nothing it finds can become a verdict without a check. The validator enforces this: a finding with a `lead_id` must have a linked confirming check call.

### 6.5 Timeline and dismissed lists

- The **location timeline** is drawn purely from `stays` and finding evidence. Each mark is a row id or a segment id, and clicking one opens its finding.
- **Checked and dismissed** lists every dismissed lead and integrity flag with its reason and rule. This is how decoys stay visible without being pinned.

### 6.6 Adding a source

When a Case Bundle is added (ARCHITECTURE.md §7.7), the load, integrity, discovery and board stages run again as a new case version. `case_diff()` then matches the old and new results by stable keys: a cell's members, kind and window; a check's name and parameters. Each insight, lead, question and finding is marked **new**, **changed** (same key, different numbers, evidence or verdict) or **withdrawn**. A changed finding is superseded exactly as after a dispute (`supersedes` set, the old one `changed`), and its derivation gains a step naming the source and case version that changed it. Every confirmed claim whose check calls touch the new rows is re-checked with the same parameters.

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
- `Signal`, `Incident`, `Anchor`: kept in `types.ts` for the current mock only; the revision 4 board replaces them with insights, leads and questions
- `Dismissal`: `{ signal_id, reason, rule }`
- `Segment`: `{ kind: stay|travel|gap, person, place?, from?, to?, start, end, gap_type?, evidence_ids }`
- `Briefing` (the board): `{ integrity_issues[], incidents[] (insights in the mock), leads[], questions[], timeline[], dismissed[], case_version }`
- `DerivationStep.kind` gains `signal`, `grouped` and `follow_up`
- `Answer`: `{ text, verdict, findings[], steps[], suggestions[] }`

New in revision 3:
- `Statement`: `{ statement_id, person_id, text }`
- `Item`: `{ item_id, source: investigator|statement|transcript, source_ref, claimant, kind: claim|question, text, people, start, end, status }`
- `ReliabilityWindow`: `{ device_id, person, start, end, status: ok|suspect, reasons[], evidence_ids }`; `ClockOffset`: `{ device_id, offset_s, n_pairs, spread_s }`
- `Review`: `{ review_id, target, kind: checked|disputed, note, by, at }`
- `Finding` gains `item_id`, `claimant`, `reliability_note?`, `status: current|changed|withdrawn`, `supersedes?`
- `Report` gains `by_person[]` and `reliability_notes[]`
- `AgentEvent` gains `items_proposed` and `rerun`; `SubagentName` loses `report-writer`
- `Lead`: `{ lead_id, kind, cell, score, drivers[], evidence_ids, proposed_check?, status: open|promoted|dismissed, promoted_finding_id? }`; `GraphCell`: `{ cell_id, rank, kind, members, start, end, evidence_ids }`
- `Briefing` and `Report` gain `leads`; `Graph` gains `cells`; `Finding` gains `lead_id?`
- Revision 4: `IntegrityIssue`: `{ issue_id, kind, phones, start, end, summary, evidence_ids }`; `SuggestedQuestion`: `{ question_id, text, origin, check?, status, finding_id? }`; `CaseDiff`: `{ from_version, to_version, source, added, changed, withdrawn, rechecked_claims }`; `Finding` gains `question_id?`

`backend/schemas.py` must mirror these exactly.

---

## 9. Engineering checklist when adding a new check

1. Make it a pure function over the `v_*` views (and `stays`, for location checks), so it sees corrected timestamps and no disputed rows, with thresholds as named keyword arguments. It answers one fixed question and never concludes.
2. Return `evidence_ids` containing only rows the computation used.
3. Return every number a sentence could need, preformatted where the format matters (e.g. `gap_label`).
4. Write the verdict rule as code in `backend/checks/verdicts.py` so `apply_verdict_rule` can run it, and add it to §3 of this file.
5. Add a `verify.ts` case that recomputes the key numbers from raw rows.
6. Add an evidence view keyed by `check_output.kind`.
7. Say which lead kinds it can confirm, so suggested questions can use it (ARCHITECTURE.md §6.6).
8. Add a unit test against the answer key, covering one planted positive and one decoy in the generator, and add the check to the precision and recall table in `eval/run_eval.py`.
9. Give it to exactly one subagent, and add its `CheckName` to `types.ts` and `backend/schemas.py`.
