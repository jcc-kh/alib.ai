# Alib.ai

*Alibi + AI = **Alib.ai**: it helps forensic investigators dissect messy phone data and see the patterns in it.*

**Load every phone in a case. Alib.ai sweeps them all and lays out who is connected, whose routine covers the scene, where every phone was when it mattered, what broke from routine, and who had a grievance. Every insight is one click from the rows behind it.**

> **The pitch.** Investigators see the world in pairs: this phone called that one. But what matters is often a group: three people acting together, money going round in a circle, two people who never talk yet always meet. Alib.ai organises the whole case into a topological structure and finds those patterns without being told what to look for. Then it does what no pattern-finder does on its own: patterns the data proves become findings, with every row cited; patterns it can't prove stay labelled as leads. **AI finds the shape; code decides what's evidence.** It runs on the mathematics topological neural networks are built on, without training; our generator produces the labelled cases a trained TNN needs next.

> Status: **clickable mock-up.** The UI runs on canned synthetic data with a simulated agent run. The real backend (loading, integrity, discovery, checks, LangChain deepagents) is designed in [ARCHITECTURE.md](ARCHITECTURE.md) and plugs in behind the same API. The mock shows the briefing and lines-of-inquiry flow; the target is the pinboard described below. Built for HackPrinceton (Arlequin Track 1, LangChain deepagents, Amazon).

---

## Why

Investigators often hold data from several phones in one case. Reading them by hand takes days, and some facts only show up when you compare phones. One example: a text that is still on the victim's phone but has been deleted from the phone it was sent to.

Alib.ai does that comparison, and goes further. As soon as the phones are loaded, it checks whether the data can be trusted and builds a network of the whole case. It then opens on a **pinboard**: the network front and centre, with data problems, the patterns it found and the questions they raise pinned to it, before the investigator types anything. From there the investigator can add new sources, check what people have said, or ask questions. Every finding cites the exact data rows behind it.

From the pinboard, insights are also filed under the questions investigators already ask, each with the visual method police use for it (the **lines of inquiry**):

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

**On load, and again whenever a source is added:**

1. **Load (code).** Case Bundles are validated and loaded, with every row's source file and line kept.
2. **Integrity (code only).** Can the data be taken at face value, and do the phones agree? Each phone's clock offset is estimated from calls that appear on both phones, and timestamps are corrected. Location fixes that imply impossible travel speeds, and GPS fixes far from the same phone's Wi-Fi or cell fixes, mark that phone and window as *suspect*. Messages, calls and transfers present on one phone and missing from the other are flagged.
3. **Discovery (network model).** The whole case is organised into a combinatorial complex: people, numbers, accounts, places and things mentioned in messages, linked in pairs **and** in groups. Fixed topological operators spread information across those levels, and an unsupervised scorer ranks the most unusual structures: a relay through three phones, money going round in a circle, a group that keeps acting together, two people connected through others who never contact each other. Each becomes a **lead**. No training and no labels; the same seed gives the same leads.
4. **The pinboard.** Integrity issues and leads are ranked as insights. Each top lead's check runs straight away: confirmed leads become findings, the rest stay labelled "pattern, not verified". Every open lead and issue raises a **suggested question** with a check behind it, so the network tells you what to ask; one click answers it.

**From the pinboard, three ways in:**

- **A. Add a source.** Upload another Case Bundle, for example a phone seized later. Steps 1–4 run again, and the board highlights what is new or changed and re-checks any claims the new data touches.
- **B. Verify claims.** Paste what people said, or (stretch) an interview transcript. The agent splits it into separate claims, each attributed to whoever made it; **you approve or edit the list**; then each claim is checked and comes back **Supported**, **Contradicted** or **Can't tell**, grouped by person.
- **C. Ask.** A chat about the case. Every answer cites its rows or says "can't tell".
- **Lines of inquiry.** Each insight and confirmed lead is also filed under the question it answers (connections, routine areas, the time-of-death window, what changed, motive), each on its own page.

At any time, **review**: dispute a data row, and every check that cited it reruns.

**Discovery finds leads, code proves facts, and agents never compute.** Every comparison is a plain Python function that returns the rows it used, and every verdict comes from a rule in code. Checks run on demand, when a lead, question, claim or chat needs one. The agents decide *which* checks answer *which* claim and write one plain sentence per finding. A code validator then rejects any sentence that:
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

**Adding a source, live.** The demo opens with four phones loaded; **Cara's phone is added mid-demo** as a new source, and the board highlights what it changes: her side of the round-trip payment and of the four meetings with Paul's phone, and any of the post-news deletions made on her phone.

