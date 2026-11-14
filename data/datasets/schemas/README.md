# Data shapes

Two kinds of page live here:

- **Generated listings** (`msab-2026-iphone12.md`, `msab-2026-samsungs20.md`): every SQLite database found in a phone copy we downloaded, with each table's row count and columns. They are produced by `scripts/dump_schema.py` and are exact for that phone.
- **This page:** the standard layout of a phone copy, for the datasets we have not opened (Cellebrite 2023 to 2025, MVS 2024). It comes from the usual iOS and Android formats, not from those files. Expect small differences between OS versions.

## The four layers of a phone dataset

1. **Container.** A `.zip` or `.tar` holding the phone's file system ("full file system" copy), one per device. Some vendors add their own formats next to it (`.xry` from MSAB, `.clbe` and `.ufd` from Cellebrite). Older sets ship raw partition images (`.bin`, `.E01`) that need a file-system tool to open.
2. **App databases.** Almost all evidence is SQLite, one or more files per app. Each has `-wal` and `-shm` companions. Recent rows are often only in the `-wal` file, so always copy all three.
3. **Parsed tables.** ALEAPP (Android) and iLEAPP (iOS) read layer 2 and write one table per evidence type.
4. **Case Bundle.** Our own format, described in [`schema/case-bundle-v1`](../../../schema/case-bundle-v1/README.md).

## Timestamps

| Where | Format |
|---|---|
| Most iOS system databases | Seconds since 2001-01-01 UTC ("Apple time"), sometimes as a float |
| iOS `sms.db` `message.date` | Nanoseconds since 2001-01-01 UTC |
| Android, most apps | Milliseconds since 1970-01-01 UTC |
| Safari `history_visits.visit_time` | Seconds since 2001-01-01 UTC |
| Chrome `visits.visit_time` | Microseconds since 1601-01-01 UTC |
| Snapchat, Instagram, Signal | Milliseconds since 1970-01-01 UTC |

## iOS: where things are

Paths are under `/private/var/`. App data is in `mobile/Containers/Data/Application/<UUID>/` and `mobile/Containers/Shared/AppGroup/<UUID>/`. The UUID folders are random; the app's name is in the hidden file `.com.apple.mobile_container_manager.metadata.plist` inside each one (`MCMMetadataIdentifier`).

| Evidence | File | Main tables |
|---|---|---|
| Texts, iMessage, RCS | `mobile/Library/SMS/sms.db` | `message`, `handle`, `chat`, `chat_message_join`, `attachment`, `chat_recoverable_message_join` (recently deleted) |
| Calls | `mobile/Library/CallHistoryDB/CallHistory.storedata` | `ZCALLRECORD`, `ZHANDLE` |
| Contacts | `mobile/Library/AddressBook/AddressBook.sqlitedb` | `ABPerson`, `ABMultiValue` (numbers and emails) |
| Who the owner interacted with, any app | `mobile/Library/CoreDuet/People/interactionC.db` | `ZINTERACTIONS`, `ZCONTACTS` |
| App usage, screen, lock | `mobile/Library/CoreDuet/Knowledge/knowledgeC.db` (iOS 16 and older); `mobile/Library/Biome/streams/` SEGB files (iOS 17 and newer, not SQLite) | `ZOBJECT`, `ZSTRUCTUREDMETADATA` |
| Places visited | `mobile/Library/Caches/com.apple.routined/Local.sqlite`, `Cloud-V2.sqlite` | `ZRTLEARNEDLOCATIONOFINTERESTMO`, `ZRTLEARNEDLOCATIONOFINTERESTVISITMO` |
| Nearby Wi-Fi and cell towers | `root/Library/Caches/locationd/cache_encryptedB.db` | `WifiLocation`, `LteCellLocation` |
| Photos and their GPS | `mobile/Media/PhotoData/Photos.sqlite` | `ZASSET` (`ZLATITUDE`, `ZLONGITUDE`, `ZDATECREATED`), `ZADDITIONALASSETATTRIBUTES` |
| Safari | `mobile/Library/Safari/History.db` | `history_items`, `history_visits` |
| Mail | `mobile/Library/Mail/Envelope Index`, `Protected Index` (no file extension), plus `.emlx` files | `messages`, `subjects`, `addresses`, `summaries` |
| Notes | AppGroup `group.com.apple.notes/NoteStore.sqlite` | `ZICCLOUDSYNCINGOBJECT`, `ZICNOTEDATA` (gzip-compressed protobuf) |
| Accounts | `mobile/Library/Accounts/Accounts3.sqlite` | `ZACCOUNT`, `ZACCOUNTTYPE` |
| Health (steps) | `mobile/Library/Health/healthdb_secure.sqlite` | `samples`, `quantity_samples` |
| App permissions | `mobile/Library/TCC/TCC.db` | `access` |
| Network use per app | `wireless/Library/Databases/DataUsage.sqlite` | `ZPROCESS`, `ZLIVEUSAGE` |
| WhatsApp | AppGroup `group.net.whatsapp.WhatsApp.shared/ChatStorage.sqlite` | `ZWAMESSAGE`, `ZWACHATSESSION` |
| Signal | AppGroup `group.org.whispersystems.signal.group/grdb/signal.sqlite` | Encrypted with SQLCipher. The key is in the keychain |
| Snapchat | App `com.toyopagroup.picaboo/.../arroyo.db` | `conversation_message` (content is a protobuf blob), `conversation` |
| Instagram direct | App `com.burbn.instagram/.../<user id>.db` | `messages` (content is an archived blob), `threads` |

## Android: where things are

Paths are under `/data/`. Each app has `data/<package>/databases/`. Secondary users, including Samsung's secure folder, are under `/data/user/<id>/`.

| Evidence | File | Main tables |
|---|---|---|
| SMS and MMS | `data/com.android.providers.telephony/databases/mmssms.db` | `sms` (`address`, `date`, `type` 1 = received, 2 = sent, `body`), `pdu`, `part` |
| Calls | `data/com.android.providers.contacts/databases/calllog.db` | `calls` (`number`, `date`, `duration`, `type`) |
| Contacts | `data/com.android.providers.contacts/databases/contacts2.db` | `raw_contacts`, `data`, `mimetypes` |
| WhatsApp | `data/com.whatsapp/databases/msgstore.db`, `wa.db` | `message`, `chat`, `jid`; `wa_contacts` |
| Instagram direct | `data/com.instagram.android/databases/direct.db` | `messages`, `threads` |
| Chrome or Brave | `data/<package>/app_chrome/Default/History` (no extension) | `urls`, `visits` |
| App usage | `system/usagestats/<user>/` | Protobuf or XML, not SQLite |
| Location | Google Maps and Play services app data | Varies by version |
| Samsung Notes | `data/com.samsung.android.app.notes/databases/` | Varies |

## What a Case Bundle adapter has to do

| Case Bundle file | iOS source | Android source |
|---|---|---|
| `messages.jsonl` | `sms.db` plus each chat app | `mmssms.db` plus each chat app |
| `calls.jsonl` | `CallHistory.storedata` | `calllog.db` |
| `contacts.jsonl` | `AddressBook.sqlitedb` | `contacts2.db` |
| `locations.jsonl` | routined, photo GPS, Wi-Fi and cell caches | Google location data, photo EXIF |
| `social_accounts.jsonl`, `social_interactions.jsonl` | `Accounts3.sqlite`, `interactionC.db`, app databases | App databases |
| `device_events.jsonl` | knowledgeC or Biome, `TCC.db`, `DataUsage.sqlite` | `usagestats` |
| `transactions.jsonl` | Wallet or banking apps, if any | Banking apps, if any |
