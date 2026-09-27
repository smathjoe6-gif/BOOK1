import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { loadOAuthClient, hasSavedLogin } from './googleAuth.js';
import { listVideosInFolder, downloadFile, moveToDone } from './drive.js';
import { uploadToYouTube } from './youtube.js';
import { writeHistoryMetadataWithAI } from './omniroute.js';

// Second YouTube channel: football + world history on @TotollsportGK.
// Joe drops finished long videos (5-30 min, often NotebookLM video
// overviews) into TOTOLL_HISTORY; this posts at most HISTORY_DAILY_LIMIT a
// day to that channel only, then moves each one to TOTOLL_HISTORY_DONE.
// Nothing here touches @PathFoundGK, TikTok, the caption sheet or Make.
//
// Drive access uses the main login (token.json). YouTube uses the history
// channel's own login (token-history.json, made with `npm run auth-history`
// and choosing "Jamal" / @TotollsportGK on Google's channel picker), so the
// upload lands on the right channel.

const STATE_PATH = path.join(process.cwd(), 'history-state.json');

// Long videos can be 0.5-1+ GB, so these are far longer than the GK
// short-video limits. The upload runs outside checkOnce()'s 10-minute cycle
// timeout (see index.js), so a slow upload can't be abandoned half-way and
// started again as a duplicate.
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const UPLOAD_TIMEOUT_MS = 90 * 60 * 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { day: state.day || '', postedToday: state.postedToday || 0, uploadedIds: state.uploadedIds || [] };
  } catch {
    return { day: '', postedToday: 0, uploadedIds: [] };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Could not save history-channel state:', err.message);
  }
}

function titleFromFilename(name) {
  let t = name.replace(/\.[^/.]+$/, '');
  t = t.replace(/[_\-]+/g, ' ');
  t = t.replace(/\b(4k|2k|1080p|720p|480p|360p)\b/gi, '');
  t = t.replace(/\b\d{8,}\b/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return t.slice(0, 100) || 'History Stories';
}

async function buildMetadata(fileName) {
  let meta;
  try {
    meta = await writeHistoryMetadataWithAI(fileName);
    console.log(`History channel: AI-written title "${meta.title}"`);
  } catch (err) {
    const title = titleFromFilename(fileName);
    console.log(`History channel: AI unavailable (${err.message}), using filename title "${title}"`);
    meta = {
      title,
      description: `${title}.\n\nThe story behind one of the moments that shaped football and the world, told from start to finish.`,
      tags: ['history', 'football history', 'world history', 'documentary'],
    };
  }
  const footer = `\n\nSubscribe for more football history and world history: https://www.youtube.com/${config.historyChannelHandle}\n\nThis video is for general information and entertainment. Views are the creator's own.\n\n#history #footballhistory #worldhistory`;
  return { ...meta, description: `${meta.description}${footer}`.slice(0, 4900) };
}

let isPosting = false;

export async function postNextHistoryVideo(driveAuth) {
  if (!config.historyChannelEnabled || !config.historyFolderId) return;
  if (isPosting) return; // a long upload from an earlier cycle is still going
  if (!hasSavedLogin(config.historyTokenFile)) {
    console.log(`History channel: not signed in yet -- run "npm run auth-history" once and pick ${config.historyChannelHandle}.`);
    return;
  }

  const state = loadState();
  if (state.day !== todayKey()) {
    state.day = todayKey();
    state.postedToday = 0;
  }
  if (state.postedToday >= config.historyDailyLimit) return;

  const files = await listVideosInFolder(driveAuth, config.historyFolderId);
  if (files.length === 0) return;
  const file = files[0];

  isPosting = true;
  let localPath;
  try {
    // Already uploaded but the move to DONE failed last time -- just retry
    // the move, never upload the same video twice.
    if (state.uploadedIds.includes(file.id)) {
      await moveToDone(driveAuth, file.id, config.historyDoneFolderId);
      return;
    }

    console.log(`History channel: posting "${file.name}" to ${config.historyChannelHandle} (${files.length} waiting)...`);
    const meta = await buildMetadata(file.name);
    localPath = await downloadFile(driveAuth, file.id, file.name, DOWNLOAD_TIMEOUT_MS);
    const youtubeAuth = loadOAuthClient(config.historyTokenFile);
    const result = await uploadToYouTube(youtubeAuth, {
      filePath: localPath,
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      categoryId: '27', // Education
      containsSyntheticMedia: true, // AI narration/visuals (NotebookLM, Grok, Gemini)
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
    console.log(`History channel: posted, YouTube id ${result.id}`);

    state.postedToday += 1;
    state.uploadedIds = [...state.uploadedIds, file.id].slice(-500);
    saveState(state);

    await moveToDone(driveAuth, file.id, config.historyDoneFolderId);
  } finally {
    isPosting = false;
    if (localPath) fs.rm(localPath, { force: true }, () => {});
  }
}
