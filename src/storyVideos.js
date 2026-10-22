import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { run } from './aspectRatio.js';
import { expandHome } from './localDrop.js';
import { listCanvaPictures, exportCanvaPages } from './canvaPictures.js';
import { pickInstrumental } from './stitchVideos.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

// Person stories: the daily routine builds a 6-page Canva design (a famous person's story)
// and puts it in the Canva folder STORY_CANVA_FOLDER_ID. Each cycle this script finds new
// designs there, exports every page as a picture, joins them into ONE vertical 9:16 slideshow
// video (STORY_SECONDS_PER_PAGE each, soft cross-fades) with instrumental music from Joe's
// MIX_CINEMATIC vault folder, and saves it in LOCAL_DROP_FOLDER -- from where localDrop.js
// uploads it to GK_TERMINAL and the normal pipeline posts it everywhere. Each design is
// done once (story-videos.json). Off until STORY_CANVA_FOLDER_ID and LOCAL_DROP_FOLDER are set.

const STATE_PATH = path.join(process.cwd(), 'story-videos.json');
const FADE_SECONDS = 0.6;
const MAX_PER_CYCLE = 2;
const MAX_REMEMBERED = 500;

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { done: Array.isArray(parsed.done) ? parsed.done : [], failed: parsed.failed || {} };
  } catch {
    return { done: [], failed: {} };
  }
}

function saveState(state) {
  state.done = state.done.slice(-MAX_REMEMBERED);
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// "Mohamed Sulayman Tubeec Instagram carousel" -> "Mohamed_Sulayman_Tubeec_story"
export function storyFileName(title, designId) {
  const person = String(title || '')
    .replace(/\b(instagram|facebook|post|carousel|story|design|untitled)\b/gi, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('_');
  return `${person || 'Person'}_story_${String(designId).slice(-6)}.mp4`;
}

async function download(url, dest) {
  const res = await fetchWithTimeout(url, {}, 60 * 1000);
  if (!res.ok) throw new Error(`picture download failed: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// Pure ffmpeg filter for n page pictures: each shown `secs` seconds, cross-faded by `fade`,
// scaled to fit 1080x1440 and centred on a 1080x1920 dark canvas (9:16).
export function slideshowFilter(n, secs, fade) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(`[${i}:v]scale=1080:1440:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0b,setsar=1,fps=30,format=yuv420p[v${i}]`);
  }
  if (n === 1) return { filter: parts.join(';') + ';[v0]null[vout]', total: secs };
  let last = 'v0';
  for (let i = 1; i < n; i++) {
    const offset = (i * (secs - fade)).toFixed(2);
    const out = i === n - 1 ? 'vout' : `x${i}`;
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset}[${out}]`);
    last = out;
  }
  return { filter: parts.join(';'), total: n * secs - (n - 1) * fade };
}

async function buildSlideshow(pagePaths, outPath, music) {
  const secs = config.storySecondsPerPage;
  const { filter, total } = slideshowFilter(pagePaths.length, secs, FADE_SECONDS);
  const args = ['-y'];
  for (const p of pagePaths) args.push('-loop', '1', '-t', secs.toFixed(2), '-i', p);
  if (music) {
    const start = music.duration > total + 20 ? 8 : 0;
    args.push('-ss', String(start), '-i', music.full);
  }
  args.push('-filter_complex', filter, '-map', '[vout]');
  if (music) {
    args.push('-map', `${pagePaths.length}:a`, '-af', `afade=t=in:d=1.2,afade=t=out:st=${Math.max(0, total - 2.5).toFixed(2)}:d=2.5`, '-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-t', total.toFixed(2), '-movflags', '+faststart', outPath);
  await run('ffmpeg', args);
}

export async function storyVideosOnce(auth) {
  if (!config.storyCanvaFolderId || !config.localDropFolder) return;
  const state = loadState();
  const designs = (await listCanvaPictures(config.storyCanvaFolderId)).filter((d) => !state.done.includes(d.id));
  if (designs.length === 0) return;
  const outDir = expandHome(config.localDropFolder);
  fs.mkdirSync(outDir, { recursive: true });
  let made = 0;
  for (const design of designs.reverse()) {
    if (made >= MAX_PER_CYCLE) break;
    if ((state.failed[design.id] || 0) >= 3) continue;
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-story-'));
    try {
      console.log(`Story video: making a slideshow from the Canva design "${design.name}"...`);
      const urls = await exportCanvaPages(design.id);
      if (urls.length < 2) throw new Error(`only ${urls.length} page(s) exported`);
      const pages = [];
      for (let i = 0; i < urls.length; i++) {
        const file = path.join(work, `page${i + 1}.png`);
        await download(urls[i], file);
        pages.push(file);
      }
      const music = await pickInstrumental(auth);
      const name = storyFileName(design.name, design.id);
      const tmpOut = path.join(work, name);
      await buildSlideshow(pages, tmpOut, music);
      fs.copyFileSync(tmpOut, path.join(outDir, name));
      state.done.push(design.id);
      made += 1;
      console.log(`Story video: saved "${name}" (${pages.length} pages${music ? `, music "${music.name}"` : ', no music'}) -- the normal pipeline posts it from here.`);
      if (music) fs.rmSync(music.full, { force: true });
    } catch (err) {
      state.failed[design.id] = (state.failed[design.id] || 0) + 1;
      console.error(`Story video for "${design.name}" failed (try ${state.failed[design.id]} of 3):`, err.message);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
      saveState(state);
    }
  }
}
