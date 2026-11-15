# Alib.ai

*Alibi + AI = **Alib.ai**: it helps forensic investigators dissect messy phone data and see the patterns in it.*

**Load every phone in a case. Alib.ai sweeps them all and lays out who is connected, whose routine covers the scene, where every phone was when it mattered, what broke from routine, and who had a grievance. Every insight is one click from the rows behind it.**

> **The pitch.** Investigators see the world in pairs: this phone called that one. But what matters is often a group: three people acting together, money going round in a circle, two people who never talk yet always meet. Alib.ai organises the whole case into a topological structure and finds those patterns without being told what to look for. Then it does what no pattern-finder does on its own: patterns the data proves become findings, with every row cited; patterns it can't prove stay labelled as leads. **AI finds the shape; code decides what's evidence.** It runs on the mathematics topological neural networks are built on, without training; our generator produces the labelled cases a trained TNN needs next.

> Status: **clickable mock-up.** The UI runs on canned synthetic data with a simulated agent run. The real backend (ingest, checks, LangChain deepagents) is designed in [ARCHITECTURE.md](ARCHITECTURE.md) and plugs in behind the same API. Built for HackPrinceton (Arlequin Track 1, LangChain deepagents, Amazon).

---

## Why

Investigators often hold data from several phones in one case. Reading them by hand takes days, and some facts only show up when you compare phones. One example: a text that is still on the victim's phone but has been deleted from the phone it was sent to.

Alib.ai does that comparison and organises what it finds around the questions investigators already ask, using the visual methods police use on digital evidence:

