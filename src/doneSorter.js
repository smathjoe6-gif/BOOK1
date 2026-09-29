import { google } from 'googleapis';
import { config } from './config.js';

// Joe wants the two GK done folders tidy (29 Sep 2026): GK_TERMINAL_DONE
// (this script's DONE_FOLDER_ID) and GK_JING_DONE (Make's done folder) each
// get a "9x16 (Vertical)" and a "16x9 (Horizontal)" subfolder, and every
// finished video is moved into the right one. Runs every cycle on whatever
// sits loose in each done folder, so it also sorts Make's videos without
// touching the Make scenario. Uses Drive's own video width/height, so it is
// exact; a video Drive hasn't measured yet (or a square one) just stays put
// until the next cycle. mirrorNewVideos() looks inside these subfolders too,
// so sorting never makes an already-posted video look new again.

const VERTICAL = '9x16 (Vertical)';
const HORIZONTAL = '16x9 (Horizontal)';
const MAX_MOVES_PER_RUN = 100; // first run clears the backlog over a few cycles
const API_TIMEOUT_MS = 30000;

export function gkJingDoneFolderId() {
  return process.env.GK_JING_DONE_FOLDER_ID || config.mirrorDoneFolderId || '1KUwQJPB4FMaQPRVm1KdF6pb44lw4nbG5';
}

async function getOrCreateFolder(drive, parentId, name) {
  const res = await drive.files.list(
    {
      q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
    },
    { timeout: API_TIMEOUT_MS }
  );
  if (res.data.files?.[0]) return res.data.files[0].id;
  const created = await drive.files.create(
    { requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' },
    { timeout: API_TIMEOUT_MS }
  );
  return created.data.id;
}

async function sortFolder(drive, folderId, label) {
  const loose = [];
  let pageToken;
  do {
    const res = await drive.files.list(
      {
        q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, videoMediaMetadata(width, height))',
        pageSize: 1000,
        pageToken,
      },
      { timeout: API_TIMEOUT_MS }
    );
    loose.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  const todo = loose
    .map((f) => {
      const { width, height } = f.videoMediaMetadata || {};
      if (!width || !height || width === height) return null;
      return { ...f, target: height > width ? VERTICAL : HORIZONTAL };
    })
    .filter(Boolean)
    .slice(0, MAX_MOVES_PER_RUN);
  if (todo.length === 0) return;

  const targetIds = {};
  for (const name of new Set(todo.map((f) => f.target))) {
    targetIds[name] = await getOrCreateFolder(drive, folderId, name);
  }
  let moved = 0;
  for (const file of todo) {
    try {
      await drive.files.update(
        { fileId: file.id, addParents: targetIds[file.target], removeParents: folderId, fields: 'id' },
        { timeout: API_TIMEOUT_MS }
      );
      moved += 1;
    } catch (err) {
      console.error(`Could not sort "${file.name}" in ${label} (will retry next cycle):`, err.message);
    }
  }
  console.log(`Sorted ${moved} video(s) in ${label} into 9x16 / 16x9 folders.`);
}

export async function sortDoneFoldersByShape(auth) {
  const drive = google.drive({ version: 'v3', auth });
  const folders = [
    [config.doneFolderId, 'GK_TERMINAL_DONE'],
    [gkJingDoneFolderId(), 'GK_JING_DONE'],
  ];
  for (const [folderId, label] of folders) {
    if (!folderId) continue;
    try {
      await sortFolder(drive, folderId, label);
    } catch (err) {
      console.error(`Could not sort ${label} (will retry next cycle):`, err.message);
    }
  }
}
