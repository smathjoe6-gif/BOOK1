import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { config } from './config.js';
import { downloadFile } from './drive.js';
import { makeThumbnail, setThumbnail } from './historyThumbnail.js';

// Joe (18 Oct 2026): history videos uploaded before the thumbnail step (and two with a
// plain white frame) have no proper thumbnail. This sets one on the videos already on
// @TotollsportGK: it matches each YouTube video to its original file in TOTOLL_HISTORY_DONE
// by title words, grabs the best frame and sets the thumbnail. DRY RUN by default (shows
// which file it matched to which video); --do changes YouTube; at most
// HISTORY_THUMB_BACKFILL_MAX (10) videos per run; every video is done once (history-thumbs-done.json).
//
//   npm run history-thumbnails                 (show matches, change nothing)
//   npm run history-thumbnails -- --do         (set thumbnails)
//   npm run history-thumbnails -- --do --only "Bikila"   (only titles containing that text)

const FOLDER = 'application/vnd.google-apps.folder';
const STATE = path.join(process.cwd(), 'history-thumbs-done.json');
const MAX = Number(process.env.HISTORY_THUMB_BACKFILL_MAX || 10);
const DO = process.argv.includes('--do');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx > 0 ? String(process.argv[onlyIdx + 1] || '').toLowerCase() : '';

const words = (t) =>
  [...new Set(String(t || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/i, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3))];

function loadDone() {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE, 'utf8')).done || []);
  } catch {
    return new Set();
  }
}

async function listDoneVideos(drive, rootId) {
  const videos = [];
  let level = [rootId];
  for (let depth = 0; depth < 4 && level.length; depth++) {
    const next = [];
    for (const parent of level) {
      let pageToken;
      do {
        const res = await drive.files.list({
          q: `'${parent}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType)',
          pageSize: 1000,
          pageToken,
        });
        for (const f of res.data.files || []) {
          if (f.mimeType === FOLDER) next.push(f.id);
          else if (String(f.mimeType).startsWith('video/')) videos.push(f);
        }
        pageToken = res.data.nextPageToken;
      } while (pageToken);
    }
    level = next;
  }
  return videos;
}

async function listChannelVideos(yt) {
  const ch = await yt.channels.list({ part: 'contentDetails', mine: true });
  const uploads = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('no uploads playlist found for the history login (run npm run auth-history, pick "Jamal")');
  const out = [];
  let pageToken;
  do {
    const res = await yt.playlistItems.list({ part: 'snippet', playlistId: uploads, maxResults: 50, pageToken });
    for (const it of res.data.items || []) out.push({ id: it.snippet.resourceId.videoId, title: it.snippet.title });
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return out;
}

function bestFile(title, files) {
  const tw = new Set(words(title));
  let best = null;
  for (const f of files) {
    const fw = words(f.name);
    if (fw.length < 2) continue;
    const score = fw.filter((w) => tw.has(w)).length / fw.length;
    if (!best || score > best.score) best = { file: f, score };
  }
  return best && best.score >= 0.5 ? best : null;
}

async function main() {
  const driveAuth = loadOAuthClient();
  const ytAuth = loadOAuthClient(config.historyTokenFile);
  const drive = google.drive({ version: 'v3', auth: driveAuth });
  const yt = google.youtube({ version: 'v3', auth: ytAuth });
  const [videos, files] = await Promise.all([listChannelVideos(yt), listDoneVideos(drive, config.historyDoneFolderId)]);
  const done = loadDone();
  console.log(`${videos.length} video(s) on the channel, ${files.length} original file(s) in the done folders.`);
  let handled = 0;
  for (const v of videos) {
    if (done.has(v.id) || (ONLY && !v.title.toLowerCase().includes(ONLY))) continue;
    const m = bestFile(v.title, files);
    if (!m) {
      console.log(`- "${v.title}": no matching file found (skipped)`);
      continue;
    }
    console.log(`- "${v.title}" <- ${m.file.name} (match ${(m.score * 100).toFixed(0)}%)`);
    if (!DO) continue;
    if (handled >= MAX) {
      console.log(`  (limit of ${MAX} per run reached; run again for the rest)`);
      break;
    }
    let local;
    const thumb = path.join(os.tmpdir(), `gk-thumb-${v.id}.jpg`);
    try {
      local = await downloadFile(driveAuth, m.file.id, m.file.name);
      await makeThumbnail(local, v.title, thumb);
      await setThumbnail(ytAuth, v.id, thumb);
      done.add(v.id);
      fs.writeFileSync(STATE, JSON.stringify({ done: [...done] }, null, 2));
      handled += 1;
      console.log('  thumbnail set');
    } catch (err) {
      console.log(`  could not set thumbnail: ${String(err.message).slice(0, 200)}`);
    } finally {
      if (local) fs.rmSync(local, { force: true });
      fs.rmSync(thumb, { force: true });
    }
  }
  if (!DO) console.log('Dry run: nothing changed. Add -- --do to set the thumbnails.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
