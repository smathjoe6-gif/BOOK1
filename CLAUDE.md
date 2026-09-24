# GK Legend Studio — Social Media Automation

This repo (branch `desktop-script`) plus a Make.com account together run Joe's
fully automatic social posting pipeline for GK Legend Studio. **The goal: Joe
drops a finished video into `GK_JING` (or `GK_TERMINAL`) in Google Drive and
it posts everywhere on its own — no explanation needed each time.** This file
is that explanation, written down once.

## ⭐ STATUS BOARD — read this first, update it last

**Every session: read this board before doing anything, and update it
before ending.** Joe has lost weeks to sessions that forgot what the last
one built and started over with a different approach. Rules:

1. **One branch: `desktop-script`.** It is what runs on Joe's Mac. Every
   fix lands there (via a PR from a `claude/...` branch, merged the same
   night). `claude/domain-list-8ikox6` is an OLD 17-Sep copy — superseded,
   don't build on it or copy from it.
2. **Fix what's on the board, don't redesign.** If something here is
   "working", don't swap its tool/approach unless Joe asks. Tools are
   decided: Mac script + Buffer API (YouTube/TikTok/X), Make.com
   (IG/FB/Pinterest), Manychat (DMs). **No Zapier.**
3. **Verify, don't assume.** Check the live log (Drive file
   `gk-automation-log-live.txt`, id `1Kyh87FahJHv7GkmC7zI_TWiKqhi4HdZs`),
   Make executions, and the sheet before claiming something works/broke.
4. **Update the board** (date + what changed) at the end of every session.

### ✅ Working (verified 22-23 Sep 2026)
| What | How | Proof |
|---|---|---|
| YouTube posting | Mac script, 1 video / 15 min | live log, 20 videos posted 22-23 Sep |
| TikTok posting | Mac script → queue (`src/tiktokQueue.js`, max `TIKTOK_DAILY_LIMIT`=8/day, ≥60 min apart, `TIKTOK_PAUSE_UNTIL` to hold) → Buffer GraphQL API (`src/bufferTikTok.js`) | first 20 posted 22-23 Sep; see TikTok daily limit below |
| Instagram + Facebook | Make scenario 9696465, 1 video / 25 min | Make executions all status 1 (success) |
| Pinterest posting | Make scenario 9696465 | same |
| Pinterest unique covers | cover pool photo → sheet column G → Make field `6` | fixed 22 Sep (was reading `7`); Joe to confirm on new pins |
| Order | YouTube+TikTok first; video mirrors to GK_JING only after its caption row exists; then Make | `mirrorNewVideos()` in `src/drive.js` |
| YouTube comment replies | `replyToNewComments()` | runs every cycle |

### ⚠️ Known broken / not set up (not blocking posting)
- **X (Twitter):** FIXED 23 Sep ~03:30 — the 4 keys had been typed at the
  Terminal prompt (saves nothing) and `.env` had them EMPTY; now written
  into `.env` (verified "has a value" x4). First real attempts (23 Sep
  03:31, 03:46) reached X but failed: "X media INIT failed: Invalid or
  expired token" — the saved access token/secret are no longer valid
  (regenerated since 20 Sep, or app permissions changed after they were
  made). Fix: developer.x.com → app → User authentication settings = Read
  and write → Keys and tokens → regenerate Access Token & Secret → write
  the new values into `.env` → restart.
  Lesson: Joe's ⌘S in Terminal opens "Save Output", which does NOT edit
  `.env`; give him one-line commands that write the file directly.
- **Mac script's own Pinterest post:** "Authentication failed" — harmless, Make already posts Pinterest. Could be switched off.
- **OmniRoute (local AI):** returns 502 → captions use built-in templates, not AI-written.
- **TikTok daily limit (23 Sep):** ~30 posts in 24h → Buffer accepted all
  (log said "posted") but TikTok rejected the last ~12: "TikTok has detected
  a large number of posts published through the API for this channel. Wait
  24 hours". Fix built: `src/tiktokQueue.js` queues every video and sends at
  most `TIKTOK_DAILY_LIMIT` (default 15) per day, one per cycle; extras wait
  for tomorrow (`tiktok-queue.json`). Joe posted the 12 failed ones by hand,
  so delete them in Buffer instead of pressing "Retry Now" (would duplicate).
  Note: "posted" in the log only means Buffer accepted it — TikTok can still
  reject later; check Buffer's Sent/Errors if TikTok looks missing.
