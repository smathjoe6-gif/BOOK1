import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required setting: ${name}. Check your .env file (copy .env.example to .env and fill it in).`);
    process.exit(1);
  }
  return value;
}

export const config = {
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  driveFolderId: required('DRIVE_FOLDER_ID'),
  doneFolderId: process.env.DONE_FOLDER_ID || '',
  mirrorFolderId: process.env.MIRROR_FOLDER_ID || '',
  // GK_JING's folder ID -- set this (independent of MIRROR_FOLDER_ID/mirroring)
  // so the script writes missing caption rows for GK_JING videos too, not
  // just its own GK_TERMINAL ones. Leave blank to skip this and only
  // caption GK_TERMINAL videos as before.
  gkJingFolderId: process.env.GK_JING_FOLDER_ID || '',
  // Mac folder Grok Bot (or anything local) saves finished videos into; the
  // script uploads them to GK_TERMINAL (see src/localDrop.js). Blank = off.
  localDropFolder: process.env.LOCAL_DROP_FOLDER || '',
  // Canva folder where the daily person-story designs (6 pages) are put; the script turns each new
  // design into a slideshow video with instrumental music (src/storyVideos.js). Blank = off.
  storyCanvaFolderId: process.env.STORY_CANVA_FOLDER_ID || '',
  // Logo / shield stamped in the top-right corner of every person-story video: a PNG (ideally transparent)
  // on this Mac, e.g. ~/gk-automation/gk-logo.png. Blank or a missing file = no logo.
  storyLogoFile: process.env.STORY_LOGO_FILE || '',
  // Optional per-gender corner pictures (a man / a woman wearing GK). A story whose Canva design title ends
  // with [M] uses STORY_LOGO_MAN, [F] uses STORY_LOGO_WOMAN; otherwise (or if the file is missing) STORY_LOGO_FILE.
  storyLogoMan: process.env.STORY_LOGO_MAN || '',
  storyLogoWoman: process.env.STORY_LOGO_WOMAN || '',
  storySecondsPerPage: Number(process.env.STORY_SECONDS_PER_PAGE) > 0 ? Number(process.env.STORY_SECONDS_PER_PAGE) : 4.5,
  localDropMinAgeSeconds: Number(process.env.LOCAL_DROP_MIN_AGE_SECONDS) || 120,
  // Video stacker (src/stitchVideos.js): joins short clips from this Mac
  // folder into one ~60 s vertical video per run and saves it into
  // LOCAL_DROP_FOLDER. Blank = off.
  stitchFolder: process.env.STITCH_FOLDER || '',
  // Or take the clips straight from a Google Drive folder (stays in Drive,
  // clips are reused round after round). Wins over STITCH_FOLDER if both set.
  stitchDriveFolderId: process.env.STITCH_DRIVE_FOLDER_ID || '',
  // Beat cuts (src/stitchBeats.js): with a song, cut on its beats; STITCH_BEAT_CUTS=false = old cuts.
  stitchBeatCuts: process.env.STITCH_BEAT_CUTS !== 'false',
  stitchBeatSeconds: Number(process.env.STITCH_BEAT_SECONDS) || 30,
  stitchTargetSeconds: Number(process.env.STITCH_TARGET_SECONDS) || 60,
  stitchMaxClipSeconds: Number(process.env.STITCH_MAX_CLIP_SECONDS) || 10,
  stitchPerDay: process.env.STITCH_PER_DAY === undefined || process.env.STITCH_PER_DAY === '' ? 2 : Number(process.env.STITCH_PER_DAY),
  stitchText: process.env.STITCH_TEXT === undefined ? 'GK Legend Studio' : process.env.STITCH_TEXT,
  stitchFont: process.env.STITCH_FONT || '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  // Music under the stacked video: songs (wav/mp3/m4a, at least ~8 MB) in this
  // Drive folder; blank = no music. The clips' own sound is turned down to
  // STITCH_CLIP_AUDIO_VOLUME (0 = muted) so random talking never fights the song.
  // Designed edit on top of the stacked clips (hook text, zoom punch at each cut,
  // white flash cut, colour grade, GK tag, progress bar, end line). STITCH_DESIGN=false
  // = plain stitching. STITCH_HOOK blank = made from the story folder name.
  stitchDesign: process.env.STITCH_DESIGN !== 'false',
  stitchHook: process.env.STITCH_HOOK || '',
  stitchEndText: process.env.STITCH_END_TEXT === undefined ? 'Follow for more' : process.env.STITCH_END_TEXT,
  // Automatic matching (src/stitchMatch.js): Gemini labels every stock clip and song
  // so clips of one kind are stacked together with a song of the same kind.
  // STITCH_AUTO_MATCH=false = off. Needs GEMINI_API_KEY. Per script cycle it tags up
  // to STITCH_CLASSIFY_PER_CYCLE clips (plus 2 songs) that were not judged yet.
  stitchAutoMatch: process.env.STITCH_AUTO_MATCH !== 'false',
  // STITCH_TIDY=false = the stock folder no longer tidies itself (exact duplicates to the Bin, clips filed into 9x16 / 16x9).
  stitchTidy: process.env.STITCH_TIDY !== 'false',
  stitchClassifyPerCycle: Number(process.env.STITCH_CLASSIFY_PER_CYCLE) || 10,
  stitchMusicDriveFolderId: process.env.STITCH_MUSIC_DRIVE_FOLDER_ID || '',
  // Only songs at least this many days old are used as stitch background music (0 = any).
  stitchMusicMinAgeDays: Number(process.env.STITCH_MUSIC_MIN_AGE_DAYS ?? 180) || 0,
  stitchClipAudioVolume: process.env.STITCH_CLIP_AUDIO_VOLUME === undefined || process.env.STITCH_CLIP_AUDIO_VOLUME === '' ? 0.12 : Number(process.env.STITCH_CLIP_AUDIO_VOLUME),
  canvaClientId: process.env.CANVA_CLIENT_ID || '',
  canvaClientSecret: process.env.CANVA_CLIENT_SECRET || '',
  canvaBrandTemplateId: process.env.CANVA_BRAND_TEMPLATE_ID || '',
  canvaTitleField: process.env.CANVA_TITLE_FIELD || 'title',
  // The data field name for an image placeholder in the brand template
  // (tagged the same way as canvaTitleField, via Canva's "Bulk create" app)
  // -- only needed if feeding a raw photo from the manual cover pool
  // through Canva (see src/coverPool.js + src/coverImage.js). Leave blank
  // to skip this and only autofill the title text.
  canvaImageField: process.env.CANVA_IMAGE_FIELD || '',
  pinterestCoversFolderId: process.env.PINTEREST_COVERS_FOLDER_ID || '',
  // Manual cover-image pool (see src/coverPool.js) -- Joe drops a raw/source
  // image into this folder himself (a photo, no design needed), and the
  // script feeds it through the Canva brand template above (if configured)
  // to render a polished, titled Pinterest cover -- or, if Canva isn't set
  // up, just uses the dropped image as-is. Either way the used image moves
  // into the "Done" subfolder afterward so it's never picked twice.
  // Defaults to the folder pair created 15 Sep 2026 so this works with zero
  // setup; override here only if Joe wants to point it elsewhere.
  coverPoolFolderId: process.env.COVER_POOL_FOLDER_ID || '1_2dyzrmG9wr_F67mKUHLIPOMczP2XgRl',
  coverPoolDoneFolderId: process.env.COVER_POOL_DONE_FOLDER_ID || '12zc1JcJkeYfoG6oc_9CCwkrqHnvjUfSe',
  // The Make.com side's own done folder (GK_JING_DONE) -- mirroring needs to
  // know about it too, otherwise a video that's already finished on one side
  // and moved to its done folder looks "missing" to the still-pending other
  // side and gets copied right back, causing a duplicate post loop.
  mirrorDoneFolderId: process.env.MIRROR_DONE_FOLDER_ID || '',
  spreadsheetId: required('SPREADSHEET_ID'),
  pollIntervalMinutes: Number(process.env.POLL_INTERVAL_MINUTES || 10),
  tiktokUseSandbox: process.env.TIKTOK_USE_SANDBOX === 'true',
  tiktokClientKey: process.env.TIKTOK_USE_SANDBOX === 'true'
    ? (process.env.TIKTOK_SANDBOX_CLIENT_KEY || '')
    : (process.env.TIKTOK_CLIENT_KEY || ''),
  tiktokClientSecret: process.env.TIKTOK_USE_SANDBOX === 'true'
    ? (process.env.TIKTOK_SANDBOX_CLIENT_SECRET || '')
    : (process.env.TIKTOK_CLIENT_SECRET || ''),
  // TikTok posting via Buffer (src/bufferTikTok.js) -- replaces the direct
  // TikTok API integration above (src/tiktok.js) as of 21 Sep 2026, since
  // that one is stuck posting SELF_ONLY/private under TIKTOK_USE_SANDBOX
  // while Buffer's own TikTok connection posts publicly. Leave
  // BUFFER_ACCESS_TOKEN blank to fall back to the direct TikTok API instead.
  bufferAccessToken: process.env.BUFFER_ACCESS_TOKEN || '',
  bufferTikTokProfileId: process.env.BUFFER_TIKTOK_PROFILE_ID || '',
  // Instagram/Facebook/Pinterest/X posting through Buffer (src/bufferPost.js).
  // Comma list, e.g. "instagram,facebook,pinterest,x". Blank = off.
  // newest (default) or oldest: which queued video goes to TikTok next.
  tiktokOrder: process.env.TIKTOK_ORDER === 'oldest' ? 'oldest' : 'newest',
  // Pause between one network and the next when posting a video via Buffer.
  // Minutes between whole videos going to the Buffer networks (IG/FB/Pinterest/X). 0 = off (every video as soon as YouTube accepts it).
  bufferVideoGapMinutes: Number(process.env.BUFFER_VIDEO_GAP_MINUTES) > 0 ? Number(process.env.BUFFER_VIDEO_GAP_MINUTES) : 0,
  bufferGapSeconds: Number.isFinite(Number(process.env.BUFFER_GAP_SECONDS)) && process.env.BUFFER_GAP_SECONDS !== undefined && process.env.BUFFER_GAP_SECONDS !== '' ? Number(process.env.BUFFER_GAP_SECONDS) : 60,
  // Picture posts for Facebook/Pinterest from Drive (src/pictureDrops.js).
  // PICTURE_FOLDER_ID = a Drive folder holding HERITAGE and WILDLIFE
  // subfolders of finished post pictures. Blank = off.
  pictureFolderId: process.env.PICTURE_FOLDER_ID || '',
  // Instead of Drive, read the pictures straight from Canva folders:
  // "HERITAGE=<canva folder id>,WILDLIFE=<canva folder id>".
  pictureCanvaFolders: process.env.PICTURE_CANVA_FOLDERS || '',
  pictureSlots: process.env.PICTURE_SLOTS || '09:00,13:00,19:00',
  pictureServices: process.env.PICTURE_SERVICES || 'facebook,pinterest',
  picturePinterestWildlifeBoardId: process.env.PICTURE_PINTEREST_WILDLIFE_BOARD_ID || '',
  bufferPostServices: process.env.BUFFER_POST_SERVICES || '',
  // shareNow = post the moment the video is processed (default); addToQueue =
  // let Buffer spread posts over each channel's own posting times.
  bufferPostMode: ['addToQueue', 'shareNext'].includes(process.env.BUFFER_POST_MODE) ? process.env.BUFFER_POST_MODE : 'shareNow',
  bufferInstagramType: process.env.BUFFER_INSTAGRAM_TYPE || 'reel',
  bufferFacebookType: process.env.BUFFER_FACEBOOK_TYPE || 'reel',
  bufferPinterestBoardId: process.env.BUFFER_PINTEREST_BOARD_ID || '',
  xaiApiKey: process.env.XAI_API_KEY || '',
  // API key for the local OmniRoute AI gateway (http://localhost:20128) --
  // copy it from OmniRoute's Dashboard -> Endpoints after connecting a
  // provider. Leave blank if OmniRoute isn't installed; captions/replies
  // just fall back to the built-in templates in that case.
  omnirouteApiKey: process.env.OMNIROUTE_API_KEY || '',
  // Direct Google Gemini key (free, from aistudio.google.com/apikey), used
  // for captions/titles/replies BEFORE OmniRoute so the script no longer
  // depends on OmniRoute running. Leave blank to keep the old behaviour.
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  // Backup Gemini models, tried in this order when the main one runs out of free
  // quota (429). Comma-separated; set GEMINI_FALLBACK_MODEL= (empty) to switch off.
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODEL === undefined ? 'gemini-2.5-flash-lite,gemini-3.5-flash-lite' : process.env.GEMINI_FALLBACK_MODEL)
    .split(',').map((m) => m.trim()).filter(Boolean),
  // Hive (thehive.ai) text model, OpenAI-compatible, tried after the Gemini models
  // and before OmniRoute. Blank key = off. URL/model can be changed in .env if
  // Hive's docs differ (the URL here was not checked against live Hive).
  hiveApiKey: process.env.HIVE_API_KEY || '',
  hiveModel: process.env.HIVE_MODEL || 'deepseek-ai/deepseek-v4.1-flash-1017',
  hiveUrl: process.env.HIVE_URL || 'https://api.thehive.ai/api/v3/chat/completions',
  // Which OmniRoute model to ask for captions/titles. "auto" lets OmniRoute
  // pick, but on 30 Sep 2026 that kept returning 502 while only some
  // providers worked -- set this to one exact model id copied from the
  // OmniRoute dashboard (a provider that tests green) to pin it.
  omnirouteModel: process.env.OMNIROUTE_MODEL || 'auto',
  // Every OmniRoute model to try, in order, when the one before it fails (add a
  // new free model here as soon as OmniRoute offers one). Comma-separated;
  // defaults to just OMNIROUTE_MODEL.
  omnirouteModels: (process.env.OMNIROUTE_MODELS || process.env.OMNIROUTE_MODEL || 'auto').split(',').map((m) => m.trim()).filter(Boolean),
  // Model id OmniRoute expects for its free "Veo AI Free" video provider.
  // Confirm the exact string via OmniRoute's Playground -> Copy cURL (the
  // Model field shown there) if this default ever stops working.
  omnirouteVideoModel: process.env.OMNIROUTE_VIDEO_MODEL || 'veo',
  // Optional hard backup for captions/replies/video concepts, used only when
  // OmniRoute itself doesn't answer (app not running, Mac asleep) rather
  // than routing through it -- so it works even when OmniRoute can't. Get a
  // key at console.anthropic.com (separate signup/billing from a claude.ai
  // subscription). Leave blank to skip this and fall back straight to the
  // built-in templates, same as before this existed.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  autoGenerateVideos: process.env.AUTO_GENERATE_VIDEOS === 'true',
  autoGenerateDailyLimit: Number(process.env.AUTO_GENERATE_DAILY_LIMIT || 1),
  autoGenerateDurationSeconds: Number(process.env.AUTO_GENERATE_DURATION_SECONDS || 5),
  autoGenerateAspectRatio: process.env.AUTO_GENERATE_ASPECT_RATIO || '9:16',
  // Which hour(s) of the day (0-23, this Mac's local time) to aim auto-generation
  // at -- only the first AUTO_GENERATE_DAILY_LIMIT of these are actually used.
  // Defaults to morning/early afternoon/evening, same as before this setting existed.
  autoGenerateHours: (process.env.AUTO_GENERATE_HOURS || '8,13,18')
    .split(',')
    .map((h) => Number(h.trim())),
  // Independent Pinterest posting for GK_TERMINAL videos, separate from
  // Make.com's own Pinterest posting for GK_JING videos -- this is a
  // deliberately slow, capped test rollout (see PINTEREST_DAILY_LIMIT)
  // while Joe's new trial API access proves itself out.
  pinterestClientId: process.env.PINTEREST_CLIENT_ID || '',
  pinterestClientSecret: process.env.PINTEREST_CLIENT_SECRET || '',
  pinterestBoardId: process.env.PINTEREST_BOARD_ID || '987484724485476675',
  // Pinterest requires apps with Trial access to hit its separate sandbox API
  // (api-sandbox.pinterest.com) -- calling api.pinterest.com with a
  // Trial-access app fails outright ("Apps with Trial access must create
  // Pins in production... use API Sandbox instead", confirmed 20 Sep 2026).
  // Switch this to https://api.pinterest.com/v5 once Joe's app is approved
  // for Standard access.
  pinterestApiBase: process.env.PINTEREST_API_BASE || 'https://api-sandbox.pinterest.com/v5',
  // Most TikTok posts per day sent through Buffer (see src/tiktokQueue.js).
  // TikTok blocked the account for 24h after ~20 API posts in a day (23 Sep),
  // and again the same evening when posting resumed too soon.
  tiktokDailyLimit: Number(process.env.TIKTOK_DAILY_LIMIT || 8),
  // Minimum minutes between two TikTok posts (bursts get the account blocked).
  tiktokMinGapMinutes: Number(process.env.TIKTOK_MIN_GAP_MINUTES || 60),
  // Optional: hold all TikTok posts until this time (ISO, e.g.
  // 2026-09-24T19:00:00+01:00) while TikTok's "Wait 24 hours" block runs out.
  tiktokPauseUntil: process.env.TIKTOK_PAUSE_UNTIL ? new Date(process.env.TIKTOK_PAUSE_UNTIL) : null,
  pinterestDailyLimit: Number(process.env.PINTEREST_DAILY_LIMIT || 2),
  // X (Twitter) posting for GK_TERMINAL videos -- a 6th platform alongside
  // YouTube/TikTok, same videos, no separate rollout cap (unlike Pinterest's
  // trial-access limit above). These four are OAuth 1.0a "user context"
  // credentials copied directly from the app's Keys and tokens page at
  // developer.x.com -- no interactive login flow needed. Leave xApiKey
  // blank to skip X entirely; everything else still works without it.
  xApiKey: process.env.X_API_KEY || '',
  xApiSecret: process.env.X_API_SECRET || '',
  xAccessToken: process.env.X_ACCESS_TOKEN || '',
  xAccessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || '',
  // Optional: uploads the tail of automation.log to this Drive file's ID
  // every check cycle, so the log is readable from the cloud without
  // screenshotting the Terminal. Leave blank to skip this entirely.
  logSyncFileId: process.env.LOG_SYNC_FILE_ID || '',
  // Second YouTube channel: the football + world history channel
  // @TotollsportGK ("Jamal", same Google account). Joe drops finished
  // long videos (5-30 min, often NotebookLM video overviews) into
  // TOTOLL_HISTORY; src/historyChannel.js posts them to that channel only
  // (never @PathFoundGK, never TikTok/Make) and moves them to
  // TOTOLL_HISTORY_DONE. Folders created 27 Sep 2026. Its login lives in
  // its own file (npm run auth-history), so the main token.json is
  // untouched. Set HISTORY_CHANNEL_ENABLED=false to switch it off.
  historyThumbnails: process.env.HISTORY_THUMBNAILS !== 'false',
  historyChannelEnabled: process.env.HISTORY_CHANNEL_ENABLED !== 'false',
  historyFolderId: process.env.HISTORY_FOLDER_ID || '1dSP5luIoeK0pjkfqu9Zo-UagSaF9Ow4F',
  historyDoneFolderId: process.env.HISTORY_DONE_FOLDER_ID || '1N0BcIlLZ7N1bpVDRlBj3oc623QRL_VzF',
  historyTokenFile: process.env.HISTORY_TOKEN_FILE || 'token-history.json',
  historyDailyLimit: Number(process.env.HISTORY_DAILY_LIMIT || 2),
  historyChannelHandle: process.env.HISTORY_CHANNEL_HANDLE || '@TotollsportGK',
};
