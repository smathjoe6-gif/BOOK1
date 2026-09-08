import { google } from 'googleapis';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';

// Joe sometimes drops videos straight into GK_JING, and sometimes into
// whatever subfolder happens to be open (out of habit from the old Make.com
// setup) — so instead of watching one fixed subfolder, we look up every
// subfolder under GK_JING each time and watch all of them too.
async function listWatchedFolderIds(drive) {
  const res = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 50,
  });
  const subfolderIds = (res.data.files || []).map((f) => f.id);
  return [config.driveFolderId, ...subfolderIds];
}

// Lists video files sitting in the watched folder or any subfolder inside
// it, oldest first — same order the Make.com scenario used.
export async function listNewVideos(auth) {
  const drive = google.drive({ version: 'v3', auth });
  const folderIds = await listWatchedFolderIds(drive);
  const parentClause = folderIds.map((id) => `'${id}' in parents`).join(' or ');

  const res = await drive.files.list({
    q: `(${parentClause}) and mimeType contains 'video/' and trashed = false`,
    fields: 'files(id, name, mimeType, createdTime)',
    orderBy: 'createdTime',
    pageSize: 50,
  });
  return res.data.files || [];
}

// Downloads a file to a temp path and returns that path.
export async function downloadFile(auth, fileId, fileName) {
  const drive = google.drive({ version: 'v3', auth });
  const destPath = path.join(os.tmpdir(), `gk-${fileId}-${fileName}`);
  const dest = fs.createWriteStream(destPath);

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  await new Promise((resolve, reject) => {
    res.data.on('end', resolve).on('error', reject).pipe(dest);
  });

  return destPath;
}

// Moves a file into the DONE folder once it's been posted everywhere.
export async function moveToDone(auth, fileId) {
  if (!config.doneFolderId) return;
  const drive = google.drive({ version: 'v3', auth });
  const file = await drive.files.get({ fileId, fields: 'parents' });
  const previousParents = (file.data.parents || []).join(',');
  await drive.files.update({
    fileId,
    addParents: config.doneFolderId,
    removeParents: previousParents,
    fields: 'id, parents',
  });
}
