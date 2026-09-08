# GK Legend Studio — Automation

Watches your GK_TERMINAL Google Drive folder and automatically posts new
videos to YouTube and TikTok, directly via their own APIs — no Buffer, no
subscriptions. Runs entirely on your own Mac.

Instagram, Facebook, and Pinterest are handled separately by the "Social
media post" scenario on Make.com, which watches its own folder (GK_JING) —
this script doesn't touch those directly. But the two folders mirror each
other automatically: drop a video into **either** GK_TERMINAL or GK_JING
and it gets copied into the other one too, so it reaches all 5 platforms
(YouTube, TikTok, Instagram, Facebook, Pinterest) no matter which folder
you use.

## One-time setup

1. Install dependencies:
   ```
   bun install
   ```
   (or `npm install` if you don't have Bun)

2. Create your real settings file:
   ```
   cp .env.example .env
   ```
   Open `.env` and fill in the Google and TikTok credentials (see your
   GK_Automation_Memory Google Doc). Never commit this file.

3. Set `MIRROR_FOLDER_ID` in `.env` to GK_JING's folder ID, so videos
   dropped into either folder reach every platform. Leave it blank if you'd
   rather keep the two folders separate.

4. Log in with Google (only needed once):
   ```
   bun run auth
   ```
   This opens your browser — approve access with your Google account. It saves
   a `token.json` file so you never have to log in again.

5. Log in with TikTok (only needed once):
   ```
   node src/tiktokAuth.js
   ```
   This opens your browser to approve access with the TikTok account this app
   posts to. Saves a `tiktok_token.json` (or `tiktok_token.sandbox.json` if
   `TIKTOK_USE_SANDBOX=true`) so you don't have to log in again.

## Running it

```
bun start
```

Leave this running in a Terminal window (or set it up to run in the
background — ask Claude how, when you're ready). It checks your GK_TERMINAL
folder every 10 minutes (configurable in `.env`), and for every new video
that has a matching row in your GK_ spreadsheet (or an AI-generated one if
there isn't), it posts to YouTube and TikTok directly, then moves the video
into your DONE folder.

Videos without a matching spreadsheet row still get posted — the AI writes a
title/caption for them and saves that row for you automatically.

## Optional: automatic video creation

You can have the script create its own videos with xAI's Grok Imagine API —
no browser, no daily free-credit limits, just a real API that runs on its
own schedule, with real synced sound (not silent). It costs real money per
video, so it's off by default.

To turn it on:

1. Get an API key from x.ai (this is separate billing from your regular
   Grok/X subscription — it needs its own payment method / prepaid credit
   added at console.x.ai).
2. In `.env`, set:
   ```
   XAI_API_KEY=your-key-here
   AUTO_GENERATE_VIDEOS=true
   AUTO_GENERATE_DAILY_LIMIT=1
   AUTO_GENERATE_DURATION_SECONDS=4
   ```
   With these settings it aims for one video a day, in the morning
   (~8am local time on this Mac). `AUTO_GENERATE_DAILY_LIMIT` caps how many
   it's allowed to make per day — raising it uses more of the fixed daily
   time slots (morning/~1pm/~6pm).

   **Cost at these settings**: 4 seconds at 720p is about $0.32/video, so
   roughly **$9.60/month** at one a day. Raising duration or the daily
   limit raises this proportionally — e.g. 3/day at 10 seconds is closer to
   **$72/month** — so check the math before raising either.

Concepts alternate between two lanes: broad, widely-shareable content with
no cultural framing needed, and GK Legend Studio's Somali heritage lane —
both written for a first-second hook and described sound, since Grok
Imagine generates real audio synced to what's described in the prompt.

Auto-generated videos get uploaded into GK_TERMINAL like any other video, so
they go through the exact same captioning and posting flow — and mirror
into GK_JING too if `MIRROR_FOLDER_ID` is set, reaching every platform.

## Free alternative: manual prompts

If you'd rather not pay per video, check the **GK_Viral_Prompts** Drive
folder — a fresh batch of ready-to-paste viral video prompts (written with
the same first-second-hook, real-sound approach as above) lands there every
morning automatically. Paste one into your own Grok app (covered by your
existing subscription, no extra cost) to generate a video yourself, then
drop the finished file into GK_TERMINAL or GK_JING like any other video.
