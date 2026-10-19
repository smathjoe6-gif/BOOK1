import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';

// Joe (11 Oct 2026): "all the empty ones deleted, folders that have something
// but are doubles made into ONE folder, empty ones to the Bin, the rest organized".
// Works on the folders directly in My Drive and directly inside
// 00_DUPLICATES_ARCHIVE (made by `npm run organize-drive`):
//   1) a folder with NO files anywhere inside it (only empty subfolders) goes to the Bin;
//   2) folders that share a name (ignoring case/spaces) are merged: everything inside the
//      others is moved into one of them (the protected one, else the oldest) and the
//      emptied copies go to the Bin.
// Folders the posting pipeline uses (GK_JING, GK_TERMINAL, the done folders, the stock
// and music folders, history / notebook / picture folders ...) are PROTECTED: never
// binned (even when empty) and never emptied into another folder.
//
// Default is a DRY RUN that only prints and saves a report. Run for real with --do.
// Everything binned stays recoverable in the Drive Bin for 30 days.
//
//   npm run tidy-drive            (look only)
//   npm run tidy-drive -- --do    (do it)

const ARCHIVE_NAME = '00_DUPLICATES_ARCHIVE';
const FOLDER = 'application/vnd.google-apps.folder';
const MAX_DEPTH = 8;

// Pipeline folders (ids from the status board) + name patterns for the same ones.
export const PROTECTED_IDS = new Set([
  '1WkRGbfFWwaxSdtLYjhDHRyRrW9VAF12Z', // GK_STOCK_VIDEOS
  '1CxC7BK5neABEU5qKD4ljT9eOAcqp0efl', // EVERY-DESKTOP-DOWNLOADS (songs)
  '1jgxpsHcBPqBEED132Z8NyaXdxI7uvL0n', // GK_MUSIC_VAULT
  '1GLeqzy5IpYbpQtN-xll-LcH-AE3_LK8Q', // GK_Viral_Prompts
  '1YIcfycSNpjFuK0_MkERQhNXwJ00gixh1', // NOTEBOOKLM_SOURCES
  '1dSP5luIoeK0pjkfqu9Zo-UagSaF9Ow4F', // TOTOLL_HISTORY
  '1N0BcIlLZ7N1bpVDRlBj3oc623QRL_VzF', // TOTOLL_HISTORY_DONE
  '1XhNoc2JlGN6pklGvnhWd7G-pbWJecm-i', // GK_TERMINAL_DONE
  '1KUwQJPB4FMaQPRVm1KdF6pb44lw4nbG5', // GK_JING_DONE
  '1_2dyzrmG9wr_F67mKUHLIPOMczP2XgRl', // GK_Pinterest_Covers
  '1N1R_YisFKON7kEE-jTiVc1OIaQHQU-Nz', // GK_POSTS_PICTURES
  '14UWenEm7EeOrhi_YeADKiZhQYD3iNgGi', // Skiller
  '1CUN7F1P8Vp1zwnEnAfBjchIlz_eFz5hW', // Family_Education
  '1_e-3dGFVjdUukjJViLj-YBfWCo3IGzJE', // Money
  '19Fh6Y4gDXxr7XowyLrtOovW7UU5BovMD', // "diin2 dowwnloads gk" (downloads from Joe's other Google login)
  '1_9noLV6Zt5OLXys4l-WjffqDWqhRYnlD', // Lekker_Globally_Dropshipping
  '1CTyuAHVh_SRJhF6NO72zPLh9EfPmujtZ', // 05_Business_Flow
]);
const PROTECTED_NAME = /^(GK_?JING|GK_?TERMINAL|GK_STOCK|GK_MUSIC|GK_VERTICAL|GK_POSTS|GK_Viral|GK_Pinterest|TOTOLL|NOTEBOOKLM|EVERY-DESKTOP|00_DUPLICATES)/i;

export function isProtected(folder, extraIds = []) {
  return PROTECTED_IDS.has(folder.id) || extraIds.includes(folder.id) || PROTECTED_NAME.test(String(folder.name || '').trim());
}

async function listChildren(drive, parentId) {
  const found = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
      pageSize: 1000,
      pageToken,
    });
    found.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return found;
}

// Does this folder hold at least one real file (not just empty folders) anywhere inside?
async function hasFiles(drive, folderId, depth = 0, memo = new Map()) {
  if (memo.has(folderId)) return memo.get(folderId);
  let result = false;
  const children = await listChildren(drive, folderId);
  for (const c of children) {
    if (c.mimeType !== FOLDER) {
      result = true;
      break;
    }
  }
  if (!result && depth < MAX_DEPTH) {
    for (const c of children) {
      if (await hasFiles(drive, c.id, depth + 1, memo)) {
        result = true;
        break;
      }
    }
  } else if (!result && children.length > 0) {
    result = true; // too deep to be sure: treat as not empty
  }
  memo.set(folderId, result);
  return result;
}

