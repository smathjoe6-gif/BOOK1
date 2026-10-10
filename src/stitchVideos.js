import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { run } from './aspectRatio.js';
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

export async function stitchOnce() {
  const dir = expandHome(config.stitchFolder);
  const outDir = expandHome(config.localDropFolder);
  if (!dir) return;
  if (!outDir) {
    console.log('Stitch: STITCH_FOLDER is set but LOCAL_DROP_FOLDER is not -- nowhere to save the result, skipping.');
    return;
  }
  fs.mkdirSync(path.join(dir, 'used'), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const state = loadState();
  if (state.made >= config.stitchPerDay) return;
  if (state.failedAt && Date.now() - state.failedAt < RETRY_AFTER_FAILURE_MS) return;

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

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-stitch-'));
  const stamp = `${state.day}_${state.made + 1}`;
  const finalName = `GK_Stitch_${stamp}.mp4`;
  const hiddenOut = path.join(outDir, `.stitching-${stamp}.mp4`);
  try {
    console.log(`Stitch: joining ${chosen.length} clips (about ${Math.round(total)}s) into "${finalName}"...`);
    const parts = [];
    for (let i = 0; i < chosen.length; i++) {
      const part = path.join(work, `part-${i}.mp4`);
      await normalizeClip(chosen[i], part);
      parts.push(part);
    }
    const withText = await joinClips(parts, path.join(work, 'list.txt'), hiddenOut, config.stitchText);
    fs.renameSync(hiddenOut, path.join(outDir, finalName));
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
  } catch (err) {
    console.error(`Stitch failed (will try again in an hour): ${err.message}`);
    fs.rmSync(hiddenOut, { force: true });
    state.failedAt = Date.now();
    saveState(state);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
