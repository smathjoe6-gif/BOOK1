# CapCut job card (for the Claude desktop session on Joe's Mac)

Read this whole card first. It is Joe's standing instruction; he should not have to repeat it.
Pull the newest copy: `cd ~/gk-automation && git pull`.

## Goal
Make **2 viral-style videos per day** (10 to 11 seconds, 9:16) in **CapCut on the web**, in Joe's own Chrome
(already signed in, year plan, free templates, about 838 credits). Use a **different template each time**,
add Joe's own music, and let the pipe post them. Short, loud, one clear feeling. Joe's hits were 6 to 11 s clips;
long or stitched videos got 11 to 500 views.

## Joe's decision (11 Nov 2026, late night): AUTOMATIC, 2-DAY TRIAL
Joe is not at the computer all day and will NOT watch each video. For the first 2 days the finished videos go
straight to `~/GK_DROP` (the pipe posts them). If the results are bad, Joe says "stop" and we fix it.
Because nobody watches, YOU are the quality gate (see "Quality gate" below). When in doubt, throw the video away
and make another: a missing video costs nothing, a bad public video does.

## Stop switch
- If the file `~/GK_CAPCUT_WORK/STOP` exists, or Joe says "stop" in chat, do NOT start a run. Finish nothing new.
- Never move anything into `~/GK_DROP` after a stop.

## Hard rules (never break)
- NEVER press Renew, Upgrade, Buy credits, Free credits upsells, or any payment button. If anything asks for
  payment or a login, STOP and tell Joe. Stop making videos when the credit balance drops below 200.
- Only Joe's own clips and music. No real public figures (politicians, presidents, ministers, celebrities).
  Skip any clip whose file name contains: politician, president, minister, drama, test_video, speech, rally.
  The GK Legend crest may appear on an OBJECT, never as a watermark.
- Never post anything yourself. The pipe posts whatever lands in `~/GK_DROP`.
- Do not touch `.env`, `~/gk-automation`, or Drive files other than reading clips/music.

## Where the clips come from (two sources, alternate)
1. **CapCut's own Media library** (the "Media" tab in the editor shows everything Joe uploaded before, in his
   CapCut space). Start at the BOTTOM (the oldest uploads) and work UP. No upload is needed, which also avoids
   CapCut's upload size limit. Remember which clips you used in `~/GK_CAPCUT_WORK/log.txt` and never reuse one
   within 14 days.
2. **GK Bot's two folders**: `GROK_LIBRARY_SORTED/9x16` and `GROK_LIBRARY_SORTED/16x9` (Google Drive for desktop,
   under `~/Library/CloudStorage/GoogleDrive-*/My Drive/GROK_LIBRARY_SORTED`). Use 9x16 clips as they are; use a
   16x9 clip only when its center-crop to 9:16 still looks good. If you must upload from here, make small copies
   with ffmpeg first (`ffmpeg -y -i in.mp4 -t 3 -vf scale=720:-2 -c:v libx264 -crf 28 -an out.mp4`) in
   `~/GK_CAPCUT_WORK`, never touch the originals.
Pick clips that MATCH each other (same mood and look) and the template's idea.


### Drive clips are ONLINE-ONLY (cloud icon in Finder)
Google Drive for desktop streams the files, so they are not on the Mac until opened. Find the folders by pattern,
not exact name (`9x16*` has a trailing space in Drive, `16x9*` has a trailing dot). Copy the clips you need
(`cp`, which forces the download) into `~/GK_CAPCUT_CLIPS` first, a few at a time. If a copy takes more than
about 2 minutes or fails, skip that clip and take the next one.

## Music (Joe's own, already sorted by Gemini)
- Vault: Drive `GK_MUSIC_VAULT` (1,000 to 2,000 songs), on the Mac under
  `~/Library/CloudStorage/GoogleDrive-*/My Drive/02_Brand_Assets/GK_MUSIC_VAULT`.
- Pick ENERGY songs that match the video: `02_HIP_HOP`, `01_SOMALI_HERITAGE/SOMALI_HIGH_ENERGY`,
  `03_MIX_CINEMATIC`, or the `Somali` / `English` / `Mixed` folders. Skip names with "ssstik". Skip `Needs Review`
  unless nothing else fits. Never the same song twice in a row.
- Cut a loud 10 to 12 s stretch (ffmpeg: start where it is loudest, 0.3 s fade in, 1 s fade out) into
  `~/GK_CAPCUT_WORK/music_NN.mp3`, upload that to CapCut's Audio tab and put it under the video.

## Templates
- A DIFFERENT CapCut template each run. Prefer templates with 6 or fewer clip slots. The 10-slot template made on
  11 Nov kept warning "Media lost / black screens" and ran 12.25 s: do not repeat it.
- If CapCut shows "Media lost" or a black-screen warning, stop and choose another template (or Video Studio).
- Record the template name and the credit balance (before and after) in `~/GK_CAPCUT_WORK/log.txt`.

## Export and save
- Export 9:16, 10 to 12 s. If Chrome cannot save to Desktop/Downloads (it was blocked on 11 Nov), copy the file URL
  from the blank tab that opens after Download and fetch it yourself:
  `curl -L -o ~/GK_CAPCUT_WORK/<name>.mp4 "<url>"` (the link expires fast).
- Name it `CAPCUT_<theme>_<NN>.mp4` (the AI caption uses the file name as its hint, so make it meaningful).

## Quality gate (you do this; nobody else will look)
Only move a video to `~/GK_DROP` if ALL are true, checked with ffprobe and extracted frames:
- 9:16 (1080x1920 or similar), 8 to 12.5 seconds, file size above 300 KB.
- Frames at 1 s, 5 s and the last second are NOT black or blank (average brightness clearly above black).
- No CapCut watermark or end card, no "Media lost" warning was shown, no real public figure.
- There is sound (the music is audible, not silent).
If any check fails: delete the file, write the reason in `~/GK_CAPCUT_WORK/log.txt`, make one new attempt with a
different template, then stop for the day.

## Where the finished videos go
- Passed videos: copy to `~/GK_DROP` (the pipe uploads them after about 2 minutes). Also keep a copy in
  `~/GK_CAPCUT_WORK/done`. Max 2 per day.
- Rejected videos: `~/GK_CAPCUT_WORK/rejected` with the reason in the log.
- At the end of each run, tell Joe in one short message: how many made, template names, credits left, anything rejected.