**Claims to verify** are pre-filled, for example:
- Ken: "I was nowhere near the pier that night." (Supported: his phone was at least 9 km away all evening)
- Paul: "Ravi never asked to meet me." (Contradicted: the 18:05 text is on Ravi's phone)
- Amy: "I didn't speak to Ravi that evening." (Contradicted: her texts survive on Ravi's phone, and her phone called him twice)
- Amy: "I was at home from 21:40 to 22:50." (Can't tell: her phone has no location data then)

All people, companies, places and data are invented. The **portraits are GAN-generated faces of people who do not exist**, taken from public-domain files on Wikimedia Commons; see [frontend/public/portraits/CREDITS.md](frontend/public/portraits/CREDITS.md). Do not replace them with photos of real people.

## The agents

They are built with LangChain **deepagents** (`create_deep_agent`): one orchestrator on a stronger model and six domain subagents on a faster one. Every subagent returns structured `Finding` objects, with the verdict copied from a code rule and each number traced to a check-output field. The orchestrator reads them and can **chain** them: one subagent's result triggers a follow-up task for another. There is no report-writing agent, because the report is assembled in code, and no auditing agent, because `validate_report()` does that job.

| Agent | Owns | Checks |
|---|---|---|
| **orchestrator** | Parsing claims and transcripts; pausing for the investigator to confirm them; dispatching checks and follow-ups; answering chat questions; the next-steps paragraph | `confirm_items`, `match_claim`, `rank_insights`, `answer_question`, `get_coverage`, `get_reliability`, `get_leads`, `search_case` (code helpers) |
| **relationship-mapper** | Identity matching across phones; the people map the others use; possible burner numbers; first reader of discovery leads, routing each proposed check | `identity_match`, `unresolved_identifiers`, `contact_graph`, `explain_lead` |
| **location-analyst** | Where each phone was | `presence_window`, `activity_space`, `location_timeline`, `location_gaps`, `distance_between`, `silent_meetings`, `group_meetings`† |
| **comms-analyst** | Messages and calls | `last_contacts`, `missing_messages`, `call_log_mismatch` (both run in the integrity layer), `contact_went_quiet`*, `search_messages` |
| **financial-analyst** | Money | `money_chains` (including round trips), `one_sided_transfers`, `transfer_after_meeting`* |
| **device-forensics** | Deletions and power | `deletions`, `power_events`, `synchronised_behaviour` |
| **social-analyst** | Social media posts, comments and follows | `social_profile`, `social_hostility` (fixed local classifier; reports tension, never placement) |

Every subagent also gets `get_reliability`, `apply_verdict_rule`, `get_events`, `get_coverage` and the lead tools (`get_leads`, `explain_lead`, `promote_lead`).

\* optional, built if time allows. † stretch.

## The data format

Alib.ai ingests **Case Bundle v1**: one folder per phone, one JSONL file per record type. The record types are contacts, messages, calls, locations, transactions, device events, social accounts and social interactions. People are referenced by phone number, email or handle, and loading works out who is who. A bundle can be added at any time during an investigation.

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

Alib.ai also **tells you what to look at before you ask.** As soon as the phones are loaded, the pinboard shows how far to trust the data (clock corrections, suspect windows, messages missing from one phone), the patterns the network found, and the questions they raise, each one click from an answer. A per-person location timeline (stays, travel and gaps) opens from any pin. Location gaps are reported only as "no location data". A gap is pinned by default only when the phone was clearly in use during it (`location_off`), because phones lose location for innocent reasons all the time. It also lists what it dismissed, and why. You can **ask questions at any time.** Every answer cites its rows or says "can't tell".

Engineers: see [DERIVATION.md](DERIVATION.md) for exactly how each statement is derived.

## Run the mock-up

Prerequisites: Node 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in Chrome on a laptop-size screen.

The dashboard opens on the case list at http://localhost:5173/#/pro/. Deep links such as `#/pro/review` (briefing), `#/pro/window` or `#/pro/connections` load the completed demo case automatically.

### Click-path (current mock)

The mock follows the briefing and lines-of-inquiry flow; the pinboard, add-a-source and verify-claims screens of revision 4 come with the backend.

0. **Cases.** Open **Death at Pier 9** to jump to its briefing, or click **+ Create new case**.
1. **Ingest.** Name the case, click **Load sample bundle**, then pick the days to analyse. Counts per phone are computed from the rows.
2. **Analyse.** Watch the sweep and triage live: an agent network (bundle → orchestrator → people map → location, messages, money, device and social agents → triage → write-up → **Main findings**), a run log, and a timeline of what each agent did. Click a finished agent to open its envelope (`findings/*.json`).
3. **Briefing.** The victim, the time-of-death facts, the four persons of interest with their phones' status in the window, the six insights (each linked to its line of inquiry), the alibi grid at a glance, and the scorecard against the answer key.
4. **Lines of inquiry** (left rail):
   - **Who is connected, and how?** Link chart with portraits; filter by channel; click days on the strip to set the time window; click a link for every interaction behind it.
   - **Whose routine area includes the scene?** Routine-area circles on a map, overlap with the victim's area, and distance to the scene through the evening.
   - **Where was every phone in the time-of-death window?** Alibi grid, each phone's journey on the map, the location timeline for that night, and the victim's last contacts.
   - **What broke from routine?** That night against a normal night, the post-news deletions, the week's activity, and every location gap with why it was or wasn't raised.
   - **Who had a grievance?** Every post on a timeline coloured by hostility score, the flagged posts, and each account's status in the window.
5. **Ask.** Try `Who was near the scene in the time-of-death window?` or `Did Paul and Ravi argue last year?` (the second returns can't tell).

Every insight opens the finding drawer: Evidence · How we know · Verify (recompute from raw rows) · Sources (file, line, raw JSON). Toggle light/dark with ☾ in the top bar.

## Status

| Part | State |
|---|---|
| UI: Ingest, Briefing, Investigate, Ask drawer, finding drawer, all evidence views | ✅ Built (mock data) |
| Transparency: derivation chain, number tracing, validator, corroboration matrix | ✅ Built (mock data) |
| Fact-check: in-browser recomputation from raw rows; row provenance | ✅ Built (works on any rows from `/api/evidence`) |
| API contract (`frontend/src/api/types.ts`) | ✅ Defined |
| Case Bundle v1 format and example | ✅ Defined |
| Revision 2: sweep → triage → brief refines; signals, incidents, anchors, dismissals; location timeline and typed gaps; follow-up chaining | ✅ Built in the mock |
| UI revamp: guided flow, Pro dashboard (light/dark), live agent network + envelopes, charts from computed rows | ✅ Built in the mock |
| Pivot to insight discovery: murder case (5 phones incl. the victim's), lines of inquiry (link chart, routine-area map, alibi grid, pattern of life, social hostility), 4 new checks, social-analyst, generated portraits | ✅ Built in the mock; Noir UI and hypothesis testing removed |
| Background data: full week of messages, calls, locations, transactions per phone (seeded), counts computed | ✅ Built in the mock (`src/mock/background.ts`) |
| Revision 3: integrity pass, topological discovery and leads, statements, item confirmation, disputes that rerun checks, report assembled in code, hardened validator, multi-seed evaluation | ✅ Designed in [ARCHITECTURE.md](ARCHITECTURE.md); not yet in the mock |
| Revision 4: the pinboard flow (network first, checks on demand, suggested questions, add a source, verify claims, Ask) | ✅ Designed in [ARCHITECTURE.md](ARCHITECTURE.md); not yet in the mock |
| Synthetic data generator and answer key (gap plant G1 and its decoy, planted clock skew and spoofed GPS, a burner number, innocent noise, higher-order patterns, statements; Cara's phone held back as a second bundle) | ⏳ Next |
| Case Bundle loading with case versions; SQLite case store, integrity layer, checks and tests | ⏳ Next |
| Discovery: combinatorial complex, training-free topological scoring, leads (a trained TNN is a stretch) | ⏳ Next |
| The board: insights, suggested questions, adding a source with a diff | ⏳ Next |
| deepagents orchestrator and subagents: claim verification and Ask | ⏳ Next |
| Report assembly, validator, reviews and reruns | ⏳ Next |
| FastAPI with SSE; the pinboard front end | ⏳ Next |
| Multi-seed evaluation (precision and recall per check), and a head-to-head against a plain LLM given the same data | ⏳ Next |
| Adapters from raw phone databases (iOS, Android) to Case Bundle v1 | Out of scope for this build |

**Open questions:**
- Does Arlequin accept a fully synthetic case for Track 1?
- Which models will the agents use: Anthropic API or Amazon Bedrock? They are configurable through the `ORCHESTRATOR_MODEL` and `SUBAGENT_MODEL` env vars.

**Decided:** the build runs on the synthetic case for now. [data/README.md](data/README.md) recommends MSAB 2026 as a later real case; it needs an adapter from raw phone databases to Case Bundle v1, which is out of scope for this build.

## Repo layout

```
README.md                  you are here
ARCHITECTURE.md            full engineering design
DERIVATION.md              how every statement is derived and traced to source
docs/architecture.png      system diagram (source: docs/architecture-diagram.html)
data/README.md             which real multi-phone case to use; recommends MSAB 2026
data/datasets/             one page per candidate dataset, plus schema dumps
data/scripts/              fetch phone databases cheaply, list their tables
schema/case-bundle-v1/     Case Bundle format spec + example bundle
frontend/src/
  api/types.ts             the API contract (shared shapes)
  api/index.ts, mock.ts    swap point: mock today, FastAPI later (incl. analyseCase run stream)
  mock/                    planted case (data.ts), seeded background week (background.ts), stays (segments.ts),
                           presence / activity space / last contacts / contact graph (derived.ts),
                           findings (findings.ts), signals/insights (signals.ts), run script (run.ts),
                           answer key and scorecard (answerKey.ts)
  lib/                     aggregates.ts (chart series), verify.ts (in-browser recompute), format.ts
  state/caseStore.tsx      the case-flow store
  components/              finding detail (4 tabs), evidence views, location lanes, portraits,
                           relationship graph, radius map, presence (alibi) grid
  ui/pro/                  dashboard: shell, steps/* (ingest, analyse, briefing, ask),
                           inquiries/* (one page per line of inquiry), charts, envelope drawer, Ask panel
frontend/public/portraits/ GAN-generated faces (public domain) + CREDITS.md
```

These are planned and not yet created: `data/generate.py` (the synthetic generator), `backend/` (case store, integrity pass, checks, agents, report, API and tests) and `eval/` (multi-seed evaluation). See [ARCHITECTURE.md](ARCHITECTURE.md) §13.
