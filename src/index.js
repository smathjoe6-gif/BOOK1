import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { loadOAuthClient } from './googleAuth.js';
import { listNewVideos, listVideosInFolder, downloadFile, moveToDone, mirrorNewVideos, syncLogToDrive, uploadVerticalCopy } from './drive.js';
import { findRowForFile, appendGeneratedRow, updateCoverImage } from './sheets.js';
import { uploadToYouTube, postEngagementComment } from './youtube.js';
import { generateCaption, isLikelyDuplicateVariant, stripCollisionSuffix } from './autoCaption.js';
import { getCoverImage } from './coverImage.js';
import { replyToNewComments } from './comments.js';
import { uploadToTikTok } from './tiktok.js';
import { loadTikTokToken } from './tiktokAuth.js';
import { queueTikTok, postNextQueuedTikTok } from './tiktokQueue.js';
import { uploadToPinterest } from './pinterest.js';
import { loadPinterestToken } from './pinterestAuth.js';
import { uploadToTwitter } from './twitter.js';
import { maybeAutoGenerateVideo } from './autoGenerate.js';
import { ensureVerticalVideo } from './aspectRatio.js';
import { engagementQuestion } from './engagementQuestion.js';
import { postNextHistoryVideo } from './historyChannel.js';
import { sortDoneFoldersByShape } from './doneSorter.js';
import { isAlreadyPosted, rememberPosted, seedPostedHashes } from './postedHashes.js';
import { postDuePicture } from './pictureDrops.js';
import { bufferPostingEnabled, bufferServices, postToBuffer, retryFailedBufferPosts } from './bufferPost.js';

