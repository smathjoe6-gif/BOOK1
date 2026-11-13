// Three JPEG frames (15 %, 50 %, 85 % of the video, 512 px wide) for the frame-based captions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function run(cmd, args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}` };
    const p = spawn(cmd, args, { env });
    let out = ''; let err = '';
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (c) => { clearTimeout(t); c === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${c}: ${err.slice(-150)}`)); });
  });
}

export async function grabFrames(file) {
  const dur = Number(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]));
  if (!(dur > 0.5)) throw new Error('could not read the video length');
  const frames = [];
  for (const f of [0.15, 0.5, 0.85]) {
    const tmp = path.join(os.tmpdir(), `vf-${process.pid}-${Date.now()}-${Math.round(f * 100)}.jpg`);
    try {
      await run('ffmpeg', ['-y', '-ss', String(Math.max(0, dur * f)), '-i', file, '-frames:v', '1', '-vf', 'scale=512:-2', '-q:v', '4', tmp]);
      frames.push(fs.readFileSync(tmp));
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  return frames;
}
