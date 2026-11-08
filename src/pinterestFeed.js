import { google } from 'googleapis';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { config } from './config.js';

// Pinterest product feed, kept up to date by the Mac script (Joe, 8 Nov 2026: 'you should be making and
// connecting from the pipe and automatically updating the data').
//
// Joe's sheet "GK Pinterest Product Feed" (Sheet1: id,title,description,link,image_link,price,availability,
// condition,brand) is read every PINTEREST_FEED_EVERY_MINUTES (default 60). The rows are turned into a clean
// CSV file "GK_Pinterest_Feed.csv" in My Drive (public link, NOT inside a watched folder) and the SAME
// Drive file is updated in place, so its link never changes. Pinterest (Catalogs -> Data sources ->
// Add data source -> from URL) reads that link by itself every day, so a changed price/title/link in the
// sheet reaches the catalog without anyone touching it. Only Sheet1 is used (the Templates tab holds
// drafts that are not live). Rows missing id/title/link/image_link/price are left out and listed in the log.
// The one thing that cannot be automated from here: pasting the link ONCE into Pinterest's Data sources
// (Pinterest's catalog API needs approved access this app does not have). The link is written to the log
// ('Pinterest feed: ... link ...') and to pinterest-feed.json.

const STATE_PATH = path.join(process.cwd(), 'pinterest-feed.json');
const FILE_NAME = 'GK_Pinterest_Feed.csv';
const COLUMNS = ['id', 'title', 'description', 'link', 'image_link', 'price', 'availability', 'condition', 'brand'];
const REQUIRED = ['id', 'title', 'link', 'image_link', 'price'];
const API_TIMEOUT_MS = 30000;
let running = false;

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}
const saveState = (s) => fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));

const csvCell = (v) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Pure function (tested without Google): sheet values (first row = header) -> { csv, kept, skipped }.
export function buildFeedCsv(values) {
  const [header = [], ...rows] = values || [];
  const idx = Object.fromEntries(COLUMNS.map((c) => [c, header.map((h) => String(h).trim().toLowerCase()).indexOf(c)]));
  const kept = [];
  const skipped = [];
  for (const row of rows) {
    if (!row || row.every((c) => !String(c || '').trim())) continue;
    const item = Object.fromEntries(COLUMNS.map((c) => [c, idx[c] >= 0 ? String(row[idx[c]] ?? '').trim() : '']));
    const missing = REQUIRED.filter((c) => !item[c]);
    if (!/^https?:\/\//i.test(item.link) && item.link) missing.push('link (not a web address)');
    if (item.price && !/^\d+([.,]\d+)?\s?[A-Za-z]{3}$/.test(item.price)) missing.push('price (use 59.00 GBP)');
    if (missing.length) { skipped.push(`${item.id || item.title || '(row)'}: ${missing.join(', ')}`); continue; }
    if (!item.availability) item.availability = 'in stock';
    if (!item.condition) item.condition = 'new';
    if (!item.brand) item.brand = 'GK Legend Studio';
    kept.push(item);
  }
  const lines = [COLUMNS.join(','), ...kept.map((it) => COLUMNS.map((c) => csvCell(it[c])).join(','))];
  return { csv: `${lines.join('\n')}\n`, kept, skipped };
}

async function findFeedFile(drive) {
  const res = await drive.files.list(
    { q: `name = '${FILE_NAME}' and trashed = false and 'me' in owners`, fields: 'files(id)', pageSize: 5 },
    { timeout: API_TIMEOUT_MS }
  );
  return res.data.files?.[0]?.id || '';
}

export async function pinterestFeedOnce(auth, { force = false } = {}) {
  const sheetId = config.pinterestFeedSheetId;
  if (!sheetId || running) return null;
  const state = loadState();
  const everyMs = config.pinterestFeedEveryMinutes * 60 * 1000;
  if (!force && state.lastRun && Date.now() - state.lastRun < everyMs) return null;
  running = true;
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get(
      { spreadsheetId: sheetId, range: 'Sheet1!A1:I' },
      { timeout: API_TIMEOUT_MS }
    );
    const { csv, kept, skipped } = buildFeedCsv(res.data.values || []);
    state.lastRun = Date.now();
    if (!kept.length) {
      saveState(state);
      console.log(`Pinterest feed: no complete product rows in the sheet (left out: ${skipped.join(' | ') || 'none'}); feed file not changed.`);
      return null;
    }
    const hash = crypto.createHash('md5').update(csv).digest('hex');
    const drive = google.drive({ version: 'v3', auth });
    let fileId = state.fileId && (await drive.files.get({ fileId: state.fileId, fields: 'id,trashed' }, { timeout: API_TIMEOUT_MS }).then((r) => (r.data.trashed ? '' : r.data.id)).catch(() => ''));
    if (!fileId) fileId = await findFeedFile(drive);
    const media = { mimeType: 'text/csv', body: Readable.from([csv]) };
    if (!fileId) {
      const created = await drive.files.create(
        { requestBody: { name: FILE_NAME, mimeType: 'text/csv' }, media, fields: 'id' },
        { timeout: 60000 }
      );
      fileId = created.data.id;
      await drive.permissions.create(
        { fileId, requestBody: { role: 'reader', type: 'anyone' } },
        { timeout: API_TIMEOUT_MS }
      );
    } else if (hash !== state.hash) {
      await drive.files.update({ fileId, media }, { timeout: 60000 });
    }
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const changed = hash !== state.hash;
    saveState({ ...state, fileId, url, hash, products: kept.length });
    console.log(`Pinterest feed: ${changed ? 'updated' : 'unchanged'} -- ${kept.length} product(s)${skipped.length ? `, left out: ${skipped.join(' | ')}` : ''}. Pinterest link (paste once in Catalogs > Data sources): ${url}`);
    return { url, products: kept.length, skipped };
  } finally {
    running = false;
  }
}

// Local run: npm run pinterest-feed   (writes/updates the Drive file now and prints the link)
if (process.argv[1] && process.argv[1].endsWith('pinterestFeed.js')) {
  const { loadOAuthClient } = await import('./googleAuth.js');
  pinterestFeedOnce(loadOAuthClient(), { force: true })
    .then((r) => console.log(r ? 'Done.' : 'Nothing written.'))
    .catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}
