import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';

// Joe (12 Oct 2026): "hunt all my music and put it in GK_MUSIC_VAULT, it already has the subfolders".
// Finds every AUDIO file you own anywhere in Drive (outside the vault), and files it into the
// vault's genre subfolders: by the Gemini label in stitch-song-tags.json when the Mac has one,
// else by words in the file name (somali / hip hop / cinematic / slow ...), else into
// 09_UNSORTED_MUSIC (created if missing) so nothing is lost. Exact doubles (same md5) go to the Bin,
// the oldest copy stays. Default = DRY RUN (summary + music-vault-report.txt with where every
// song is NOW); --do applies, at most 500 per run. Songs in EVERY-DESKTOP-DOWNLOADS (the stacker's
// current music folder) are only moved with --include-downloads; afterwards set
// STITCH_MUSIC_DRIVE_FOLDER_ID to the vault id so the stacker still finds them.
//
//   npm run organize-music                      (look only)
//   npm run organize-music -- --do              (do it)
//   npm run organize-music -- --do --include-downloads

const VAULT_ID = '1jgxpsHcBPqBEED132Z8NyaXdxI7uvL0n';
const DOWNLOADS_ID = '1CxC7BK5neABEU5qKD4ljT9eOAcqp0efl';
const FOLDER = 'application/vnd.google-apps.folder';
const AUDIO_EXT = /\.(mp3|wav|m4a|flac|aac|ogg|wma|aiff?)$/i;
const MAX_PER_RUN = 500;
const MIN_BYTES = 500 * 1024;

const NAME_RULES = [
  [/somali|kaban|gabay|geeraar|buraanbur|xamar|qaraami|dhaanto|hees|heello|soomaali/i, '01'],
  [/hip.?hop|\brap\b|trap|drill|beat|freestyle/i, '02'],
  [/cinematic|score|epic|orchestra|trailer|soundtrack/i, '03'],
  [/slow|ballad|sad|lofi|lo-fi|calm|piano|emotional/i, '08'],
];
const LABEL_TO_PREFIX = { SOMALI_HERITAGE: '01', SOMALI_WOMEN: '01', HIPHOP_URBAN: '02', STORY_CINEMATIC: '03', SLOW_EMOTIONAL: '08' };

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

function loadSongTags() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'stitch-song-tags.json'), 'utf8'));
  } catch {
    return {};
  }
}

export function prefixFor(file, tags) {
  const t = tags[file.id];
  const label = typeof t === 'string' ? t : t && t.label;
  if (label && LABEL_TO_PREFIX[label]) return LABEL_TO_PREFIX[label];
  for (const [re, p] of NAME_RULES) if (re.test(file.name || '')) return p;
  return null;
}

// Pure planning step: songs = audio files outside the vault; returns { move: [{file,prefix}], bin: [file] }.
export function planMusic(songs, tags) {
  const byHash = new Map();
  const bin = [];
  const keep = [];
  const sorted = [...songs].sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')));
  for (const s of sorted) {
    if (s.md5Checksum) {
      if (byHash.has(s.md5Checksum)) {
        bin.push(s);
        continue;
      }
      byHash.set(s.md5Checksum, s);
    }
    keep.push(s);
  }
  return { move: keep.map((file) => ({ file, prefix: prefixFor(file, tags) })), bin };
}

