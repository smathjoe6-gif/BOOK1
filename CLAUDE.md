# GK Legend Studio — Social Media Automation

This repo (branch `desktop-script`) plus a Make.com account together run Joe's
fully automatic social posting pipeline for GK Legend Studio. **The goal: Joe
drops a finished video into `GK_JING` (or `GK_TERMINAL`) in Google Drive and
it posts everywhere on its own — no explanation needed each time.** This file
is that explanation, written down once.

## The one thing to remember

Two separate systems each own half the platforms. Both watch a pair of
Google Drive folders that mirror each other:

- **`GK_JING`** — watched by **Make.com** scenario `9696465` ("Social media
  post"), team 1643250. Posts to **Instagram, Facebook, Pinterest**.
- **`GK_TERMINAL`** — watched by **this repo's script** (`src/index.js`,
  run via a `launchd` agent `com.gklegend.automation.plist` on Joe's Mac,
  working dir `~/gk-automation`). Posts to **YouTube, TikTok**.

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
`src/coverImage.js`, which tries two sources in order:

1. **The manual pool (`src/coverPool.js`) — the simple option, zero setup.**
   Joe drops finished cover images straight into the Drive folder
   `GK_Pinterest_Covers` (id `1_2dyzrmG9wr_F67mKUHLIPOMczP2XgRl`, created
   15 Sep 2026, sits next to GK_JING/GK_TERMINAL under `02_Brand_Assets`) —
   any tool, exported by hand, no Canva API/OAuth needed. Each time a video
   needs a cover, the script takes the oldest untouched image in that
   folder, makes it publicly viewable, and moves it into the folder's
   `Used` subfolder (id `12zc1JcJkeYfoG6oc_9CCwkrqHnvjUfSe`) so it's never
   handed out twice. Config: `COVER_POOL_FOLDER_ID`/`COVER_POOL_USED_FOLDER_ID`
   in `.env`, already defaulted to those two IDs.
2. **The Canva API (`src/canvaCover.js`) — the advanced, fully-automatic
   option.** Only used if the pool is empty. Autofills a Canva **brand
   template** (`CANVA_BRAND_TEMPLATE_ID`) with the video's title, exports a
   PNG, uploads it to `PINTEREST_COVERS_FOLDER_ID`. Needs
   `CANVA_CLIENT_ID`/`CANVA_CLIENT_SECRET` and a one-time OAuth login
   (`src/canvaAuth.js`) — if that's not set up, this step is just skipped.

Whichever source wins, the resulting link gets written into **column G** of
the caption sheet (`appendGeneratedRow`/`updateCoverImage` in `src/sheets.js`)
— for GK_TERMINAL videos via `processVideo()`, for GK_JING videos via
`backfillGkJingCaptions()` (also fills in column G on a row that already has
a caption but is still missing a cover, e.g. one the hourly Claude Code
caption routine wrote — that routine only ever writes text, never a cover).

**Make's scenario reads column G too** (the "Create Pinterest Video Pin"
step's `cover_image_url` field, both the main path and its retry twin) —
`{{ifempty(<row>.`7`; <4-image day-of-month rotation>)}}`. So: a unique
cover if column G has one, otherwise the generic rotation as a fallback.
**This field literally broke once already** (it was pointing at field `6`
— the Hashtag column — instead of field `7`, so it silently never found a
real cover and always fell back to the generic rotation even when a cover
existed). Fixed 15 Sep 2026 — if Pinterest covers ever look wrong/repetitive
again, check this field first before assuming the bug is back.

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
  requirement for unaudited apps, not a bug. If TikTok posts aren't showing
  up publicly, check this first before assuming something's broken.
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
