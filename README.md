# GK Legend Studio — Automation

Watches your GK_JING Google Drive folder and automatically posts new videos to
YouTube, TikTok, Facebook, Pinterest and Instagram — no Zapier, no Make.com,
runs entirely on your own Mac.

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
   Open `.env` and check the values — the Google and Buffer credentials are
   already filled in from your memory doc. Leave the `BUFFER_..._CHANNEL_ID`
   lines empty for now, step 4 fills those in.

3. Log in with Google (only needed once):
   ```
   bun run auth
   ```
   This opens your browser — approve access with your Google account. It saves
   a `token.json` file so you never have to log in again.

4. Find your Buffer channel IDs:
   ```
   node src/buffer.js
   ```
   This prints your connected Buffer channels and their IDs. Copy each one
   into the matching line in `.env` (e.g. `BUFFER_TIKTOK_CHANNEL_ID=...`).

## Running it

```
bun start
```

Leave this running in a Terminal window (or set it up to run in the
background — ask Claude how, when you're ready). It checks your GK_JING
folder every 10 minutes (configurable in `.env`), and for every new video
that has a matching row in your GK_ spreadsheet, it posts to YouTube directly
and to TikTok/Facebook/Pinterest/Instagram through Buffer, then moves the
video into your DONE folder.

Videos without a matching spreadsheet row are safely skipped (not posted with
a blank title) — add the row, and it'll be picked up on the next check.
