#!/usr/bin/env python3
"""Print a quick summary of the iOS databases fetched by fetch_from_remote_zip.py.

  python summarize_ios.py ../raw/msab-2026/iphone12

Opens each database read-only, with its -wal file, wherever it sits under the folder.
"""
import datetime
import os
import sqlite3
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."


def find(name):
    for d, _, files in os.walk(root):
        if name in files:
            return os.path.join(d, name)


def q(name, sql):
    path = find(name)
    if not path:
        return "not fetched"
    try:
        return sqlite3.connect(f"file:{path}?mode=ro", uri=True).execute(sql).fetchall()
    except sqlite3.Error as e:
        return f"error: {e}"


def apple_time(v):
    """Apple timestamps count from 2001-01-01, in seconds or nanoseconds."""
    return datetime.datetime(2001, 1, 1) + datetime.timedelta(seconds=v / 1e9 if v > 1e12 else v)


print("Messages (total, sent by owner):", q("sms.db", "select count(*), sum(is_from_me) from message"))
print("  by service:", q("sms.db", "select service, count(*) from message group by 1"))
span = q("sms.db", "select min(date), max(date) from message where date > 0")
if isinstance(span, list) and span[0][0]:
    print("  span:", apple_time(span[0][0]), "to", apple_time(span[0][1]))
print("  top partners:", q("sms.db", "select h.id, count(*) n from message m join handle h on m.handle_id = h.ROWID group by 1 order by n desc limit 8"))
print("Calls by app:", q("CallHistory.storedata", "select ZSERVICE_PROVIDER, count(*) from ZCALLRECORD group by 1"))
print("Contacts:", q("AddressBook.sqlitedb", "select First, Last, Organization from ABPerson"))
print("Accounts:", q("Accounts3.sqlite", "select t.ZACCOUNTTYPEDESCRIPTION, count(*) from ZACCOUNT a join ZACCOUNTTYPE t on a.ZACCOUNTTYPE = t.Z_PK group by 1"))
print("Interactions by app:", q("interactionC.db", "select ZBUNDLEID, count(*) from ZINTERACTIONS group by 1 order by 2 desc limit 10"))
