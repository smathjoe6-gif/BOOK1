import fs from 'node:fs';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';

// Joe (14 Nov 2026): everything from his KA pile was put in the Drive folder
// GROK_LIBRARY_SORTED/"organised need it" (videos, pictures, songs, documents mixed together).
// This sorts the files lying loose in that folder:
//   videos (Drive's own width/height) -> the library's 9x16 / 16x9 folders (square or unmeasured -> other),
//   pictures -> "Images", songs -> "Audio", everything else -> "Documents and other" (all inside the same folder).
// Nothing is deleted, only moved; files already inside sub-folders are left alone.
// DRY RUN by default (prints the plan, writes organize-folder-report.txt); add --do to move (500 per run).
//   npm run organize-folder                      (finds the folder by name "organised need it")
//   npm run organize-folder -- --folder=<id> --do

const LIBRARY_ROOT_ID = process.env.LIBRARY_ROOT_FOLDER_ID || '15BCZdPZ9084ZmZxkVyaE3A1fwU4zmcDe';
const LIB_9X16 = process.env.LIBRARY_9X16_FOLDER_ID || '1urZQyvzL085W9MXjX24mdRlYCbeaUwIB';
const LIB_16X9 = process.env.LIBRARY_16X9_FOLDER_ID || '1TVCN8wI2SUxc4svA6xq8OcwmedPuEXxY';
const LIB_OTHER = process.env.LIBRARY_OTHER_FOLDER_ID || '1_tBk7T4gT-lWR_3MzZSenC3VYd012CTM';
const MAX_PER_RUN = 500;
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|flac|ogg|aif|aiff)$/i;

// Where one file goes: {key, label}. key is a library id or a sub-folder name to find-or-create.
export function destinationFor(f) {
  const mime = String(f.mimeType || '');
  if (mime === 'application/vnd.google-apps.folder') return null;
  if (mime.startsWith('video/')) {
    const { width, height } = f.videoMediaMetadata || {};
    if (!width || !height || width === height) return { id: LIB_OTHER, label: 'library other' };
    return height > width ? { id: LIB_9X16, label: 'library 9x16' } : { id: LIB_16X9, label: 'library 16x9' };
  }
  if (mime.startsWith('image/')) return { sub: 'Images', label: 'Images' };
  if (mime.startsWith('audio/') || AUDIO_EXT.test(f.name || '')) return { sub: 'Audio', label: 'Audio' };
  return { sub: 'Documents and other', label: 'Documents and other' };
}

async function listDirect(drive, folderId) {
  const out = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, videoMediaMetadata(width, height))',
      pageSize: 1000,
      pageToken,
    });
    out.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return out;
}

async function findFolder(drive, argId) {
  if (argId) return argId;
  const res = await drive.files.list({
    q: `'${LIBRARY_ROOT_ID}' in parents and name contains 'organised' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  const hit = (res.data.files || []).find((f) => /need/i.test(f.name)) || res.data.files?.[0];
  if (!hit) throw new Error('Could not find a folder named like "organised need it" in GROK_LIBRARY_SORTED. Pass --folder=<id>.');
  console.log(`Folder: "${hit.name}" (${hit.id})`);
  return hit.id;
}

async function subFolder(drive, parentId, name) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  });
  if (res.data.files?.[0]) return res.data.files[0].id;
  const made = await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' });
  return made.data.id;
}

async function main() {
  const args = process.argv.slice(2);
  const doIt = args.includes('--do');
  const folderArg = (args.find((a) => a.startsWith('--folder=')) || '').slice(9);
  const drive = google.drive({ version: 'v3', auth: loadOAuthClient() });
  const folderId = await findFolder(drive, folderArg);
  const files = (await listDirect(drive, folderId)).filter((f) => destinationFor(f));
  const counts = {};
  const lines = [];
  for (const f of files) {
    const d = destinationFor(f);
    counts[d.label] = (counts[d.label] || 0) + 1;
    lines.push(`${d.label}\t${f.name}`);
  }
  console.log(`${files.length} loose file(s) to sort${doIt ? '' : ' (DRY RUN, nothing moved)'}:`);
  for (const [label, n] of Object.entries(counts)) console.log(`  ${label}: ${n}`);
  fs.writeFileSync('organize-folder-report.txt', lines.join('\n') + '\n');
  if (!doIt) {
    console.log('Full list in organize-folder-report.txt. Run again with --do to move them.');
    return;
  }
  const subIds = {};
  let moved = 0;
  for (const f of files.slice(0, MAX_PER_RUN)) {
    const d = destinationFor(f);
    try {
      if (d.sub && !subIds[d.sub]) subIds[d.sub] = await subFolder(drive, folderId, d.sub);
      await drive.files.update({ fileId: f.id, addParents: d.id || subIds[d.sub], removeParents: folderId, fields: 'id' });
      moved += 1;
    } catch (err) {
      console.error(`Could not move "${f.name}": ${err.message.slice(0, 100)}`);
    }
  }
  console.log(`Done. Moved ${moved} file(s).${files.length > MAX_PER_RUN ? ` ${files.length - MAX_PER_RUN} more -- run it again.` : ''}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error('Organize folder failed:', err.message);
    process.exit(1);
  });
}
