#!/usr/bin/env python3
"""Build the "Death at Pier 9" synthetic case as five phone bundles that can be added one at a time.

    python build_pier9.py            # writes ./pier9/

The story matches the front-end mock (frontend/src/mock/data.ts). Everything is fictional.

How it works:
  1. A TRUE EVENT LOG is written first: who messaged, called, paid and met whom, and when.
  2. Each phone's files are DERIVED from the log. A message between two case phones appears on both,
     unless a plant removes it.
  3. Plants, decoys and noise are applied by code and recorded in answer_key.json with row ids.
  4. stages.json describes what the relation graph looks like after each phone is added.

Output is Case Bundle v1 (schema/case-bundle-v1) plus optional extensions modelled on what real
phones contain (see README.md next to this file). The seed is fixed, so the output is reproducible.
"""
import json
import math
import os
import random
import shutil
from datetime import datetime, timedelta, timezone

SEED = 42
rng = random.Random(SEED)
TZ = timezone(timedelta(hours=-4))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pier9")
ADD_ORDER = ["ravi", "paul", "amy", "cara", "ken"]          # suggested order for the demo
KEN_CLOCK_OFFSET_S = 90                                       # tampering plant: Ken's phone clock runs fast


def T(day, h, m, s=0):
    return datetime(2026, 4, day, h, m, s, tzinfo=TZ)


def iso(d):
    return d.isoformat()


# ---------------------------------------------------------------- the world
PEOPLE = {
    "ravi": dict(name="Ravi Mehta", role="Victim. Owner of Harbor Supply Co.", number="+1 555 010 0100", handle="@ravi.mehta",
                 email="ravi@harborsupply.example", device="ravi-iphone", model="iPhone 15 Pro", home="Mehta residence"),
    "paul": dict(name="Paul Becker", role="Bookkeeper at Harbor Supply Co.", number="+1 555 010 0101", handle="@paulbecker",
                 email="paul.becker@harborsupply.example", device="paul-iphone", model="iPhone 14", home="Becker residence"),
    "amy": dict(name="Amy Brooks", role="Ravi's estranged partner", number="+1 555 010 0202", handle="@amybrooks",
                email="amy.brooks@mailbox.example", device="amy-pixel", model="Pixel 8", home="Brooks residence"),
    "cara": dict(name="Cara Novak", role="Supplier to Harbor Supply Co.", number="+1 555 010 0404", handle="@cara.novak",
                 email="cara@novakmarine.example", device="cara-iphone", model="iPhone 13", home="Novak residence"),
    "ken": dict(name="Ken Walsh", role="Warehouse lead, dismissed 14 Apr", number="+1 555 010 0303", handle="@kwalsh_",
                email="kwalsh77@mailbox.example", device="ken-galaxy", model="Galaxy S23", home="Walsh residence"),
}
# People and numbers outside the case. They have no phone in the bundle.
OUTSIDE = {
    "lena": ("Lena Park", "+1 555 010 0150"),      # HR at Harbor Supply; known to four of the five
    "dana": ("Dana Mehta", "+1 555 010 0611"),      # Ravi's sister; also in Amy's contacts
    "priya": ("Priya Becker", "+1 555 010 0622"),
    "jo": ("Jo Alvarez", "+1 555 010 0633"),
    "marco": ("Marco Diaz", "+1 555 010 0644"),
    "tom": ("Tom Reyes", "+1 555 010 0655"),
    "burner": (None, "+1 555 010 0777"),            # plant: contacted by Paul and Cara, saved by neither
}
ORGS = {
    "news": ("Port Calder News", "78234"),
    "swiftpay": ("Swiftpay", "22000"),
    "snapline": ("Snapline", "51515"),
    "telco": ("Calder Mobile", "611611"),
    "payroll": ("Harbor Supply Co. payroll", "acct:HSC-PAYROLL"),
}
PLACES = [
    ("Pier 9 Warehouse", "work", 40.938, -71.962, 150), ("Harbor Rd lot", "parking", 40.946, -71.966, 80),
    ("Harbor Supply Co.", "work", 41.0, -72.0, 120), ("Dock Cafe", "cafe", 40.9905, -71.9842, 60),
    ("Sunset Park", "park", 40.905, -72.04, 300), ("Northgate Mall", "mall", 41.11, -71.99, 250),
    ("FreshMart", "supermarket", 41.03, -72.03, 100), ("Riverside Gym", "gym", 41.045, -72.052, 80),
    ("Mehta residence", "home", 40.972, -71.978, 60), ("Becker residence", "home", 40.975, -72.02, 60),
    ("Brooks residence", "home", 41.061, -71.996, 60), ("Walsh residence", "home", 41.021, -71.951, 60),
    ("Novak residence", "home", 40.961, -71.94, 60),
]
LL = {n: (lat, lon) for n, _, lat, lon, _ in PLACES}
COVER_START, COVER_END = T(13, 0, 0), T(19, 23, 50)
COVER_END_BY = {"ravi": T(17, 8, 0)}                # the victim's phone was seized on the morning of the 17th

# Truth windows. OFF = phone powered off (no rows at all, messages arrive late).
OFF = {"paul": [(T(16, 21, 16), T(16, 23, 38)), (T(17, 9, 30), T(17, 12, 40))],
       "cara": [(T(17, 9, 55), T(17, 13, 10))],
       "ken": [(T(14, 23, 30), T(15, 6, 40))]}
# NOLOC = no location rows, for whatever reason.
NOLOC = {p: list(w) for p, w in OFF.items()}
NOLOC.setdefault("amy", []).append((T(16, 21, 40), T(16, 22, 50)))   # plant: location off while the phone is in use
NOLOC["cara"].append((T(19, 14, 10), T(19, 15, 0)))                  # decoy: 50 minutes, no activity at all
QUIET = {p: [(a - timedelta(minutes=15), b + timedelta(minutes=15)) for a, b in w] for p, w in NOLOC.items()}
RAVI_LAST_OUT = T(16, 20, 30)                                        # no background messages from Ravi after this


def number(x):
    return PEOPLE[x]["number"] if x in PEOPLE else OUTSIDE[x][1] if x in OUTSIDE else ORGS[x][1]


def ident(x):
    if x in ORGS and x == "payroll":
        return {"kind": "account", "value": ORGS[x][1]}
    return {"kind": "phone", "value": number(x)}


