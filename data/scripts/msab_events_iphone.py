#!/usr/bin/env python3
"""Extract Blaise's iPhone 12 (MSAB 2026) into one list of events.

  python msab_events_iphone.py ../raw/msab-2026/iphone12 ../raw/msab-2026/events_iphone.json

Each event: ts (UTC), dev, src, id (row id in the source table), who, text.
Sources: sms, call, mail, safari, google-search, note, voicememo, interaction.
The ids are the ones cited in datasets/msab-2026-storyline.md as B:<src>:<id>.
"""
import sqlite3, os, re, json, datetime, gzip, zlib, plistlib, sys
R=os.path.join(sys.argv[1],"iPhone12/Volumes/private/var")
allp=[os.path.join(d,f) for d,_,fs in os.walk(R) for f in fs]
def find(p): 
    r=[x for x in allp if re.search(p,x)]; return r[0] if r else None
def con(p): return sqlite3.connect(f"file:{p}?mode=ro",uri=True)
def A(s):
    if s is None: return None
    if s>1e12: s=s/1e9
    return (datetime.datetime(2001,1,1)+datetime.timedelta(seconds=s)).strftime("%Y-%m-%d %H:%M:%S")
def U(ms): return datetime.datetime.fromtimestamp(ms/1000,datetime.UTC).strftime("%Y-%m-%d %H:%M:%S")
ev=[]
def add(ts,src,rid,who,text): ev.append(dict(ts=ts,dev="blaise-iphone",src=src,id=str(rid),who=who,text=(text or "").replace("\n"," ⏎ ")))
def attr_text(b):
    if not b: return None
    i=b.find(b"NSString")
    if i<0: return None
    j=b.find(b"\x2b",i)
    if j<0: return None
    n=b[j+1]; k=j+2
    if n==0x81: n=int.from_bytes(b[j+2:j+4],"little"); k=j+4
    return b[k:k+n].decode("utf8","replace")
c=con(find(r"SMS/sms\.db$"))
rec={r[0] for r in c.execute("select message_id from chat_recoverable_message_join")}
for r in c.execute("select m.ROWID,m.date,m.is_from_me,h.id,m.service,m.text,m.attributedBody,m.date_read,m.date_delivered from message m left join handle h on m.handle_id=h.ROWID order by m.date"):
    t=r[5] or attr_text(r[6]) or "(no text)"
    add(A(r[1]),"sms",r[0],("Blaise→" if r[2] else "←")+str(r[3]),f"[{r[4]}{' RECENTLY-DELETED' if r[0] in rec else ''}] {t}")
c=con(find(r"CallHistory\.storedata$"))
for r in c.execute("select Z_PK,ZDATE,ZDURATION,ZORIGINATED,ZANSWERED,ZSERVICE_PROVIDER,ZNAME,ZADDRESS from ZCALLRECORD order by ZDATE"):
    ad=r[7].decode("utf8","replace") if isinstance(r[7],bytes) else r[7]
    add(A(r[1]),"call",r[0],("Blaise→" if r[3] else "←")+str(ad),f"{r[5].split('.')[-1]} dur={int(r[2] or 0)}s answered={r[4]} name={r[6]}")
ei=find(r"Mail/Envelope Index$"); pi=find(r"Mail/Protected Index$")
c=con(ei); c.execute(f"attach 'file:{pi}?mode=ro' as p")
try:
    for r in c.execute("select m.ROWID,m.date_sent,m.date_received,a.address,a.comment,s.subject,su.summary,m.deleted,m.read,mb.url from messages m left join p.addresses a on m.sender=a.ROWID left join p.subjects s on m.subject=s.ROWID left join p.summaries su on m.summary=su.ROWID left join mailboxes mb on m.mailbox=mb.ROWID order by m.date_received"):
        add(U(r[2]*1000) if r[2] else None,"mail",r[0],f"{r[4] or ''} <{r[3]}>",f"[{(r[9] or '').split('/')[-1]}{' DELETED' if r[7] else ''}] {r[5]} — {(r[6] or '')[:230]}")
except Exception as e: print("mail err",e)
c=con(find(r"Safari/History\.db$"))
for r in c.execute("select v.id,v.visit_time,i.url,v.title from history_visits v join history_items i on v.history_item=i.id order by v.visit_time"):
    add(A(r[1]),"safari",r[0],"Blaise",f"{r[3] or ''} | {r[2][:140]}")
p=find(r"GoogleMobile.*searchhistory\.db$") or find(r"searchhistory\.db$")
if p:
    for r in con(p).execute("select rowid,created,query,type from search_history"): add(A(r[1]) if r[1] and r[1]<1e9 else (U(r[1]*1000) if r[1] else None),"google-search",r[0],"Blaise",str(r[2]))
c=con(find(r"NoteStore\.sqlite$"))
cols=[x[1] for x in c.execute("pragma table_info(ZICCLOUDSYNCINGOBJECT)")]
tcol=[x for x in cols if x.startswith("ZTITLE")]; 
for r in c.execute(f"select o.Z_PK,o.ZCREATIONDATE3,o.ZMODIFICATIONDATE1,o.ZTITLE1,o.ZSNIPPET,d.ZDATA,o.ZMARKEDFORDELETION from ZICCLOUDSYNCINGOBJECT o join ZICNOTEDATA d on d.ZNOTE=o.Z_PK"):
    body=""
    try:
        raw=gzip.decompress(r[5]); body=" ".join(x.decode("utf8","ignore") for x in re.findall(rb"[\x20-\x7e\xc2-\xf4][\x20-\x7e\x80-\xbf\xc2-\xf4\n]{8,}",raw))[:500]
    except Exception as e: body=f"(body unreadable: {e})"
    add(A(r[1]) or A(r[2]),"note",r[0],"Blaise",f"TITLE={r[3]} DELETED={r[6]} | {body}")
p=find(r"CloudRecordings\.db$")
for r in con(p).execute("select Z_PK,ZDATE,ZDURATION,ZCUSTOMLABEL,ZENCRYPTEDTITLE,ZPATH from ZCLOUDRECORDING"): add(A(r[1]),"voicememo",r[0],"Blaise",f"{r[3]} / {r[4]} dur={int(r[2] or 0)}s {r[5]}")
c=con(find(r"interactionC\.db$"))
ic=[x[1] for x in c.execute("pragma table_info(ZINTERACTIONS)")]
for r in c.execute("select i.Z_PK,i.ZSTARTDATE,i.ZBUNDLEID,i.ZDIRECTION,s.ZDISPLAYNAME,s.ZIDENTIFIER,i.ZRECIPIENTCOUNT,i.ZDOMAINIDENTIFIER from ZINTERACTIONS i left join ZCONTACTS s on i.ZSENDER=s.Z_PK order by i.ZSTARTDATE"):
    add(A(r[1]),"interaction",r[0],f"{r[4]} ({r[5]})",f"{r[2].split('.')[-1]} dir={r[3]} rcpt={r[6]} dom={str(r[7])[:40]}")
json.dump(ev,open(sys.argv[2],"w"),ensure_ascii=False,indent=0)
import collections; print(collections.Counter(e["src"] for e in ev))
