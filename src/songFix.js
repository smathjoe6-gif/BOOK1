import { google } from 'googleapis';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { downloadFile } from './drive.js';

// Song fix: Joe drops a finished full song (audio or a video with the song) into the Drive folder
// SONG_FIX_FOLDER_ID ("GK Legend Studio - Complete Lyrics Archive"). Each cycle ONE new file is
// downloaded, its whole sound is cleaned and levelled with ffmpeg (nothing is cut), and the result
// is saved into the subfolder "complete finish deploy" as <name>_FIXED.wav + .mp3 (+ _FIXED.mp4 when
// the source was a video, picture untouched). The original is never changed. NOTHING is posted:
// this folder is not watched by the posting pipeline. Joe listens, and only then moves a file on.

const STATE_PATH = path.join(process.cwd(), 'song-fix.json');
const MEDIA_EXT = new Set(['.wav', '.mp3', '.m4a', '.flac', '.aac', '.ogg', '.mp4', '.mov', '.m4v', '.webm']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const OUT_FOLDER_NAME = 'complete finish deploy';

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { done: s.done || [], failed: s.failed || {} };
  } catch {
    return { done: [], failed: {} };
  }
}
const saveState = (s) => fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${out.slice(-250)}`))));
  });
}

async function durationOf(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(out) || 0;
}

async function hasVideo(file) {
  const out = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file]);
  return out.trim().includes('video');
}

// The whole sound chain. Order: rumble filter -> hiss reduction -> gentle tone shaping -> glue
// compression -> loudness to streaming level (-14 LUFS) -> true-peak limiter -> fades.
export function buildFilter(duration) {
  const fadeOut = Math.min(2.5, Math.max(0.5, duration / 10));
  const chain = [
    'highpass=f=30',
    'afftdn=nr=10:nf=-45',
    'equalizer=f=250:t=q:w=1:g=-1.5',
    'equalizer=f=3500:t=q:w=1:g=1',
    'acompressor=threshold=-20dB:ratio=2:attack=20:release=250:makeup=1',
    'loudnorm=I=-14:TP=-1.0:LRA=11',
    'alimiter=limit=0.89',
    'afade=t=in:st=0:d=0.3',
    `afade=t=out:st=${Math.max(0, duration - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`,
  ];
  return chain.join(',');
}

// Fixes one local file. Returns { wav, mp3, mp4? } paths (in outDir).
export async function fixSongFile(inputPath, outDir, baseName) {
  const duration = await durationOf(inputPath);
  if (!duration) throw new Error('could not read the length of the file');
  const af = buildFilter(duration);
  const wav = path.join(outDir, `${baseName}_FIXED.wav`);
  const mp3 = path.join(outDir, `${baseName}_FIXED.mp3`);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', inputPath, '-vn', '-af', af, '-ar', '48000', '-c:a', 'pcm_s24le', wav]);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '320k', mp3]);
  const result = { wav, mp3 };
  if (await hasVideo(inputPath)) {
    const mp4 = path.join(outDir, `${baseName}_FIXED.mp4`);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', inputPath, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', mp4]);
    result.mp4 = mp4;
  }
  return result;
}

async function findOrCreateOutFolder(drive, parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 100,
  });
  const hit = (res.data.files || []).find((f) => f.name.trim().toLowerCase() === OUT_FOLDER_NAME);
  if (hit) return hit.id;
  const made = await drive.files.create({
    requestBody: { name: OUT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return made.data.id;
}

const MIME = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };

export async function songFixOnce(auth) {
  const folderId = config.songFixFolderId;
  if (!folderId) return;
  const drive = google.drive({ version: 'v3', auth });
  const state = loadState();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
    fields: 'files(id,name,size,md5Checksum)',
    orderBy: 'createdTime',
    pageSize: 100,
  });
  const next = (res.data.files || []).find((f) => {
    const ext = path.extname(f.name || '').toLowerCase();
    return MEDIA_EXT.has(ext) && !/_FIXED/i.test(f.name) && !state.done.includes(f.id) && (state.failed[f.id] || 0) < 3;
  });
  if (!next) return;

  console.log(`Song fix: fixing "${next.name}" ...`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-songfix-'));
  let local = '';
  try {
    local = await downloadFile(auth, next.id, next.name, 20 * 60 * 1000);
    const base = path.basename(next.name, path.extname(next.name)).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'song';
    const out = await fixSongFile(local, work, base);
    const outId = await findOrCreateOutFolder(drive, folderId);
    for (const file of Object.values(out)) {
      await drive.files.create(
        {
          requestBody: { name: path.basename(file), parents: [outId] },
          media: { mimeType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.createReadStream(file) },
          fields: 'id',
        },
        { timeout: 15 * 60 * 1000 }
      );
    }
    state.done.push(next.id);
    saveState(state);
    console.log(`Song fix: saved ${Object.values(out).map((f) => path.basename(f)).join(', ')} into "${OUT_FOLDER_NAME}".`);
  } catch (err) {
    state.failed[next.id] = (state.failed[next.id] || 0) + 1;
    saveState(state);
    throw err;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    if (local) fs.unlink(local, () => {});
  }
}

// Local test: npm run song-fix -- path/to/song.wav   (writes next to a "song-fix-test" folder, uploads nothing)
if (process.argv[1] && process.argv[1].endsWith('songFix.js') && process.argv[2]) {
  const input = path.resolve(process.argv[2]);
  const dir = path.join(process.cwd(), 'song-fix-test');
  fs.mkdirSync(dir, { recursive: true });
  fixSongFile(input, dir, path.basename(input, path.extname(input)).replace(/\s+/g, '_'))
    .then((r) => console.log('Done:', r))
    .catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}