def in_windows(t, windows):
    return any(a <= t < b for a, b in windows)


# ---------------------------------------------------------------- 1. the true event log
EVENTS = []          # messages, calls, transfers: things with two parties
OWN = {p: {"device_events": [], "social": [], "emails": [], "notes": [], "web": []} for p in PEOPLE}


def msg(t, frm, to, body, app="SMS", tag=None):
    EVENTS.append(dict(kind="msg", t=t, frm=frm, to=to, body=body, app=app, tag=tag, eid=len(EVENTS)))


def call(t, frm, to, dur, tag=None, app="Phone"):
    EVENTS.append(dict(kind="call", t=t, frm=frm, to=to, dur=dur, app=app, tag=tag, eid=len(EVENTS)))


def tx(t, frm, to, amount, memo, tag=None):
    EVENTS.append(dict(kind="tx", t=t, frm=frm, to=to, amount=amount, memo=memo, tag=tag, eid=len(EVENTS)))


def dev(owner, t, event_type, detail=None, tag=None):
    OWN[owner]["device_events"].append(dict(t=t, event_type=event_type, detail=detail or {}, tag=tag))


def social(owner, t, kind, text, target=None, where="", tag=None):
    OWN[owner]["social"].append(dict(t=t, kind=kind, text=text, target=target, where=where, tag=tag))


# ---- planted story (times and wording follow the front-end mock)
msg(T(14, 16, 20), "ravi", "ken", "Ken, as discussed: today is your last day. HR will send the paperwork. Please return your keys to Paul.", tag="fired")
msg(T(16, 18, 5, 12), "ravi", "paul", "I've seen the Novak invoices. Pier 9, 9:30 tonight. Come alone.", tag="summon")
msg(T(16, 18, 11, 40), "paul", "ravi", "Ok. We can sort this out.", tag="summon")
call(T(16, 20, 58), "paul", "ravi", 64, tag="last_call")
for t, frm, body in [(T(16, 19, 40, 3), "amy", "We need to talk about the house. Tonight."), (T(16, 19, 52, 30), "ravi", "Not tonight."),
                     (T(16, 20, 31, 9), "amy", "You always say that. I'm done waiting."), (T(16, 21, 47, 51), "ravi", "I'm at the warehouse. Tomorrow."),
                     (T(16, 22, 15, 20), "amy", "Answer your phone.")]:
    msg(t, frm, "ravi" if frm == "amy" else "amy", body, tag="amy_thread")
call(T(16, 22, 30), "amy", "ravi", 0, tag="amy_calls")
call(T(16, 22, 31), "amy", "ravi", 0, tag="amy_calls")
# Sent while Paul's phone was off, so it reaches his phone 93 minutes late. His reply is a claim.
msg(T(16, 22, 5, 44), "amy", "paul", "Have you heard from Ravi? He's not answering.", tag="late_delivery")
msg(T(16, 23, 52, 10), "paul", "amy", "No. Went to bed early, only just saw this.", tag="paul_claim_text")
# Paul and Cara's WhatsApp chat. Both delete it on 17 Apr, so it is on NEITHER phone, apart from one leftover.
for t, frm, body in [(T(14, 20, 15), "paul", "Next one goes through tomorrow. HSC-2291."), (T(14, 20, 17), "cara", "Same split?"),
                     (T(14, 20, 18), "paul", "10% for you, rest back to me by end of day."), (T(15, 15, 42), "cara", "Sent."), (T(15, 15, 45), "paul", "Got it."),
                     (T(16, 18, 20), "paul", "He's seen the invoices. Wants to meet at Pier 9 tonight."), (T(16, 18, 24), "cara", "Don't say anything about me."),
                     (T(16, 18, 25), "paul", "I'll handle it."), (T(17, 9, 8), "cara", "Have you seen the news??"),
                     (T(17, 9, 15), "paul", "Delete this chat. Turn your phone off.")]:
    msg(t, frm, "cara" if frm == "paul" else "paul", body, app="WhatsApp", tag="paul_cara_chat")
msg(T(17, 9, 40), "cara", "paul", "Done.", app="WhatsApp", tag="leftover")     # arrives after Paul deleted the chat; Cara then deletes hers
for p in ["paul", "amy", "ken", "cara"]:
    msg(T(17, 9, 5), "news", p, "Port Calder News: Man found dead at Pier 9 warehouse. Police are appealing for anyone who was in the area last night.", tag="news")
tx(T(15, 11, 5), "paul", "cara", 4800, "invoice HSC-2291", tag="chain")
tx(T(15, 15, 40), "cara", "paul", 4320, "thx", tag="chain")
tx(T(16, 13, 10), "paul", "amy", 50, "lunch", tag="decoy_lunch")
tx(T(13, 10, 0), "ravi", "amy", 600, "utilities")
tx(T(14, 9, 0), "payroll", "ken", 1840, "payroll wk 15")
tx(T(14, 9, 0), "payroll", "paul", 2310, "payroll wk 15")
for t, frm, to, dur in [(T(15, 7, 32), "paul", "burner", 41), (T(15, 7, 36), "cara", "burner", 55), (T(16, 12, 5), "burner", "paul", 20), (T(16, 12, 8), "cara", "burner", 33)]:
    call(t, frm, to, dur, tag="burner")
dev("paul", T(16, 21, 16), "power_off", tag="paul_gap")
dev("paul", T(16, 23, 38), "power_on", tag="paul_gap")
dev("ken", T(14, 23, 30), "power_off", tag="decoy_ken_overnight")
dev("ken", T(15, 6, 40), "power_on", tag="decoy_ken_overnight")
DELETIONS = [("paul", T(17, 9, 20), "SMS", "ravi"), ("paul", T(17, 9, 21), "WhatsApp", "cara"), ("amy", T(17, 9, 25), "SMS", "ravi"), ("cara", T(17, 9, 46), "WhatsApp", "paul")]
for owner, t, app, other in DELETIONS:
    dev(owner, t, "thread_deleted", {"counterpart": ident(other), "app": app}, tag="sync")
for owner, t, et in [("paul", T(17, 9, 30), "power_off"), ("cara", T(17, 9, 55), "power_off"), ("paul", T(17, 12, 40), "power_on"), ("cara", T(17, 13, 10), "power_on")]:
    dev(owner, t, et, tag="sync")