// Independent test rollout of Pinterest posting for GK_TERMINAL videos,
// capped at config.pinterestDailyLimit attempts per day while Joe's new
// trial API access proves itself out -- separate from, and in addition to,
// Make.com's own long-running Pinterest posting for GK_JING videos.
const PINTEREST_STATE_PATH = path.join(process.cwd(), 'pinterest-state.json');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadPinterestState() {
  try {
    const state = JSON.parse(fs.readFileSync(PINTEREST_STATE_PATH, 'utf8'));
    if (state.date !== todayKey()) return { date: todayKey(), count: 0 };
    return state;
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function savePinterestState(state) {
  fs.writeFileSync(PINTEREST_STATE_PATH, JSON.stringify(state, null, 2));
}

// Persisted (not just in memory) so a script restart can't reset how many
// times a video has already failed -- a video that fails on every single
// attempt (a corrupt file, a permanently broken upload, anything) used to
// jam every video behind it forever, since the main loop only ever retries
// the same oldest file. This still allows a few genuine retries (a transient
// network blip shouldn't set a video aside permanently), but after that it
// stops retrying it every cycle so newer videos keep flowing -- exactly the
// kind of stuck-until-someone-restarts-it episode that hit 3 videos for
// hours on 17-18 Sep 2026.
const VIDEO_FAILURE_STATE_PATH = path.join(process.cwd(), 'video-failure-state.json');
const MAX_ATTEMPTS_BEFORE_SETTING_ASIDE = 3;

function loadVideoFailureState() {
  try {
    return JSON.parse(fs.readFileSync(VIDEO_FAILURE_STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveVideoFailureState(state) {
  try {
    fs.writeFileSync(VIDEO_FAILURE_STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.log(`Could not persist video failure state: ${err.message}`);
  }
}

const auth = loadOAuthClient();
if (!auth.credentials || !auth.credentials.refresh_token) {
  console.error('Not logged in to Google yet. Run "npm run auth" first, then try again.');
  process.exit(1);
}

async function processVideoOnce(file) {
  console.log(`\n--- Found: ${file.name} ---`);

  // Same bytes already posted (e.g. a " (1)" re-download of a posted video)?
  // Park it in DONE instead of posting it again.
  if (isAlreadyPosted(file.md5Checksum)) {
    console.log(`"${file.name}" has identical content to a video already posted -- moving to DONE without posting again.`);
    await moveToDone(auth, file.id);
    return 'skipped';
  }

  let row = await findRowForFile(auth, file.name);
  let newRowCover = '';
  const collisionBaseName = stripCollisionSuffix(file.name);
  if (!row && collisionBaseName !== file.name) {
    // Drive/macOS append " (1)", " (2)" etc whenever a file lands with the
    // same base name as one already there -- not proof this is a repost of
    // the same content, just a name collision. Only treat it as a genuine
    // duplicate (and skip it) if a caption row already exists under the
    // real name -- otherwise it's a brand-new video that happens to have a
    // collision-renamed filename, and gets captioned/posted like any other.
    row = await findRowForFile(auth, collisionBaseName);
    if (row) {
      console.log(`"${file.name}" already has a caption row under "${collisionBaseName}" — treating as an already-known video, not brand new.`);
    }
  }
  if (!row) {
    if (isLikelyDuplicateVariant(file.name)) {
      console.log(`"${file.name}" looks like an extra copy of another video (ends in _2/_3/etc) — skipping so it doesn't post twice. Add a spreadsheet row for it if it's actually different content.`);
      return 'skipped';
    }
    const generated = await generateCaption(collisionBaseName);
    console.log(`No spreadsheet entry for "${file.name}" — auto-writing one: "${generated.title}"`);
    row = { title: generated.title, capture: generated.capture, hashtag: generated.hashtag };

    // Generate a unique Pinterest cover image here too, not just in
    // backfillGkJingCaptions() -- this same row can end up feeding Make's
    // GK_JING/Pinterest posting (via folder mirroring, or if Joe drops the
    // video in both folders), and without a cover URL in column G, Make
    // falls back to its generic rotating template cover instead of a
    // unique one.
    let coverImageUrl = '';
    try {
      coverImageUrl = await getCoverImage(auth, generated.title);
      newRowCover = coverImageUrl || '';
    } catch (err) {
      console.error(`Could not get a Pinterest cover image for "${file.name}" (falling back to Make's default rotation):`, err.message);
    }

    try {
      await appendGeneratedRow(auth, file.name, generated, coverImageUrl);
    } catch (err) {
      console.error('Could not save the auto-generated row to the spreadsheet (posting anyway):', err.message);
    }
  }

  console.log(`Downloading...`);
  let localPath = await downloadFile(auth, file.id, file.name);

  // Which Drive file Buffer (IG/FB/Pinterest/X/TikTok) fetches: the original,
  // unless the video had to be converted to 9:16, in which case a copy of the
  // converted file (a wide original is rejected by Facebook Reels).
  let postFileId = file.id;
  const downloadedPath = localPath;
  try {
    localPath = await ensureVerticalVideo(localPath);
  } catch (err) {
    console.error(`Could not check/convert "${file.name}" to vertical 9:16 (posting as-is):`, err.message);
  }
  if (localPath !== downloadedPath) {
    try {
      postFileId = await uploadVerticalCopy(auth, localPath, file.name);
      console.log(`Uploaded the 9:16 copy for Buffer (Drive id ${postFileId}).`);
    } catch (err) {
      console.error(`Could not upload the 9:16 copy of "${file.name}" (Buffer gets the original file):`, err.message);
    }
  }

  const caption = `${row.capture} ${row.hashtag}`.trim();

  console.log('Uploading to YouTube...');
  let youtubePosted = false;
  let engagementText = '';
  try {
    const yt = await uploadToYouTube(auth, {
      filePath: localPath,
      title: row.title,
      description: caption,
    });
    console.log(`YouTube: posted, id ${yt.id}`);
    youtubePosted = true;
    // Remember the moment YouTube accepts it: a restart after this point can
    // never upload the same video again (the md5 guard catches it).
    rememberPosted(file.md5Checksum, file.name);
    try {
      const question = await engagementQuestion(row.title, row.capture);
      engagementText = `${question} — GK Legend Studio`;
      await postEngagementComment(auth, yt.id, `${question} — GK Legend Studio`);
      console.log(`YouTube: posted engagement question: "${question}"`);
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
    if (config.bufferAccessToken) {
      // Queued, not posted here -- postNextQueuedTikTok() in checkOnce()
      // sends it, keeping TikTok under its daily API post limit.
      queueTikTok({ fileId: postFileId, name: file.name, caption });
    } else if (loadTikTokToken()) {
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

  // Move to DONE as soon as YouTube has posted and TikTok is queued -- BEFORE
  // the slow Buffer posts (one minute apart). If the script is restarted
  // during those minutes the video is already filed away and the networks
  // not yet done resume from buffer-retry.json, instead of the whole video
  // being posted again from the top (3 Oct 2026: 3 restarts = Instagram 3x).
  let movedToDone = false;
  if (youtubePosted) {
    rememberPosted(file.md5Checksum, file.name);
    try {
      console.log('Moving to DONE folder...');
      await moveToDone(auth, file.id);
      movedToDone = true;
    } catch (err) {
      console.error('Could not move the video to DONE yet (will try again at the end):', err.message);
    }
  }

  // Independent test rollout: also post to Pinterest directly from this
  // script (separate from Make.com's own Pinterest posting for GK_JING
  // videos), capped at a few per day while the new trial API access is
  // still being proven out. A failure or a not-yet-logged-in state here
  // never blocks YouTube/TikTok above or the move-to-done below.
  const viaBuffer = bufferPostingEnabled() ? bufferServices() : [];
  if (youtubePosted && viaBuffer.length) {
    try {
      // Pinterest's "preview" (cover) image: reuse the cover made for this
      // video's sheet row, or make one now if the row already existed.
      let coverUrl = newRowCover || row.cover || '';
      if (!coverUrl && viaBuffer.includes('pinterest')) {
        try {
          coverUrl = (await getCoverImage(auth, row.title)) || '';
        } catch (err) {
          console.error('Could not get a Pinterest cover image for the Buffer pin (posting without one):', err.message);
        }
      }
      await postToBuffer(auth, { fileId: postFileId, name: file.name, title: row.title, caption, firstComment: engagementText, coverUrl });
    } catch (err) {
      console.error('Buffer posting failed (other posts above still stand):', err.message);
    }
  }

  if (youtubePosted && !viaBuffer.includes('pinterest')) {
    if (!loadPinterestToken()) {
      console.log('Not logged in to Pinterest yet — skipping (run "node src/pinterestAuth.js" to connect).');
    } else {
      const pinterestState = loadPinterestState();
      if (pinterestState.count >= config.pinterestDailyLimit) {
        console.log(`Pinterest: already at today's test limit (${config.pinterestDailyLimit}/day) — skipping until tomorrow.`);
      } else {
        console.log('Posting to Pinterest...');
        try {
          let coverImageUrl;
          try {
            coverImageUrl = await getCoverImage(auth, row.title);
          } catch (err) {
            console.error('Could not get a Pinterest cover image (posting without one):', err.message);
          }
          const pin = await uploadToPinterest({ filePath: localPath, title: row.title, description: caption, coverImageUrl });
          console.log(`Pinterest: posted, pin id ${pin.id}`);
          // Only count successful posts against the daily test cap -- a
          // failed attempt (bad token, transient API error, etc.) shouldn't
          // burn one of today's slots before it's even posted anything.
          pinterestState.count += 1;
          savePinterestState(pinterestState);
        } catch (err) {
          console.error('Pinterest upload failed (other posts above still stand):', err.message);
        }
      }
    }
  }

  // X (Twitter) -- a 6th platform for the same GK_TERMINAL videos, no daily
  // cap (unlike Pinterest's trial-access rollout above). A failure here
  // never blocks anything else or stops the move-to-done below.
  if (youtubePosted && !viaBuffer.includes('twitter')) {
    if (!config.xApiKey) {
      console.log('X (Twitter) is not configured yet — skipping (set X_API_KEY etc. in .env).');
    } else {
      console.log('Posting to X (Twitter)...');
      try {
        const tweet = await uploadToTwitter({ filePath: localPath, caption });
        console.log(`X: posted, tweet id ${tweet.tweetId}`);
      } catch (err) {
        console.error('X upload failed (other posts above still stand):', err.message);
      }
    }
  }

  fs.unlink(localPath, () => {});

  if (youtubePosted) {
    if (!movedToDone) {
      console.log('Moving to DONE folder...');
      await moveToDone(auth, file.id);
    }
    console.log(`--- Finished: ${file.name} ---\n`);
  } else {
    console.log(`--- YouTube failed for "${file.name}" -- leaving it in place to retry next cycle ---\n`);
    return 'failed';
  }
}

// Wraps processVideoOnce() with the persisted failure counter described
// above. Anything processVideoOnce throws (a download/conversion error, a
// timeout from one of the network calls it makes) counts as a failed
// attempt the same as an explicit 'failed' return (a YouTube upload that
// failed cleanly) -- either way, after enough attempts this stops retrying
// the file every cycle so it can't block the videos behind it.
async function processVideo(file) {
  const state = loadVideoFailureState();
  let result;
  try {
    result = await processVideoOnce(file);
  } catch (err) {
    console.error(`"${file.name}" threw an unexpected error: ${err.message}`);
    result = 'failed';
  }

  if (result !== 'failed') {
    if (state[file.name]) {
      delete state[file.name];
      saveVideoFailureState(state);
    }
    return result;
  }

  const attempts = (state[file.name] || 0) + 1;
  state[file.name] = attempts;
  saveVideoFailureState(state);

  if (attempts >= MAX_ATTEMPTS_BEFORE_SETTING_ASIDE) {
    console.error(`"${file.name}" has now failed ${attempts} times in a row -- setting it aside so it doesn't block every video behind it. It's still sitting in the folder; check automation.log for the real error, fix it by hand, then restart the script to give it a fresh try.`);
    return 'skipped';
  }
  console.log(`"${file.name}" has failed ${attempts}/${MAX_ATTEMPTS_BEFORE_SETTING_ASIDE} times so far -- will retry it next cycle before setting it aside.`);
  return 'failed';
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
      let row = await findRowForFile(auth, file.name);
      const collisionBaseName = stripCollisionSuffix(file.name);
      if (!row && collisionBaseName !== file.name) {
        // Same Drive/macOS " (1)"/" (2)" collision-suffix issue as
        // processVideoOnce() -- check for a row under the real base name
        // before treating this as a brand-new (or duplicate) video.
        row = await findRowForFile(auth, collisionBaseName);
        if (row) {
          console.log(`GK_JING: "${file.name}" already has a caption row under "${collisionBaseName}" — treating as an already-known video, not brand new.`);
        }
      }

      if (row) {
        // A caption already exists (written here or by the hourly Claude Code backfill
        // routine, which only ever writes text) -- but it might still be missing a
        // Pinterest cover image. Without this, that row's blank column G stays blank
        // forever, since nothing else ever revisits an existing row, and Pinterest
        // just falls back to the same generic rotating cover every time.
        if (!row.coverImageUrl) {
          try {
            const coverImageUrl = await getCoverImage(auth, row.title);
            if (coverImageUrl) {
              await updateCoverImage(auth, row.rowNumber, coverImageUrl);
              console.log(`GK_JING: added a unique Pinterest cover image for "${file.name}" (caption already existed).`);
            }
          } catch (err) {
            console.error(`Could not get a Pinterest cover image for "${file.name}" (leaving it on the fallback rotation):`, err.message);
          }
        }
        continue;
      }

      if (isLikelyDuplicateVariant(file.name)) continue;

      const generated = await generateCaption(collisionBaseName);

      let coverImageUrl = '';
      try {
        coverImageUrl = await getCoverImage(auth, generated.title);
      } catch (err) {
        console.error(`Could not get a Pinterest cover image for "${file.name}" (falling back to Make's default rotation):`, err.message);
      }

      await appendGeneratedRow(auth, file.name, generated, coverImageUrl);
      console.log(`GK_JING: no caption for "${file.name}" -- auto-wrote one: "${generated.title}"${coverImageUrl ? ' (with a unique cover image)' : ''}`);
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
    await sortDoneFoldersByShape(auth);
  } catch (err) {
    console.error('Sorting the done folders failed (will retry next cycle):', err.message);
  }

  try {
    await backfillGkJingCaptions();
  } catch (err) {
    console.error('GK_JING caption backfill check failed:', err.message);
  }

  try {
    await seedPostedHashes(auth);
  } catch (err) {
    console.error('Duplicate-guard seeding failed (will retry next cycle):', err.message);
  }

  console.log(`[${new Date().toLocaleString()}] Checking for new videos...`);
  const files = await listNewVideos(auth);
  if (files.length === 0) {
    console.log('Nothing new.');
  } else {
    // Post only the oldest one this cycle -- the rest wait for their own
    // future check, so posts land one per poll interval instead of all
    // bunching up together. But a video processVideo() permanently skips
    // (a duplicate-looking filename with no spreadsheet row) never gets
    // removed from the folder, so it would otherwise stay "the oldest" and
    // block every video behind it forever -- this happened for real on
    // 17 Sep 2026, when one such file jammed 3 videos for hours. So we walk
    // forward past any skipped files within this same cycle, and still stop
    // (posting at most one) the moment a file is actually attempted.
    if (files.length > 1) {
      console.log(`Found ${files.length} videos waiting -- posting the oldest one now, the rest will follow on future checks.`);
    }
    for (const file of files) {
      let outcome;
      try {
        outcome = await processVideo(file);
      } catch (err) {
        console.error(`Failed to process "${file.name}":`, err.message);
        break;
      }
      if (outcome !== 'skipped') break;
    }
  }

  if (config.bufferAccessToken) {
    try {
      await postNextQueuedTikTok(auth);
    } catch (err) {
      console.error('TikTok queue check failed:', err.message);
    }
  }

  if (bufferPostingEnabled()) {
    try {
      await retryFailedBufferPosts(auth);
    } catch (err) {
      console.error('Buffer retry check failed:', err.message);
    }
  }

  try {
    await postDuePicture(auth);
  } catch (err) {
    console.error('Picture posting failed (will retry next cycle):', err.message);
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

  // Last step in the cycle so the synced snapshot includes everything just
  // logged above -- lets the log be checked from the cloud without needing
  // a Terminal screenshot.
  try {
    await syncLogToDrive(auth);
  } catch (err) {
    console.error('Could not sync automation.log to Drive (will retry next cycle):', err.message);
  }
}

// A backstop, not the primary fix -- the real fix is bounding every network
// call that checkOnce() can reach (see grokVideo.js's fetchWithTimeout) so
// nothing hangs in the first place. This just guarantees that even an
// unforeseen hang somewhere else can't wedge isChecking forever and require
// a manual restart, the way one un-timed-out fetch just did.
const CHECK_TIMEOUT_MS = 10 * 60 * 1000;

let isChecking = false;
async function safeCheckOnce() {
  if (isChecking) {
    console.log('Still working through the previous batch — skipping this check.');
    return;
  }
  isChecking = true;
  try {
    await Promise.race([
      checkOnce(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Check cycle took longer than ${CHECK_TIMEOUT_MS / 60000} minutes`)), CHECK_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    console.error('Check cycle failed (will retry next cycle):', err.message);
  } finally {
    isChecking = false;
  }
}

// The history channel (@TotollsportGK) runs on its own timer, outside
// safeCheckOnce()'s 10-minute cycle timeout: its long videos can take far
// longer than that to upload, and abandoning one half-way would let the next
// cycle start the same upload again. postNextHistoryVideo() has its own
// "still uploading" guard.
async function historyCycle() {
  try {
    await postNextHistoryVideo(auth);
  } catch (err) {
    console.error('History channel post failed (will retry next cycle):', err.message);
  }
}

async function main() {
  await safeCheckOnce();
  const intervalMs = config.pollIntervalMinutes * 60 * 1000;
  historyCycle();
  setInterval(historyCycle, intervalMs);
  console.log(`\nWatching your configured Drive folder${config.mirrorFolderId ? ' (and mirroring with its pair folder)' : ''} — checking every ${config.pollIntervalMinutes} minutes, posting at most one video per check so they never all land at once. Leave this running (Ctrl+C to stop).`);
  setInterval(safeCheckOnce, intervalMs);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
