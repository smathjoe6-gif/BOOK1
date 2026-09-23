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
| TikTok posting | Mac script → queue (`src/tiktokQueue.js`, max `TIKTOK_DAILY_LIMIT`=10/day) → Buffer GraphQL API (`src/bufferTikTok.js`) | first 20 posted 22-23 Sep; see TikTok daily limit below |
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
  most `TIKTOK_DAILY_LIMIT` (default 10) per day, one per cycle; extras wait
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
  it works, then 1/day.
- **Pinterest covers not designed:** pins show the raw pool photo, because
  the Canva step isn't set up. Checked 23 Sep via Canva: Joe has brand
  templates (incl. "Cinematic Documentary-Style Pin Cover" `EAHVCdKpybI`,
  "Pinterest Pin - Elderly Man Speaking" `EAHVCThTlF0`) but **none has
  autofill data fields** (both return an empty dataset). To finish: in Canva
  open the pin template → Apps → Bulk create → connect the headline text as
  a data field named `title` and the photo frame as an image field named
  `photo` → republish template; then in `.env`: `CANVA_BRAND_TEMPLATE_ID=
  EAHVCdKpybI`, `CANVA_IMAGE_FIELD=photo` (+ `CANVA_CLIENT_ID/SECRET`, then
  `npm run canva-auth` once) → restart. No code change needed.
- **ffmpeg missing on Mac:** horizontal videos aren't converted to 9:16 (`brew install ffmpeg`).

### 🔜 Next (in order, only when Joe asks)
1. Canva pin template data fields + `.env` (see "Pinterest covers not designed").
1b. Joe: xAI credits/spending limit on team `3d338612…`; X token regenerate.
2. TikTok comment auto-replies via Buffer API — **blocked**: Buffer has no comment endpoints yet (see Known quirks).
3. Add X keys to `.env` on the Mac.
4. Fix OmniRoute so captions are AI-written again.

### 📅 Log
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
