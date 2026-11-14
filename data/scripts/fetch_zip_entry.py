#!/usr/bin/env python3
"""Download ONE entry of a remote zip (resumable), instead of the whole file.

Use it when the phone copy is compressed inside the outer zip, so
fetch_from_remote_zip.py cannot read it in place.

  # Emily's Samsung S20: 9 GB instead of the 39 GB outer file
  python fetch_zip_entry.py https://msab26.hexordiactf.com/SamsungS20.zip \
      SamsungS20FFS.zip ../raw/msab-2026/samsungs20/SamsungS20FFS.zip

Rerun the same command to resume an interrupted download.
"""
import os
import struct
import sys
import zipfile
import zlib

import requests
from remotezip import RemoteZip

url, name, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
with RemoteZip(url) as z:
    info = z.getinfo(name)
session = requests.Session()
head = session.get(url, headers={"Range": f"bytes={info.header_offset}-{info.header_offset + 29}"}, timeout=60).content
name_len, extra_len = struct.unpack("<HH", head[26:30])
start, size = info.header_offset + 30 + name_len + extra_len, info.compress_size

raw = out + ".raw"
have = os.path.getsize(raw) if os.path.exists(raw) else 0
print(f"{name}: {size / 1e9:.2f} GB to download, {have / 1e9:.2f} GB already here", flush=True)
while have < size:
    try:
        r = session.get(url, headers={"Range": f"bytes={start + have}-{start + size - 1}"}, stream=True, timeout=120)
        r.raise_for_status()
        with open(raw, "ab") as f:
            for chunk in r.iter_content(1 << 22):
                f.write(chunk)
                have += len(chunk)
                if have % (1 << 29) < (1 << 22):
                    print(f"  {have / 1e9:.2f} / {size / 1e9:.2f} GB", flush=True)
    except requests.RequestException as e:
        print("connection dropped, resuming:", e, flush=True)

if info.compress_type == zipfile.ZIP_STORED:
    os.replace(raw, out)
else:
    inflater = zlib.decompressobj(-15)
    with open(raw, "rb") as f, open(out, "wb") as o:
        while chunk := f.read(1 << 24):
            o.write(inflater.decompress(chunk))
        o.write(inflater.flush())
    os.remove(raw)
print("done:", out, f"{os.path.getsize(out) / 1e9:.2f} GB")
