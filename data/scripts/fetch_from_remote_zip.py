#!/usr/bin/env python3
"""Fetch a few files from a huge remote zip without downloading the whole thing.

Works when the server supports HTTP range requests. Handles two layouts:
  1. Files directly in the remote zip.
  2. Files in a zip nested inside the remote zip (--inner), as long as the
     inner zip is STORED (not compressed) in the outer one.

Examples (MSAB 2026 CTF, Blaise's iPhone 12: 50 GB remote, about 12 MB fetched):

  # See what is in the outer zip
  python fetch_from_remote_zip.py https://msab26.hexordiactf.com/iPhone12.zip --list

  # List files in the nested phone copy whose path contains "Library/SMS"
  python fetch_from_remote_zip.py https://msab26.hexordiactf.com/iPhone12.zip \
      --inner iPhone12FFS.zip --list --match Library/SMS

  # Fetch the default set of iOS databases, with their -wal and -shm files
  python fetch_from_remote_zip.py https://msab26.hexordiactf.com/iPhone12.zip \
      --inner iPhone12FFS.zip --preset ios --out ../raw/msab-2026/iphone12

SQLite keeps recent rows in <db>-wal until they are checkpointed, so the -wal
and -shm files are always fetched with each database. Keep them next to it.
"""
import argparse
import io
import os
import struct
import sys
import zipfile

import requests
from remotezip import RemoteZip

PRESETS = {
    # Core evidence only (about 100 MB on the MSAB iPhone 12)
    "ios": [
        "Library/SMS/sms.db",
        "Library/AddressBook/AddressBook.sqlitedb",
        "Library/CallHistoryDB/CallHistory.storedata",
        "Library/CoreDuet/People/interactionC.db",
        "Library/CoreDuet/Knowledge/knowledgeC.db",
        "Library/Accounts/Accounts3.sqlite",
        "Library/Safari/History.db",
        "Library/Mail/Envelope Index",
        "Library/Mail/Protected Index",
        "Library/Caches/com.apple.routined/Local.sqlite",
        "Library/Caches/com.apple.routined/Cloud-V2.sqlite",
        "Library/Caches/locationd/cache_encryptedB.db",
        "Media/PhotoData/Photos.sqlite",
        "Library/Notes/notes.sqlite",
        "NoteStore.sqlite",
        "ChatStorage.sqlite",          # WhatsApp
        "signal.sqlite",               # Signal (encrypted; key is in the keychain)
    ],
    # Every database plus the plists that name each app folder
    # (about 560 MB and 2,500 files on the MSAB iPhone 12; takes a few minutes)
    "ios-all": [
        ".db", ".sqlite", ".sqlite3", ".sqlitedb", ".storedata",
        "Library/Mail/Envelope Index", "Library/Mail/Protected Index",
        ".com.apple.mobile_container_manager.metadata.plist",
    ],
    "android": [
        "com.android.providers.telephony/databases/mmssms.db",
        "com.android.providers.contacts/databases/contacts2.db",
        "com.android.providers.contacts/databases/calllog.db",
        "com.google.android.apps.messaging/databases/bugle_db",
        "com.whatsapp/databases/msgstore.db",
        "com.whatsapp/databases/wa.db",
        "org.thoughtcrime.securesms/databases/signal.db",
        "com.instagram.android/databases/direct.db",
        "com.android.chrome/app_chrome/Default/History",
    ],
}
# System data that is large and holds no user evidence
SKIP = ("/MobileAsset", "/System/Library/", "pron_dict", "valid.sqlite3", "MapTiles")
SIDECARS = ("", "-wal", "-shm")


class RangedFile(io.RawIOBase):
    """Read-only file object over one byte span of a URL, using range requests."""

    def __init__(self, session, url, start, size):
        self.session, self.url, self.start, self.size, self.pos = session, url, start, size, 0

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def readinto(self, buf):
        n = min(len(buf), self.size - self.pos)
        if n <= 0:
            return 0
        a = self.start + self.pos
        r = self.session.get(self.url, headers={"Range": f"bytes={a}-{a + n - 1}"}, timeout=120)
        r.raise_for_status()
        buf[: len(r.content)] = r.content
        self.pos += len(r.content)
        return len(r.content)


def open_inner(url, inner_name):
    """Open a zip stored uncompressed inside the remote zip, without downloading it."""
    session = requests.Session()
    with RemoteZip(url) as outer:
        info = outer.getinfo(inner_name)
    if info.compress_type != zipfile.ZIP_STORED:
        sys.exit(
            f"'{inner_name}' is compressed inside the outer zip, so it cannot be read in place.\n"
            f"Download just that entry instead ({info.compress_size / 1e9:.1f} GB):\n"
            f"  python -c \"from remotezip import RemoteZip; RemoteZip('{url}').extract('{inner_name}', '.')\""
        )
    head = session.get(url, headers={"Range": f"bytes={info.header_offset}-{info.header_offset + 29}"}, timeout=60)
    head.raise_for_status()
    name_len, extra_len = struct.unpack("<HH", head.content[26:30])
    data_start = info.header_offset + 30 + name_len + extra_len
    raw = RangedFile(session, url, data_start, info.file_size)
    return zipfile.ZipFile(io.BufferedReader(raw, buffer_size=1 << 20))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url")
    p.add_argument("--inner", help="name of a zip nested (stored) inside the remote zip")
    p.add_argument("--list", action="store_true", help="list entries instead of fetching")
    p.add_argument("--match", action="append", default=[], help="path substring to list or fetch (repeatable)")
    p.add_argument("--preset", choices=PRESETS, help="fetch a standard set of databases")
    p.add_argument("--out", default="../raw/out", help="output folder (keep it under data/raw/, which is git-ignored)")
    args = p.parse_args()

    zf = open_inner(args.url, args.inner) if args.inner else RemoteZip(args.url)
    infos = zf.infolist()

    if args.list:
        shown = [i for i in infos if not args.match or any(m in i.filename for m in args.match)]
        for i in shown[:500]:
            print(f"{i.file_size / 1e6:10.2f} MB  {i.filename}")
        print(f"{len(shown)} of {len(infos)} entries, {sum(i.file_size for i in shown) / 1e9:.2f} GB uncompressed")
        return

    wanted = list(args.match) + (PRESETS[args.preset] if args.preset else [])
    if not wanted:
        sys.exit("Nothing to fetch: pass --preset or --match (or --list to look around).")
    suffixes = tuple(w + s for w in wanted for s in SIDECARS)
    os.makedirs(args.out, exist_ok=True)
    total = 0
    for i in infos:
        if i.is_dir() or not i.filename.endswith(suffixes) or any(k in i.filename for k in SKIP):
            continue
        dest = os.path.join(args.out, i.filename.strip("/"))  # keep the phone's own path
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with zf.open(i) as src, open(dest, "wb") as dst:
            dst.write(src.read())
        total += i.file_size
        print(f"{i.file_size / 1e3:10.1f} KB  {i.filename}")
    print(f"Fetched {total / 1e6:.1f} MB into {args.out}")


if __name__ == "__main__":
    main()