for t, kind, text, where in [(T(14, 19, 2), "post", "11 years at Pier 9 and Ravi Mehta walks me out with a cardboard box. Remember that name.", "own profile"),
                             (T(14, 22, 40), "comment", "Ask the owner where the 'missing' stock really goes.", "Harbor Supply Co. page"),
                             (T(15, 8, 15), "post", "Some people only learn when it costs them.", "own profile"),
                             (T(15, 21, 30), "comment", "Enjoy it while it lasts.", "reply to @ravi.mehta's post"),
                             (T(16, 12, 5), "post", "He'll get what's coming to him. Not my problem anymore.", "own profile"),
                             (T(17, 9, 50), "post", "karma.", "own profile")]:
    social("ken", t, kind, text, "ravi", where, tag="hostile")
social("ravi", T(15, 18, 0), "post", "Cleaning house at Harbor Supply. Honesty isn't optional.")
social("amy", T(16, 20, 33), "post", "Done being lied to.", tag="decoy_amy_post")
social("cara", None, "follow", "", "paul", "follow list")
social("paul", T(16, 23, 48), "like", "", "cara", "liked @cara.novak's post")
social("amy", None, "follow", "", "ravi", "follow list")
social("ken", None, "follow", "", "ravi", "follow list")
social("paul", T(15, 18, 22), "like", "", "ravi", "liked @ravi.mehta's post")

# ---- background: ordinary life, so the planted rows are not the only rows
BANK = {
    "work": [("Can you send me the delivery sheet for today?", "Sent.", "Thanks"), ("Forklift 2 is down again.", "Call the service guy."),
             ("Payroll goes out Friday, right?", "Yes."), ("Customer on line 2 asking about the Novak order.", "Tell them Thursday."),
             ("Running 10 min late.", "No problem."), ("Did the pallets from Tuesday get counted?", "Counting now."),
             ("Need the March statements on my desk.", "Will do."), ("Gate code changed, it's 4417 now.", "Got it."),
             ("Are you in tomorrow?", "From 8."), ("The scanner in bay 3 is acting up.", "I'll log it.")],
    "family": [("Mum's birthday is Sunday, don't forget.", "I won't."), ("Call me when you can.", "After work."),
               ("Dinner at ours Saturday?", "Sure, what time?", "7"), ("Did you get home ok?", "Yes, just in."), ("Can you pick up milk?", "Ok")],
    "friend": [("Coffee this week?", "Thursday works."), ("Did you watch the game?", "Don't remind me."), ("Gym tonight?", "Can't, tomorrow?"),
               ("Send me that recipe!", "One sec"), ("You free Saturday?", "Think so."), ("lol look at this", "hahaha"), ("How was the interview?", "Tell you later.")],
    "strained": [("Did you sign the papers?", "Not yet."), ("The realtor called again.", "I'll deal with it."), ("You can't keep avoiding this.", "I'm busy.")],
    "supplier": [("Delivery for Thursday confirmed?", "Confirmed, 40 crates."), ("Invoice attached for last week.", "Received."), ("Can we move pickup to 2pm?", "Fine.")],
}
# (a, b, relationship, exchanges per day, app, days)
PAIRS = [("ravi", "paul", "work", 4, "SMS", range(13, 17)), ("ravi", "lena", "work", 2, "SMS", range(13, 17)), ("ravi", "dana", "family", 1.5, "iMessage", range(13, 17)),
         ("ravi", "amy", "strained", 0.7, "SMS", range(13, 16)), ("ravi", "ken", "work", 2, "SMS", range(13, 15)), ("ravi", "cara", "supplier", 0.8, "SMS", range(13, 17)),
         ("paul", "amy", "friend", 1.2, "SMS", range(13, 20)), ("paul", "ken", "work", 1.5, "SMS", range(13, 15)), ("paul", "priya", "family", 1.5, "WhatsApp", range(13, 20)),
         ("paul", "lena", "work", 1, "SMS", range(13, 20)), ("amy", "jo", "friend", 3, "WhatsApp", range(13, 20)), ("amy", "dana", "friend", 0.7, "SMS", range(13, 20)),
         ("ken", "marco", "friend", 3, "WhatsApp", range(13, 20)), ("ken", "lena", "work", 0.5, "SMS", range(13, 20)), ("cara", "tom", "work", 2.5, "SMS", range(13, 20)),
         ("cara", "lena", "work", 0.5, "SMS", range(13, 20))]


def free(person, t):
    if person not in PEOPLE:
        return True
    if t >= COVER_END_BY.get(person, COVER_END) or (person == "ravi" and t >= RAVI_LAST_OUT):
        return False
    return not in_windows(t, QUIET.get(person, []))


for a, b, rel, rate, app, days in PAIRS:
    for day in days:
        n = int(rate) + (1 if rng.random() < rate - int(rate) else 0)
        for _ in range(n):
            t = T(day, 7, 30) + timedelta(seconds=rng.randrange(0, int(14.5 * 3600)))
            first, second = (a, b) if rng.random() < 0.5 else (b, a)
            for i, body in enumerate(rng.choice(BANK[rel])):
                frm, to = (first, second) if i % 2 == 0 else (second, first)
                if free(a, t) and free(b, t):
                    msg(t, frm, to, body, app=app)
                t += timedelta(seconds=rng.randrange(40, 600))
for a, b, days in [("ravi", "paul", range(13, 17)), ("ravi", "lena", range(13, 17)), ("amy", "jo", range(13, 20)), ("ken", "marco", range(13, 20)), ("cara", "tom", range(13, 20)), ("paul", "priya", range(13, 20))]:
    for day in days:
        if rng.random() < 0.6:
            t = T(day, 8, 0) + timedelta(seconds=rng.randrange(0, 12 * 3600))
            frm, to = (a, b) if rng.random() < 0.5 else (b, a)
            if free(a, t) and free(b, t):
                call(t, frm, to, rng.choice([0, 0, 35, 80, 140, 260, 410]))
SPAM = [("swiftpay", "Swiftpay: your verification code is {c}. Never share it."), ("snapline", "{c} is your Snapline code."),
        ("telco", "Calder Mobile: your bill is ready. Reply STOP to opt out."), ("telco", "Calder Mobile: you've used 80% of your data."),
        ("snapline", "Snapline: 3 people viewed your profile this week.")]
