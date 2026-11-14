# Cellebrite CTF 2025

Nothing in this dataset has been opened by us.

## Files
Four Google Drive files. The first is `2025CellebriteCTF_AnneLockwood.zip`, **23.8 GB**. If the others are similar, the set is about 100 GB.

- https://drive.google.com/file/d/1Q9HZFYiB4iZx98DkNSv6MCTIOHfra8fB/view (Anne Lockwood)
- https://drive.google.com/file/d/1jM5a7Qen1NKyY8ucOgNi0eJhnuj4qgxl/view
- https://drive.google.com/file/d/1Qrq8q1xS4kxZBs4qGxlk90rtHHhn1ogj/view
- https://drive.google.com/file/d/1LFFU9iY2Cj_2MLmNrF_przoPsLfQi4-V/view

No password is listed. CFReDS tags it iOS.

## Answer key
Not found. A recap of Cellebrite's wrap-up video says walkthroughs are on https://cellebrite.com/the-101/resources/notebook/. Contact: ctf@cellebrite.com.

## Data shape
Not verified, because we have not opened these files. Each file should be a zip of one phone's full file system: iPhone, by the CFReDS tag. Expect the standard layout in [schemas/README.md](schemas/README.md): one SQLite database per app, with the texts, calls, contacts and chat apps at the paths listed there. The [MSAB 2026 listings](msab-2026.md) show what a real iPhone and a real Android copy look like in practice.

## Fit for Alib.ai
- **Good:** the newest case, so a model is least likely to know it. Useful as a held-out test.
- **Weak:** very large; no confirmed story or answers.
