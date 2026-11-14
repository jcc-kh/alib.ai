# Datasets: which real case should Alib.ai run on?

This folder is for choosing a real multi-phone case to replace the synthetic Harbor Supply demo. It holds one page per candidate dataset and the scripts to fetch them cheaply.

All candidates are fictional training cases published through [NIST CFReDS](https://cfreds.nist.gov/all), so they meet Arlequin's "public or synthetic data only" rule.

Raw downloads go in `data/raw/`, which is git-ignored. Never commit phone data.

## Comparison

| Dataset | People and phones | Answer key | Download cost | Checked by us | Page |
|---|---|---|---|---|---|
| **MSAB 2026** | 2: Blaise (iPhone 12), Emily (Samsung S20). Employee and boss, same case | Yes: 40 questions, all answered | iPhone: 100 MB with our script. Samsung: 9 GB | iPhone databases fetched and opened | [msab-2026.md](datasets/msab-2026.md) |
| **Cellebrite 2023** | 4: Sharon, Abe, Russell, Felix | Yes: question list and a walkthrough per phone | Several GB per phone, Google Drive | Not opened (Drive blocked us) | [cellebrite-2023.md](datasets/cellebrite-2023.md) |
| **Cellebrite 2024** | 4: Otto, Felix, Russell, Sharon. Continues 2023 | Said to be on Cellebrite's notebook page, not confirmed | Unknown size, Google Drive | Not opened | [cellebrite-2024.md](datasets/cellebrite-2024.md) |
| **Cellebrite 2025** | 4 files, one is Anne Lockwood | Not found | About 24 GB per phone, Google Drive | Not opened | [cellebrite-2025.md](datasets/cellebrite-2025.md) |
| **NGDC 2012** | 2 main: Carry, Tracy, plus "Joe". Phones, tablet, laptop | Yes: instructor packet and a report per device | 30 to 200 MB per phone copy | Answer key and emails read | [ngdc-2012.md](datasets/ngdc-2012.md) |
| **MVS 2024** | 2: Rocco (Pixel 3), Chad (iPhone 14) | Partial: community write-ups | Unknown, and the CFReDS link may be wrong | Not opened | [mvs-2024.md](datasets/mvs-2024.md) |

Datasets we ruled out are in [others.md](datasets/others.md).

## Recommendation

**Start with MSAB 2026.**
- It's the only one where we have real data on disk today.
- Both people's phones are available, and they talk to each other across several apps.
- Every answer is published, so we can score the agent.
- The cost is 100 MB for the iPhone and 9 GB for the Samsung, from a normal server.

Its weaknesses:
- Only two people, so there is one relationship to cross-check.
- The iPhone has few text messages (25). Most of the conversation is in Signal and Snapchat, which need app-specific parsing. Signal's database is encrypted, and the key is in the keychain file that ships with the dataset.
- It has no bank transfers, so the `money_chains` check has nothing to run on.

**Add Cellebrite 2023 if we want four people.** It needs a signed-in browser download or a Colab notebook, because Google Drive blocks automated downloads of these files.

## What Alib.ai needs from a dataset

The ingest format is [Case Bundle v1](../schema/case-bundle-v1/README.md). Every real dataset needs an adapter that turns phone databases into that format. What each check needs:

| Check | Needs | MSAB 2026 iPhone |
|---|---|---|
| `missing_messages` | The same conversation on two phones | SMS on both; Signal after decryption |
| `distance_between`, `silent_meetings` | Location history on two phones | `Local.sqlite` and `cache_encryptedB.db` fetched, not yet parsed |
| `money_chains` | Transactions | None seen |
| `synchronised_behaviour` | Device events (app use, screen) | `knowledgeC.db` was not found at the usual path; `interactionC.db` has 259 rows |

## Fetching data

```bash
cd data/scripts
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# Blaise's iPhone 12: fetches about 100 MB out of a 50 GB file
python fetch_from_remote_zip.py https://msab26.hexordiactf.com/iPhone12.zip \
    --inner iPhone12FFS.zip --preset ios --out ../raw/msab-2026/iphone12

python summarize_ios.py ../raw/msab-2026/iphone12
```

`fetch_from_remote_zip.py` reads the zip's index with HTTP range requests and downloads only the files asked for. It always fetches each database's `-wal` and `-shm` files too, because recent rows live in the `-wal` file. Run it with `--list` to look around first. Details are in the script's header.

It only works on servers that support range requests, and only on nested zips that are stored uncompressed. That covers the MSAB iPhone. It doesn't cover Google Drive, so it can't be used for the Cellebrite sets.

## Answer keys

- Use them for grading only. Never put them in an agent prompt or a retrieval index.
- Write-ups for older cases are public, so a model may know the answers from training. Count an answer only when it cites real rows.