for p in PEOPLE:
    for day in range(13, 20):
        for _ in range(rng.choice([0, 1, 1, 2])):
            t = T(day, 8, 0) + timedelta(seconds=rng.randrange(0, 13 * 3600))
            org, body = rng.choice(SPAM)
            if free(p, t):
                msg(t, org, p, body.format(c=rng.randrange(100000, 999999)), tag="spam")

# ---- per-phone extras modelled on real phones: email, notes, web history
def email(owner, t, frm, subject, body, direction="in", to=None):
    OWN[owner]["emails"].append(dict(t=t, frm=frm, to=to or PEOPLE[owner]["email"], subject=subject, body=body, direction=direction))


def note(owner, t, title, body, locked=False, tag=None):
    OWN[owner]["notes"].append(dict(t=t, title=title, body=None if locked else body, locked=locked, tag=tag))


def web(owner, t, kind, text, tag=None):
    OWN[owner]["web"].append(dict(t=t, kind=kind, text=text, tag=tag))


email("ravi", T(14, 15, 50), PEOPLE["ravi"]["email"], "Ken Walsh", "Lena, proceed with Ken's termination today. I'll tell him myself at 4.", "out", "lena.park@harborsupply.example")
email("ravi", T(16, 16, 42), "alerts@firstharborbank.example", "Review requested: 3 supplier payments", "Payments HSC-2291, HSC-2297 and HSC-2304 to Novak Marine exceed the value of goods received. Please review.")
email("paul", T(15, 11, 6), "receipts@swiftpay.example", "You sent $4,800.00 to Cara Novak", "Memo: invoice HSC-2291")
email("paul", T(15, 15, 41), "receipts@swiftpay.example", "You received $4,320.00 from Cara Novak", "Memo: thx")
email("paul", T(17, 12, 45), "lena.park@harborsupply.example", "All staff: office closed today", "Police are on site at Pier 9. Please do not come in. More to follow.")
email("amy", T(15, 14, 10), "j.ortega@calderfamilylaw.example", "Re: property settlement", "Mr Mehta has not responded to our second letter. We can file on Monday if you wish.")
email("ken", T(14, 17, 5), "lena.park@harborsupply.example", "Termination paperwork", "Ken, your final pay and paperwork are attached. Please return keys and badge.")
email("ken", T(15, 10, 12), "alerts@calderjobs.example", "3 new warehouse supervisor roles", "New roles matching your search in Port Calder.")
email("cara", T(15, 11, 5), "receipts@swiftpay.example", "You received $4,800.00 from Paul Becker", "Memo: invoice HSC-2291")
email("cara", T(15, 15, 40), "receipts@swiftpay.example", "You sent $4,320.00 to Paul Becker", "Memo: thx")
email("cara", T(13, 9, 30), PEOPLE["cara"]["email"], "Invoice HSC-2291", "Ravi, invoice for week 15 attached. Payment to the usual account.", "out", PEOPLE["ravi"]["email"])
note("ravi", T(16, 17, 31), "Novak invoices", "HSC-2291, 2297, 2304. Amounts don't match deliveries. Who signs these off? Ask Paul tonight.", tag="ravi_note")
note("ravi", T(13, 8, 5), "To do", "Insurance renewal. Call realtor. Stock count Friday.")
note("paul", T(14, 20, 30), "N", None, locked=True, tag="locked_note")
note("paul", T(13, 19, 0), "Shopping", "Coffee, bin bags, printer paper.")
note("amy", T(16, 19, 20), "What I need to say to him", "The house. Half. No more delays.")
note("ken", T(15, 9, 0), "CV", "Update dates. Add forklift cert. Ask Marco for a reference.")
note("cara", T(13, 7, 30), "Deliveries wk 16", "Harbor Supply Thu 40 crates. Eastside Fri.")
web("ravi", T(16, 16, 50), "search", "how to report employee fraud small business")
web("paul", T(14, 21, 2), "search", "how are small business payments audited")
web("paul", T(16, 23, 51), "search", "can deleted texts be recovered from a phone", tag="paul_search")
web("paul", T(17, 9, 11), "visit", "Port Calder News: Man found dead at Pier 9 warehouse")
web("amy", T(15, 20, 15), "search", "property split separation state law")
web("amy", T(16, 21, 34), "search", "harbor supply pier 9 warehouse address", tag="amy_search")
web("ken", T(15, 9, 30), "search", "warehouse supervisor jobs port calder")
web("ken", T(15, 22, 0), "search", "wrongful dismissal lawyer free consultation")
web("cara", T(14, 19, 40), "search", "swiftpay transfer reporting threshold")

# ---------------------------------------------------------------- 2. each phone's view
def skew(person, t):
    """Ken's phone clock runs fast. GPS fixes and server-stamped rows are not affected."""
    return t + timedelta(seconds=KEN_CLOCK_OFFSET_S) if person == "ken" else t


def delivered(person, t):
    for a, b in OFF.get(person, []):
        if a <= t < b:
            return b + timedelta(seconds=rng.randrange(8, 50))
    return t + timedelta(seconds=rng.randrange(1, 5))


