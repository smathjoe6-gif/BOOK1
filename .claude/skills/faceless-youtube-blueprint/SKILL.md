---
name: faceless-youtube-blueprint
description: Joe's business blueprint for launching a new faceless YouTube channel on autopilot with Make.com + Claude — drop a video into a Drive folder, Claude writes the title, description and tags, Make uploads it to YouTube and files it away. Use when Joe starts a new business/channel, says "new channel", "faceless YouTube", "business blueprint", or asks to set up YouTube automation for something other than GK Legend Studio.
metadata:
  type: workflow
  version: "1.0"
  owner: Joe
---

# Faceless YouTube Blueprint (Make.com + Claude)

A ready-made Make.com scenario for a **new** business / channel. It is
saved next to this file as `make-blueprint.json`. With it, a new channel
is up and running in about 15 minutes.

## What it does (7 steps)

1. **Google Drive — Watch folder.** Picks up the newest video, one per run.
2. **Google Drive — Get file.** Downloads it.
3. **Claude — Description.** Writes an opening hook, 2–3 short paragraphs,
   the channel links, a disclaimer and 3–5 hashtags.
4. **Claude — Tags.** Writes 8–10 lowercase tags, under 450 characters.
5. **Claude — Title.** Writes one title of 70 characters or fewer.
6. **YouTube — Upload.** Public, category Education (27), marked as AI
   (synthetic) media and not made for kids.
7. **Google Drive — Move.** Moves the video into a "done" folder so it's
   never posted twice.

## Setting up a new channel — fill these in first

The blueprint has placeholders. Before importing, replace them in
`make-blueprint.json` (Claude does this for Joe):

| Placeholder | What to put | Example |
|---|---|---|
| `CHANNEL_NAME` | the channel's name | "Desert Craft Stories" |
| `CHANNEL_TOPIC` | one sentence on what the channel is about | "traditional crafts from East Africa, shown step by step" |
| `LINK_1`, `LINK_2` | the real links for the description (shop, website, socials) | `https://…` |

Then in Make.com:
1. Scenarios → **Create** → the ⋯ menu → **Import blueprint** → choose the
   filled-in `make-blueprint.json`.
2. Connect the **Google Drive**, **Anthropic (Claude)** and **YouTube**
   accounts. The YouTube account must be the new channel, not @PathFoundGK.
3. Step 1: pick the **folder to watch**. Make a new Drive folder for this
   channel; never reuse GK_JING or GK_TERMINAL.
4. Step 7: pick the **done folder**. Make a "…_DONE" folder next to the
   watched one.
5. Set the schedule, e.g. every 60 minutes, which is 1 video per hour.
6. Run once with one test video, check it on YouTube, then switch it on.

Claude can also create the scenario directly with the Make tools
(`scenarios_create` with the filled-in blueprint) once Joe has given the
channel name, topic, links and folders.

## Rules / lessons (learned on GK Legend Studio)

- **Never point it at GK_JING or GK_TERMINAL.** GK Legend's YouTube is
  already posted by the Mac script, so that would double-post every video.
- **Name the video files by what's in them**, e.g.
  `man_balancing_stones_on_beach.mp4`. Claude only sees the filename, so
  `grok-video-1234…mp4` or a cut-off Gemini prompt gives vague titles.
  Rename files before dropping them in.
- **Filenames need `.mp4` on the end.** On 26 Sep 2026, files with no
  extension ("by", "j", "h") broke Make's uploads, and the scenario stopped
  itself after 3 errors.
- **Cost.** Each video uses about 6 Make operations plus 3 small Claude API
  calls. Joe's Make plan is already close to its limit, so check credits
  before adding a busy channel.
- **Brand voice.** The prompts are neutral on purpose: no emoji, plus a
  disclaimer. For a GK-style channel, add the brand footer in step 3.
- **Model.** The Claude steps use `claude-sonnet-5`. That's a good balance
  for short text, so no change is needed.
- Uploads are marked as AI (synthetic) media, which YouTube requires for
  realistic AI video. Keep it that way.
