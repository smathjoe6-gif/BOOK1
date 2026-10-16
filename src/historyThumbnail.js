import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './config.js';
import { run } from './aspectRatio.js';

// YouTube shows a random blurry frame when a video has no thumbnail. This makes
// a proper 1280x720 one for every history video: a frame from the video (about
// a third of the way in), darkened at the bottom, with the title in big white
// letters, then sets it on the uploaded video. Callers wrap this in try/catch:
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

export async function makeThumbnail(videoPath, title, outPath) {
  const secs = await videoSeconds(videoPath);
  const at = secs > 12 ? Math.min(secs * 0.3, 240) : secs > 0 ? secs * 0.4 : 5;
  const base = 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=saturation=1.25:contrast=1.08';
  const shade = 'drawbox=x=0:y=ih*0.42:w=iw:h=ih*0.58:color=black@0.6:t=fill';
  const lines = wrapTitle(title);
  const textFile = path.join(os.tmpdir(), `gk-thumb-${process.pid}-${Date.now()}.txt`);
  const fontPart = config.stitchFont ? `fontfile='${config.stitchFont.replace(/'/g, '')}':` : '';
  const grab = (vf) => run('ffmpeg', ['-y', '-ss', String(at), '-i', videoPath, '-frames:v', '1', '-vf', vf, '-q:v', '3', outPath]);

  try {
    if (lines.length) {
      fs.writeFileSync(textFile, lines.join('\n'));
      const size = lines.length >= 3 ? 84 : 100;
      const text =
        `drawtext=${fontPart}textfile='${textFile}':fontsize=${size}:fontcolor=white:borderw=6:bordercolor=black:` +
        `line_spacing=10:x=60:y=h-th-60`;
      try {
        await grab(`${base},${shade},${text}`);
        return outPath;
      } catch (err) {
        // Usually this ffmpeg has no text filter or cannot open the font.
        console.log(`History channel: thumbnail with text failed (${String(err.message).slice(-200)}) -- using the plain frame.`);
      }
    }
    await grab(base);
    return outPath;
  } finally {
    fs.rm(textFile, { force: true }, () => {});
  }
}

export async function setThumbnail(auth, videoId, imagePath) {
  const youtube = google.youtube({ version: 'v3', auth });
  await youtube.thumbnails.set(
    { videoId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(imagePath) } },
    { timeout: 2 * 60 * 1000 }
  );
}
