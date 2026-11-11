# CapCut job card (for the Claude desktop session on Joe's Mac)

Read this whole card first. It is Joe's standing instruction; he should not have to repeat it.
Pull the newest copy: `cd ~/gk-automation && git pull`.

## Goal
Make **2 viral-style videos per run** (10 to 11 seconds, 9:16) in **CapCut on the web**, in Joe's own Chrome
(already signed in, year plan, free templates, about 838 credits). Use a **different template each time**.
Short, loud, one clear feeling. Joe's hits were 6 to 11 s clips; long or stitched videos got 11 to 500 views.

## Hard rules (never break)
- NEVER press Renew, Upgrade, Buy credits, Free credits upsells, or any payment button. If anything asks for
  payment or a login, STOP and tell Joe.
- Only Joe's own clips and music. No real people (no politicians, no famous faces). The GK Legend crest may appear
  on an OBJECT, never as a watermark.
- Never post anything yourself. The pipe posts whatever lands in `~/GK_DROP`.
- Do not touch `.env`, `~/gk-automation`, or Drive files other than reading music.

## Clips (only from ONE folder)
- Use ONLY `~/GK_CAPCUT_CLIPS`. Joe puts his best clips there. Do not browse `~/GK_DROP/done` (434+ files, too many).
- If the folder is empty, copy 12 clips of 6 to 11 s from `~/GK_DROP/done` (no real people, 9:16, loud/visual) into it,
  then tell Joe which ones.
- CapCut web has an upload size limit. Make small copies with ffmpeg before uploading, for example
  `ffmpeg -y -i in.mp4 -t 3 -vf scale=720:-2 -c:v libx264 -crf 28 -an ~/GK_CAPCUT_WORK/clip_NN.mp4`
  (keep the originals untouched; work only in `~/GK_CAPCUT_WORK`).

## Music (Joe's own, already sorted by Gemini)
- Joe's vault is Drive folder `GK_MUSIC_VAULT` (about 1,000 to 2,000 songs). On the Mac it is under
  `~/Library/CloudStorage/GoogleDrive-*/My Drive/02_Brand_Assets/GK_MUSIC_VAULT` (Google Drive for desktop).
- Pick ENERGY songs that match the video: `02_HIP_HOP`, `01_SOMALI_HERITAGE/SOMALI_HIGH_ENERGY`, `03_MIX_CINEMATIC`,
  or the `Somali` / `English` / `Mixed` folders. Skip names with "ssstik". Skip `Needs Review` unless nothing else fits.
- Cut a loud 10 to 12 s stretch (ffmpeg, start where it is loudest, 0.3 s fade in, 1 s fade out) into
  `~/GK_CAPCUT_WORK/music_NN.mp3` (small file), then upload that to CapCut.
- Do not use the same song twice in a row. Keep a list in `~/GK_CAPCUT_WORK/log.txt`.

## Templates
- Use a DIFFERENT CapCut template each run. Prefer templates with 6 or fewer clip slots. The 10-slot template made
  on 11 Nov kept warning "Media lost / black screens" and ran 12.25 s: do not repeat it.
- If CapCut shows a "Media lost" or black-screen warning, stop and choose another template (or Video Studio).
- Record the template name and credit balance (before and after) in `~/GK_CAPCUT_WORK/log.txt`.

## Export and save
- Export 9:16, 10 to 12 s. Check there is no CapCut watermark or end card.
- If Chrome cannot save to Desktop/Downloads (it was blocked on 11 Nov), copy the file URL from the blank tab
  that opens after Download and fetch it yourself with `curl -L -o ~/GK_CAPCUT_WORK/<name>.mp4 "<url>"` (the link expires fast).
- Check the file with ffprobe (length, size) and grab one frame to confirm it is not black.
- Name it `CAPCUT_<theme>_<NN>.mp4` (the AI caption uses the file name as its hint, so make it meaningful).

## Where the finished videos go
- First two runs: save to `~/Desktop/CAPCUT_REVIEW` and tell Joe. He watches them first.
- After Joe says "auto": move them into `~/GK_DROP` (the pipe uploads them after about 2 minutes).
