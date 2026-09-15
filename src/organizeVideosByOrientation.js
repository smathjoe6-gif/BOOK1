import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';

// Joe's videos (source clips, generated shorts, finished music videos) are scattered
// across dozens of project folders in his Drive. This finds every video file anywhere
// in the Drive and consolidates it into 01_VIDEOS, sorted first by whether it's a
// music video (based on filename/caption keywords -- the closest signal available
// without watching each one), then by real aspect ratio using Drive's own video
// metadata (width/height), which is exact, not a guess. A video Drive hasn't finished
// processing yet (so no dimensions are available) goes into "Needs Review" instead of
// being guessed at. Safe to run again any time -- files already sitting in a sorted
// subfolder are left alone.
//
// Run with: npm run organize-videos

const DEST_FOLDER_NAME = '01_VIDEOS';

const MUSIC_VIDEO_KEYWORDS = ['music', 'song', 'rap', 'hip-hop', 'hiphop', 'kaban', 'qaraami', 'lyrics'];

function isMusicVideo(title) {
  const lower = title.toLowerCase();
  if (MUSIC_VIDEO_KEYWORDS.some((word) => lower.includes(word))) return true;
  return lower.includes('#');
}

function classifyOrientation(width, height) {
  if (!width || !height) return null;
  if (width > height) return '16x9 (Horizontal)';
  if (height > width) return '9x16 (Vertical)';
  return 'Square or Other';
}

async function getOrCreateFolder(drive, parentId, name) {
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

async function listAllVideoFiles(drive) {
  let files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: "mimeType contains 'video/' and trashed = false",
      fields: 'nextPageToken, files(id, name, parents, videoMediaMetadata(width, height))',
      pageToken,
      pageSize: 1000,
    });
    files = files.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function moveFile(drive, fileId, fromParents, toParent) {
  await drive.files.update({
    fileId,
    addParents: toParent,
    removeParents: fromParents.join(','),
    fields: 'id',
  });
}

async function main() {
  const auth = loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const rootRes = await drive.files.list({
    q: `'root' in parents and name = '${DEST_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  const destFolderId = rootRes.data.files?.[0]?.id;
  if (!destFolderId) {
    console.error(`Could not find a "${DEST_FOLDER_NAME}" folder at your Drive root -- nothing to organize into.`);
    process.exit(1);
  }

  const musicFolderId = await getOrCreateFolder(drive, destFolderId, 'Music Videos');
  const needsReviewId = await getOrCreateFolder(drive, destFolderId, 'Needs Review (No Dimensions Yet)');

  const orientationFolders = {};
  for (const parentId of [destFolderId, musicFolderId]) {
    orientationFolders[parentId] = {
      '16x9 (Horizontal)': await getOrCreateFolder(drive, parentId, '16x9 (Horizontal)'),
      '9x16 (Vertical)': await getOrCreateFolder(drive, parentId, '9x16 (Vertical)'),
      'Square or Other': await getOrCreateFolder(drive, parentId, 'Square or Other'),
    };
  }

  const sortedFolderIds = new Set([
    needsReviewId,
    ...Object.values(orientationFolders[destFolderId]),
    ...Object.values(orientationFolders[musicFolderId]),
  ]);

  const files = await listAllVideoFiles(drive);
  const counts = {
    music: { '16x9 (Horizontal)': 0, '9x16 (Vertical)': 0, 'Square or Other': 0 },
    other: { '16x9 (Horizontal)': 0, '9x16 (Vertical)': 0, 'Square or Other': 0 },
    needsReview: 0,
    alreadySorted: 0,
  };

  for (const file of files) {
    const parents = file.parents || [];
    if (parents.some((p) => sortedFolderIds.has(p))) {
      counts.alreadySorted += 1;
      continue;
    }

    const { width, height } = file.videoMediaMetadata || {};
    const orientation = classifyOrientation(width, height);
    const music = isMusicVideo(file.name);

    if (!orientation) {
      await moveFile(drive, file.id, parents, needsReviewId);
      counts.needsReview += 1;
      continue;
    }

    const bucketParentId = music ? musicFolderId : destFolderId;
    await moveFile(drive, file.id, parents, orientationFolders[bucketParentId][orientation]);
    counts[music ? 'music' : 'other'][orientation] += 1;
  }

  console.log(
    `Done. Found ${files.length} video file(s) across your whole Drive. ` +
      `${counts.alreadySorted} were already sorted, ${counts.needsReview} had no dimensions yet ` +
      `(Drive still processing them) so went to "Needs Review (No Dimensions Yet)".\n` +
      `Music Videos -- 16x9: ${counts.music['16x9 (Horizontal)']}, 9x16: ${counts.music['9x16 (Vertical)']}, ` +
      `Square/Other: ${counts.music['Square or Other']}.\n` +
      `Other Videos -- 16x9: ${counts.other['16x9 (Horizontal)']}, 9x16: ${counts.other['9x16 (Vertical)']}, ` +
      `Square/Other: ${counts.other['Square or Other']}.`
  );
}

main().catch((err) => {
  console.error('Video organize failed:', err.message);
  process.exit(1);
});