def schedule(p, day):
    home = PEOPLE[p]["home"]
    s = [(0, home)]
    add = lambda h, m, place: s.append((h * 60 + m, place))
    wk = day <= 17
    if p == "ravi":
        if day == 17:
            return [(0, "Pier 9 Warehouse")]
        if wk:
            add(8, 15, "Harbor Supply Co.")
            add(20, 45, "Pier 9 Warehouse") if day == 16 else add(18, 30, home)
    elif p == "paul":
        cafe = {13: (8, 10, 9, 10), 15: (7, 50, 8, 40), 16: (12, 30, 13, 30)}
        if day in (13, 15):
            add(*cafe[day][:2], "Dock Cafe"); add(*cafe[day][2:], "Harbor Supply Co.")
        elif wk:
            add(8, 40, "Harbor Supply Co.")
        if day == 16:
            add(12, 30, "Dock Cafe"); add(13, 30, "Harbor Supply Co.")
        if wk:
            add(18, 10, home)
        if day == 16:
            add(21, 10, "Harbor Rd lot"); add(23, 40, home)
        if day == 18:
            add(9, 0, "Dock Cafe"); add(10, 10, home)
        if day == 19:
            add(11, 0, "Sunset Park"); add(12, 30, home)
    elif p == "amy":
        if wk:
            add(9, 30, "Northgate Mall")
            if day == 14:
                add(17, 30, "FreshMart"); add(18, 20, home)
            else:
                add(17, 40, home)
            if day == 15:
                add(18, 30, "Riverside Gym"); add(19, 40, home)
        if day == 18:
            add(11, 0, "Northgate Mall"); add(13, 0, home)
    elif p == "ken":
        if day in (13, 14):
            add(7, 0, "Pier 9 Warehouse")
            if day == 14:
                add(17, 30, "FreshMart"); add(18, 20, home)
            else:
                add(16, 10, home)
        else:
            add(10, 0, "Riverside Gym"); add(11, 40, home)
        if day == 16:
            add(20, 30, "Riverside Gym"); add(22, 10, home)
        if day == 18:
            add(14, 0, "Sunset Park"); add(15, 30, home)
    elif p == "cara":
        if day == 13:
            add(8, 10, "Dock Cafe"); add(9, 10, home); add(14, 0, "Harbor Supply Co."); add(15, 0, home)
        if day == 14:
            add(10, 0, "Harbor Supply Co."); add(11, 0, home)
        if day == 15:
            add(7, 50, "Dock Cafe"); add(8, 40, home)
        if day == 16:
            add(12, 30, "Dock Cafe"); add(13, 30, home)
        if day == 18:
            add(9, 0, "Dock Cafe"); add(10, 10, home)
        if day == 19:
            add(11, 0, "Northgate Mall"); add(13, 0, home)
    return sorted(s)


def km(a, b):
    (la1, lo1), (la2, lo2) = LL[a], LL[b]
    return math.hypot((la1 - la2) * 111.0, (lo1 - lo2) * 111.0 * math.cos(math.radians(la1)))


def track(p):
    """One location fix every 10 minutes, with travel interpolated, GPS jitter and short indoor dropouts."""
    rows = []
    end = COVER_END_BY.get(p, COVER_END)
    for day in range(13, 20):
        s = schedule(p, day)
        drop = set(rng.sample(range(82, 102), 2)) if not (p == "cara" and day == 19) else set()   # innocent noise
        for tick in range(144):
            t = T(day, 0, 0) + timedelta(minutes=10 * tick)
            if t >= end or in_windows(t, NOLOC.get(p, [])) or tick in drop:
                continue
            minute = tick * 10
            i = max(k for k, (m, _) in enumerate(s) if m <= minute)
            here, pos = s[i][1], LL[s[i][1]]
            if i + 1 < len(s):
                nxt_min, nxt = s[i + 1]
                n = max(1, math.ceil(km(here, nxt) / 5.0))            # 30 km/h, so 5 km per tick
                left = (nxt_min - minute) // 10
                if 1 <= left <= n and nxt != here:
                    f = (n - left + 1) / (n + 1)
                    pos, here = (pos[0] + (LL[nxt][0] - pos[0]) * f, pos[1] + (LL[nxt][1] - pos[1]) * f), "In transit"
            wifi = rng.random() < 0.1
            rows.append(dict(t=t, lat=round(pos[0] + rng.gauss(0, 18 / 111000), 6), lon=round(pos[1] + rng.gauss(0, 18 / 84000), 6),
                             accuracy_m=rng.randrange(30, 60) if wifi else rng.randrange(5, 20), source="wifi" if wifi else "gps", place=here))
    return rows


