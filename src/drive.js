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

// Uploads a local video file straight into the watched folder (GK_TERMINAL),
// so auto-generated videos show up alongside the ones Joe drops in by hand
// and get picked up by the normal listNewVideos()/processVideo() flow.
export async function uploadFile(auth, localPath, fileName) {
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.create({
    requestBody: { name: fileName, parents: [config.driveFolderId] },
    media: { mimeType: 'video/mp4', body: fs.createReadStream(localPath) },
    fields: 'id',
  });
}

// Joe now drops videos into either GK_TERMINAL (this script's folder) or
// GK_JING (the Make.com scenario's folder) and expects them to reach every
// platform either way. Since the two systems no longer share any platform
// (Make.com does Instagram/Facebook/Pinterest, this script does
// YouTube/TikTok), copying a video into whichever folder it's missing from
// is safe -- each side processes its own copy and moves it to DONE on its
// own, without touching the other's copy.
export async function mirrorNewVideos(auth) {
  if (!config.mirrorFolderId) return;
  const drive = google.drive({ version: 'v3', auth });

  const [ownRes, mirrorRes] = await Promise.all([
    drive.files.list({
      q: `'${config.driveFolderId}' in parents and mimeType contains 'video/' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 50,
    }),
    drive.files.list({
      q: `'${config.mirrorFolderId}' in parents and mimeType contains 'video/' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 50,
    }),
  ]);

  const own = ownRes.data.files || [];
  const mirror = mirrorRes.data.files || [];
  const ownNames = new Set(own.map((f) => f.name));
  const mirrorNames = new Set(mirror.map((f) => f.name));

  for (const file of own) {
    if (mirrorNames.has(file.name)) continue;
    await drive.files.copy({
      fileId: file.id,
      requestBody: { name: file.name, parents: [config.mirrorFolderId] },
    });
    console.log(`Mirrored "${file.name}" into the other folder so it posts everywhere.`);
  }
  for (const file of mirror) {
    if (ownNames.has(file.name)) continue;
    await drive.files.copy({
      fileId: file.id,
      requestBody: { name: file.name, parents: [config.driveFolderId] },
    });
    console.log(`Mirrored "${file.name}" into the other folder so it posts everywhere.`);
  }
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
