import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { config } from './config.js';
import { classifySongLanguage, RateLimited } from './stitchMatch.js';

// Joe (12 Oct 2026): everything goes into GK_MUSIC_VAULT/Needs Review (npm run organize-music -- --review --do),
// then Gemini LISTENS to each song and files it by language: Somali / English / Mixed (instrumentals go to
// 03_MIX_CINEMATIC; songs Gemini cannot tell stay in Needs Review). Gemini only analyses; it makes nothing.
// Each run listens to at most LISTEN_PER_RUN songs (free-tier quota), remembers every answer in
// music-listen.json (a song is judged once), and never deletes anything. Default is a DRY RUN that
// shows what it WOULD do; --do moves the files.
//
//   npm run listen-music            (listen and show, nothing moves)
//   npm run listen-music -- --do    (listen and file)
//   LISTEN_PER_RUN=200 npm run listen-music -- --do    (more songs in one run; stops by itself when Gemini's quota is used up)

const VAULT_ID = '1jgxpsHcBPqBEED132Z8NyaXdxI7uvL0n';
const FOLDER = 'application/vnd.google-apps.folder';
const LISTEN_PER_RUN = Number(process.env.LISTEN_PER_RUN || 25);
const LISTEN_DELAY_MS = Number(process.env.LISTEN_DELAY_MS || 4000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HEAD_BYTES = 14 * 1024 * 1024; // enough for ~45 s of wav or ~10 min of mp3
const CACHE = path.join(process.cwd(), 'music-listen.json');

async function listAll(drive, q, fields) {
  const found = [];
  let pageToken;
  do {
    const res = await drive.files.list({ q, fields: `nextPageToken, files(${fields})`, pageSize: 1000, pageToken });
    found.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return found;
}

const loadCache = () => {
  try {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {
    return {};
  }
};

async function fetchHead(drive, file, dest) {
  const big = Number(file.size || 0) > HEAD_BYTES * 2 && /\.(wav|mp3)$/i.test(file.name || '');
  const res = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'stream', headers: big ? { Range: `bytes=0-${HEAD_BYTES - 1}` } : {}, timeout: 5 * 60 * 1000 }
  );
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    res.data.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    res.data.pipe(out);
  });
}

async function main() {
  const doIt = process.argv.includes('--do');
  if (!config.geminiApiKey) {
    console.error('GEMINI_API_KEY is not set in .env -- needed so Gemini can listen.');
    process.exit(1);
  }
  const drive = google.drive({ version: 'v3', auth: loadOAuthClient() });
  const subs = await listAll(drive, `'${VAULT_ID}' in parents and mimeType = '${FOLDER}' and trashed = false`, 'id, name');
  const byName = (re) => subs.find((f) => re.test(f.name.trim()));
  const review = byName(/^needs review$/i);
  const targets = {
    SOMALI: byName(/^somali$/i),
    ENGLISH: byName(/^english$/i),
    MIXED: byName(/^mixed$/i),
    INSTRUMENTAL: byName(/^03_/),
  };
  if (!review) {
    console.error('No "Needs Review" folder inside GK_MUSIC_VAULT.');
    process.exit(1);
  }
  const missing = Object.entries(targets).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) console.log(`Note: no vault folder for ${missing.join(', ')} -- those songs will stay in Needs Review.`);

  const songs = await listAll(
    drive,
    `'${review.id}' in parents and mimeType != '${FOLDER}' and trashed = false`,
    'id, name, size, mimeType, parents'
  );
  const cache = loadCache();
  const todo = songs.filter((s) => !cache[s.id]).slice(0, LISTEN_PER_RUN);
  console.log(`Needs Review holds ${songs.length} file(s); listening to ${todo.length} this run (${songs.length - todo.length} already judged or waiting).`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-listen-'));
  let moved = 0;
  const lines = [];
  // Answers remembered from an earlier look-only run: file those songs now (no new listening needed).
  if (doIt) {
    for (const s of songs) {
      const known = cache[s.id];
      const target = known && targets[known.language];
      if (!target) continue;
      try {
        await drive.files.update({ fileId: s.id, addParents: target.id, removeParents: review.id, fields: 'id' });
        moved += 1;
      } catch (err) {
        console.error(`  could not file "${s.name}": ${String(err.message).slice(0, 160)}`);
      }
    }
    if (moved) console.log(`Filed ${moved} song(s) from earlier answers.`);
  }
  try {
    for (const s of todo) {
      const local = path.join(work, `song${path.extname(s.name || '') || '.mp3'}`);
      try {
        await fetchHead(drive, s, local);
        let language;
        try {
          language = await classifySongLanguage(local);
        } catch (err) {
          if (!(err instanceof RateLimited)) throw err;
          console.log('Gemini says too fast -- waiting a minute...');
          await sleep(65000);
          language = await classifySongLanguage(local); // a second refusal stops the run (caught below)
        }
        cache[s.id] = { name: s.name, language };
        fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
        lines.push(`${language.padEnd(12)} "${s.name}"`);
        const target = targets[language];
        if (doIt && target) {
          await drive.files.update({ fileId: s.id, addParents: target.id, removeParents: review.id, fields: 'id' });
          moved += 1;
        }
      } catch (err) {
        if (err instanceof RateLimited) {
          console.log('Gemini quota is used up for now -- run it again later (tomorrow at the latest).');
          break;
        }
        console.error(`  skipped "${s.name}": ${String(err.message).slice(0, 160)}`);
      } finally {
        fs.rmSync(local, { force: true });
      }
      await sleep(LISTEN_DELAY_MS);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  console.log(lines.join('\n'));
  console.log(doIt ? `\nDone. ${moved} song(s) filed.` : '\nThis was only a listen -- nothing moved. To file them: npm run listen-music -- --do');
}

main().catch((err) => {
  console.error('Music listen failed:', err.message);
  process.exit(1);
});