- **Grok auto video generation:** runs at `AUTO_GENERATE_HOURS=13` (1pm),
  1/day (Joe's `.env`; not 8am). xAI's real reason (23 Sep 13:01): "403 --
  Your team 3d338612-… has either used all available credits or reached its
  monthly spending limit". So the $10 isn't usable by the team the API key
  belongs to. Fix (Joe, console.x.ai): open team `3d338612…` → Billing →
  check credits are on THIS team and raise the monthly spending limit above
  $0. `autogen-state.json` last success: 17 Sep. Retries every 15 min until
  it works, then 1/day. **Joe (23 Sep): doesn't need the paid API video —
  his real flow is Grok's own "Automations" (grok.com) making videos into
  his Grok library from the daily prompt doc.** Can't be driven from here
  (no grok.com access); our side is the daily prompt doc (below).
  To stop the API retries: set `AUTO_GENERATE_VIDEOS=false` in `.env`.
- **Daily viral prompt doc (routine `trig_01MwtEhNcLoziffeXBJmEEYM`, 8am
  UTC → Drive folder `1GLeqzy5IpYbpQtN-xll-LcH-AE3_LK8Q`):** 23 Sep's run
  ended after 30s with no doc; re-fired twice (14:49Z, 14:51Z) — same.
  Cause: the routine's sessions get NO Google Drive tools, and at ~14:55Z
  the Drive connector itself asked to be signed in again. Routines can't
  have connectors attached from here ("connectors parameter not available
  for this organization"). Fix = Joe signs Drive in again at
  claude.ai/customize/connectors and sets its tools to "Always allow".
  Today's prompts were written by hand and saved to Drive from the chat
  session (doc `1Glzq44_edeTi_IuZosSCMLGmD8Tw96IdC8I9Wnq-E7c`). A 4th run
  (14:58Z, after Joe set Drive to "Always allow") ran 5 min and still had
  NO Drive tools → the routine itself needs Google Drive added under its
  own settings (claude.ai → Routines → this routine → Connectors); account
  -level "Always allow" alone doesn't give it to routine sessions.
- **Pinterest covers not designed:** pins showed the raw pool photo because
  the Canva step wasn't set up (Joe's older templates had no data fields).
  **23 Sep: built a new brand template `EAHWBiN6j8A`** (1000x1500 pin:
  full-bleed photo, gold serif headline, "GK LEGEND STUDIO", dark gradient)
  with autofill fields `title` (text) + `photo` (image) — verified with a
  test autofill. Remaining (Mac `.env`): `CANVA_BRAND_TEMPLATE_ID=EAHWBiN6j8A`,
  `CANVA_TITLE_FIELD=title`, `CANVA_IMAGE_FIELD=photo`, plus
  `CANVA_CLIENT_ID/SECRET` and one `npm run canva-auth` if
  `canva-token.json` is missing → restart. No code change needed.
- **ffmpeg missing on Mac:** horizontal videos aren't converted to 9:16 (`brew install ffmpeg`).

### 🔜 Next (in order, only when Joe asks)
1. Canva `.env` values on the Mac (template `EAHWBiN6j8A` is ready).
1b. Joe: xAI credits/spending limit on team `3d338612…`; X token regenerate.
2. TikTok comment auto-replies via Buffer API — **blocked**: Buffer has no comment endpoints yet (see Known quirks).
3. Add X keys to `.env` on the Mac.
4. Fix OmniRoute so captions are AI-written again.

### 📅 Log
- **24 Sep 2026 ~20:40 London:** Joe's "Style DNA" (4 layers: Alindi/Guntiino/Shabal/Dirac textures · Kaban + Bakool/southern-plains light · GK stamp · 9:16 anamorphic volumetric high-contrast) added to `.claude/skills/gk-gabay-blueprint/SKILL.md` in a house-safe version: "high-fashion/stylized" → "tailored/premium" (artifacts), GK logo placed on objects not as a watermark, realism lines kept.
- **24 Sep 2026 ~20:35 London:** Joe's buraanbur "Jihaadka Hiddaha (The Anthem of the Brave)" → women's call-and-answer song + 2 Grok videos + caption via gk-gabay-blueprint: doc `1n2hdoF5u9ViAUoMbt2Us9pUnBhleNg_XY6oNhtRIrYk`. Flagged: "Jihaad" in a public title risks platform flagging (caption uses "The Anthem of the Brave"); alliteration changes per stanza (G / vowels / H / mixed); "guntiino" on "nin". No "deployment queue" exists — posting = drop finished video into GK_JING/GK_TERMINAL.
- **24 Sep 2026 ~20:30 London:** Joe asked to save the method as a skill → new repo skill `.claude/skills/gk-gabay-blueprint/SKILL.md` (iron rules, gabay alliteration check, song/video/caption workflow, safe vocabulary, checked facts, example doc ids). **Use it whenever Joe sends Somali verse or a heritage scene.** Joe's G-locked gabay "Xarafka G — The Sovereign Rally" (alliteration complete in every half-line) → song + opener video + caption: doc `1Xh80XoyY_ZQPPNBw9eQp3LKtSd_2MemcwUyXnnQVBt4`, pairs with the Sovereign Shield film.
- **24 Sep 2026 ~20:25 London:** Joe's scene "The Sovereign Shield (Gurmadka iyo Gobannimada)" (Shir under the acacia → Gurmad messenger → Iskaashi → stand on the ridge) → 4 Grok prompts (10 s each, house style) + Dhaanto/Kaban music prompt + caption: Drive doc `1nPp9Ug2IU2xt_n_jUISXNveRPvARCdMpctKIYRKJKjc` (GK_Viral_Prompts). Kept it defensive, no gore.
- **24 Sep 2026 ~20:20 London:** Joe sent a 2nd gabay "Mudane Geesi (The Son of the Soil)" (3 stanzas, vowel alliteration, countryman voice) → song doc `GK_Gabay_Mudane_Geesi_SONG_2026-09-24` (`1nMF7k--SRNRJ4MWebyG-3TK7IpWhbnRRzod6x27sGZE`): pastoral Qaraami music prompt, his verses spoken→half-sung→sung, English chorus hooked on his words "Mudane Geesi", Grok video prompt (herdsman + oodda thorn fence), caption. His words unchanged; asked about "Atkutaba". Pattern: when Joe sends Somali verse, keep it verbatim, build music/video/caption around it, only flag suspected typos.
- **24 Sep 2026 ~20:15 London:** Joe's "11 videos, nothing posted" → checked: nothing broken. Live log shows the batch posting 1 per 15 min (YouTube j4SJdZWel7E 19:46, yHyUL0QxwIA 20:01; 8 still in GK_TERMINAL); Make (next run 19:17Z, 1 per 25 min, runs only log when a file is found) picks them up after mirroring; TikTok queue now 15 waiting at 8/day so the new batch reaches TikTok over 2-3 days. Joe then sent his own Somali gabay "Hirta iyo Hiddaha" (2 stanzas, vowel alliteration) → built into the Soomaaliyeey song as spoken intro + bridge: Drive doc `GK_Gabay_Hirta_iyo_Hiddaha_SONG_2026-09-24` (`1swAK_ZNoc3R_Z6a3JusxkAlD7y0mQzQkLp9hiW01GEI`). His words unchanged; asked him about "ururkaoo" (typo?) and "Gabai"/"Gabay".
- **24 Sep 2026 ~19:40 London:** TikTok pause ENDED on time — live log 19:01: "TikTok (via Buffer): posted … (1/8 today, 13 still waiting)" (Sand_fusing_into_glass_disc), then 60-min gap respected (19:16, 19:31 no post). Queue will drain ≤8/day. Joe told he can Retry the 3 failed Buffer posts (kite, tea, haan) one per hour. Still in log: Canva `403 Missing scopes: [design:meta:read]` on every video (Joe hasn't re-authed yet), X "Invalid or expired token", ffprobe missing. Log gap 04:29→17:16 (Mac asleep/off).
- **24 Sep 2026 ~16:40:** Joe asked for a stronger Gabay-style patriotic song. Wrote "Soomaaliyeey" (spoken-gabay intro/bridge, one alliteration sound "S" through every line like a real gabay, Tubeec-style Qaraami music prompt, matching Grok video prompt, caption) → Drive doc `GK_Gabay_Patriotic_Song_SOOMAALIYEEY_2026-09-24` (`1WiRb0u6ciRxy0SaU8F23CJ2TnMPzB1i2ETpMo-5syow`, GK_Viral_Prompts). Lyrics are English; the only Somali word is "Soomaaliyeey" — Somali verses only from Joe or a real poem. Not generated (waits for Joe's "Go").
- **24 Sep 2026 ~16:35:** Joe said the Buraanbur prompt felt weak/not authentic. Used ARS fact-check + web sources to write 5 stronger Buraanbur prompts (poet-with-drum call-and-answer, one-leg shawl dance per family, 1950s anti-colonial buraanbur, Hawa Jibril-inspired first poem at 12, 3-generation diaspora) → Drive doc `GK_Buraanbur_Prompts_STRONG_2026-09-24` (`1Lkm4r_j5CbDta7qqQbYeR5JSYN9P6QRELK7d9YGTuHU`, in GK_Viral_Prompts), sources listed in it. No Somali verse written — Somali lines only from a real poem Joe picks. Don't depict real poets' faces.
- **24 Sep 2026 ~08:15:** Joe asked to add the Academic Research Skills plugin (github Imbad0202/academic-research-skills, v3.22.1) for deep research / fact-checking of Somali history & culture in Documentary-lane prompts. Enabled via `.claude/settings.json` (extraKnownMarketplaces + enabledPlugins) so every session in this repo gets it. Licence is CC-BY-NC 4.0 (non-commercial) — Joe was told; use it for checking facts, don't copy its text into published posts. Daily prompts doc for 24 Sep saved (`1zWIYNMWfYB8vpVX0HENzpDJ0-KQlmiaIfKMAgI7YBM8`).
- **23 Sep 2026 ~19:00:** Joe pulled PR #3+#4 and restarted 18:30 local. Canva upload now OK; next step fails: "Canva autofill check failed: 403 -- Missing scopes: [design:meta:read]". Added `design:meta:read` to `SCOPES` in `src/canvaAuth.js`. Joe must tick it on canva.com/developers → integration → Scopes, then `git pull` + `npm run canva-auth` + restart. TikTok pause confirmed in log ("paused until 9/24/2026, 7:00 PM"), videos queuing.
- **23 Sep 2026 ~18:40:** Joe's Buffer screenshots: the evening's TikTok posts (17:57, 17:59, 18:14) were ALL rejected with the same "Wait 24 hours" — the block from this morning was still active, so the 15/day cap didn't help. Added to `src/tiktokQueue.js`: `TIKTOK_PAUSE_UNTIL` (hold the whole queue, videos keep queuing), `TIKTOK_MIN_GAP_MINUTES` (default 60, no bursts), default cap lowered 15→8/day. Joe to set `TIKTOK_PAUSE_UNTIL=2026-09-24T19:00:00+01:00`. Failed Buffer posts: don't press Retry until after that time.
- **23 Sep 2026 ~18:15:** New batch (16 videos) posting since 17:28 local. TikTok queue confirmed working in the live log ("1/15 … 3/15 today"). Canva cover step failed on every video: "Canva asset upload failed: 400" → cause: `Asset-Upload-Metadata` header was base64 of the whole JSON; Canva wants JSON `{"name_base64": "…"}`. Fixed in `src/canvaCover.js` (+ Canva errors now show Canva's message). Until the Mac pulls it, pins use the raw pool photo (fallback).
- **23 Sep 2026 ~17:15:** Daily viral prompts FIXED another way: old routine `trig_01MwtEhNcLoziffeXBJmEEYM` (no Drive tools in its sessions) is now DISABLED; new routine `trig_01SkYCVsjTMjtRaA3pYeo5RW` (07:00 UTC = 8am London) fires into Joe's main chat session, which has Google Drive, writes + verifies the doc, and tells Joe the link. Joe set all Drive tools to Always allow. Nothing left for Joe to do on this.
- **23 Sep 2026 ~16:10:** PR #2 merged; Joe pulled, set Canva `.env` (template `EAHWBiN6j8A`, client id/secret + `canva-token.json` already present), `AUTO_GENERATE_VIDEOS=false`, restarted. Next: confirm first Canva-designed pin + TikTok queue lines in the live log. Viral-prompt routine still gets no Drive tools (see above).
- **23 Sep 2026 ~15:50:** Built Canva pin template `EAHWBiN6j8A` (title+photo fields). TikTok limit raised to 15/day (Joe: "no limit" — but the 24h block message is TikTok's own, so a cap stays). Grok: Joe uses Grok Automations, not the paid API; re-fired the daily prompt routine (today's doc was missing).
- **23 Sep 2026 ~15:40:** Joe's screenshots: TikTok rejected ~12 posts (daily API limit) → built TikTok queue, 10/day (`src/tiktokQueue.js`, PR #2). Grok reason found: xAI team out of credits / spending limit (runs 1pm, `AUTO_GENERATE_HOURS=13`). Pinterest pins show raw photos, not Canva designs — Canva templates lack data fields (steps above). Make field `6` confirmed working (pins have unique photos).
- **23 Sep 2026 ~11:20:** Make batch 2 done: GK_JING empty, every Make run 05:47–09:32Z succeeded. Grok: the log has NO auto-generate line at all since the 03:16 restart (not even a failure), and the 8am slot passed silently. The code can only skip silently if `AUTO_GENERATE_VIDEOS` isn't `true` in `.env` or `autogen-state.json` already lists today's slots. Asked Joe to run the check below. The `grok-video-<id>.mp4` files posted overnight were Joe's own downloads; auto-made ones are named `grok-auto-<time>.mp4`. X is still waiting on a regenerated token.
  Mac check: `cd ~/gk-automation && grep -E '^AUTO_GENERATE' .env; cat autogen-state.json`
- **23 Sep 2026 ~06:45:** 2nd batch (9 + 1 extra from GK_JING) all posted to YouTube + TikTok by 05:50. X failed every one ("Invalid or expired token") — Joe still needs to regenerate the X access token. Make: all runs success; 10 videos queued in GK_JING, done ~11:00. No Grok attempt logged since the restart yet.
- **23 Sep 2026 ~03:50:** New 9-video batch started; YouTube+TikTok posting fine. X now tries but X rejects the token ("Invalid or expired token") — needs regenerated access token.
- **23 Sep 2026 ~03:30:** X keys written into the Mac's `.env` (were empty). Batch done: YouTube 20/20, TikTok 18/20 (2 failed before the Buffer fix), Make finishing last 9 by ~06:30.
- **23 Sep 2026 (later):** tonight's work merged into `desktop-script` (PR #1). Grok errors now show xAI's reason. X keys: Joe says saved, script still sees none — checking names/file.
- **22-23 Sep 2026:** TikTok via Buffer fixed (REST → GraphQL; every Buffer post had failed with 401 since 21 Sep). Pinterest cover field fixed `7`→`6`. 20-video batch posted one at a time. Comment-reply plan recorded. Status board created.

## The one thing to remember

Two separate systems each own half the platforms. Both watch a pair of
Google Drive folders that mirror each other:

- **`GK_JING`** — watched by **Make.com** scenario `9696465` ("Social media
  post"), team 1643250. Posts to **Instagram, Facebook, Pinterest**.
- **`GK_TERMINAL`** — watched by **this repo's script** (`src/index.js`,
  run via a `launchd` agent `com.gklegend.automation.plist` on Joe's Mac,
  working dir `~/gk-automation`). Posts to **YouTube, TikTok, and X
  (Twitter)** — X posting (`src/twitter.js`) only fires after YouTube
  succeeds for that video, same gating as TikTok/Pinterest below. Configured
  via `X_API_KEY`/`X_API_SECRET`/`X_ACCESS_TOKEN`/`X_ACCESS_TOKEN_SECRET` in
  `.env` (OAuth 1.0a user-context credentials from developer.x.com's "Keys
  and tokens" page — no interactive login flow needed, unlike
  TikTok/Pinterest). **They must be lines in the `~/gk-automation/.env`
  file** — on 20 Sep 2026 they were typed at the Terminal prompt instead
  (visible in Joe's Drive "MY Memory" → "Terminal Saved Output.txt"), which
  saves nothing, so X has never actually posted. No daily cap on X posting,
  unlike Pinterest's trial-access limit (see below).

A background job on each side copies any video that lands in one folder into
the other (Make does this inside scenario 9696465; the script does it via
`mirrorNewVideos()` in `src/drive.js`). So **it never matters which folder
Joe drops a video into** — both eventually get a copy and each side posts to
its own platforms independently. They use separate copies (different file
IDs), so one side's move-to-done never affects the other's copy.

Once a side finishes posting a video, it moves **its own copy** to a DONE
folder (`GK_JING_DONE` for Make; the script's own done folder, see
`DONE_FOLDER_ID` in `.env`, for YouTube/TikTok). **Only move/trash a video
from one of these folders if you're sure that specific side already
processed it** — moving a file out of GK_JING/GK_TERMINAL before it's been
seen makes it invisible to that side forever (this has bitten us before:
cleaning up Make's stuck-file bug once accidentally hid videos from the
YouTube/TikTok script too, since it had already been living in GK_JING_DONE
instead of GK_TERMINAL).

## Captions — one shared source of truth

Google Sheet **"GK_ spreadsheet"** (`1RlI_viqzggtblKH1EXtC5_qkwzyr2-rvXMPzp3DUZpo`,
tab `Sheet1`), columns: `A Original Filename | B New Filename | C Time |
D Title | E Capture | F Hashtag | G Cover Image URL`. Column G exists in
code (`src/sheets.js`) even on rows where it's still blank — see the
Pinterest cover images section below.

- Make's scenario looks up a row by filename (`google-sheets:filterRows`) —
  if there's no row, or Title is blank, that video's post caption is empty.
- The local script does the same (`findRowForFile` in `src/sheets.js`), but
  if there's no row it **writes one automatically** using AI
  (`generateCaption` in `src/autoCaption.js`, via the local OmniRoute
  helper) before posting — so YouTube/TikTok never gets stuck on a missing
  caption, but Instagram/Facebook/Pinterest can if nobody backfills the row.
- A standing background routine in this Claude Code account
  ("Write GK Legend captions for GK_JING videos") also checks GK_JING
  periodically and backfills any missing row in GK Legend's brand voice, so
  this rarely needs manual attention. This routine only ever writes text
  (columns A/D/E/F) — it never touches column G.

## Pinterest cover images (per-video)

There's a real, already-built pipeline for giving each video its own unique
Pinterest cover instead of reusing one of 4 generic branded templates. Every
call site goes through one function, `getCoverImage(auth, title)` in
`src/coverImage.js`.

**The intended flow (Joe's actual plan):** Joe drops a raw/source **photo**
(no design needed) into the manual pool — the Drive folder
`GK_Pinterest_Covers` (id `1_2dyzrmG9wr_F67mKUHLIPOMczP2XgRl`, created
15 Sep 2026, sits next to GK_JING/GK_TERMINAL under `02_Brand_Assets`).
`src/coverPool.js` downloads the oldest untouched photo and moves the Drive
original into the folder's `Done` subfolder (id
`12zc1JcJkeYfoG6oc_9CCwkrqHnvjUfSe`, matching the `DONE_FOLDER_ID`/
`GK_JING_DONE` naming used everywhere else in this pipeline) so it's never
picked twice. That photo then gets run through the **Canva brand template**
(`src/canvaCover.js`) — autofilling both the title text field
(`CANVA_TITLE_FIELD`) and an image placeholder field (`CANVA_IMAGE_FIELD`)
in the same autofill call, via Canva's asset-upload API — producing one
polished, on-brand, titled Pinterest cover per video instead of a raw photo
or a generic template. Requires `CANVA_CLIENT_ID`/`CANVA_CLIENT_SECRET`, a
one-time OAuth login (`src/canvaAuth.js`), `CANVA_BRAND_TEMPLATE_ID`, and
the brand template having **both** a title field and an image field tagged
as data fields (Canva's "Bulk create" app, same process for each).

**Fallbacks if any of that isn't set up yet** (so this never blocks
posting): a dropped photo with Canva not configured (or a Canva run that
fails) just gets used as the cover directly, as-is. No photo in the pool at
all falls back to text-only Canva autofill (the original, simpler version
of this feature) if `CANVA_BRAND_TEMPLATE_ID` is set. Neither available ->
`getCoverImage()` returns `''` and Make's generic 4-image rotation is used
instead — not a bug, just nothing to work with yet.

Whichever source wins, the resulting link gets written into **column G** of
the caption sheet (`appendGeneratedRow`/`updateCoverImage` in `src/sheets.js`)
— for GK_TERMINAL videos via `processVideo()`, for GK_JING videos via
`backfillGkJingCaptions()` (also fills in column G on a row that already has
a caption but is still missing a cover, e.g. one the hourly Claude Code
caption routine wrote — that routine only ever writes text, never a cover).

**Keeping the pool clean — `npm run organize-covers` (`src/organizeCoverPool.js`).**
Joe bulk-drops photos into `GK_Pinterest_Covers` in large batches from
wherever he's been collecting them, which routinely mixes in: browser-export
junk (stray `.html`/binary files, not images), watermarked stock-photo
thumbnails (filenames starting `watermarked_img_` — unusable as a real
cover), and exact duplicate photos saved more than once. Running this script
sorts all of that out of the main pool into three subfolders it
finds-or-creates inside `GK_Pinterest_Covers` — `Papers` (non-image files),
`Watermarked - Not Used` (by filename prefix), `Duplicates` (exact-match via
Drive's `md5Checksum`, oldest copy kept) — leaving only clean, unique photos
in the pool for `coverPool.js` to hand out. Safe to run any time, including
repeatedly; already-sorted files are left alone. Run it after every big
batch Joe drops in.

**Make's scenario reads column G too** (the "Create Pinterest Video Pin"
step's `cover_image_url` field, both the main path and its retry twin) —
`{{ifempty(<row>.`6`; <4-image day-of-month rotation>)}}`. So: a unique
cover if column G has one, otherwise the generic rotation as a fallback.
**Make's sheet columns are numbered from 0**: A=`0`, D Title=`3`,
E Capture=`4`, F Hashtag=`5`, **G Cover=`6`** — check the caption fields in
the same scenario, which use `3`/`4`/`5`, if in doubt. On 15 Sep 2026 this
field was wrongly "fixed" from `6` to `7` (the empty column H), so every
pin silently fell back to the generic "Somali culture" rotation cover even
though column G was full of unique covers — Joe saw the same cover night
after night. Corrected back to `6` on 22 Sep 2026. **Do not change it to
`7` again.** If Pinterest covers look repetitive, first check column G in
the sheet has a link, then check this field says `6`.

If neither source has anything available, `getCoverImage()` returns an empty
string and everything above is a no-op — Pinterest pins just use the
generic 4-image rotation, which is expected, not a bug.

## Why two systems instead of one

Make.com has zero YouTube/TikTok upload capability that survives real use
(YouTube posting broke repeatedly on caption/title mapping; there's no
TikTok app in Make at all). So YouTube+TikTok live in this hand-rolled
Node script instead, using the real YouTube Data API and TikTok Content
Posting API directly. Instagram/Facebook/Pinterest stay on Make since that
side has worked reliably.

## Known quirks worth remembering

- **TikTok only gets attempted after YouTube succeeds for that video**, and
  the video is only marked DONE once YouTube succeeds (see `processVideo()`
  in `src/index.js`). If YouTube fails for a video, it just retries next
  cycle — TikTok is never attempted in the meantime. A broken YouTube step
  silently blocks TikTok too.
- **`TIKTOK_USE_SANDBOX=true`** forces every TikTok post to `SELF_ONLY`
  (private, visible only to Joe's own account) — this is a TikTok
  requirement for unaudited apps, not a bug.
- **TikTok posting now goes through Buffer, not TikTok's own API** (as of
  21 Sep 2026) — `src/bufferTikTok.js`, wired into `processVideo()` in
  `src/index.js` ahead of the old direct-API path. TikTok's Production app
  review is still pending, so the direct integration (`src/tiktok.js` /
  `src/tiktokAuth.js`, still present but no longer called) is stuck posting
  `SELF_ONLY` per the sandbox note above; Buffer's own TikTok connection
  (`kamaldii1` account, "Buffer #2" in Zapier) is already approved and posts
  publicly, confirmed with a real live test post. Controlled by
  `BUFFER_ACCESS_TOKEN` / `BUFFER_TIKTOK_PROFILE_ID` in `.env` — if either is
  blank the script falls back to the old direct TikTok path automatically.
  Buffer needs a public URL to fetch the video from, so this briefly flips
  the source Drive file's sharing to "anyone with the link" (same pattern
  `uploadPublicImage()` already uses for cover images) and leaves it that
  way afterward — fine since the same video is about to be public on
  YouTube/Twitter/Pinterest anyway. If TikTok posts stop showing up, check
  Buffer's own dashboard/connection status before assuming the script died.
  **Uses Buffer's GraphQL API (`https://api.buffer.com`), not the old REST
  API** — Joe's `BUFFER_ACCESS_TOKEN` is a new-style Buffer API key, which
  the REST API rejects with "Public API tokens are not accepted for REST API
  access" (this broke the very first real post on 22 Sep 2026). The script
  looks up the TikTok channel on the Buffer account by itself, so
  `BUFFER_TIKTOK_PROFILE_ID` is optional now (used only if it matches a real
  channel id).
- **TikTok comment auto-replies: decided plan, not built yet (22-23 Sep
  2026).** Joe wants the Mac script to thank/welcome TikTok commenters
  automatically (e.g. sticker/emoji comments get "Thank you for the love 🙏
  Welcome to the GK Legend family ✨"). **Joe does NOT use Zapier for this —
  it goes through the Buffer API from this script, same as TikTok posting.**
  Blocker: Buffer's GraphQL API has no comment endpoints yet (on Buffer's
  API roadmap as "Community endpoints"), and TikTok's own API doesn't allow
  comment replies for this app. When Buffer ships them, add a
  `replyToBufferComments()` step to `checkOnce()` in `src/index.js`, next to
  `replyToNewComments()` (YouTube). Until then Joe replies by hand in Buffer
  → Community. Don't propose Zapier/Make/other tools for this again.
- The script must actually be **running** to do anything — it's a
  `launchd` background process on Joe's Mac, not something living in the
  cloud. If videos pile up and nothing posts to YouTube/TikTok, the first
  thing to check is whether the process is alive
  (`launchctl list | grep gklegend`, or check `~/gk-automation/automation.log`).
- **Auto-generating new videos** (not posting — generating brand-new ones
  with Grok Imagine, 3x/day at ~8am/1pm/6pm) is a feature of this script too
  (`maybeAutoGenerateVideo` in `src/autoGenerate.js`), gated behind
  `AUTO_GENERATE_VIDEOS=true` in `.env`. It needs a local AI helper
  ("OmniRoute", `http://localhost:20128`) running on Joe's Mac to write the
  video concept — falls back to a small hardcoded list of concepts if that's
  unreachable, so it still works, just less freshly.
- Make's Facebook route and the script's YouTube upload both post the same
  engagement-invite comment after every video ("👀 What did you think? Drop
  a comment below..." — see `postEngagementComment` in `src/youtube.js`),
  plus the script separately replies to comments others leave
  (`replyToNewComments` in `src/comments.js`).
- Every video that generates fresh (via the daily Grok-prompts routine, or
  via `autoGenerateVideos`) should include: a first-second hook, loud
  described sound, GK Legend branding worked into the scene, explicit
  photorealism language (avoid "high-fashion"/"stylized" — it causes visible
  AI artifacts), tight framing when a person interacts with an animal/object,
  and a short bold on-screen subtitle. This house style lives in the daily
  "Write daily viral video prompts for GK" Claude Code routine — update that
  routine (not just one day's doc) when the style needs to change again.

## Separate from all of the above: Manychat

Instagram DM/comment auto-replies and Facebook Messenger auto-replies run
through **Manychat** (manychat.com), not Make.com or this script — Make has
no messaging/DM capability at all. Two separate Manychat workspaces exist
(one per platform, free tier: 25 contacts/2 channels). This isn't code —
it's configured entirely in the Manychat dashboard and can't be checked or
fixed from a coding session; ask Joe to check the Manychat dashboard
directly if a reply isn't firing.

## Brand & creative voice reference

This is the current, authoritative brand guide — used for writing captions,
video/song prompts, and any other GK Legend Studio copy. It replaces any
older brand-brief document that mentioned Buffer, Zapier, Asana, or hosting
things on an external storefront domain — none of that is part of this
pipeline. If a routine or session turns up an old copy of that material,
treat this section as the replacement.

**Core philosophy** — GK Legend Studio doesn't just make posts or products,
it curates artifacts: the bridge between Somali ancestral heritage (Alindi
weaving, Kaban resonance) and a cinematic modern future. Cultural
preservation through the work itself.

**Visual identity** — high-contrast, cinematic, editorial (a documentary
still, not an ad). Deep earth tones (ochre, gold, midnight black) balanced
against future-forward metallic accents. Cultural anchors — Alindi
textiles, Guntiino, Shabal — rendered with real specificity, never generic
"African print" styling. The GK logo integrated organically into the frame,
like a signature on a painting, not a watermark slapped on top.

**Audio/music style** — Kaban (oud) as lead instrument, never a background
prop: heavy, melancholic vibrato, microtonal slides. Traditional playing run
through clean modern compression — intimate and high-fidelity, not lo-fi.
Slow-attack synth pads underneath for warmth (the "Alindi" layering feel).
Slow syncopated 6/8 or 4/4 groove, felt sub-bass, dry crisp snare. Vocals:
breathy, vulnerable verses breaking into soaring, melismatic choruses —
telling a story, not just singing. Space between phrases matters as much as
the notes. Every track closes with a short, recognizable "audio logo" pluck
identifying it as GK Legend Studio.

**Post structure ("Heritage Drop")** — (1) The Hook: one evocative line
that stops the scroll. (2) The Story: the artisan, material, or cultural
significance. (3) The Vision: a line describing the visual/cinematic
direction, for later asset generation. (4) The Call: invite the audience to
*secure* or *join* — never "buy." (5) Footer (mandatory on every public
post): copyright notice + channel link (see below).

**Voice** — never "sell," always *invite*. Preferred CTA phrasing: "Secure
a Piece of the Legacy." Warm, human, specific to the craft — if a draft
reads corporate, rewrite it around the person/craft behind it. Never invent
phonetic-sounding filler and call it "Somali" or "Benadiri" — if a real
word or detail isn't known, ask rather than fabricate.

**Mandatory footer on public content:**
> © 2026 GK Legend Studio. All rights reserved.
> https://www.youtube.com/@PathFoundGK

**Generation safety valve** — never generate an actual image/video/audio
asset based on this guide until Joe explicitly says "Generate now" or "Go."
Everything before that is text/prompt refinement only.

**Somali music reference (for grounding lyrics/captions in real tradition)**
— two distinct traditions, don't conflate them:
- *Banaadiri (Xamari)* — coastal Mogadishu tradition, Kaban-led, local
  dialect. Reference artist: Axmed Shariif Killer (solo, reverent); duet
  partner Siteey Maxamed Sheekh ("Qosol Wanaag") — signature duet "Qayr Iyo
  Qasaaro."
- *Pan-Somali Qaraami* — standard literary Somali, wider mainstream
  tradition. Reference artist: Maxamed Saleebaan Tubeec — signature
  "Hodan."

Poetic meters: *Gabay* (long-form, 100+ lines, formal, deliberate — the
prestige form) vs. *Geeraar* (short, urgent, high-energy, traditionally
chanted on horseback — closer to a rap cadence).

Practical rule: "Benadiri/soul" → Killer solo mode. "Back-and-forth
Benadiri" → Killer + Qosol Wanaag duet dynamic. "Somali" (not Benadiri) →
Tubeec-style Qaraami. "Gabay" → long and weighty. "Geeraar" → short and
punchy.

## Other Google Drive folders in play

- `GK_JING_DONE` — Make's done folder for IG/FB/Pinterest.
- `GK_JING_TOO_LARGE` — videos too big for Cloudinary's upload limit inside
  Make (~60MB base64); need compressing before they can post via Make.
- Whatever `DONE_FOLDER_ID` points to in the script's `.env` — the script's
  own done folder for YouTube/TikTok.
