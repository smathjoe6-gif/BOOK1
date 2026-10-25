import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { google } from 'googleapis';
import sharp from 'sharp';
import { config } from './config.js';
import { run } from './aspectRatio.js';
import { loadOAuthClient } from './googleAuth.js';
import { downloadFile } from './drive.js';
import { expandHome } from './localDrop.js';
import { postedHashSet } from './postedHashes.js';

// Loop cutter (Joe, 24 Oct 2026: "I have thousands of videos, my videos are stuck, make it
// viral, hands free"). His hits are SHORT: an 11 s wedding clip (~76k views) and a 6 s lion
// roar (46k); long or stitched videos got 11-500 views. So instead of stitching, this takes ONE
// clip from the library folder LOOP_SOURCE_FOLDER_ID (any depth up to 3), finds the loudest
// LOOP_SECONDS (default 10) stretch, crops it to 1080x1920, puts an honest one-line hook on the
// first 2.5 s (drawn with sharp, so it works on an ffmpeg without drawtext), fades the sound out
// so the end flows back to the start, and saves it into LOCAL_DROP_FOLDER -> localDrop ->
// GK_TERMINAL -> the normal pipeline. Each library clip is used once (loop-used.json).
// Off until LOOP_SOURCE_FOLDER_ID and LOCAL_DROP_FOLDER are set.
//
//   npm run loop-cut -- --dry [--count=5]   makes test files in ./loop-cut-test, posts nothing

const USED_PATH = path.join(process.cwd(), 'loop-used.json');
const STATE_PATH = path.join(process.cwd(), 'loop-state.json');
const TEST_DIR = path.join(process.cwd(), 'loop-cut-test');
const MIN_CLIP_SECONDS = 4;
const HOOK_SECONDS = 2.5;
const RATE = 8000;
const FOLDER = 'application/vnd.google-apps.folder';

// Honest attention hooks only: curiosity, sound, payoff at the end. No claims, no fake news.
export const HOOKS = ['WAIT FOR IT', 'SOUND ON', 'LISTEN CLOSELY', 'WATCH TILL THE END', 'LOOK AT THIS', 'DID YOU HEAR THAT?'];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadUsed() {
  try {
    const parsed = JSON.parse(fs.readFileSync(USED_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsed(used) {
  fs.writeFileSync(USED_PATH, JSON.stringify(used.slice(-5000)));
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (parsed.day === todayKey()) return parsed;
  } catch {
    // fresh day
  }
  return { day: todayKey(), made: 0, failedAt: 0 };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state));
}

async function probe(filePath) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', filePath]);
  const info = JSON.parse(out);
  return {
    duration: Number(info.format?.duration) || 0,
    hasAudio: (info.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

function decodeAudio(file) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-']);
    const chunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.on('error', reject);
    ff.on('close', () => resolve(Buffer.concat(chunks)));
  });
}

// Start second of the loudest `windowSeconds` stretch (average loudness per second). Pure function
// on per-second loudness so it can be tested without ffmpeg.
export function loudestStart(perSecond, windowSeconds) {
  const w = Math.max(1, Math.round(windowSeconds));
  if (perSecond.length <= w) return 0;
  let sum = 0;
  for (let i = 0; i < w; i++) sum += perSecond[i];
  let best = sum;
  let bestAt = 0;
  for (let i = w; i < perSecond.length; i++) {
    sum += perSecond[i] - perSecond[i - w];
    if (sum > best) {
      best = sum;
      bestAt = i - w + 1;
    }
  }
  return bestAt;
}

async function chooseStart(file, duration, windowSeconds) {
  if (duration <= windowSeconds + 0.5) return 0;
  const pcm = await decodeAudio(file);
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const seconds = Math.floor(samples.length / RATE);
  if (seconds < 2) return 0;
  const perSecond = [];
  for (let s = 0; s < seconds; s++) {
    let sum = 0;
    for (let i = s * RATE; i < (s + 1) * RATE; i++) sum += samples[i] * samples[i];
    perSecond.push(Math.sqrt(sum / RATE));
  }
  const start = loudestStart(perSecond, windowSeconds);
  return Math.min(start, Math.max(0, duration - windowSeconds));
}

async function hookPng(text, outPath) {
  const size = Math.max(52, Math.min(110, Math.floor(980 / (Math.max(1, text.length) * 0.74))));
  const svg = Buffer.from(
    `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">` +
      `<style>.t{font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:${size}px;fill:#fff;stroke:#000;stroke-width:7px;paint-order:stroke}</style>` +
      `<text class="t" x="540" y="${Math.round(1920 * 0.2)}" text-anchor="middle">${text.replace(/[<>&"']/g, '')}</text>` +
      `</svg>`
  );
  await sharp(svg).png().toFile(outPath);
}

