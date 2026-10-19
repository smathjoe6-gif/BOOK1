import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { config } from './config.js';
import { PROTECTED_IDS, isProtected } from './driveTidy.js';

// Joe (11 Oct 2026): "any video or any image that is a double: put it in the Bin".
// Looks at every VIDEO and IMAGE you own anywhere in Drive. Two files are doubles only when
// Drive's md5 checksum is identical (the same bytes), never because the names look alike.
// In a group of identical files:
//   - if some copies sit inside the posting pipeline (02_Brand_Assets, GK_JING, GK_TERMINAL, the
//     DONE / stock / music / history / picture folders ...), ALL of those stay (GK_JING and
//     GK_TERMINAL intentionally hold mirrored copies) and the copies outside the pipeline are Binned;
//   - otherwise the OLDEST copy stays and the rest are Binned.
// Default is a DRY RUN: prints a summary and writes drive-dedupe-report.txt. --do applies.
// Binned files stay recoverable in Drive's Bin for 30 days.
//
//   npm run dedupe-drive            (look only)
//   npm run dedupe-drive -- --do    (do it; at most 2000 files per run, run again for more)

const FOLDER = 'application/vnd.google-apps.folder';
const MAX_PER_RUN = 2000;

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

export function pipelineRootIds() {
  const ids = new Set(PROTECTED_IDS);
  for (const id of [
    '1uvG_EqrwnSxHlFZBllm1WeY59_C0yZWV', // GK_JING
    '1UTaWnZTjRFuhQlbplSPdUKD0jiSdCxDh', // GK_TERMINAL
    config.driveFolderId,
    config.doneFolderId,
    config.mirrorFolderId,
    config.mirrorDoneFolderId,
    config.historyFolderId,
    config.pictureFolderId,
    config.stitchDriveFolderId,
    config.stitchMusicDriveFolderId,
  ]) {
    if (id) ids.add(id);
  }
  return ids;
}

// All folder ids inside the pipeline: the roots above, any root-level folder with a pipeline name
// (02_Brand_Assets ...), and everything below them.
export async function protectedTree(drive, extraRoots = []) {
  const tree = new Set([...pipelineRootIds(), ...extraRoots]);
  const topFolders = await listAll(drive, `'root' in parents and mimeType = '${FOLDER}' and trashed = false`, 'id, name');
  for (const f of topFolders) {
    if (isProtected(f) || /^02_Brand_Assets$/i.test(String(f.name).trim())) tree.add(f.id);
  }
  const queue = [...tree];
  while (queue.length) {
    const id = queue.shift();
    const subs = await listAll(drive, `'${id}' in parents and mimeType = '${FOLDER}' and trashed = false`, 'id');
    for (const s of subs) {
      if (!tree.has(s.id)) {
        tree.add(s.id);
        queue.push(s.id);
      }
    }
  }
  return tree;
}

// Pure planning step (tested with fake data).
export function planDedupe(files, tree) {
  const byHash = new Map();
  for (const f of files) {
    if (!f.md5Checksum || !Number(f.size)) continue;
    if (!byHash.has(f.md5Checksum)) byHash.set(f.md5Checksum, []);
    byHash.get(f.md5Checksum).push(f);
  }
  const bin = [];
  let groups = 0;
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    const inPipe = group.filter((f) => (f.parents || []).some((p) => tree.has(p)));
    const outside = group.filter((f) => !inPipe.includes(f));
    let extras;
    if (inPipe.length > 0) extras = outside;
    else {
      const sorted = [...group].sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')) || a.id.localeCompare(b.id));
      extras = sorted.slice(1);
    }
    if (extras.length === 0) continue;
    groups += 1;
    bin.push(...extras);
  }
  return { bin, groups };
}

async function main() {
  const doIt = process.argv.includes('--do');
  const drive = google.drive({ version: 'v3', auth: loadOAuthClient() });
  console.log('Reading your Drive (this can take several minutes)...');
  const tree = await protectedTree(drive);
  const files = await listAll(
    drive,
    "'me' in owners and trashed = false and (mimeType contains 'video/' or mimeType contains 'image/')",
    'id, name, size, md5Checksum, parents, createdTime'
  );
  const plan = planDedupe(files, tree);
  const bytes = plan.bin.reduce((n, f) => n + Number(f.size || 0), 0);
  const gb = (bytes / 1024 ** 3).toFixed(1);
  const lines = [
    `Videos and images checked: ${files.length}`,
    `Groups of identical files: ${plan.groups}`,
    `Extra copies that would go to the Bin: ${plan.bin.length} (about ${gb} GB)`,
    '',
    ...plan.bin.map((f) => `  bin  ${f.name}  (${(Number(f.size) / 1024 ** 2).toFixed(1)} MB)`),
  ];
  (await import('node:fs')).writeFileSync('drive-dedupe-report.txt', lines.join('\n') + '\n');
  console.log(lines.slice(0, 3).join('\n'));
  console.log('The full list is in drive-dedupe-report.txt');
  if (!doIt) {
    console.log('\nThis was only a look -- nothing was changed. To do it for real: npm run dedupe-drive -- --do');
    return;
  }
  let binned = 0;
  for (const f of plan.bin.slice(0, MAX_PER_RUN)) {
    try {
      await drive.files.update({ fileId: f.id, requestBody: { trashed: true }, fields: 'id' });
      binned += 1;
    } catch (err) {
      console.error(`could not Bin "${f.name}":`, err.message);
    }
  }
  console.log(`\nDone. ${binned} file(s) went to the Bin (restore from Drive's Bin within 30 days).` + (plan.bin.length > MAX_PER_RUN ? ` ${plan.bin.length - binned} more -- run it again.` : ''));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error('Drive dedupe failed:', err.message);
    process.exit(1);
  });
}
