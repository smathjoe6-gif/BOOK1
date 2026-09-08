import fs from 'node:fs';
import { config } from './config.js';
import { loadOAuthClient } from './googleAuth.js';
import { listNewVideos, downloadFile, moveToDone } from './drive.js';
import { findRowForFile, appendGeneratedRow } from './sheets.js';
import { uploadToYouTube } from './youtube.js';
import { generateCaption, isLikelyDuplicateVariant } from './autoCaption.js';
import { replyToNewComments } from './comments.js';
import { uploadToTikTok } from './tiktok.js';
import { loadTikTokToken } from './tiktokAuth.js';

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
  try {
    const yt = await uploadToYouTube(auth, {
      filePath: localPath,
      title: row.title,
      description: caption,
    });
    console.log(`YouTube: posted, id ${yt.id}`);
  } catch (err) {
    console.error('YouTube upload failed:', err.message);
  }

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

  fs.unlink(localPath, () => {});

  console.log('Moving to DONE folder...');
  await moveToDone(auth, file.id);
  console.log(`--- Finished: ${file.name} ---\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkOnce() {
  console.log(`[${new Date().toLocaleString()}] Checking GK_JING for new videos...`);
  const files = await listNewVideos(auth);
  if (files.length === 0) {
    console.log('Nothing new.');
  } else {
    for (let i = 0; i < files.length; i++) {
      try {
        await processVideo(files[i]);
      } catch (err) {
        console.error(`Failed to process "${files[i].name}":`, err.message);
      }
      if (i < files.length - 1) {
        console.log(`Waiting ${config.postStaggerMinutes} minutes before the next one, so they don't all land at once...`);
        await sleep(config.postStaggerMinutes * 60 * 1000);
      }
    }
  }

  console.log('Checking for new YouTube comments to reply to...');
  try {
    await replyToNewComments(auth);
  } catch (err) {
    console.error('Comment reply check failed:', err.message);
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
  console.log(`\nWatching GK_JING — checking every ${config.pollIntervalMinutes} minutes, posting one video every ${config.postStaggerMinutes} minutes when several show up at once. Leave this running (Ctrl+C to stop).`);
  setInterval(safeCheckOnce, intervalMs);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