async function main() {
  const doIt = process.argv.includes('--do');
  const includeDownloads = process.argv.includes('--include-downloads');
  const drive = google.drive({ version: 'v3', auth: loadOAuthClient() });

  console.log('Reading the vault and hunting audio files (this can take several minutes)...');
  const vaultSubs = (await listAll(drive, `'${VAULT_ID}' in parents and mimeType = '${FOLDER}' and trashed = false`, 'id, name')).filter(
    (f) => !/^09_UNSORTED/i.test(f.name)
  );
  const subByPrefix = {};
  for (const f of vaultSubs) {
    const m = f.name.match(/^(\d\d)_/);
    if (m) subByPrefix[m[1]] = f;
  }

  // Every folder id inside the vault (so songs already there are not touched).
  const inVault = new Set([VAULT_ID]);
  let frontier = [VAULT_ID];
  for (let depth = 0; depth < 4 && frontier.length; depth += 1) {
    const next = [];
    for (const id of frontier) {
      for (const f of await listAll(drive, `'${id}' in parents and mimeType = '${FOLDER}' and trashed = false`, 'id')) {
        inVault.add(f.id);
        next.push(f.id);
      }
    }
    frontier = next;
  }

  const all = await listAll(
    drive,
    `(mimeType contains 'audio/' or name contains '.mp3' or name contains '.wav' or name contains '.m4a' or name contains '.flac') and 'me' in owners and trashed = false`,
    'id, name, mimeType, size, createdTime, md5Checksum, parents'
  );
  const songs = all.filter(
    (f) =>
      f.mimeType !== FOLDER &&
      (String(f.mimeType || '').startsWith('audio/') || AUDIO_EXT.test(f.name || '')) &&
      Number(f.size || 0) >= MIN_BYTES &&
      !(f.parents || []).some((p) => inVault.has(p)) &&
      (includeDownloads || !(f.parents || []).includes(DOWNLOADS_ID))
  );

  const plan = planMusic(songs, loadSongTags());
  const counts = {};
  for (const m of plan.move) counts[m.prefix || 'unsorted'] = (counts[m.prefix || 'unsorted'] || 0) + 1;
  const lines = [
    `Audio files found outside the vault: ${songs.length}${includeDownloads ? '' : ' (EVERY-DESKTOP-DOWNLOADS left alone; add --include-downloads to move those too)'}`,
    `Exact doubles that would go to the Bin: ${plan.bin.length}`,
    `Would be filed: ${JSON.stringify(counts)}  (unsorted -> 09_UNSORTED_MUSIC)`,
    '',
    ...plan.move.map((m) => `${m.prefix || 'unsorted'}  "${m.file.name}"  (${Math.round(Number(m.file.size || 0) / 1e6)} MB)`),
    ...plan.bin.map((f) => `bin  "${f.name}"`),
  ];
  fs.writeFileSync('music-vault-report.txt', lines.join('\n') + '\n');
  console.log(lines.slice(0, 3).join('\n'));
  console.log('The full list is in music-vault-report.txt');
  if (!doIt) {
    console.log('\nThis was only a look -- nothing was changed. To do it for real: npm run organize-music -- --do');
    return;
  }

  let unsortedId = null;
  let actions = 0;
  for (const f of plan.bin) {
    if (actions >= MAX_PER_RUN) break;
    await drive.files.update({ fileId: f.id, requestBody: { trashed: true }, fields: 'id' });
    actions += 1;
  }
  for (const { file, prefix } of plan.move) {
    if (actions >= MAX_PER_RUN) break;
    let target = prefix && subByPrefix[prefix] && subByPrefix[prefix].id;
    if (!target) {
      if (!unsortedId) {
        const ex = (await listAll(drive, `'${VAULT_ID}' in parents and name = '09_UNSORTED_MUSIC' and mimeType = '${FOLDER}' and trashed = false`, 'id'))[0];
        unsortedId = ex
          ? ex.id
          : (await drive.files.create({ requestBody: { name: '09_UNSORTED_MUSIC', mimeType: FOLDER, parents: [VAULT_ID] }, fields: 'id' })).data.id;
      }
      target = unsortedId;
    }
    try {
      await drive.files.update({ fileId: file.id, addParents: target, removeParents: (file.parents || []).join(','), fields: 'id' });
      actions += 1;
    } catch (err) {
      console.error(`  could not move "${file.name}": ${String(err.message).slice(0, 200)}`);
    }
  }
  const left = plan.move.length + plan.bin.length - actions;
  console.log(`\nDone. ${actions} file(s) handled${left > 0 ? `, ${left} more -- run it again` : ''}. Binned doubles can be restored from Drive's Bin for 30 days.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error('Music vault failed:', err.message);
    process.exit(1);
  });
}