def build_phone(p):
    me = PEOPLE[p]
    end = COVER_END_BY.get(p, COVER_END)
    tables = {k: [] for k in ["messages", "calls", "transactions", "device_events", "locations", "social_interactions", "emails", "notes", "web_history"]}
    tagged, removed = {}, {}
    # messages: number them in arrival order, then apply deletions, which leaves gaps in the numbering
    inbox = []
    for e in EVENTS:
        if e["kind"] != "msg" or p not in (e["frm"], e["to"]):
            continue
        out = e["frm"] == p
        local = e["t"] if out else delivered(p, e["t"])
        if local < end:
            inbox.append((local, e, out))
    inbox.sort(key=lambda x: x[0])
    for seq, (local, e, out) in enumerate(inbox, 1):
        other = e["to"] if out else e["frm"]
        rid = f"m{seq:04d}"
        gone = any(owner == p and app == e["app"] and who == other and local < when for owner, when, app, who in DELETIONS)
        if gone:
            removed.setdefault(e["tag"] or "background", []).append(dict(source_seq=seq, eid=e["eid"]))
            continue
        row = dict(record_id=rid, source_seq=seq, thread_id=f"{e['app'].lower().replace(' ', '')}:{other}", app=e["app"], direction="out" if out else "in",
                   **{"from": ident(e["frm"]), "to": [ident(e["to"])]}, timestamp=iso(skew(p, e["t"])), body=e["body"], _eid=e["eid"], _other=other)
        if not out:
            row["received_timestamp"] = iso(skew(p, local))
        if e["frm"] in ORGS:
            row["from"]["label"] = ORGS[e["frm"]][0]
        tables["messages"].append(row)
        if e["tag"]:
            tagged.setdefault(e["tag"], []).append(rid)
    spam = [r for r in tables["messages"] if r["_other"] in ORGS and r["_other"] != "news"]
    if p == "amy" and spam:
        spam[0]["state"] = "recently_deleted"                        # innocent noise: a deleted verification code
    for kind, table, prefix in [("call", "calls", "k"), ("tx", "transactions", "t")]:
        rows = sorted((e for e in EVENTS if e["kind"] == kind and p in (e["frm"], e["to"]) and e["t"] < end), key=lambda e: e["t"])
        for seq, e in enumerate(rows, 1):
            out, rid = e["frm"] == p, f"{prefix}{seq:03d}"
            if kind == "call":
                status = "answered" if e["dur"] > 0 else "missed"
                row = dict(record_id=rid, app=e["app"], direction="out" if out else "in", **{"from": ident(e["frm"]), "to": [ident(e["to"])]},
                           start_time=iso(skew(p, e["t"])), duration_s=e["dur"], status=status)
            else:
                row = dict(record_id=rid, app="Swiftpay", direction="out" if out else "in", **{"from": ident(e["frm"]), "to": ident(e["to"])},
                           amount=e["amount"], currency="USD", timestamp=iso(e["t"]), memo=e["memo"])   # stamped by the payment server
            row["_eid"], row["_other"] = e["eid"], e["to"] if out else e["frm"]
            tables[table].append(row)
            if e["tag"]:
                tagged.setdefault(e["tag"], []).append(rid)
    for seq, d in enumerate(sorted(OWN[p]["device_events"], key=lambda d: d["t"]), 1):
        tables["device_events"].append(dict(record_id=f"e{seq:03d}", event_type=d["event_type"], timestamp=iso(skew(p, d["t"])), detail=d["detail"]))
        if d["tag"]:
            tagged.setdefault(d["tag"], []).append(f"e{seq:03d}")
    for seq, r in enumerate(track(p), 1):
        tables["locations"].append(dict(record_id=f"l{seq:04d}", timestamp=iso(r["t"]), lat=r["lat"], lon=r["lon"], accuracy_m=r["accuracy_m"], source=r["source"]))
    for seq, s in enumerate(sorted(OWN[p]["social"], key=lambda s: s["t"] or COVER_START), 1):
        row = dict(record_id=f"si{seq:03d}", platform="Snapline", actor_handle=me["handle"], target_handle=PEOPLE[s["target"]]["handle"] if s["target"] else None,
                   kind=s["kind"], timestamp=iso(s["t"]) if s["t"] else None)
        if s["text"]:
            row["content"] = s["text"]
        if s["where"]:
            row["where"] = s["where"]
        tables["social_interactions"].append(row)
        if s["tag"]:
            tagged.setdefault(s["tag"], []).append(row["record_id"])
    for seq, m in enumerate(sorted(OWN[p]["emails"], key=lambda m: m["t"]), 1):
        if m["t"] < end:
            tables["emails"].append(dict(record_id=f"em{seq:03d}", direction=m["direction"], **{"from": {"kind": "email", "value": m["frm"]}, "to": [{"kind": "email", "value": m["to"]}]},
                                         timestamp=iso(m["t"]), subject=m["subject"], body=m["body"]))
    for seq, n in enumerate(sorted(OWN[p]["notes"], key=lambda n: n["t"]), 1):
        tables["notes"].append(dict(record_id=f"n{seq:03d}", title=n["title"], body=n["body"], locked=n["locked"], created=iso(skew(p, n["t"])), modified=iso(skew(p, n["t"]))))
        if n["tag"]:
            tagged.setdefault(n["tag"], []).append(f"n{seq:03d}")
    for seq, w in enumerate(sorted(OWN[p]["web"], key=lambda w: w["t"]), 1):
        if w["t"] < end:
            tables["web_history"].append(dict(record_id=f"w{seq:03d}", timestamp=iso(skew(p, w["t"])), kind=w["kind"], **({"query": w["text"]} if w["kind"] == "search" else {"title": w["text"]})))
            if w["tag"]:
                tagged.setdefault(w["tag"], []).append(f"w{seq:03d}")
    return tables, tagged, removed


SAVED = {   # how each phone's owner saved the others: names differ from phone to phone
    "ravi": {"paul": "Paul B (books)", "amy": "Amy", "ken": "Ken W warehouse", "cara": "Novak Marine - Cara", "lena": "Lena HR", "dana": "Dana"},
    "paul": {"ravi": "Ravi", "amy": "Amy B", "ken": "Ken", "cara": "C. Novak (supplier)", "lena": "Lena Park", "priya": "Priya"},
    "amy": {"ravi": "Ravi (don't answer)", "paul": "Paul Becker", "jo": "Jo", "dana": "Dana M"},
    "cara": {"ravi": "Harbor Supply - Ravi", "paul": "Paul B", "tom": "Tom driver", "lena": "Harbor Supply HR"},
    "ken": {"ravi": "Boss", "paul": "Paul office", "marco": "Marco", "lena": "HR Lena"},
}
FORMATS = [lambda n: n, lambda n: n.replace("+1 ", "").replace(" ", "-"), lambda n: "(" + n[3:6] + ") " + n[7:10] + "-" + n[11:]]


