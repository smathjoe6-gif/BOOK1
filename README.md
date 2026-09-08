# GK Legend Studio — Automation

Watches your GK_TERMINAL Google Drive folder and automatically posts new
videos to YouTube and TikTok, directly via their own APIs — no Buffer, no
subscriptions. Runs entirely on your own Mac.

Instagram, Facebook, and Pinterest are handled separately by the "Social
media post" scenario on Make.com, which watches its own folder (GK_JING) —
this script doesn't touch those. Drop a video into GK_TERMINAL for
YouTube/TikTok, or into GK_JING for Instagram/Facebook/Pinterest.

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

3. Log in with Google (only needed once):
   ```
   bun run auth
   ```
   This opens your browser — approve access with your Google account. It saves
   a `token.json` file so you never have to log in again.

4. Log in with TikTok (only needed once):
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
   AUTO_GENERATE_DAILY_LIMIT=3
   AUTO_GENERATE_DURATION_SECONDS=10
   ```
   With these settings it aims for roughly three videos a day — morning
   (~8am), early afternoon (~1pm), and evening (~6pm), local time on this
   Mac — instead of just spacing them evenly. `AUTO_GENERATE_DAILY_LIMIT`
   caps how many it's allowed to make per day; it only uses the first N of
   those three time slots if you set it lower than 3.

   **Cost at these settings**: 10 seconds at 720p is about $0.80/video.
   Three a day is roughly **$2.40/day, ~$72/month**. Lower
   `AUTO_GENERATE_DURATION_SECONDS` or `AUTO_GENERATE_DAILY_LIMIT` to spend
   less.

Concepts alternate between two lanes: broad, widely-shareable content with
no cultural framing needed, and GK Legend Studio's Somali heritage lane —
both written for a first-second hook and described sound, since Grok
Imagine generates real audio synced to what's described in the prompt.

Auto-generated videos get uploaded into GK_TERMINAL like any other video, so
they go through the exact same captioning and posting flow (YouTube +
TikTok). Ask Claude if you'd rather have them land in GK_JING for
Instagram/Facebook/Pinterest instead.
