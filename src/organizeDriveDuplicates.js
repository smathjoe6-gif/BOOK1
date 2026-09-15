import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';

// Joe's whole Google Drive has folders duplicated under the same name --
// not just at the top level (multiple copies of GK_Agency_Master_Tracker_2026,
// KA, etc.) but nested inside other folders too (an "EVERYTHING FIX" folder
// from an earlier incomplete consolidation attempt, old video-generation
// working folders, and more). This is a separate, one-off cleanup utility --
// unrelated to the GK Legend posting pipeline itself.
//
// Walks the whole Drive tree starting from the root. At every folder, for
// each name that more than one of its direct child folders share, it keeps
// the most recently modified copy in place and moves every other copy into
// one holding folder (00_DUPLICATES_ARCHIVE, created at the root if
// missing) for Joe to review and delete from by hand later. Then it
// recurses into whichever copy it kept, so duplicates nested many levels
// deep get caught too. Nothing is ever deleted -- every move is a normal
// Drive move and can be dragged back if the wrong copy got archived. Safe
// to run again any time; a second run just finds nothing left to do.
//
// Run with: npm run organize-drive

const ARCHIVE_FOLDER_NAME = '00_DUPLICATES_ARCHIVE';

async function getOrCreateArchiveFolder(drive) {
  const res = await drive.files.list({
    q: `'root' in parents and name = '${ARCHIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  if (res.data.files?.[0]) return res.data.files[0].id;

  const created = await drive.files.create({
    requestBody: { name: ARCHIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
    fields: 'id',
  });
  return created.data.id;
}

async function listChildFolders(drive, parentId) {
  let files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageToken,
      pageSize: 1000,
    });
    files = files.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function moveToArchive(drive, fileId, fromParent, archiveId) {
  await drive.files.update({
    fileId,
    addParents: archiveId,
    removeParents: fromParent,
    fields: 'id',
  });
}

const stats = { foldersScanned: 0, dupedNameGroups: 0, archivedCount: 0 };

// Dedupes one folder's direct children, then recurses into whichever copy
// of each name was kept, so duplicates nested inside those get caught too.
async function processFolder(drive, parentId, archiveId, depth) {
  stats.foldersScanned += 1;
  const children = await listChildFolders(drive, parentId);

  const groups = new Map();
  for (const child of children) {
    if (child.id === archiveId) continue;
    const key = child.name.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(child);
  }

  const kept = [];
  for (const [name, group] of groups) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }

    stats.dupedNameGroups += 1;
    group.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    const [keep, ...rest] = group;
    const indent = '  '.repeat(depth);
    console.log(
      `${indent}"${name}": keeping the most recently modified copy, ` +
        `archiving ${rest.length} other cop${rest.length === 1 ? 'y' : 'ies'}.`
    );

    for (const dupe of rest) {
      await moveToArchive(drive, dupe.id, parentId, archiveId);
      stats.archivedCount += 1;
    }
    kept.push(keep);
  }

  for (const folder of kept) {
    await processFolder(drive, folder.id, archiveId, depth + 1);
  }
}

async function main() {
  const auth = loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const archiveId = await getOrCreateArchiveFolder(drive);

  await processFolder(drive, 'root', archiveId, 0);

  console.log(
    `\nDone. Scanned ${stats.foldersScanned} folder(s) across your whole Drive. ` +
      `${stats.dupedNameGroups} duplicate-name group(s) found. Moved ${stats.archivedCount} ` +
      `duplicate folder(s) into "${ARCHIVE_FOLDER_NAME}" -- nothing was deleted, go through ` +
      `that folder yourself whenever you're ready.`
  );
}

main().catch((err) => {
  console.error('Drive cleanup failed:', err.message);
  process.exit(1);
});