def write(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps({k: v for k, v in r.items() if not k.startswith("_")}, ensure_ascii=False) + "\n")


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    phones = {p: build_phone(p) for p in ADD_ORDER}
    for p, (tables, _, _) in phones.items():
        me, d = PEOPLE[p], os.path.join(OUT, "devices", PEOPLE[p]["device"])
        os.makedirs(d, exist_ok=True)
        json.dump(dict(device_id=me["device"], owner=p, model=me["model"], extraction_tool="synthetic-generator pier9 1.0", extracted_at=iso(T(21, 9, 14)),
                       coverage_start=iso(COVER_START), coverage_end=iso(COVER_END_BY.get(p, COVER_END))), open(os.path.join(d, "device.json"), "w"), indent=1)
        for name, rows in tables.items():
            write(os.path.join(d, name + ".jsonl"), rows)
        write(os.path.join(d, "contacts.jsonl"), [dict(record_id=f"c{i}", saved_name=name, identifiers=[{"kind": "phone", "value": FORMATS[i % 3](number(who))}])
                                                  for i, (who, name) in enumerate(SAVED[p].items(), 1)])
        accounts = [dict(record_id="s1", platform="Snapline", handle=me["handle"], display_name=me["name"].split()[0])]
        if p == "cara":
            accounts.append(dict(record_id="s2", platform="Snapline", handle="@dockside.c", display_name="C"))      # plant: a second account
        write(os.path.join(d, "social_accounts.jsonl"), accounts)
    write(os.path.join(OUT, "persons.jsonl"), [dict(person_id=p, display_name=v["name"], role=v["role"], identifiers=[
        {"kind": "phone", "value": v["number"]}, {"kind": "handle", "platform": "Snapline", "value": v["handle"]}, {"kind": "email", "value": v["email"]}]) for p, v in PEOPLE.items()])
    json.dump(dict(schema_version="case-bundle/1.0", case_id="pier9-2026-04", title="Death at Pier 9", timezone="-04:00",
                   devices=[PEOPLE[p]["device"] for p in ADD_ORDER], add_order=[PEOPLE[p]["device"] for p in ADD_ORDER],
                   places=[dict(name=n, kind=k, lat=la, lon=lo, radius_m=r) for n, k, la, lo, r in PLACES],
                   known_orgs=[dict(name=n, identifier=v) for n, v in ORGS.values()],
                   extensions=["messages.source_seq", "messages.received_timestamp", "messages.state", "emails.jsonl", "notes.jsonl", "web_history.jsonl",
                               "social_interactions.where", "statements.jsonl", "known_orgs", "add_order"]),
              open(os.path.join(OUT, "manifest.json"), "w"), indent=1)

    # statements: what each person told investigators, with the expected verdict in the answer key only
    STATEMENTS = [
        ("st1", "paul", "I went straight home after work on the 16th and stayed in all night.", "inconsistent", "Paul's phone was at the Harbor Rd lot at 21:10, then powered off until 23:38.", ["paul"]),
        ("st2", "paul", "Ravi and I spoke briefly on the phone that evening.", "confirmed", "A 64-second call at 20:58 is on both phones.", ["paul", "ravi"]),
        ("st3", "paul", "I only deal with Cara Novak through invoices. We don't meet.", "inconsistent", "Their phones were together at Dock Cafe on four days.", ["paul", "cara"]),
        ("st4", "amy", "I didn't contact Ravi at all that night.", "inconsistent", "Two calls at 22:30 and 22:31 are on both phones; five texts are on Ravi's phone only.", ["amy", "ravi"]),
        ("st5", "amy", "I was at home the whole evening.", "cannot_tell", "Amy's phone has no location data from 21:40 to 22:50.", ["amy"]),
        ("st6", "ken", "I was nowhere near the pier that night.", "confirmed", "Ken's phone was at Riverside Gym and then at home, about 9 km away.", ["ken"]),
        ("st7", "cara", "I was at home on the night of the 16th.", "confirmed", "Cara's phone stayed at the Novak residence.", ["cara"]),
        ("st8", "cara", "Paul and I never talk outside of work email.", "cannot_tell", "No messages or calls between them survive on either phone, but both deleted a WhatsApp chat on 17 Apr.", ["paul", "cara"]),
    ]
    write(os.path.join(OUT, "statements.jsonl"), [dict(statement_id=s, person_id=p, text=t, taken_at=iso(T(20, 10, 0))) for s, p, t, *_ in STATEMENTS])

    def ev(tag, people=None):
        return {PEOPLE[p]["device"]: phones[p][1][tag] for p in (people or ADD_ORDER) if tag in phones[p][1]}

    def gone(tag, p):
        return [r["source_seq"] for r in phones[p][2].get(tag, [])]

    plants = [
        dict(id="LAST", label="Ravi's text naming Pier 9, 21:30", check="search_messages", needs=["ravi"], evidence=ev("summon", ["ravi"]),
             note="On Ravi's phone only once Paul's is added, because Paul deleted the thread."),
        dict(id="MISSING_AMY", label="Ravi and Amy's texts of 16 Apr, deleted from Amy's phone", check="missing_messages", needs=["ravi", "amy"],
             evidence=ev("amy_thread", ["ravi"]), missing_on={"amy-pixel": gone("amy_thread", "amy")}),
        dict(id="MISSING_PAUL", label="Ravi and Paul's whole SMS thread, deleted from Paul's phone", check="missing_messages", needs=["ravi", "paul"],
             evidence=ev("summon", ["ravi"]), missing_on={"paul-iphone": gone("summon", "paul") + gone("background", "paul")}),
        dict(id="GPAUL", label="Paul's phone off near the scene, 21:16 to 23:38", check="location_gaps", needs=["paul"], evidence=ev("paul_gap", ["paul"]), gap_type="powered_off"),
        dict(id="GAMY", label="Amy's location off while her phone called Ravi", check="location_gaps", needs=["amy"], evidence=ev("amy_calls", ["amy"]), gap_type="location_off"),
        dict(id="CHAIN", label="Paul paid Cara $4,800; Cara sent $4,320 back 4 h 35 min later", check="money_chains", needs=["paul"], evidence=ev("chain"),
             note="Visible from either phone; confirmed on both once Cara's is added."),
        dict(id="MEET", label="Paul's and Cara's phones together at Dock Cafe on four days, no contact on record", check="silent_meetings", needs=["paul", "cara"],
             occasions=["2026-04-13 08:10", "2026-04-15 07:50", "2026-04-16 12:30", "2026-04-18 09:00"]),
        dict(id="SYNC", label="After the 09:05 news alert, three phones deleted threads within 26 minutes", check="synchronised_behaviour", needs=["paul", "amy", "cara"], evidence=ev("sync")),
        dict(id="BURNER", label="An unsaved number contacted by both Paul and Cara", check="unresolved_identifiers", needs=["paul", "cara"], evidence=ev("burner"), identifier=number("burner")),
        dict(id="LEFTOVER", label="One WhatsApp message from Cara survives on Paul's phone after both deleted the chat", check="missing_messages", needs=["paul", "cara"],
             evidence=ev("leftover", ["paul"]), missing_on={"cara-iphone": gone("leftover", "cara")}),
        dict(id="HOSTILE", label="Ken's hostile posts about Ravi after his dismissal", check="hostility", needs=["ken"], evidence=ev("hostile", ["ken"])),
        dict(id="LATE", label="Amy's 22:05 text reached Paul's phone 93 minutes late, because it was off", check="integrity", needs=["paul", "amy"], evidence=ev("late_delivery"),
             note="Not a missing message. A check that compares arrival times would raise a false alarm."),
        dict(id="ALIAS", label="Cara's phone is logged in to a second Snapline account", check="identity_match", needs=["cara"], evidence={"cara-iphone": ["s2"]}),
    ]
    decoys = [
        dict(label="Ken's phone off overnight, 14 to 15 Apr", evidence=ev("decoy_ken_overnight", ["ken"]), why="Ordinary overnight power-off, overlapping nothing."),
        dict(label="Cara's 50-minute location gap on 19 Apr", why="No activity of any kind during it."),
        dict(label="Amy's and Ken's phones at FreshMart together once, 14 Apr 17:30", why="One occasion; below the two-occasion threshold."),
        dict(label='Paul sent Amy $50, memo "lunch"', evidence=ev("decoy_lunch"), why="Below the $500 minimum and not passed on."),
        dict(label='Amy posted "Done being lied to."', evidence=ev("decoy_amy_post", ["amy"]), why="Names no one."),
        dict(label="Short indoor GPS dropouts on every phone", why="Two missing fixes a day, well under the 45-minute gap threshold."),
        dict(label="Verification-code and marketing texts", why="Sent by known organisations listed in the manifest."),
    ]
    truth_only = dict(
        paul_cara_chat=[dict(t=iso(e["t"]), **{"from": e["frm"]}, body=e["body"]) for e in EVENTS if e["tag"] == "paul_cara_chat"],
        note="This WhatsApp chat was deleted from both phones, so no phone holds it. A correct system answers cannot_tell about its content.",
        who_was_at_the_scene="Not defined. The data does not establish who was at Pier 9 during the window, and no system should claim it does.")
    json.dump(dict(case_id="pier9-2026-04", seed=SEED, tampering=[dict(device="ken-galaxy", kind="clock_offset", seconds=KEN_CLOCK_OFFSET_S,
                   affects=["messages", "calls", "device_events", "notes", "web_history"], not_affected=["locations (GPS time)", "transactions and social (server time)"])],
                   plants=plants, decoys=decoys, statements=[dict(statement_id=s, person_id=p, expected=v, why=w, needs=[PEOPLE[x]["device"] for x in n]) for s, p, _, v, w, n in STATEMENTS],
                   truth_only=truth_only), open(os.path.join(OUT, "answer_key.json"), "w"), indent=1, ensure_ascii=False)

    # stages: what the relation graph looks like after each phone is added
    REVEAL = {
        "ravi": "The victim's phone alone. His contacts appear as numbers with the names he saved. The Pier 9 text to Paul and the argument with Amy are visible, from his side only.",
        "paul": "Paul becomes a full node. His SMS thread with Ravi is missing from his own phone. The payments to and from Cara appear, and so does an unsaved number.",
        "amy": "Amy's texts with Ravi are missing from her phone, and her location is off while she calls him. Three phones now show the same shared contacts.",
        "cara": "Both sides of the money loop are confirmed. Paul's and Cara's phones meet at Dock Cafe four times. The unsaved number now links two people. One leftover WhatsApp message contradicts both deletions.",
        "ken": "Ken's hostile posts appear, but his phone was 9 km away all evening. His phone's clock runs 90 seconds fast.",
    }
    stages, added = [], []
    name_of = lambda x: PEOPLE[x]["name"] if x in PEOPLE else (OUTSIDE[x][0] if x in OUTSIDE else ORGS[x][0])
    for p in ADD_ORDER:
        added.append(p)
        seen = {}                                               # truth event id -> set of phones that hold it
        for q in added:
            for table in ("messages", "calls", "transactions"):
                for r in phones[q][0][table]:
                    seen.setdefault(r["_eid"], set()).add(q)
        edges, one_sided = {}, {}
        for eid, holders in seen.items():
            e = EVENTS[eid]
            if e["frm"] in ORGS or e["to"] in ORGS:
                continue
            a, b = sorted([e["frm"], e["to"]])
            channel = {"msg": "message", "call": "call", "tx": "transfer"}[e["kind"]]
            edges[(a, b, channel)] = edges.get((a, b, channel), 0) + 1
            if a in added and b in added and len(holders) == 1:
                one_sided[(a, b, channel)] = one_sided.get((a, b, channel), 0) + 1
        others = sorted({x for a, b, _ in edges for x in (a, b) if x not in added})
        saved = lambda x: sorted({SAVED[q][x] for q in added if x in SAVED[q]})
        stages.append(dict(
            step=len(added), added=PEOPLE[p]["device"], devices=[PEOPLE[q]["device"] for q in added], reveals=REVEAL[p],
            nodes=[dict(id=q, kind="case_person_with_phone", name=PEOPLE[q]["name"]) for q in added] +
                  [dict(id=x, kind="case_person_no_phone_yet" if x in PEOPLE else "unsaved_number" if not saved(x) else "outside_contact", number=number(x),
                        saved_as=saved(x), contacted_by=sorted({q for a, b, _ in edges for q in (a, b) if q in added and x in (a, b)})) for x in others],
            edges=[dict(a=a, b=b, channel=c, events=n, on_one_phone_only=one_sided.get((a, b, c), 0)) for (a, b, c), n in sorted(edges.items())],
            plants_detectable=[pl["id"] for pl in plants if all(n in added for n in pl["needs"])],
            statements_checkable=[s for s, _, _, _, _, n in STATEMENTS if all(x in added for x in n)]))
    json.dump(dict(case_id="pier9-2026-04", add_order=[PEOPLE[p]["device"] for p in ADD_ORDER], stages=stages), open(os.path.join(OUT, "stages.json"), "w"), indent=1, ensure_ascii=False)

    # ---- self-checks
    for a in ADD_ORDER:
        for b in ADD_ORDER:
            if a < b:
                for table in ("messages", "calls", "transactions"):
                    ea = {r["_eid"] for r in phones[a][0][table] if r["_other"] == b}
                    eb = {r["_eid"] for r in phones[b][0][table] if r["_other"] == a}
                    cut = min(COVER_END_BY.get(a, COVER_END), COVER_END_BY.get(b, COVER_END))
                    diff = [EVENTS[i] for i in ea ^ eb if EVENTS[i]["t"] < cut - timedelta(minutes=5)]
                    unexplained = [e for e in diff if not any(o in (a, b) and w in (a, b) and e.get("app") == app for o, _, app, w in DELETIONS)]
                    assert not unexplained, (a, b, table, unexplained[:2])
    for p in ADD_ORDER:
        counts = {k: len(v) for k, v in phones[p][0].items()}
        print(f"{PEOPLE[p]['device']:12s}", " ".join(f"{k}={v}" for k, v in counts.items()))
    for s in stages:
        print(f"step {s['step']} +{s['added']:12s} nodes={len(s['nodes'])} edges={len(s['edges'])} one-sided={sum(e['on_one_phone_only'] for e in s['edges'])} plants={s['plants_detectable']}")


if __name__ == "__main__":
    main()