export async function cutLoop(inputPath, outPath, hook) {
  const { duration, hasAudio } = await probe(inputPath);
  if (duration < MIN_CLIP_SECONDS) throw new Error(`clip is only ${duration.toFixed(1)} s`);
  const length = Math.min(config.loopSeconds, duration);
  const start = hasAudio ? await chooseStart(inputPath, duration, length) : 0;
  const png = path.join(os.tmpdir(), `gk-loop-hook-${process.pid}-${Date.now()}.png`);
  await hookPng(hook, png);
  const fade = Math.max(0, length - 0.35);
  const filter =
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[b];` +
    `[b][1:v]overlay=0:0:enable='between(t,0,${HOOK_SECONDS})'[v]`;
  const args = [
    '-y', '-ss', start.toFixed(2), '-t', length.toFixed(2), '-i', inputPath,
    '-loop', '1', '-t', length.toFixed(2), '-i', png,
    '-filter_complex', filter, '-map', '[v]',
  ];
  if (hasAudio) args.push('-map', '0:a:0', '-af', `afade=t=in:d=0.1,afade=t=out:st=${fade.toFixed(2)}:d=0.35`);
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', outPath);
  try {
    await run('ffmpeg', args);
  } finally {
    fs.unlink(png, () => {});
  }
  return { start, length, hasAudio };
}

// LOOP_SOURCE_FOLDER_ID may hold several folder ids separated by commas.
export function sourceFolderIds() {
  return String(config.loopSourceFolderId || '').split(',').map((x) => x.trim()).filter(Boolean);
}

async function listSources(auth) {
  const all = [];
  for (const id of sourceFolderIds()) all.push(...(await listFolderTree(auth, id)));
  return all;
}

async function listFolderTree(auth, rootId, depth = 3) {
  const drive = google.drive({ version: 'v3', auth });
  const clips = [];
  const walk = async (folderId, level) => {
    let pageToken;
    do {
      const res = await drive.files.list(
        {
          q: `'${folderId}' in parents and trashed = false and (mimeType contains 'video/' or mimeType = '${FOLDER}')`,
          fields: 'nextPageToken, files(id, name, mimeType, createdTime, size, md5Checksum)',
          pageSize: 1000,
          pageToken,
        },
        { timeout: 60 * 1000 }
      );
      for (const f of res.data.files || []) {
        if (f.mimeType === FOLDER) {
          if (level < depth) await walk(f.id, level + 1);
        } else {
          clips.push(f);
        }
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  };
  await walk(rootId, 1);
  return clips;
}

function pick(clips, used, count) {
  const usedSet = new Set(used);
  // Never re-cut a library clip whose exact bytes were already posted as a full video.
  const posted = postedHashSet();
  const fresh = clips.filter(
    (c) => !usedSet.has(c.id) && Number(c.size || 0) > 300 * 1024 && !(c.md5Checksum && posted.has(c.md5Checksum)) && !config.loopSkipWords.some((w) => String(c.name || '').toLowerCase().includes(w)) && /\.(mp4|mov|m4v|webm)$/i.test(c.name || '')
  );
  // Newest library clips first: they are the freshest ideas and the most likely to be on-brand.
  fresh.sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')));
  return fresh.slice(0, count);
}

async function makeOne(auth, clip, outDir, hookIndex) {
  const hook = HOOKS[hookIndex % HOOKS.length];
  const localPath = await downloadFile(auth, clip.id, clip.name);
  try {
    const outName = `GK_Loop_${todayKey()}-${clip.id.slice(0, 6).replace(/[^\w]/g, 'x')}-v1.mp4`;
    const outPath = path.join(outDir, outName);
    const info = await cutLoop(localPath, outPath, hook);
    return { outPath, outName, hook, ...info };
  } finally {
    fs.unlink(localPath, () => {});
  }
}

// Called every cycle from src/index.js.
export async function loopCutOnce(auth) {
  if (!config.loopSourceFolderId || !config.localDropFolder) return;
  const state = loadState();
  if (state.made >= config.loopPerDay) return;
  if (state.failedAt && Date.now() - state.failedAt < 60 * 60 * 1000) return;
  const clips = await listSources(auth);
  const [clip] = pick(clips, loadUsed(), 1);
  if (!clip) {
    console.log('Loop cutter: no unused clip left in the library folder.');
    return;
  }
  const dropDir = expandHome(config.localDropFolder);
  fs.mkdirSync(dropDir, { recursive: true });
  try {
    const made = await makeOne(auth, clip, dropDir, state.made);
    const used = loadUsed();
    used.push(clip.id);
    saveUsed(used);
    state.made += 1;
    state.failedAt = 0;
    saveState(state);
    console.log(`Loop cutter: saved "${made.outName}" (${made.length.toFixed(1)} s from ${made.start.toFixed(0)} s, hook "${made.hook}") from "${clip.name}".`);
  } catch (err) {
    // A clip that cannot be cut is skipped for good, so one bad file never blocks the rest.
    const used = loadUsed();
    used.push(clip.id);
    saveUsed(used);
    state.failedAt = Date.now();
    saveState(state);
    console.log(`Loop cutter: could not cut "${clip.name}" (${err.message.slice(-200).replace(/\s+/g, ' ')}) -- skipped.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const countArg = args.find((a) => a.startsWith('--count='));
  const count = Math.min(10, Number(countArg?.split('=')[1]) || 5);
  if (!config.loopSourceFolderId) {
    console.log('Set LOOP_SOURCE_FOLDER_ID in .env first (the Drive folder with your library clips, e.g. GROK_LIBRARY_SORTED/9x16).');
    return;
  }
  if (!dry) {
    console.log('This command only does test runs. Use --dry (nothing is posted); the live version runs inside the script.');
    return;
  }
  const auth = await loadOAuthClient();
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const clips = await listSources(auth);
  console.log(`Library folder: ${clips.length} clip(s) found.`);
  const chosen = pick(clips, loadUsed(), count);
  let i = 0;
  for (const clip of chosen) {
    try {
      const made = await makeOne(auth, clip, TEST_DIR, i++);
      console.log(`OK  ${made.outName}  ${made.length.toFixed(1)} s from ${made.start.toFixed(0)} s  hook "${made.hook}"  <- ${clip.name}`);
    } catch (err) {
      console.log(`FAIL ${clip.name}: ${err.message.slice(-200).replace(/\s+/g, ' ')}`);
    }
  }
  console.log(`\nTest files are in ${TEST_DIR}. Nothing was posted and no clip was marked as used.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error('Loop cutter failed:', err.message);
    process.exit(1);
  });
}