const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Pure planning step (tested against a fake Drive): returns what would be done to one set of sibling folders.
export async function planGroup(drive, parentId, label, skipIds = [], extraProtected = []) {
  const folders = (await listChildren(drive, parentId)).filter((c) => c.mimeType === FOLDER && !skipIds.includes(c.id));
  const memo = new Map();
  const plan = { label, bin: [], merge: [], keep: [], skipped: [] };
  const alive = [];
  for (const f of folders) {
    const prot = isProtected(f, extraProtected);
    const filled = await hasFiles(drive, f.id, 0, memo);
    if (!filled && !prot) plan.bin.push(f);
    else alive.push({ ...f, prot });
  }
  const groups = new Map();
  for (const f of alive) {
    const k = nameKey(f.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  for (const group of groups.values()) {
    if (group.length < 2) {
      plan.keep.push(group[0]);
      continue;
    }
    const protectedOnes = group.filter((g) => g.prot);
    if (protectedOnes.length > 1) {
      plan.skipped.push({ name: group[0].name, why: 'two pipeline folders share this name -- left alone' });
      plan.keep.push(...group);
      continue;
    }
    const target =
      protectedOnes[0] ||
      [...group].sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')))[0];
    plan.keep.push(target);
    for (const other of group) {
      if (other.id === target.id) continue;
      if (other.prot) {
        plan.skipped.push({ name: other.name, why: 'pipeline folder, not merged' });
        continue;
      }
      plan.merge.push({ from: other, into: target });
    }
  }
  return plan;
}

async function trash(drive, id) {
  await drive.files.update({ fileId: id, requestBody: { trashed: true }, fields: 'id' });
}

export async function applyPlan(drive, plan, log = console.log) {
  let binned = 0;
  let moved = 0;
  for (const f of plan.bin) {
    await trash(drive, f.id);
    binned += 1;
  }
  for (const { from, into } of plan.merge) {
    const children = await listChildren(drive, from.id);
    for (const child of children) {
      await drive.files.update({ fileId: child.id, addParents: into.id, removeParents: from.id, fields: 'id' });
      moved += 1;
    }
    await trash(drive, from.id);
    binned += 1;
    log(`  merged "${from.name}" into "${into.name}" (${children.length} item(s) moved).`);
  }
  return { binned, moved };
}

export function describePlan(plan) {
  const lines = [`== ${plan.label} ==`];
  lines.push(`Empty folders to the Bin: ${plan.bin.length}`);
  for (const f of plan.bin) lines.push(`  bin    "${f.name}"`);
  lines.push(`Doubles to merge into one: ${plan.merge.length}`);
  for (const m of plan.merge) lines.push(`  merge  "${m.from.name}" -> "${m.into.name}" (the oldest / protected copy stays)`);
  for (const s of plan.skipped) lines.push(`  left   "${s.name}": ${s.why}`);
  lines.push(`Folders staying as they are: ${plan.keep.length}`);
  return lines.join('\n');
}

async function main() {
  const doIt = process.argv.includes('--do');
  const auth = loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const archive = (
    await drive.files.list({
      q: `'root' in parents and name = '${ARCHIVE_NAME}' and mimeType = '${FOLDER}' and trashed = false`,
      fields: 'files(id)',
    })
  ).data.files?.[0];

  const plans = [await planGroup(drive, 'root', 'My Drive (top level)', archive ? [archive.id] : [])];
  if (archive) plans.push(await planGroup(drive, archive.id, ARCHIVE_NAME));

  const report = plans.map(describePlan).join('\n\n');
  console.log(report);
  const fs = await import('node:fs');
  fs.writeFileSync('drive-tidy-report.txt', report + '\n');

  if (!doIt) {
    console.log('\nThis was only a look -- nothing was changed. To do it for real: npm run tidy-drive -- --do');
    return;
  }
  let binned = 0;
  let moved = 0;
  for (const plan of plans) {
    const r = await applyPlan(drive, plan);
    binned += r.binned;
    moved += r.moved;
  }
  console.log(`\nDone. ${binned} folder(s) went to the Bin (restore from Drive's Bin within 30 days), ${moved} item(s) moved into the kept folders.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error('Drive tidy failed:', err.message);
    process.exit(1);
  });
}
