import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { run } from './aspectRatio.js';
import { google } from 'googleapis';
import { downloadFile } from './drive.js';
import { expandHome, listFinishedVideos } from './localDrop.js';

// Video stacker: Joe keeps a stack of short clips (Grok Library downloads,
// stock footage he owns) in STITCH_FOLDER. Each cycle, up to STITCH_PER_DAY
// times a day, this joins enough of them to reach about STITCH_TARGET_SECONDS
// (default 60) into ONE vertical 9:16 video, adds a short GK text line, and
// saves it into LOCAL_DROP_FOLDER, from where localDrop.js sends it to
// GK_TERMINAL and the normal pipeline posts it. Used clips move to
// "<folder>/used" so a clip is never stacked twice. Off until
// STITCH_FOLDER and LOCAL_DROP_FOLDER are both set. Needs ffmpeg.

const STATE_PATH = path.join(process.cwd(), 'stitch-state.json');
const USED_PATH = path.join(process.cwd(), 'stitch-used.json');
const MAX_CLIPS = 20;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (parsed.day === todayKey()) return parsed;
  } catch {
    // fall through to a fresh day
  }
  return { day: todayKey(), made: 0, failedAt: 0, waitingLogged: false };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function probe(filePath) {
  const out = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type',
    '-of', 'json',
    filePath,
  ]);
  const info = JSON.parse(out);
  const duration = Number(info.format?.duration) || 0;
  const hasAudio = (info.streams || []).some((s) => s.codec_type === 'audio');
  return { duration, hasAudio };
}

// Only plain characters go into the drawtext filter, so quotes/colons in
// STITCH_TEXT can never break the ffmpeg command.
export function cleanText(text) {
  return String(text || '').replace(/[^A-Za-z0-9 .,!?&-]/g, '').trim();
}

export function chooseClips(clips, targetSeconds, maxClipSeconds) {
  const chosen = [];
  let total = 0;
  for (const clip of clips) {
    if (chosen.length >= MAX_CLIPS) break;
    const used = Math.min(clip.duration, maxClipSeconds);
    if (used < 1) continue;
    chosen.push({ ...clip, used });
    total += used;
    if (total >= targetSeconds) break;
  }
  return { chosen, total };
}

