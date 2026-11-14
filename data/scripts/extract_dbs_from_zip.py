#!/usr/bin/env python3
"""Pull every database out of a local phone-copy zip, keeping the phone's folder paths.

  python extract_dbs_from_zip.py ../raw/msab-2026/samsungs20/SamsungS20FFS.zip \
      ../raw/msab-2026/samsungs20/extracted

Takes anything in a `databases/` folder, anything ending .db/.sqlite/.sqlite3
(with -wal, -shm and -journal files), browser `History` files and Android
`usagestats`. Skips files over 120 MB.
"""
import os
import re
import sys
import zipfile

src, out = sys.argv[1], sys.argv[2]
WANT = re.compile(r"(/databases/[^/]+$|\.(db|sqlite|sqlite3|sqlitedb|storedata)(-wal|-shm|-journal)?$|/Default/History$|/usagestats/)", re.I)
n = total = 0
with zipfile.ZipFile(src) as z:
    for i in z.infolist():
        if i.is_dir() or not WANT.search(i.filename) or i.file_size > 120e6:
            continue
        dest = os.path.join(out, i.filename.strip("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with z.open(i) as s, open(dest, "wb") as d:
            d.write(s.read())
        n += 1
        total += i.file_size
print(f"extracted {n} files, {total / 1e6:.0f} MB, into {out}")