| Question | Method it borrows | Main visual |
|---|---|---|
| Who is connected, and how? | Link chart (i2 Analyst's Notebook, Cellebrite Pathfinder), synced to a timeline | Portraits as nodes; calls, texts, money, deleted threads, meetings and hostile posts as links |
| Whose routine area includes the scene? | Activity space / anchor points from geographic profiling | Map with each phone's routine radius, the scene, and overlap with the victim's area |
| Where was every phone in the time-of-death window? | Alibi grid and suspect-journey map | Phone × 10-minute grid, plus each phone's track through the window |
| What broke from routine? | Pattern-of-life comparison, synchronised behaviour | That night against a normal night; the post-news deletions; location gaps |
| Who had a grievance? | Social media review for leakage and grievance | Every post, scored for hostility by a fixed classifier |

Every insight cites the exact data rows behind it, and every number can be recomputed in the browser from those rows.

## How it works

![Alib.ai system architecture](docs/architecture.png)

On case load:

1. **Integrity pass (code only).** Before anything else, the data is checked for signs it can't be taken at face value. Each phone's clock offset is estimated from calls that appear on both phones, and timestamps are corrected before messages are compared. Location fixes that imply impossible travel speeds, and GPS fixes far from the same phone's Wi-Fi or cell fixes, mark that phone and time window as *suspect*.
2. **Sweep (code only).** Every check runs across every pair of people and the whole date range. Each hit is saved as a *signal*, with the rows that support it.
3. **Discovery (network model).** Alongside the sweep, the whole case is organised into a combinatorial complex: people, numbers, accounts, places and things mentioned in messages, linked in pairs **and** in groups. Fixed topological operators spread information across those levels, and an unsupervised scorer ranks the most unusual structures: a relay through three phones, money going round in a circle, a group that keeps acting together, two people connected through others who never contact each other. Each becomes a **lead**, with its rows and a proposed check. No training and no labels; the same seed gives the same leads.
4. **Triage (agents).** Signals are grouped into incidents, and incidents are ranked by how many checks agree and how many phones are involved. Signals with an ordinary explanation are dismissed, with the reason recorded. Moments where three or more phones act together are flagged as anchors. Each top lead's proposed check is run: confirmed leads become findings, the rest stay labelled "pattern, not verified". The result is an **opening briefing**, on screen before you type anything.

Then it's a loop, not a pipeline. Investigators keep finding new evidence sources, so:

5. **Add a source, refine the board.** Each new source (another phone, for now) is ingested on its own, and only the checks it affects re-run. Everything on the **case board** is recomputed from the loaded sources: people whose phone isn't in yet appear as ghost nodes, a check runs once all the phones it needs are loaded, and what changed is marked on the board.
6. **Lines of inquiry.** Each insight and confirmed lead is filed under the question it answers (connections, routine areas, the time-of-death window, what changed, motive). Each question has its own page with the visual police use for it.
7. **Ask.** Free-form questions go to the same orchestrator; answers cite findings or say "can't tell" (including "can't tell yet" when the phone that would settle it hasn't been added).
8. **Review.** If you dispute a data row, it is excluded, every check that cited it reruns, and findings that changed are marked.

> The mock no longer includes hypothesis testing (parsing statements into claims and grading each one). [ARCHITECTURE.md](ARCHITECTURE.md) stages ③–⑤ still describe it as designed in revision 3; the team should decide whether to keep it in the backend.

**Discovery finds leads, code proves facts, and agents never compute.** Every comparison is a plain Python function that returns the rows it used, and every verdict comes from a rule in code. The agents decide *which* checks answer *which* question and write one plain sentence per finding. A code validator then rejects any sentence that:
- doesn't cite evidence, or cites a row the investigator disputed
- uses a number that didn't come from a check
- has a verdict different from the one the code rule gave
- rests on a suspect window without saying so
- cites a discovery lead that no check has confirmed

## The demo case (synthetic): Death at Pier 9

**Ravi Mehta**, owner of Harbor Supply Co., is found dead at the company's Pier 9 warehouse on 17 April at 07:40. The medical examiner puts the time of death between **21:00 and 23:30 on 16 April**. Five phones are seized, including Ravi's own, recovered at the scene.

| Person | Role |
|---|---|
| Ravi Mehta | Victim. Owner of Harbor Supply Co. |
| Paul Becker | Bookkeeper at Harbor Supply Co. |
| Amy Brooks | Ravi's estranged partner |
| Ken Walsh | Warehouse lead, let go by Ravi on 14 April |
| Cara Novak | Supplier to Harbor Supply Co. |

What the data holds (the answer key is in `frontend/src/mock/answerKey.ts`):
- At 18:05 Ravi's phone texted Paul: *"I've seen the Novak invoices. Pier 9, 9:30 tonight. Come alone."* Paul's phone came within 950 m of Pier 9 at 21:10 and was then off until 23:38.
- Amy's texts with Ravi that evening survive only on Ravi's phone; her phone had no location data from 21:40 to 22:50 while it called him twice.
- Paul paid Cara $4,800 as an "invoice" and $4,320 came back the same afternoon; their phones met four times with no call or text on record.
- Ken posted hostile comments about Ravi after losing his job, but his phone was at least 9 km from Pier 9 all evening. Motive is a lead, not presence.
- After a news alert at 09:05 on 17 April, three phones deleted threads within 35 minutes.
- Five decoys look suspicious but have ordinary explanations; the sweep sets all of them aside.

All people, companies, places and data are invented. The **portraits are GAN-generated faces of people who do not exist**, taken from public-domain files on Wikimedia Commons; see [frontend/public/portraits/CREDITS.md](frontend/public/portraits/CREDITS.md). Do not replace them with photos of real people.

## The agents

They are built with LangChain **deepagents** (`create_deep_agent`): one orchestrator on a stronger model and six domain subagents on a faster one. Every subagent returns structured `Finding` objects, with the verdict copied from a code rule and each number traced to a check-output field. The orchestrator reads them and can **chain** them: one subagent's result triggers a follow-up task for another. There is no report-writing agent, because the report is assembled in code, and no auditing agent, because `validate_report()` does that job.

| Agent | Owns | Checks |
|---|---|---|
| **orchestrator** | Triage on case load; parsing the brief and statements into claims; pausing for the investigator to confirm them; dispatching follow-ups; the next-steps paragraph | `confirm_items`, `propose_incidents`, `anchor_moments`, `rank_incidents`, `match_brief_item`, `get_coverage`, `get_reliability` (code helpers) |
| **relationship-mapper** | Identity matching across phones; the people map the others use; possible burner numbers; first reader of discovery leads, routing each proposed check | `identity_match`, `unresolved_identifiers`, `contact_graph`, `explain_lead` |
| **location-analyst** | Where each phone was | `presence_window`, `activity_space`, `location_timeline`, `location_gaps`, `distance_between`, `silent_meetings`, `group_meetings`† |
| **comms-analyst** | Messages and calls | `last_contacts`, `missing_messages`, `call_log_mismatch`*, `contact_went_quiet`*, `search_messages` |
| **financial-analyst** | Money | `money_chains`, `transfer_after_meeting`* |
| **device-forensics** | Deletions and power | `deletions`, `power_events`, `synchronised_behaviour` |
| **social-analyst** | Social media posts, comments and follows | `social_profile`, `social_hostility` (fixed local classifier; reports tension, never placement) |

Every subagent also gets `get_reliability`, `apply_verdict_rule`, `get_events`, `get_coverage` and the lead tools (`get_leads`, `explain_lead`, `promote_lead`).

\* optional, built if time allows. † stretch.

## The data format

Alib.ai ingests **Case Bundle v1**: one folder per phone, one JSONL file per record type. The record types are contacts, messages, calls, locations, transactions, device events, social accounts and social interactions. People are referenced by phone number, email or handle, and ingest works out who is who.

Any source can be supported by writing an adapter that outputs this format.

- Full spec: [schema/case-bundle-v1/README.md](schema/case-bundle-v1/README.md)
- Example: [schema/case-bundle-v1/example/](schema/case-bundle-v1/example/)

## Report rules

- **Verdicts:**
  - `confirmed`: data on at least two phones agrees.
  - `inconsistent`: the data contradicts the claim.
  - `cannot_tell`: the phones hold nothing that settles it. The agent says so instead of guessing.
- **Every statement cites evidence rows.** Each row shows its id, its source phone and its timestamp.
- **Leads are not findings.** A pattern discovery found is shown as "pattern, not verified", with its rows and the check that would confirm it. It gets a verdict only once that check confirms it.
- **Names stand for phones.** "Amy was at Northgate Mall" means Amy's phone was there. Every report states this once in its assumptions, because a phone's location is not proof of where its owner was.
- **"Inconsistent", never "lied" or "guilty".** The report describes data, and the investigator draws the conclusions. Words like "suspicious", "proves" and "clearly" are banned too.
- **Phone data is assumed genuine.** Spoofing detection is out of scope, and the report says so.

## Trust and transparency

Every finding can be checked by the person reading it. Each one opens with four tabs:

| Tab | What it gives you |
|---|---|
| **Evidence** | The picture: a map, a money chain, a thread diff, a timeline |
| **How we know** | The step-by-step derivation, marking which steps were plain code and which were the language model. It also shows where each number came from, which phones hold each fact, and the validator checks the sentence passed. |
| **Verify** | Your browser recomputes the key numbers from the raw rows, without trusting the check's own output, and shows ✓ or ✗ for each. Here you can also record "I checked this" or "I dispute this". A dispute excludes the row and reruns every check that cited it. |
| **Sources** | For each row: the bundle hash, file, line number and the original JSON line, so you can open the source file and find it |

Alib.ai also **briefs you before you ask.** As soon as the phones are loaded, it sweeps every pair and presents what stands out, ranked, with anchor moments, a week timeline, a per-person location timeline (stays, travel and gaps) and a relations graph. Location gaps are reported only as "no location data". A gap is raised by default only when the phone was clearly in use during it (`location_off`), because phones lose location for innocent reasons all the time. It also lists what it checked and dismissed, and why. You can **ask questions at any time.** Every answer cites its rows or says "cannot tell".

Engineers: see [DERIVATION.md](DERIVATION.md) for exactly how each statement is derived.

## Run the mock-up

Prerequisites: Node 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in Chrome on a laptop-size screen.

The dashboard opens on the case board at http://localhost:5173/#/pro/board, with two of the five seized phones already examined (Ravi's, recovered at the scene, and Paul's). Drill-down pages are `#/pro/connections`, `#/pro/radius`, `#/pro/window`, `#/pro/changes` and `#/pro/motive`; the case list is `#/pro/cases`.

### Click-path

1. **The board.** One page, pinned cards on a board:
   - **Relationships:** portraits as nodes, one line per tie, styled by strength (close, regular, occasional, hidden). Lines are labelled with the relationship from the case file or what the rows show, with badges for money, meetings without contact, deleted threads and hostile posts. People and lines appear only once that person's phone is examined. Click a person to see their ties; **click a line for every exchange between the two** (calls, texts, payments, times together, deletions, posts), filterable by kind, with which phones hold each copy.
   - **Insights:** ranked notes, each with an **Evidence** button.
   - **Unidentified until examined.** A person whose phone hasn't been examined shows as **?** with the first name other phones use (e.g. "Cara"); seized phones show only as **Phone 3/4/5**, and nothing says whose phone a waiting check needs. Adding a phone reveals its owner ("Phone 3 identified as Amy Brooks").
2. **Add evidence source** (top right). Pick the next phone (Amy, then Ken, then Cara), or drop any file. A progress bar runs through load, validate, normalise, resolve, store, re-run checks and update board. Then the new data drops in: the ghost turns solid, changed ties glow, new rows and circles slide in, and new or strengthened insights land with a **NEW** or **+ evidence** tag. A toast sums up what changed. The insight count goes 1 → 2 → 3 → 6.
3. **Expand ↗** on any card opens its line of inquiry (also in the top bar):
   - **Time of death:** one timeline of the week. Each day is split into blocks (morning, afternoon, evening; on 16 April also the time-of-death window and late night; then the morning after). One column per phone: where it was, who it was with, when it went dark and where it was last seen, what it deleted. Under each block, every call, text and payment between the people on the board. 13–15 April are collapsed to a one-line summary. A key above it uses the same chips; hide people to widen the columns (columns never go below 210 px; the timeline scrolls sideways instead). Click any entry for its evidence.
   - **Semantic analysis:** everything people on the board wrote (posts, comments, texts, group chats) tagged into five themes: threats or ill-wishing, grievance or blame, arranging to meet, money and accounts, pressure or distress. Click a theme to see its statements, with the matched words underlined. On the right, each person's tone over the week (daily hostility score of their posts) with a one-line read of how it changed; click a person to filter.
4. **Interviews** (top bar). Three transcripts (Paul, Amy, Ken). Verifying one reads it, highlights each checkable claim (opinions are dotted, not checked), then tests every claim against the examined phones. Click a claim for its breakdown: each check's method, what it found, source rows, and a step-by-step table of how the score was reached (start at 50%, each check shifts the odds ×10 / ×2 or ÷10 / ÷2, then the verdict rule and the confidence sum): **VERIFIED**, **UNVERIFIED** (can't conclude) or **DISPROVEN**. The **Model confidence** scorecard shows counts, mean confidence, checks run, every claim on a 0–100% scale, and agreement with the answer key. Verdicts recompute when phones are added (e.g. Paul's "I only deal with her over email" is unverified until Cara's phone is added, then disproven). Logic: `frontend/src/mock/interviews.ts`.
5. **Ask.** Try `Who was near the scene in the time-of-death window?`, or `Do Paul and Cara know each other?` before Cara's phone is added (it answers "can't tell yet").

**Reset demo** in the top bar returns to the two-phone start and clears verified transcripts and Ask. **Evidence** opens a drawer with two tabs: **Evidence** (what the rows show, in plain words) and **Sources (raw logs)** (file, line, raw JSON). It works for insights and for anything in the time-of-death timeline, every semantic-analysis statement and every interview check. Toggle light/dark with ☾ in the top bar.

## Status

| Part | State |
|---|---|
| UI: case board (relationship chart, insight notes with threads, maps, alibi grid, timelines), add-evidence-source loop, drill-down pages, Ask drawer, finding drawer, all evidence views | ✅ Built (mock data) |
| Transparency: derivation chain, number tracing, validator, corroboration matrix | ✅ Built (mock data) |
| Fact-check: in-browser recomputation from raw rows; row provenance | ✅ Built (works on any rows from `/api/evidence`) |
| API contract (`frontend/src/api/types.ts`) | ✅ Defined |
| Case Bundle v1 format and example | ✅ Defined |
| Revision 2: sweep → triage → brief refines; signals, incidents, anchors, dismissals; location timeline and typed gaps; follow-up chaining | ✅ Built in the mock |
| UI revamp: guided flow, Pro dashboard (light/dark), live agent network + envelopes, charts from computed rows | ✅ Built in the mock |
| Pivot to insight discovery: murder case (5 phones incl. the victim's), lines of inquiry (link chart, routine-area map, alibi grid, pattern of life, social hostility), 4 new checks, social-analyst, generated portraits | ✅ Built in the mock; Noir UI and hypothesis testing removed |
| Case board: sources added one at a time, board recomputed from loaded phones, ghost nodes, relationship ties and mutual connections, drop-in animation of what changed; replaces the Ingest → Analyse → Briefing flow | ✅ Built in the mock (`src/mock/sources.ts`, `src/ui/pro/board/`) |
| Background data: full week of messages, calls, locations, transactions per phone (seeded), counts computed | ✅ Built in the mock (`src/mock/background.ts`) |
| Revision 3: integrity pass, topological discovery and leads, statements, item confirmation, disputes that rerun checks, report assembled in code, hardened validator, multi-seed evaluation | ✅ Designed in [ARCHITECTURE.md](ARCHITECTURE.md); not yet in the mock |
| Synthetic data generator and answer key (gap plant G1 and its decoy, planted clock skew and spoofed GPS, a burner number, innocent noise, statements) | ⏳ Next |
| SQLite case store, integrity pass, checks and tests | ⏳ Next |
| Discovery: combinatorial complex, training-free topological scoring, leads (a trained TNN is a stretch) | ⏳ Next |
| deepagents orchestrator, subagents, briefing and Ask | ⏳ Next |
| Report assembly, validator, reviews and reruns | ⏳ Next |
| FastAPI with SSE | ⏳ Next |
| Multi-seed evaluation (precision and recall per check), and a head-to-head against a plain LLM given the same data | ⏳ Next |
| Ingest pipeline from Case Bundle v1 | Upstream; out of scope for this build |

**Open questions:**
- Does Arlequin accept a fully synthetic case for Track 1?
- Which models will the agents use: Anthropic API or Amazon Bedrock? They are configurable through the `ORCHESTRATOR_MODEL` and `SUBAGENT_MODEL` env vars.

**Decided:** the build runs on the synthetic case for now. [data/README.md](data/README.md) recommends MSAB 2026 as a later real case; it needs a Case Bundle adapter (ingest), which is out of scope for this build.

## Repo layout

```
README.md                  you are here
ARCHITECTURE.md            full engineering design
DERIVATION.md              how every statement is derived and traced to source
docs/architecture.png      system diagram (source: docs/architecture-diagram.html)
data/README.md             which real multi-phone case to use; recommends MSAB 2026
data/datasets/             one page per candidate dataset, plus schema dumps
data/scripts/              fetch phone databases cheaply, list their tables
schema/case-bundle-v1/     ingest format spec + example bundle
frontend/src/
  api/types.ts             the API contract (shared shapes)
  api/index.ts, mock.ts    swap point: mock today, FastAPI later (incl. analyseCase run stream)
  mock/                    planted case (data.ts), seeded background week (background.ts), stays (segments.ts),
                           presence / activity space / last contacts / contact graph (derived.ts),
                           findings (findings.ts), signals/insights (signals.ts), sources and the board (sources.ts),
                           answer key and scorecard (answerKey.ts)
  lib/                     aggregates.ts (chart series), verify.ts (in-browser recompute), format.ts
  state/caseStore.tsx      the case store: loaded sources, board, add-source progress, what changed
  components/              finding detail (4 tabs), evidence views, location lanes, portraits,
                           relationship chart and exchange list (board), presence (time-of-death) bars
  ui/pro/                  dashboard: shell, board/* (case board, cards, insight notes, threads, add source),
                           inquiries/* (one page per line of inquiry), charts, Ask panel
frontend/public/portraits/ GAN-generated faces (public domain) + CREDITS.md
```

These are planned and not yet created: `data/generate.py` (the synthetic generator), `backend/` (case store, integrity pass, checks, agents, report, API and tests) and `eval/` (multi-seed evaluation). See [ARCHITECTURE.md](ARCHITECTURE.md) §13.
