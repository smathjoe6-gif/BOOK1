# GK Legend Studio — Automation

Watches your GK_JING Google Drive folder and automatically posts new videos to
YouTube and TikTok, directly via their own APIs — no Buffer, no subscriptions.
Runs entirely on your own Mac.

Instagram, Facebook, and Pinterest are handled separately by the "Social media
post" scenario on Make.com — this script doesn't touch those.

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
background — ask Claude how, when you're ready). It checks your GK_JING
folder every 10 minutes (configurable in `.env`), and for every new video
that has a matching row in your GK_ spreadsheet (or an AI-generated one if
there isn't), it posts to YouTube and TikTok directly, then moves the video
into your DONE folder.

Videos without a matching spreadsheet row still get posted — the AI writes a
title/caption for them and saves that row for you automatically.

## Optional: automatic video creation

You can have the script create its own videos with xAI's Grok Imagine API —
no browser, no daily free-credit limits, just a real API that runs on its
own schedule. It costs real money per video (roughly a few cents per second
at current pricing), so it's off by default.

To turn it on:

1. Get an API key from x.ai (this is separate billing from your regular
   Grok/X subscription — it needs its own payment method added).
2. In `.env`, set:
   ```
   XAI_API_KEY=your-key-here
   AUTO_GENERATE_VIDEOS=true
   AUTO_GENERATE_DAILY_LIMIT=1
   ```
   `AUTO_GENERATE_DAILY_LIMIT` caps how many videos it's allowed to make per
   day, so you're never surprised by the bill. Raise it once you're
   comfortable with the cost.

Auto-generated videos get uploaded into GK_JING like any other video, so they
go through the exact same captioning and posting flow.
