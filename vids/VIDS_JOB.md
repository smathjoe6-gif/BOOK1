# Google Vids job card (for the Claude desktop session on Joe's Mac)

Read this whole card first. Joe's standing instruction (14 Nov 2026): stitch his Somali clips into short videos
with **Google Vids** (included in his Google AI Pro plan, so no extra payment), and let the pipe post them.
Pull the newest copy: `cd ~/gk-automation && git pull`.

## Who does what (Joe's split, 14 Nov)
- **Viral prompts and clip making**: GK Bot / Grok already does this by itself every day (prompt doc, 10 clips,
  `~/GK_DROP`). Do NOT make prompts or generate clips here.
- **CapCut**: separate card `capcut/CAPCUT_JOB.md` (CapCut's own viral music).
- **This card**: stitch Somali clips in Google Vids.

## Goal
1 video a day, 15 to 30 seconds, 9:16, made of 4 to 6 of Joe's own Somali-themed clips that belong together
(same mood and look: heritage, buraanbur / gabay scenes, Somali wedding energy, markets, coast). Joe's own music
(or Vids' stock music), no voices. Finished file goes to `~/GK_DROP`; the pipe posts it everywhere.

## Hard rules (never break)
- NEVER press Upgrade, Buy, Get AI credits or any payment button; stop and tell Joe if asked to pay or sign in.
- Only Joe's own clips. No real public figures (skip file names with politician, president, minister, drama,
  test_video, speech, rally). No gore.
- The GK Legend crest only on an object or as the small corner badge below, never a big watermark.
- Never post yourself. Do not touch `.env` or `~/gk-automation`.
- Stop switch: if `~/GK_VIDS_WORK/STOP` exists or Joe says stop, do not start.

## Clips
Source: Drive `GROK_LIBRARY_SORTED/9x16 ` (id `1urZQyvzL085W9MXjX24mdRlYCbeaUwIB`) and `GK_VERTICAL_COPIES`.
Drive files are online-only: copy a few into `~/GK_VIDS_CLIPS` first (`cp` forces the download), skip any that
take over 2 minutes. Never reuse a clip within 14 days (log it in `~/GK_VIDS_WORK/log.txt`). Pick Somali-looking
clips of one mood; 6 s clips are fine (cut each to 3 to 5 s).

## Make it in Vids
1. docs.google.com/videos in Joe's signed-in Chrome, new blank video, vertical 9:16 if offered (else 16:9 and
   crop in the next step).
2. Add the clips in order (strongest first, strongest last), trim each to 3 to 5 s, cuts on the beat.
3. Music: Joe's OWN music is allowed here (his decision, 14 Nov). Vault: Drive `GK_MUSIC_VAULT`
   (`02_Brand_Assets/GK_MUSIC_VAULT`, on the Mac under `~/Library/CloudStorage/GoogleDrive-*/My Drive/02_Brand_Assets/`).
   Prefer `01_SOMALI_HERITAGE`, `Somali`, `03_MIX_CINEMATIC` for Somali clips; skip names with "ssstik" and
   `Needs Review`; never the same song twice in a row. Cut a loud 15 to 30 s stretch with ffmpeg (0.3 s fade in,
   1 s fade out), upload it to Vids as the audio. Fallback: Vids' own music. No voice-over, no AI voice.
4. Export / download as MP4 (File > Download > MP4). If Chrome cannot save, fetch the file URL with curl as in
   the CapCut card.

## NO VOICES, MUSIC THAT MATCHES, USE THE TEMPLATE (Joe, 14 Nov 2026, after the first test)
The first test had voices from the clips and music that did not fit. Fix, every time:
- **Mute the clips' own sound completely** (set every clip volume to 0 / use "Detach audio" and delete it). The
  only sound in the video is ONE music track. If any speech is audible in the exported video, reject it.
- **The music must match the picture**: fast, loud, punchy clips get an energetic beat; slow, calm clips get a
  slow track. Pick the music AFTER you have looked at the clips, never the reverse.
- **Cut on the beat**: use the template's own beat-sync (CapCut: "Auto beat sync" / "Beats" on the audio; Vids:
  cuts on the beat by hand) so every cut lands on a drum hit. Clips of 1.5 to 3 s each, strongest clip first, a
  strong last second. No slow fades.
- **Use a template** (CapCut: Templates tab; Vids: a template or scene layout) and keep ITS cuts, transitions and
  text style, but put Joe's own clips in every slot. Do not leave the template's sample footage.
- Viral shape: a hook in the first second (the most striking moment), fast cuts, one clear feeling, ends on a
  loop-friendly or strong final shot.

## Branding (every video) and quality gate
Same ffmpeg overlay as the CapCut card (logo top-right 200 px, copyright strip near the bottom), name
`VIDS_Somali_<theme>_<NN>_GK.mp4`. Gate: 9:16 (1080x1920 or similar), 12 to 35 s, over 300 KB, frames at 1 s,
mid and last second not black, no real public figure, sound audible, no Vids watermark. If any check fails, delete,
log the reason, one new attempt, then stop for the day.

## Output
Passed: copy to `~/GK_DROP` (max 1 a day) and keep a copy in `~/GK_VIDS_WORK/done`. Rejected: `rejected` with the
reason. At the end tell Joe in one short line: made, clips used, anything rejected.
