import fs from 'node:fs';
import { config } from './config.js';
import { loadOAuthClient } from './googleAuth.js';
import { listNewVideos, listVideosInFolder, downloadFile, moveToDone, mirrorNewVideos } from './drive.js';
import { findRowForFile, appendGeneratedRow } from './sheets.js';
import { uploadToYouTube, postEngagementComment } from './youtube.js';
import { generateCaption, isLikelyDuplicateVariant } from './autoCaption.js';
import { replyToNewComments } from './comments.js';
import { uploadToTikTok } from './tiktok.js';
import { loadTikTokToken } from './tiktokAuth.js';
import { maybeAutoGenerateVideo } from './autoGenerate.js';

const auth = loadOAuthClient();
if (!auth.credentials || !auth.credentials.refresh_token) {
  console.error('Not logged in to Google yet. Run "npm run auth" first, then try again.');
  process.exit(1);
}

async function processVideo(file) {
  console.log(`\n--- Found: ${file.name} ---`);

  let row = await findRowForFile(auth, file.name);
  if (!row) {
    if (isLikelyDuplicateVariant(file.name)) {
      console.log(`"${file.name}" looks like an extra copy of another video (ends in _2/_3/etc) — skipping so it doesn't post twice. Add a spreadsheet row for it if it's actually different content.`);
      return;
    }
    const generated = await generateCaption(file.name);
    console.log(`No spreadsheet entry for "${file.name}" — auto-writing one: "${generated.title}"`);
    row = { title: generated.title, capture: generated.capture, hashtag: generated.hashtag };
    try {
      await appendGeneratedRow(auth, file.name, generated);
    } catch (err) {
      console.error('Could not save the auto-generated row to the spreadsheet (posting anyway):', err.message);
    }
  }

  console.log(`Downloading...`);
  const localPath = await downloadFile(auth, file.id, file.name);

  const caption = `${row.capture} ${row.hashtag}`.trim();

  console.log('Uploading to YouTube...');
  let youtubePosted = false;
  try {
    const yt = await uploadToYouTube(auth, {
      filePath: localPath,
      title: row.title,
      description: caption,
    });
    console.log(`YouTube: posted, id ${yt.id}`);
    youtubePosted = true;
    try {
      await postEngagementComment(
        auth,
        yt.id,
        '👀 What did you think? Drop a comment below and let us know! — GK Legend Studio'
      );
      console.log('YouTube: posted engagement comment');
    } catch (err) {
      console.error('Could not post the YouTube engagement comment (video still posted fine):', err.message);
    }
  } catch (err) {
    console.error('YouTube upload failed:', err.message);
  }

  // Only attempt TikTok (and only mark this video done) once YouTube has
  // actually posted -- otherwise a video with a permanently broken YouTube
  // upload would still get moved to DONE and never retried, while a video
  // that succeeds on retry could end up posted to TikTok twice.
  if (youtubePosted) {
    if (loadTikTokToken()) {
      console.log('Posting to TikTok...');
      try {
        const tk = await uploadToTikTok({ filePath: localPath, caption });
        console.log(`TikTok: posted, publish id ${tk.publishId}`);
      } catch (err) {
        console.error('TikTok upload failed (other posts above still stand):', err.message);
      }
    } else {
      console.log('Not logged in to TikTok yet — skipping (run "node src/tiktokAuth.js" to connect).');
    }
  }

  fs.unlink(localPath, () => {});

  if (youtubePosted) {
    console.log('Moving to DONE folder...');
    await moveToDone(auth, file.id);
    console.log(`--- Finished: ${file.name} ---\n`);
  } else {
    console.log(`--- YouTube failed for "${file.name}" -- leaving it in place to retry next cycle ---\n`);
  }
}

// Make.com's scenario only posts a GK_JING video once it finds a matching
// row with a non-blank Title -- it never writes captions itself. This backs
// that up: for any GK_JING video with no row yet, write one the same way we
// already do for GK_TERMINAL, so Instagram/Facebook/Pinterest never get
// stuck on a missing caption either. Read-only on the Drive side -- this
// never downloads, moves, or touches the video file itself, only the sheet.
async function backfillGkJingCaptions() {
  if (!config.gkJingFolderId) return;

  const files = await listVideosInFolder(auth, config.gkJingFolderId);
  for (const file of files) {
    try {
      const row = await findRowForFile(auth, file.name);
      if (row || isLikelyDuplicateVariant(file.name)) continue;

      const generated = await generateCaption(file.name);
      await appendGeneratedRow(auth, file.name, generated);
      console.log(`GK_JING: no caption for "${file.name}" -- auto-wrote one: "${generated.title}"`);
    } catch (err) {
      console.error(`GK_JING caption backfill failed for "${file.name}" (skipping, others still checked):`, err.message);
    }
  }
}

async function checkOnce() {
  try {
    await mirrorNewVideos(auth);
  } catch (err) {
    console.error('Mirroring videos between GK_TERMINAL and GK_JING failed:', err.message);
  }

  try {
    await backfillGkJingCaptions();
  } catch (err) {
    console.error('GK_JING caption backfill check failed:', err.message);
  }

  console.log(`[${new Date().toLocaleString()}] Checking for new videos...`);
  const files = await listNewVideos(auth);
  if (files.length === 0) {
    console.log('Nothing new.');
  } else {
    // Post only the oldest one this cycle -- the rest wait for their own
    // future check, so posts land one per poll interval instead of all
    // bunching up together.
    if (files.length > 1) {
      console.log(`Found ${files.length} videos waiting -- posting the oldest one now, the rest will follow on future checks.`);
    }
    try {
      await processVideo(files[0]);
    } catch (err) {
      console.error(`Failed to process "${files[0].name}":`, err.message);
    }
  }

  console.log('Checking for new YouTube comments to reply to...');
  try {
    await replyToNewComments(auth);
  } catch (err) {
    console.error('Comment reply check failed:', err.message);
  }

  try {
    await maybeAutoGenerateVideo(auth);
  } catch (err) {
    console.error('Auto video generation failed (will retry next cycle):', err.message);
  }
}

let isChecking = false;
async function safeCheckOnce() {
  if (isChecking) {
    console.log('Still working through the previous batch — skipping this check.');
    return;
  }
  isChecking = true;
  try {
    await checkOnce();
  } catch (err) {
    console.error('Check cycle failed (will retry next cycle):', err.message);
  } finally {
    isChecking = false;
  }
}

async function main() {
  await safeCheckOnce();
  const intervalMs = config.pollIntervalMinutes * 60 * 1000;
  console.log(`\nWatching your configured Drive folder${config.mirrorFolderId ? ' (and mirroring with its pair folder)' : ''} — checking every ${config.pollIntervalMinutes} minutes, posting at most one video per check so they never all land at once. Leave this running (Ctrl+C to stop).`);
  setInterval(safeCheckOnce, intervalMs);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
