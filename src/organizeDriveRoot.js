import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';

// Joe's whole Google Drive root has dozens of top-level folders that exist
// more than once under the exact same name (duplicated over time, plus a
// stray "EVERYTHING FIX" folder that was an earlier, incomplete attempt at
// consolidating everything into one place). This is a separate, one-off
// cleanup utility -- unrelated to the GK Legend Studio posting pipeline
// itself -- that tidies the top level of Drive without deleting anything:
// for every folder name that appears more than once at the root, it keeps
// the most recently modified copy where it is and moves every other copy
// into one holding folder (00_DUPLICATES_ARCHIVE) so Joe can go through
// them by hand afterward and decide what to actually delete. Nothing is
// ever deleted by this script -- every move is a normal Drive move and can
// be dragged back if the wrong copy got kept.
//
// Run with: npm run organize-drive-root

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

async function listRootFolders(drive) {
  let files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: "'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageToken,
      pageSize: 1000,
    });
    files = files.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function moveFolder(drive, fileId, toParent) {
  await drive.files.update({
    fileId,
    addParents: toParent,
    removeParents: 'root',
    fields: 'id',
  });
}

async function main() {
  const auth = loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const archiveId = await getOrCreateArchiveFolder(drive);
  const folders = await listRootFolders(drive);

  const groups = new Map();
  for (const f of folders) {
    if (f.id === archiveId) continue;
    const key = f.name.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  let archivedCount = 0;
  let dupedNameCount = 0;

  for (const [name, group] of groups) {
    if (group.length < 2) continue;
    dupedNameCount += 1;

    // Keep the most recently modified copy at the root; archive the rest.
    group.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    const [keep, ...rest] = group;
    console.log(
      `"${name}": keeping the most recently modified copy at the root, ` +
        `archiving ${rest.length} other cop${rest.length === 1 ? 'y' : 'ies'}.`
    );

    for (const dupe of rest) {
      await moveFolder(drive, dupe.id, archiveId);
      archivedCount += 1;
    }
  }

  console.log(
    `\nDone. ${dupedNameCount} folder name(s) had duplicates at the root. ` +
      `Moved ${archivedCount} duplicate folder(s) into "${ARCHIVE_FOLDER_NAME}" -- ` +
      `nothing was deleted, go through that folder yourself whenever you're ready. ` +
      `One copy of each name stays clean at the top level of your Drive.`
  );
}

main().catch((err) => {
  console.error('Drive root cleanup failed:', err.message);
  process.exit(1);
});
