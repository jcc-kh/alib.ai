#!/usr/bin/env python3
"""Extract Emily's Samsung S20 (MSAB 2026) into one list of events.

  python msab_events_samsung.py ../raw/msab-2026/samsungs20/extracted ../raw/msab-2026/events_samsung.json

Each event: ts (UTC), dev, src, id (row id in the source table), who, text.
Sources: gmessages, sms, call, signal, instagram, chrome, edge, brave-SECUREFOLDER
(and their -search terms), notesapp, x-search, contact, vestiaire.
The ids are the ones cited in datasets/msab-2026-storyline.md as E:<src>:<id>.
"""
import sqlite3, os, re, json, datetime, sys
R=os.path.join(sys.argv[1],"SamsungS20/Volumes/userdata")
def con(p): return sqlite3.connect(f"file:{R}/{p}?mode=ro",uri=True)
def U(ms,div=1000):
    try: return datetime.datetime.fromtimestamp(ms/div,datetime.UTC).strftime("%Y-%m-%d %H:%M:%S")
    except Exception: return None
def W(us): return (datetime.datetime(1601,1,1)+datetime.timedelta(microseconds=us)).strftime("%Y-%m-%d %H:%M:%S") if us else None
ev=[]
def add(ts,src,rid,who,text): ev.append(dict(ts=ts,dev="emily-samsung",src=src,id=str(rid),who=who,text=(text or "").replace("\n"," ⏎ ")))
def tryq(label,fn):
    try: fn()
    except Exception as e: print("ERR",label,str(e)[:120])
def bugle():
    c=con("data/com.google.android.apps.messaging/databases/bugle_db")
    part={r[0]:(r[1],r[2]) for r in c.execute("select _id,normalized_destination,full_name from participants")}
    for r in c.execute("""select m._id,m.received_timestamp,m.sent_timestamp,m.sender_id,m.message_status,m.message_protocol,cv.name,
        (select group_concat(coalesce(text,'['||content_type||']'),' ⏎ ') from parts where message_id=m._id) from messages m join conversations cv on m.conversation_id=cv._id order by m.received_timestamp"""):
        s=part.get(r[3],("?",None))
        add(U(r[1]),"gmessages",r[0],f"from {s[1] or s[0]} in [{r[6]}]",f"[status {r[4]} proto {r[5]} sent {U(r[2]) if r[2] else '-'}] {r[7]}")
tryq("bugle",bugle)
def sms():
    c=con("data/com.android.providers.telephony/databases/mmssms.db")
    for r in c.execute("select _id,date,date_sent,address,type,body from sms order by date"): add(U(r[1]),"sms",r[0],("Emily→" if r[4]==2 else "←")+str(r[3]),r[5])
tryq("sms",sms)
def calls():
    c=con("data/com.samsung.android.providers.contacts/databases/calllog.db")
    for r in c.execute("select _id,date,duration,number,type,name,geocoded_location from calls order by date"): add(U(r[1]),"call",r[0],str(r[3]),f"type={r[4]} dur={r[2]}s name={r[5]} loc={r[6]}")
tryq("calls",calls)
def signal():
    c=con("data/org.thoughtcrime.securesms/databases/signal.db")
    rec={r[0]:(r[1] or "", (r[2] or "")+" "+(r[3] or "")) for r in c.execute("select _id,e164,profile_given_name,profile_family_name from recipient")}
    for r in c.execute("select _id,date_sent,date_received,from_recipient_id,to_recipient_id,type,body from message order by date_sent"):
        add(U(r[1]),"signal",r[0],f"{rec.get(r[3],('','?'))[1].strip() or rec.get(r[3],('?',))[0]}→{rec.get(r[4],('','?'))[1].strip() or rec.get(r[4],('?',))[0]}",f"[type {r[5]}] {r[6]}")
tryq("signal",signal)
def ig():
    c=con("data/com.instagram.android/databases/direct.db")
    for r in c.execute("select _id,timestamp,thread_id,user_id,message_type,text,message from messages order by timestamp"):
        m=r[6] if isinstance(r[6],str) else (r[6] or b"").decode("utf8","ignore")
        sender=re.search(r'"user_id":"?(\d+)',m); 
        add(U(r[1],1e6),"instagram",r[0],f"thread …{r[2][-6:]} sender {sender.group(1) if sender else '?'} (owner {r[3]})",f"[{r[4]}] {r[5] or m[:160]}")
tryq("ig",ig)
def hist(pkg,label,base="data"):
    c=con(f"{base}/{pkg}/app_chrome/Default/History")
    for r in c.execute("select v.id,v.visit_time,u.url,u.title from visits v join urls u on v.url=u.id order by v.visit_time"): add(W(r[1]),label,r[0],"Emily",f"{r[3]} | {r[2][:150]}")
    for r in c.execute("select k.url_id,k.term,u.last_visit_time from keyword_search_terms k join urls u on k.url_id=u.id"): add(W(r[2]),label+"-search",r[0],"Emily",r[1])
for pkg,label,base in [("com.android.chrome","chrome","data"),("com.microsoft.emmx","edge","data"),("com.brave.browser","brave-SECUREFOLDER","user/150")]: tryq(label,lambda:hist(pkg,label,base))
def notes():
    c=con("data/com.notes.todolist.notebook.checklist.notepad.android/databases/notes_db")
    cols=[x[1] for x in c.execute("pragma table_info(notes_table)")]; print("notes cols",cols)
    for r in c.execute("select * from notes_table"): add(None,"notesapp",r[0],"Emily"," | ".join(f"{k}={str(v)[:400]}" for k,v in zip(cols,r) if v not in (None,"",0)))
tryq("notes",notes)
def tw():
    c=con("data/com.twitter.android/databases/1991194803300958208-search.db")
    for r in c.execute("select * from search_queries"): add(None,"x-search",r[0],"Emily",str(r)[:200])
tryq("tw",tw)
def contacts():
    c=con("data/com.samsung.android.providers.contacts/databases/contacts2.db")
    for r in c.execute("select rc._id, rc.display_name, group_concat(d.data1,' ; ') from raw_contacts rc left join data d on d.raw_contact_id=rc._id group by rc._id"): add(None,"contact",r[0],"Emily",f"{r[1]} | {r[2]}")
tryq("contacts",contacts)
def vest():
    c=con("data/fr.vestiairecollective/databases/vestiaire.db")
    for t in ("Product",):
        cols=[x[1] for x in c.execute(f"pragma table_info({t})")]
        for r in c.execute(f"select * from {t}"): add(None,"vestiaire",0,"Emily"," | ".join(f"{k}={str(v)[:80]}" for k,v in zip(cols,r) if v)[:400])
tryq("vest",vest)
json.dump(ev,open(sys.argv[2],"w"),ensure_ascii=False,indent=0)
import collections; print(collections.Counter(e["src"] for e in ev))
