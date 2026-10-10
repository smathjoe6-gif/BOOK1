import { google } from 'googleapis';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';

// Local drop folder: Joe's Grok Bot (or anything else on the same Mac) saves
// finished videos into LOCAL_DROP_FOLDER (e.g. ~/GK_DROP). Each cycle this
// uploads every new, finished video from that folder into GK_TERMINAL
// (DRIVE_FOLDER_ID) and then moves the local file into a "done" subfolder, so
// nothing is uploaded twice. From GK_TERMINAL on, the normal pipeline takes
// over (YouTube, TikTok, Buffer...). Off until LOCAL_DROP_FOLDER is set.

const STATE_PATH = path.join(process.cwd(), 'local-drop.json');
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_UPLOADS_PER_CYCLE = 5;
const MAX_REMEMBERED = 1000;

export function expandHome(p) {
  if (!p) return '';
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { uploaded: Array.isArray(parsed.uploaded) ? parsed.uploaded : [] };
  } catch {
    return { uploaded: [] };
  }
}

function saveState(state) {
  state.uploaded = state.uploaded.slice(-MAX_REMEMBERED);
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function md5Of(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function uniqueDestination(dir, name) {
  let candidate = path.join(dir, name);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return path.join(dir, `${base}-${Date.now()}${ext}`);
}

// A file counts as finished only when it hasn't changed for a while, so a
// download that is still being written is never uploaded half-done.
export function listFinishedVideos(dir, minAgeSeconds, now = Date.now()) {
  const finished = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    if (!VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    if (stat.size === 0) continue;
    if (now - stat.mtimeMs < minAgeSeconds * 1000) continue;
    finished.push({ name: entry.name, full, mtimeMs: stat.mtimeMs });
  }
  return finished.sort((a, b) => a.mtimeMs - b.mtimeMs);
}

export async function uploadLocalDrops(auth) {
  const dir = expandHome(config.localDropFolder);
  if (!dir) return;

  const doneDir = path.join(dir, 'done');
  fs.mkdirSync(doneDir, { recursive: true });

  const files = listFinishedVideos(dir, config.localDropMinAgeSeconds).slice(0, MAX_UPLOADS_PER_CYCLE);
  if (files.length === 0) return;

  const drive = google.drive({ version: 'v3', auth });
  const state = loadState();

  for (const file of files) {
    try {
      const md5 = await md5Of(file.full);
      if (state.uploaded.includes(md5)) {
        fs.renameSync(file.full, uniqueDestination(doneDir, `duplicate-${file.name}`));
        console.log(`Local drop: "${file.name}" was already uploaded before -- not sending it again (moved to done).`);
        continue;
      }
      // Drive needs a file extension or Make/Facebook reject the video.
      const driveName = path.extname(file.name) ? file.name : `${file.name}.mp4`;
      await drive.files.create(
        {
          requestBody: { name: driveName, parents: [config.driveFolderId] },
          media: { mimeType: 'video/mp4', body: fs.createReadStream(file.full) },
          fields: 'id',
        },
        { timeout: UPLOAD_TIMEOUT_MS }
      );
      // Remember it BEFORE moving the file, so a crash in between can never
      // cause a second upload.
      state.uploaded.push(md5);
      saveState(state);
      fs.renameSync(file.full, uniqueDestination(doneDir, file.name));
      console.log(`Local drop: uploaded "${file.name}" to GK_TERMINAL (moved to done).`);
    } catch (err) {
      console.error(`Local drop: "${file.name}" failed (will retry next cycle):`, err.message);
    }
  }
}
