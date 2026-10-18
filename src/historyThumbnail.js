import fs from 'node:fs';
import { google } from 'googleapis';
import { run } from './aspectRatio.js';

// YouTube shows a random blurry frame when a video has no thumbnail. This makes
// a proper 1280x720 one for every history video: the best of several frames from the video (not white, not black, most detail), darkened at the bottom, with the title in big white
// letters (drawn with sharp, not ffmpeg), then sets it on the uploaded video. Callers wrap this in try/catch:
// a thumbnail problem must never undo or repeat the upload.

// Plain characters only (the title goes into an ffmpeg text file, but odd
// symbols can still break the font), split into at most 3 short lines.
export function wrapTitle(title, maxChars = 22, maxLines = 3) {
  const words = String(title || '')
    .replace(/[^\p{L}\p{N}\s'&?!.,-]/gu, ' ')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[.,\s-]+$/, '') + '...';
    return kept;
  }
  return lines;
}

async function videoSeconds(videoPath) {
  try {
    const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath]);
    const s = parseFloat(out.trim());
    return Number.isFinite(s) ? s : 0;
  } catch {
    return 0; // unknown length: use a frame a few seconds in
  }
}

function escapeXml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Draws the title with the "sharp" image library (own text engine, so it does
// not depend on the ffmpeg build having the drawtext filter -- the Homebrew
// ffmpeg on Joe's Mac does not). Fonts come from the system (Arial/Helvetica).
async function addTitle(imagePath, lines, outPath) {
  const { default: sharp } = await import('sharp');
  const W = 1280;
  const H = 720;
  const size = lines.length >= 3 ? 84 : 100;
  const lineH = Math.round(size * 1.15);
  const textH = lineH * lines.length;
  const bandTop = H - textH - 110;
  const tspans = lines
    .map((l, i) => `<text x="60" y="${bandTop + 70 + size + i * lineH - lineH}" class="t">${escapeXml(l)}</text>`)
    .join('');
  const svg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="black" stop-opacity="0"/><stop offset="0.35" stop-color="black" stop-opacity="0.65"/>` +
      `<stop offset="1" stop-color="black" stop-opacity="0.8"/></linearGradient></defs>` +
      `<style>.t{font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:${size}px;fill:#fff;stroke:#000;stroke-width:6px;paint-order:stroke}</style>` +
      `<rect x="0" y="${bandTop - 70}" width="${W}" height="${H - bandTop + 70}" fill="url(#g)"/>` +
      tspans +
      `</svg>`
  );
  await sharp(imagePath).composite([{ input: svg }]).jpeg({ quality: 90 }).toFile(outPath);
}

// Brightness and contrast of a frame: a near-white or near-black or flat frame
// (e.g. a blank NotebookLM slide) makes a useless thumbnail.
async function frameScore(imagePath) {
  try {
    const { default: sharp } = await import('sharp');
    const { channels } = await sharp(imagePath).stats();
    const rgb = channels.slice(0, 3);
    const mean = rgb.reduce((a, c) => a + c.mean, 0) / rgb.length;
    const stdev = rgb.reduce((a, c) => a + c.stdev, 0) / rgb.length;
    const usable = mean >= 30 && mean <= 220 && stdev >= 25;
    return { mean, stdev, usable };
  } catch {
    return { mean: 128, stdev: 0, usable: true };
  }
}

// Takes several frames across the video and keeps the one with the most
// detail that is not washed out (white) or black.
async function pickFrame(videoPath, secs, framePath, base) {
  const fractions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  const times = secs > 12 ? fractions.map((f) => Math.min(secs * f, 600)) : secs > 0 ? fractions.map((f) => secs * f) : [3, 6, 10];
  let best = null;
  for (let i = 0; i < times.length; i++) {
    const tmp = `${framePath}.${i}.jpg`;
    try {
      await run('ffmpeg', ['-y', '-ss', String(times[i]), '-i', videoPath, '-frames:v', '1', '-vf', base, '-q:v', '3', tmp]);
    } catch {
      continue;
    }
    const sc = await frameScore(tmp);
    const rank = (sc.usable ? 1000 : 0) + sc.stdev;
    if (!best || rank > best.rank) {
      if (best) fs.rmSync(best.path, { force: true });
      best = { path: tmp, rank };
    } else {
      fs.rmSync(tmp, { force: true });
    }
  }
  if (!best) throw new Error('could not grab any frame from the video');
  fs.renameSync(best.path, framePath);
}

export async function makeThumbnail(videoPath, title, outPath) {
  const secs = await videoSeconds(videoPath);
  const base = 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=saturation=1.25:contrast=1.08';
  const framePath = `${outPath}.frame.jpg`;
  await pickFrame(videoPath, secs, framePath, base);
  try {
    const lines = wrapTitle(title);
    if (lines.length) {
      try {
        await addTitle(framePath, lines, outPath);
        return outPath;
      } catch (err) {
        console.log(`History channel: thumbnail text failed (${String(err.message).slice(-200)}) -- using the plain frame.`);
      }
    }
    fs.copyFileSync(framePath, outPath);
    return outPath;
  } finally {
    fs.rm(framePath, { force: true }, () => {});
  }
}

export async function setThumbnail(auth, videoId, imagePath) {
  const youtube = google.youtube({ version: 'v3', auth });
  await youtube.thumbnails.set(
    { videoId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(imagePath) } },
    { timeout: 2 * 60 * 1000 }
  );
}
