import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`"${cmd}" is not installed -- run "brew install ffmpeg" on your Mac, then try again.`));
      } else {
        reject(err);
      }
    });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

const TARGET_RATIO = 9 / 16;
const RATIO_TOLERANCE = 0.05;

async function getDimensions(filePath) {
  const output = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0',
    filePath,
  ]);
  const [width, height] = output.trim().split('x').map(Number);
  return { width, height };
}

// YouTube Shorts, TikTok, and Instagram Reels all expect vertical 9:16 video.
// This script's own auto-generate call already requests 9:16 from Grok, but
// Grok Imagine's web app defaults to horizontal 16:9 -- so anything Joe drops
// in from there needs squaring up before it ever gets uploaded, rather than
// posting an oddly letterboxed/pillarboxed video. Center-crops (not letterbox
// padding) so the result looks like a native vertical shot, then rescales to
// a standard 1080x1920. Already-vertical video is left untouched.
export async function ensureVerticalVideo(inputPath) {
  const { width, height } = await getDimensions(inputPath);
  const ratio = width / height;
  if (Math.abs(ratio - TARGET_RATIO) <= RATIO_TOLERANCE) {
    return inputPath;
  }

  const outputPath = path.join(os.tmpdir(), `gk-vertical-${Date.now()}${path.extname(inputPath) || '.mp4'}`);
  await run('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vf', "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920",
    '-c:a', 'copy',
    outputPath,
  ]);

  fs.unlink(inputPath, () => {});
  console.log(`Converted "${path.basename(inputPath)}" from ${width}x${height} to vertical 9:16 before posting.`);
  return outputPath;
}
