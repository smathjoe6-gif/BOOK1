import { google } from 'googleapis';
import { config } from './config.js';
import { loadOAuthClient } from './googleAuth.js';

// One-time (or run-anytime) cleanup for the manual cover-image pool
// (GK_Pinterest_Covers / COVER_POOL_FOLDER_ID). Joe drops in raw photos in
// bulk from wherever he's collecting them -- mixed in with real photos
// there's often: browser-export junk (html/binary files, not images),
// watermarked stock-photo thumbnails (unusable as a final cover), and exact
// duplicate photos saved more than once. This sorts all of that out so only
// clean, unique photos are left in the pool ready to be picked up by
// getCoverImage() (src/coverImage.js). Safe to run again any time Joe adds
// a fresh batch -- already-sorted files are left alone.
//
// Run with: npm run organize-covers

const WATERMARK_PREFIX = 'watermarked_img';

async function getOrCreateSubfolder(drive, parentId, name) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  if (res.data.files?.[0]) return res.data.files[0].id;

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return created.data.id;
}

async function listDirectFiles(drive, folderId) {
  let files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, createdTime)',
      pageToken,
      pageSize: 1000,
    });
    files = files.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function moveFile(drive, fileId, fromParent, toParent) {
  await drive.files.update({
    fileId,
    addParents: toParent,
    removeParents: fromParent,
    fields: 'id',
  });
}

async function main() {
  if (!config.coverPoolFolderId) {
    console.error('COVER_POOL_FOLDER_ID is not set -- nothing to organize.');
    process.exit(1);
  }

  const auth = loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const poolId = config.coverPoolFolderId;

  const papersId = await getOrCreateSubfolder(drive, poolId, 'Papers');
  const watermarkedId = await getOrCreateSubfolder(drive, poolId, 'Watermarked - Not Used');
  const duplicatesId = await getOrCreateSubfolder(drive, poolId, 'Duplicates');
  const skipIds = new Set([papersId, watermarkedId, duplicatesId]);
  if (config.coverPoolDoneFolderId) skipIds.add(config.coverPoolDoneFolderId);

  const allFiles = await listDirectFiles(drive, poolId);
  const candidates = allFiles.filter(
    (f) => !skipIds.has(f.id) && f.mimeType !== 'application/vnd.google-apps.folder'
  );

  // Oldest first, so when duplicates are found the earliest upload is the
  // one kept in the pool and later copies are the ones moved out.
  candidates.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));

  let papersCount = 0;
  let watermarkedCount = 0;
  let duplicateCount = 0;
  const seenHashes = new Map();

  for (const file of candidates) {
    if (!file.mimeType.startsWith('image/')) {
      await moveFile(drive, file.id, poolId, papersId);
      papersCount += 1;
      continue;
    }

    if (file.name.startsWith(WATERMARK_PREFIX)) {
      await moveFile(drive, file.id, poolId, watermarkedId);
      watermarkedCount += 1;
      continue;
    }

    if (file.md5Checksum) {
      if (seenHashes.has(file.md5Checksum)) {
        await moveFile(drive, file.id, poolId, duplicatesId);
        duplicateCount += 1;
        continue;
      }
      seenHashes.set(file.md5Checksum, file.id);
    }
  }

  const cleanCount = candidates.length - papersCount - watermarkedCount - duplicateCount;
  console.log(
    `Done. Non-image files -> Papers: ${papersCount}. Watermarked images -> ` +
      `"Watermarked - Not Used": ${watermarkedCount}. Exact duplicates -> Duplicates: ${duplicateCount}. ` +
      `Clean photos left ready to use: ${cleanCount}.`
  );
}

main().catch((err) => {
  console.error('Cover pool organize failed:', err.message);
  process.exit(1);
});
