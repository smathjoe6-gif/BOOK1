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
tab `Sheet1`), columns: `Original Filename | New Filename | Time | Title |
Capture | Hashtag`.

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
  this rarely needs manual attention.

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

## Other Google Drive folders in play

- `GK_JING_DONE` — Make's done folder for IG/FB/Pinterest.
- `GK_JING_TOO_LARGE` — videos too big for Cloudinary's upload limit inside
  Make (~60MB base64); need compressing before they can post via Make.
- Whatever `DONE_FOLDER_ID` points to in the script's `.env` — the script's
  own done folder for YouTube/TikTok.
