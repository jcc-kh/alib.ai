# Datasets: which real case should Alib.ai run on?

This folder is for choosing a real multi-phone case to replace the synthetic Harbor Supply demo. It holds one page per candidate dataset and the scripts to fetch them cheaply.

All candidates are fictional training cases published through [NIST CFReDS](https://cfreds.nist.gov/all), so they meet Arlequin's "public or synthetic data only" rule.

Raw downloads go in `data/raw/`, which is git-ignored. Never commit phone data.

## Comparison

| Dataset | People and phones | Answer key | Download cost | Checked by us | Page |
|---|---|---|---|---|---|
| **MSAB 2026** | 2: Blaise (iPhone 12), Emily (Samsung S20). Employee and boss, same case | Yes: 40 questions, all answered | iPhone: 560 MB with our script. Samsung: 9 GB | **Both phones downloaded; all 2,370 databases listed; the same conversations confirmed on both** | [msab-2026.md](datasets/msab-2026.md) |
| **Cellebrite 2023** | 4: Sharon, Abe, Russell, Felix | Yes: question list and a walkthrough per phone | Several GB per phone, Google Drive | Not opened (Drive blocked us) | [cellebrite-2023.md](datasets/cellebrite-2023.md) |
| **Cellebrite 2024** | 4: Otto, Felix, Russell, Sharon. Continues 2023 | Said to be on Cellebrite's notebook page, not confirmed | Unknown size, Google Drive | Case document read; phones not opened | [cellebrite-2024.md](datasets/cellebrite-2024.md) |
| **Cellebrite 2025** | 4 files, one is Anne Lockwood | Not found | About 24 GB per phone, Google Drive | Not opened | [cellebrite-2025.md](datasets/cellebrite-2025.md) |
| **NGDC 2012** | 2 main: Carry, Tracy, plus "Joe". Phones, tablet, laptop | Yes: instructor packet and a report per device | 200 MB per phone copy, but they are raw disk images | Answer key and emails read; one phone copy opened (raw partitions, not parsed) | [ngdc-2012.md](datasets/ngdc-2012.md) |
| **MVS 2024** | 2: Rocco (Pixel 3), Chad (iPhone 14) | Partial: community write-ups | Unknown, and the CFReDS link may be wrong | Not opened | [mvs-2024.md](datasets/mvs-2024.md) |

Datasets we ruled out are in [others.md](datasets/others.md).

## Recommendation

**Use MSAB 2026.** It is the only candidate where we have both phones on disk and have confirmed the core requirement: the same conversations appear on both phones.

- Blaise and Emily's text thread is on both phones (12 rows on his, 15 on hers), with differences in counts and times to explain.
- Their Signal chat is readable in plain text on Emily's phone. Blaise's copy is encrypted.
- Their Instagram messages are on both phones.
- Every answer is published, so we can score the agent.
- Both phones cost about 9.5 GB to fetch, from a normal server.

Its weaknesses:
- Only two people, so there is one relationship to cross-check.
- Small volumes: tens of messages per channel, not thousands.
- No money transfers between them, so the `money_chains` check has nothing to run on.
- Weak location data on the iPhone (no GPS track; 2 of 4,120 photos have coordinates).

**Add Cellebrite 2023 if we want four people.** It needs a signed-in browser download or a Colab notebook, because Google Drive blocks automated downloads of these files.

## What Alib.ai needs from a dataset

The ingest format is [Case Bundle v1](../schema/case-bundle-v1/README.md). Every real dataset needs an adapter that turns phone databases into that format.

| Check | Needs | MSAB 2026 |
|---|---|---|
| `missing_messages` | The same conversation on two phones | Yes: texts today; Signal and Instagram after decoding the iPhone side |
| `distance_between`, `silent_meetings` | Location history on two phones | Weak on the iPhone; the Samsung is unchecked |
| `money_chains` | Transactions | None between the two people |
| `synchronised_behaviour` | Device events (app use, screen) | Possible: needs the iPhone's Biome files and the Samsung's `usagestats` parsed |

## Data shapes

- [datasets/schemas/README.md](datasets/schemas/README.md): the standard layout of an iOS or Android phone copy, where each kind of evidence lives, timestamp formats, and what a Case Bundle adapter has to map. Use this for the datasets we have not opened.
- [datasets/schemas/msab-2026-iphone12.md](datasets/schemas/msab-2026-iphone12.md): every table, row count and column in Blaise's iPhone (641 databases with data).
- [datasets/schemas/msab-2026-samsungs20.md](datasets/schemas/msab-2026-samsungs20.md): the same for Emily's Samsung (1,366 databases with data).

The two generated listings are large (about 600 KB and 850 KB). Search them for a table or app name; don't read them top to bottom.

## Fetching data

```bash
cd data/scripts
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
```

| Script | What it does |
|---|---|
| `fetch_from_remote_zip.py` | Fetches chosen files from a huge remote zip using HTTP range requests. `--preset ios` is the core set (100 MB), `--preset ios-all` is every database (560 MB). `--list` looks around first |
| `fetch_zip_entry.py` | Downloads one entry of a remote zip, resumably. For phone copies that are compressed inside the outer zip |
| `extract_dbs_from_zip.py` | Pulls every database out of a local phone-copy zip |
| `dump_schema.py` | Writes the table, row-count and column listing for a folder of databases |
| `fetch_gdrive.sh` | Downloads Google Drive files by id, skipping any that Drive refuses. Drive often blocks these files, so expect to fall back to a browser |
| `summarize_ios.py` | Prints message, call, contact and account counts for an iPhone |

The exact commands for both MSAB phones are in [datasets/msab-2026.md](datasets/msab-2026.md).

The fetch scripts always take each database's `-wal` and `-shm` files too, because recent rows live in the `-wal` file. They only work on servers that support range requests. That doesn't include Google Drive, so they can't be used for the Cellebrite sets.

## Answer keys

- Use them for grading only. Never put them in an agent prompt or a retrieval index.
- Write-ups for older cases are public, so a model may know the answers from training. Count an answer only when it cites real rows.
