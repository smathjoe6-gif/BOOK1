import { spawn } from 'node:child_process';

// Beat detection for the stitcher (Joe, 18 Oct 2026: "the beat and the image have to match").
// ffmpeg decodes the song to 11 kHz mono; we measure loudness per ~23 ms hop, find the
// tempo + beat phase by comb-matching the onsets, and the loudest stretch of the song.
// Pure JS (no extra packages). Returns null if the song can't be read or has no clear beat.

const RATE = 11025;
const HOP = 256;
const FPS = RATE / HOP;

function decode(file, maxSeconds) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-t', String(maxSeconds), '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-']);
    const chunks = [];
    let err = '';
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.stderr.on('data', (c) => { err += c; });
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 || chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error(err.slice(-200) || `ffmpeg code ${code}`))));
  });
}

// env: loudness per hop; onset: sharp rises only
export function envelopeFromSamples(samples) {
  const n = Math.floor(samples.length / HOP);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) s += samples[j] * samples[j];
    env[i] = Math.sqrt(s / HOP);
  }
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, Math.sqrt(env[i]) - Math.sqrt(env[i - 1]));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0, c = 0;
    for (let k = Math.max(0, i - 20); k <= Math.min(n - 1, i + 20); k++) { m += onset[k]; c++; }
    out[i] = Math.max(0, onset[i] - m / c);
  }
  return { env, onset: out };
}

export function findBeats(onset) {
  const n = onset.length;
  const usable = Math.min(n, Math.floor(60 * FPS));
  let bestLag = 0, bestScore = -1;
  for (let lag = Math.round((60 / 170) * FPS); lag <= Math.round((60 / 75) * FPS); lag++) {
    let s = 0;
    for (let i = lag; i < usable; i++) s += onset[i] * onset[i - lag];
    s /= usable - lag;
    const bpm = (60 * FPS) / lag;
    if (bpm >= 85 && bpm <= 150) s *= 1.15; // favour the common dance/hip-hop range
    if (s > bestScore) { bestScore = s; bestLag = lag; }
  }
  if (!bestLag) return null;
  let best = { score: -1, period: bestLag, phase: 0 };
  for (let p = bestLag * 0.96; p <= bestLag * 1.04; p += 0.02) {
    for (let phase = 0; phase < p; phase += 1) {
      let s = 0;
      for (let t = phase; t < usable; t += p) s += onset[Math.round(t)] || 0;
      if (s > best.score) best = { score: s, period: p, phase };
    }
  }
  let total = 0;
  for (let i = 0; i < usable; i++) total += onset[i];
  const clarity = total > 0 ? (best.score * best.period) / total : 0; // 1 = no better than chance
  return { period: best.period / FPS, phase: best.phase / FPS, bpm: (60 * FPS) / best.period, clarity };
}

// loudest `seconds` stretch (start time in seconds)
export function loudestStart(env, seconds) {
  const win = Math.round(seconds * FPS);
  if (env.length <= win) return 0;
  let sum = 0;
  for (let i = 0; i < win; i++) sum += env[i];
  let best = sum, bestAt = 0;
  for (let i = win; i < env.length; i++) {
    sum += env[i] - env[i - win];
    if (i % 22 === 0 && sum > best) { best = sum; bestAt = i - win + 1; }
  }
  return bestAt / FPS;
}

export function analyzeSamples(samples, seconds = 30) {
  if (samples.length < RATE * 20) return null;
  const { env, onset } = envelopeFromSamples(samples);
  const beats = findBeats(onset);
  if (!beats || beats.clarity < 1.3) return null;
  const rawStart = loudestStart(env, seconds + 2);
  const k = Math.ceil((rawStart - beats.phase) / beats.period);
  const start = beats.phase + Math.max(0, k) * beats.period;
  return { bpm: beats.bpm, period: beats.period, start, clarity: beats.clarity };
}

export async function analyzeSong(file, seconds = 30) {
  const buf = await decode(file, 240);
  const copy = Buffer.from(buf); // aligned copy for Int16Array
  return analyzeSamples(new Int16Array(copy.buffer, copy.byteOffset, Math.floor(copy.length / 2)), seconds);
}

// Cut length = 2, 4 or 8 beats, the shortest that is at least ~1.8 s (viral pace, not frantic).
export function cutLengthFor(period) {
  for (const b of [2, 4, 8]) if (period * b >= 1.8) return { beats: b, seconds: period * b };
  return { beats: 8, seconds: period * 8 };
}

// Cuts from the clips, round-robin so no clip repeats back to back. Every cut gets a
// frame-exact duration so the cut points stay on the beat over the whole video.
export function planBeatCuts(clips, cutSeconds, targetSeconds, fps = 30) {
  const wanted = Math.max(4, Math.floor(targetSeconds / cutSeconds));
  const segs = [];
  for (let j = 0; segs.length < wanted; j++) {
    let added = false;
    for (const c of clips) {
      if (segs.length >= wanted) break;
      if ((j + 1) * cutSeconds <= c.duration + 0.05) {
        segs.push({ ...c, start: j * cutSeconds });
        added = true;
      }
    }
    if (!added) break;
  }
  if (segs.length < 4) return null;
  return segs.map((s, i) => ({
    ...s,
    used: (Math.round((i + 1) * cutSeconds * fps) - Math.round(i * cutSeconds * fps)) / fps,
  }));
}
