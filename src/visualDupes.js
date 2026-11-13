// Catches the SAME-LOOKING video under a different file (Joe, 13 Nov 2026: the same clip showed up several
// times on YouTube with different titles). The md5 guard only stops identical BYTES; a re-saved, re-encoded or
// re-cut copy has different bytes. Here three frames of the video (at 15 %, 50 % and 85 %) are shrunk to a
// 9x8 grey picture and turned into a 64-bit "difference hash" each; two videos are the same if all three
// hashes are almost equal (<= VISUAL_DUPE_MAX_DIFF bits). Hashes of posted videos are kept for
// VISUAL_DUPE_DAYS days in visual-hashes.json. VISUAL_DUPE_GUARD=false turns it off. Any failure = not a duplicate.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const STATE_PATH = path.join(process.cwd(), 'visual-hashes.json');
const DAYS = Number(process.env.VISUAL_DUPE_DAYS || 14);
const MAX_DIFF = Number(process.env.VISUAL_DUPE_MAX_DIFF || 6);
const ON = process.env.VISUAL_DUPE_GUARD !== 'false';

function run(cmd, args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}` };
    const p = spawn(cmd, args, { env });
    let out = ''; let err = '';
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (c) => { clearTimeout(t); c === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${c}: ${err.slice(-200)}`)); });
  });
}

async function frameHash(file, seconds) {
  const tmp = path.join(os.tmpdir(), `vh-${process.pid}-${Date.now()}-${Math.round(seconds * 100)}.png`);
  try {
    await run('ffmpeg', ['-y', '-ss', String(seconds), '-i', file, '-frames:v', '1', '-vf', 'scale=64:-2', tmp]);
    const { data } = await sharp(tmp).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
    return bits;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Three hashes (15 %, 50 %, 85 % of the length), or null if the video cannot be read.
export async function visualHashes(file) {
  if (!ON) return null;
  try {
    const dur = Number(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]));
    if (!(dur > 0.5)) return null;
    const out = [];
    for (const f of [0.15, 0.5, 0.85]) out.push(await frameHash(file, Math.max(0, dur * f)));
    return out;
  } catch {
    return null;
  }
}

function diff(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
function load() { try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return []; } }

// The name of a recently posted video that looks the same, or '' if none.
export function findVisualDuplicate(hashes) {
  if (!hashes) return '';
  const cutoff = Date.now() - DAYS * 86400000;
  for (const item of load()) {
    if (item.time < cutoff || !item.hashes || item.hashes.length !== 3) continue;
    if (item.hashes.every((h, i) => diff(h, hashes[i]) <= MAX_DIFF)) return item.name;
  }
  return '';
}

export function rememberVisual(hashes, name) {
  if (!hashes) return;
  const cutoff = Date.now() - DAYS * 86400000;
  const list = load().filter((i) => i.time >= cutoff);
  list.push({ name, hashes, time: Date.now() });
  fs.writeFileSync(STATE_PATH, JSON.stringify(list.slice(-2000)));
}
