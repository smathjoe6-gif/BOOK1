import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { config } from './config.js';

// Central place to SEE the social queue (Joe, 11 Nov 2026: "we need management central").
// Writes/updates one plain-text file `GK_Social_Queue.txt` in My Drive: the gap, when the last
// video went to the Buffer networks, when the next is due, and every video still waiting.
// Read-only view: changing the order or deleting happens with `npm run buffer-queue`.
const NAME = 'GK_Social_Queue.txt';
const STATE = path.join(process.cwd(), 'social-queue-status.json');
let lastText = '';

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function buildStatusText() {
  const gap = config.bufferVideoGapMinutes;
  const waiting = readJson(path.join(process.cwd(), 'buffer-deferred.json'), []);
  const last = readJson(path.join(process.cwd(), 'buffer-last-video.json'), { at: 0 }).at || 0;
  const tt = readJson(path.join(process.cwd(), 'tiktok-queue.json'), { queue: [], sent: [] });
  const fmt = (ms) => (ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'never');
  const lines = [
    'GK SOCIAL QUEUE (Instagram, Facebook, Pinterest, X via Buffer)',
    `Updated: ${fmt(Date.now())}`,
    `Rule: ONE video, then ${gap || 'no'} minutes, then the next one. YouTube is not slowed down.`,
    `Last video sent: ${fmt(last)}`,
    `Next video due: ${gap && last ? fmt(last + gap * 60000) : 'as soon as one is waiting'}`,
    `Waiting: ${waiting.length}`,
    ...waiting.map((d, i) => `  ${i + 1}. ${d.name}  (waiting since ${fmt(d.deferredAt)})`),
    '',
    'Recently finished (what came back from Buffer):',
    ...(readJson(path.join(process.cwd(), 'social-queue-history.json'), []).slice(0, 10).map((h) =>
      `  ${fmt(h.at)}  ${h.name}  ->  ${Object.entries(h.results || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'nothing sent'}`)),
    '',
    `TikTok queue: ${(tt.queue || []).length} waiting, daily limit ${config.tiktokDailyLimit || 'n/a'}`,
    '',
    config.copyrightFooter || '© 2026 GK Legend Studio. All rights reserved.\nhttps://www.youtube.com/@PathFoundGK',
  ];
  return lines.join('\n');
}

export async function updateSocialQueueStatus(auth) {
  const text = buildStatusText().replace(/^Updated: .*$/m, '');
  if (text === lastText) return;
  lastText = text;
  const drive = google.drive({ version: 'v3', auth });
  const body = buildStatusText();
  const media = { mimeType: 'text/plain', body: Readable.from([body]) };
  const saved = readJson(STATE, {});
  if (saved.fileId) {
    try {
      await drive.files.update({ fileId: saved.fileId, media }, { timeout: 30000 });
      return;
    } catch { /* recreated below */ }
  }
  const res = await drive.files.create({ requestBody: { name: NAME }, media: { mimeType: 'text/plain', body: Readable.from([body]) }, fields: 'id' }, { timeout: 30000 });
  fs.writeFileSync(STATE, JSON.stringify({ fileId: res.data.id }));
}
