import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { loadOAuthClient, hasSavedLogin } from './googleAuth.js';
import { listVideosInFolder, downloadFile, moveToDone } from './drive.js';
import { google } from 'googleapis';
import { uploadToYouTube, findOrCreatePlaylist, addVideoToPlaylist, postEngagementComment } from './youtube.js';
import { writeHistoryMetadataWithAI } from './omniroute.js';

// Second YouTube channel: football + world history on @TotollsportGK.
// Joe drops finished long videos (5-30 min, often NotebookLM video
// overviews) into TOTOLL_HISTORY; this posts at most HISTORY_DAILY_LIMIT a
// day to that channel only, then moves each one to TOTOLL_HISTORY_DONE (sorted into the same
// SPORTS/WORLD/SOMALI_HISTORY subfolders as the drop folder).
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
  // Strip every trailing extension/dot, not just one: Joe's first upload
  // was named "…Brazil.mp4..mp4" and came out titled "… Brazil.mp4." (27 Sep).
  let t = name.replace(/(\.+(mp4|mov|m4v|webm|mkv|avi))+\.*$/i, '').replace(/\.+$/, '');
  t = t.replace(/[_\-]+/g, ' ');
  t = t.replace(/\b(4k|2k|1080p|720p|480p|360p)\b/gi, '');
  t = t.replace(/\b\d{8,}\b/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return t.slice(0, 100) || 'History Stories';
}