async function normalizeClip(clip, outPath) {
  const filter =
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[v]';
  const args = ['-y', '-i', clip.full];
  if (!clip.hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
  args.push(
    '-filter_complex', filter,
    '-map', '[v]',
    '-map', clip.hasAudio ? '0:a:0' : '1:a:0',
    '-t', String(clip.used),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-shortest',
    outPath
  );
  await run('ffmpeg', args);
}

async function joinClips(partPaths, listPath, outPath, text) {
  fs.writeFileSync(listPath, partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  const joined = outPath.replace(/\.mp4$/, '.joined.mp4');
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', joined]);

  const label = cleanText(text);
  if (!label) {
    fs.renameSync(joined, outPath);
    return false;
  }
  const fontPart = config.stitchFont ? `fontfile='${config.stitchFont.replace(/'/g, '')}':` : '';
  const drawtext =
    `drawtext=${fontPart}text='${label}':fontsize=64:fontcolor=white:borderw=4:bordercolor=black:` +
    'x=(w-text_w)/2:y=h-300';
  try {
    await run('ffmpeg', ['-y', '-i', joined, '-vf', drawtext, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', outPath]);
    fs.rmSync(joined, { force: true });
    return true;
  } catch (err) {
    console.log(`Stitch: could not add the text line (${err.message.slice(0, 120)}) -- saving the video without it.`);
    fs.renameSync(joined, outPath);
    return false;
  }
}

function loadUsedIds() {
  try {
    const parsed = JSON.parse(fs.readFileSync(USED_PATH, 'utf8'));
    return Array.isArray(parsed.used) ? parsed.used : [];
  } catch {
    return [];
  }
}

function saveUsedIds(used) {
  fs.writeFileSync(USED_PATH, JSON.stringify({ used: used.slice(-5000) }, null, 2));
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Every video directly inside the Drive stock folder (all pages).
async function listDriveStock(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  const found = [];
  let pageToken;
  do {
    const res = await drive.files.list(
      {
        q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken,
      },
      { timeout: 60 * 1000 }
    );
    found.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return found;
}

// Joins the chosen clips into one video in outDir. Returns { finalName, withText }.
async function buildStitch(chosen, outDir, stamp) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-stitch-'));
  const finalName = `GK_Stitch_${stamp}.mp4`;
  const hiddenOut = path.join(outDir, `.stitching-${stamp}.mp4`);
  try {
    const parts = [];
    for (let i = 0; i < chosen.length; i++) {
      const part = path.join(work, `part-${i}.mp4`);
      await normalizeClip(chosen[i], part);
      parts.push(part);
    }
    const withText = await joinClips(parts, path.join(work, 'list.txt'), hiddenOut, config.stitchText);
    fs.renameSync(hiddenOut, path.join(outDir, finalName));
    return { finalName, withText };
  } catch (err) {
    fs.rmSync(hiddenOut, { force: true });
    throw err;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Mac-folder mode: clips are consumed (moved to "used").
async function stitchFromFolder(dir, outDir, state) {
  fs.mkdirSync(path.join(dir, 'used'), { recursive: true });
  const finished = listFinishedVideos(dir, config.localDropMinAgeSeconds);
  if (finished.length === 0) return;

  const probed = [];
  for (const f of finished.slice(0, MAX_CLIPS * 2)) {
    try {
      probed.push({ ...f, ...(await probe(f.full)) });
    } catch (err) {
      // Park unreadable files so they are not re-tried (and re-logged) every cycle.
      const badDir = path.join(dir, 'unreadable');
      fs.mkdirSync(badDir, { recursive: true });
      fs.renameSync(f.full, path.join(badDir, f.name));
      console.log(`Stitch: "${f.name}" is not a readable video -- moved it to "unreadable".`);
    }
  }
  const { chosen, total } = chooseClips(probed, config.stitchTargetSeconds, config.stitchMaxClipSeconds);
  if (total < config.stitchTargetSeconds * 0.8) {
    if (!state.waitingLogged) {
      console.log(`Stitch: waiting for more clips -- have about ${Math.round(total)}s, need about ${config.stitchTargetSeconds}s.`);
      state.waitingLogged = true;
      saveState(state);
    }
    return;
  }
  console.log(`Stitch: joining ${chosen.length} clips (about ${Math.round(total)}s)...`);
  const { finalName, withText } = await buildStitch(chosen, outDir, `${state.day}_${state.made + 1}`);
  for (const clip of chosen) {
    let dest = path.join(dir, 'used', clip.name);
    if (fs.existsSync(dest)) dest = path.join(dir, 'used', `${Date.now()}-${clip.name}`);
    fs.renameSync(clip.full, dest);
  }
  state.made += 1;
  state.waitingLogged = false;
  state.failedAt = 0;
  saveState(state);
  console.log(`Stitch: saved "${finalName}" to the drop folder${withText ? ' with the GK text line' : ''} (${state.made}/${config.stitchPerDay} today).`);
}

// Drive-stock mode: the library stays where it is. Random unused clips are
// downloaded, joined, and remembered in stitch-used.json; when every clip has
// been used the cycle starts again.
async function stitchFromDrive(auth, folderId, outDir, state) {
  const stock = await listDriveStock(auth, folderId);
  const needed = Math.min(MAX_CLIPS, Math.ceil(config.stitchTargetSeconds / config.stitchMaxClipSeconds) + 2);
  if (stock.length < needed) {
    if (!state.waitingLogged) {
      console.log(`Stitch: the Drive stock folder has ${stock.length} videos, need at least ${needed} -- waiting for more.`);
      state.waitingLogged = true;
      saveState(state);
    }
    return;
  }
  let used = loadUsedIds();
  let pool = stock.filter((f) => !used.includes(f.id));
  if (pool.length < needed) {
    console.log('Stitch: every stock clip has been used once -- starting a new round.');
    used = [];
    pool = stock;
  }
  const picked = shuffled(pool).slice(0, needed);

  const downloaded = [];
  const probed = [];
  try {
    for (const f of picked) {
      try {
        const full = await downloadFile(auth, f.id, f.name.replace(/[^\w.-]+/g, '_'));
        downloaded.push(full);
        probed.push({ id: f.id, name: f.name, full, ...(await probe(full)) });
      } catch (err) {
        console.log(`Stitch: could not use "${f.name}" (${err.message.slice(0, 100)}) -- skipping it.`);
      }
    }
    const { chosen, total } = chooseClips(probed, config.stitchTargetSeconds, config.stitchMaxClipSeconds);
    if (total < config.stitchTargetSeconds * 0.8) {
      console.log(`Stitch: only ${Math.round(total)}s of readable clips this round -- will try again next cycle.`);
      return;
    }
    console.log(`Stitch: joining ${chosen.length} Drive stock clips (about ${Math.round(total)}s)...`);
    const { finalName, withText } = await buildStitch(chosen, outDir, `${state.day}_${state.made + 1}`);
    saveUsedIds([...used, ...chosen.map((c) => c.id)]);
    state.made += 1;
    state.waitingLogged = false;
    state.failedAt = 0;
    saveState(state);
    console.log(`Stitch: saved "${finalName}" to the drop folder${withText ? ' with the GK text line' : ''} (${state.made}/${config.stitchPerDay} today).`);
  } finally {
    for (const f of downloaded) fs.rmSync(f, { force: true });
  }
}

export async function stitchOnce(auth) {
  const dir = expandHome(config.stitchFolder);
  const driveFolderId = config.stitchDriveFolderId;
  const outDir = expandHome(config.localDropFolder);
  if (!dir && !driveFolderId) return;
  if (!outDir) {
    console.log('Stitch: no LOCAL_DROP_FOLDER set -- nowhere to save the result, skipping.');
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });

  const state = loadState();
  if (state.made >= config.stitchPerDay) return;
  if (state.failedAt && Date.now() - state.failedAt < RETRY_AFTER_FAILURE_MS) return;

  try {
    if (driveFolderId) await stitchFromDrive(auth, driveFolderId, outDir, state);
    else await stitchFromFolder(dir, outDir, state);
  } catch (err) {
    console.error(`Stitch failed (will try again in an hour): ${err.message}`);
    state.failedAt = Date.now();
    saveState(state);
  }
}