async function buildMetadata(fileName, topic) {
  let meta;
  try {
    meta = await writeHistoryMetadataWithAI(topic ? `${fileName} (${topic.title})` : fileName);
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
  return meta;
}

// Joe's rule (9 Oct 2026): EVERY public GK Legend post carries the copyright
// line + channel link, history videos included.
const COPYRIGHT = '© 2026 GK Legend Studio. All rights reserved.\nhttps://www.youtube.com/@PathFoundGK';

function withFooter(description, topic) {
  const footer = `\n\nWhat story should we tell next? Tell us in the comments, and subscribe so you never miss one.\n\nSubscribe for more history stories -- football, world and Somali history: https://www.youtube.com/${config.historyChannelHandle}\n\nThis video is for general information and entertainment. Views are the creator's own.\n\n${COPYRIGHT}\n\n${topic.hashtags}`;
  // Cut the AI description (never the footer) to fit YouTube's limit.
  return `${description.slice(0, Math.max(0, 4900 - footer.length))}${footer}`;
}

// Joe sorts videos by dropping them into a subfolder of TOTOLL_HISTORY
// (SPORTS_HISTORY / WORLD_HISTORY / SOMALI_HISTORY, created 27 Sep 2026).
// The folder decides the playlist; a video dropped straight into
// TOTOLL_HISTORY just gets no playlist. Playlists are matched by title
// word, so ones Joe made by hand in Studio are reused, not duplicated.
const TOPICS = [
  {
    key: 'sports',
    folder: /SPORT|FOOTBALL/i,
    doneFolder: 'SPORTS_HISTORY',
    playlist: /sport|football/i,
    title: 'Football & Sports History',
    description: 'The greatest matches, players and moments in football and sports history, told as stories.',
    hashtags: '#footballhistory #sportshistory #history',
  },
  {
    key: 'world',
    folder: /WORLD/i,
    doneFolder: 'WORLD_HISTORY',
    playlist: /world/i,
    title: 'World History',
    description: 'Empires, turning points and the people who shaped our world, told as stories.',
    hashtags: '#worldhistory #history #documentary',
  },
  {
    key: 'somali',
    folder: /SOMALI/i,
    doneFolder: 'SOMALI_HISTORY',
    playlist: /somali/i,
    title: 'Somali History',
    description: 'The history, heritage and people of Somalia, told as stories.',
    hashtags: '#somalihistory #somalia #history',
  },
];

// Joe mostly drops videos straight into TOTOLL_HISTORY and expects the
// script to pick the playlist itself (27 Sep 2026). The AI's TOPIC answer
// wins when OmniRoute/Anthropic is up; otherwise these filename words decide,
// and anything unmatched counts as world history.
const SOMALI_WORDS = /somali|somalia|mogadishu|muqdisho|hargeisa|hargeysa|puntland|jubaland|kismayo|berbera|zeila|saylac|laas.?geel|darwiish|dervish|sayyid|ajuran|\badal\b|geledi|warsangeli|majeerteen|gabay|buraanbur|\bpunt\b/i;
const SPORTS_WORDS = /football|soccer|world.?cup|fifa|uefa|olympic|league|\bmatch|goal|stadium|maracan|pel[eé]\b|maradona|messi|ronaldo|cruyff|boxing|\bali\b|bern\b|wembley|hand.?of.?god|jesse.?owens|marathon|athlete|athletics|sprint|cricket|rugby|tennis|basketball|\bnba\b|\bf1\b|formula.?1|tournament|champion|\bfinal\b|derby|\bclub\b/i;

function topicFromText(rawText) {
  const text = rawText.replace(/[_\-.]+/g, ' ');
  if (SOMALI_WORDS.test(text)) return 'somali';
  if (SPORTS_WORDS.test(text)) return 'sports';
  return 'world';
}

async function topicForFile(driveAuth, fileId) {
  const drive = google.drive({ version: 'v3', auth: driveAuth });
  const file = await drive.files.get({ fileId, fields: 'parents' }, { timeout: 30000 });
  const parentId = (file.data.parents || [])[0];
  if (!parentId || parentId === config.historyFolderId) return null;
  const parent = await drive.files.get({ fileId: parentId, fields: 'name' }, { timeout: 30000 });
  return TOPICS.find((t) => t.folder.test(parent.data.name || '')) || null;
}

// Joe wants TOTOLL_HISTORY_DONE sorted the same way as the drop folder
// (29 Sep 2026), so finished videos go into DONE/SPORTS_HISTORY,
// DONE/WORLD_HISTORY or DONE/SOMALI_HISTORY (created here if missing).
// Any problem finding the subfolder falls back to DONE itself, so the move
// never fails because of sorting.
async function doneFolderFor(driveAuth, topic) {
  if (!topic) return config.historyDoneFolderId;
  try {
    const drive = google.drive({ version: 'v3', auth: driveAuth });
    const res = await drive.files.list(
      {
        q: `'${config.historyDoneFolderId}' in parents and name = '${topic.doneFolder}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
      },
      { timeout: 30000 }
    );
    if (res.data.files?.[0]) return res.data.files[0].id;
    const created = await drive.files.create(
      {
        requestBody: { name: topic.doneFolder, mimeType: 'application/vnd.google-apps.folder', parents: [config.historyDoneFolderId] },
        fields: 'id',
      },
      { timeout: 30000 }
    );
    return created.data.id;
  } catch (err) {
    console.log(`History channel: could not open DONE/${topic.doneFolder} (${err.message}) -- using DONE instead.`);
    return config.historyDoneFolderId;
  }
}

// A new channel needs conversation under every video (Joe, 5 Oct 2026), so
// each upload gets a pinned-style first comment with a question. Plain
// question banks per topic: no AI call, so it can never fail the upload.
const ENGAGEMENT_QUESTIONS = {
  sports: [
    'Which moment from this story still gives you goosebumps? Tell us below.',
    'Who is the greatest athlete of all time in your eyes, and why?',
    'Which sporting story should we tell next? Drop a name or a year.',
  ],
  world: [
    'Did you know this story before today? Tell us what surprised you most.',
    'Which moment in history should we cover next? Give us a year or a name.',
    'If you could stand in this moment for one hour, what would you ask?',
  ],
  somali: [
    'Does your family have a story that connects to this? Share it below.',
    'Which part of Somali history should we tell next? Name a place, a person or a year.',
    'Where are you watching from today? Tell us your city or country.',
  ],
};

function engagementFor(topic, videoId) {
  const bank = ENGAGEMENT_QUESTIONS[topic?.key] || ENGAGEMENT_QUESTIONS.world;
  let n = 0;
  for (const ch of String(videoId)) n += ch.charCodeAt(0);
  return bank[n % bank.length];
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
    let topic = null;
    try {
      topic = await topicForFile(driveAuth, file.id);
    } catch (err) {
      console.log(`History channel: could not read the video's folder (${err.message}) -- posting without a playlist.`);
    }
    const meta = await buildMetadata(file.name, topic);
    if (!topic) {
      const key = meta.topic || topicFromText(`${file.name} ${meta.title}`);
      topic = TOPICS.find((t) => t.key === key) || TOPICS.find((t) => t.key === 'world');
      console.log(`History channel: sorted into "${topic.title}" (${meta.topic ? 'AI' : 'filename words'})`);
    }
    localPath = await downloadFile(driveAuth, file.id, file.name, DOWNLOAD_TIMEOUT_MS);
    const youtubeAuth = loadOAuthClient(config.historyTokenFile);
    const result = await uploadToYouTube(youtubeAuth, {
      filePath: localPath,
      title: meta.title,
      description: withFooter(meta.description, topic),
      tags: meta.tags,
      categoryId: '27', // Education
      containsSyntheticMedia: true, // AI narration/visuals (NotebookLM, Grok, Gemini)
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
    console.log(`History channel: posted, YouTube id ${result.id}`);

    state.postedToday += 1;
    state.uploadedIds = [...state.uploadedIds, file.id].slice(-500);
    saveState(state);

    // An engagement-comment failure must never undo or repeat the upload.
    try {
      await postEngagementComment(youtubeAuth, result.id, engagementFor(topic, result.id));
      console.log('History channel: posted engagement question');
    } catch (err) {
      console.log(`History channel: could not post engagement question: ${err.message}`);
    }

    if (topic) {
      // A playlist failure must never undo or repeat the upload itself.
      try {
        const playlistId = await findOrCreatePlaylist(youtubeAuth, { matcher: topic.playlist, title: topic.title, description: topic.description });
        await addVideoToPlaylist(youtubeAuth, playlistId, result.id);
        console.log(`History channel: added to playlist "${topic.title}"`);
      } catch (err) {
        console.log(`History channel: could not add to playlist "${topic.title}": ${err.message}`);
      }
    }

    await moveToDone(driveAuth, file.id, await doneFolderFor(driveAuth, topic));
  } finally {
    isPosting = false;
    if (localPath) fs.rm(localPath, { force: true }, () => {});
  }
}
