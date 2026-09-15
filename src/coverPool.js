import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './config.js';

// Manual cover-image pool: Joe drops a raw/source photo (designed or not --
// no Canva setup needed to use this) straight into COVER_POOL_FOLDER_ID in
// Drive. Each call here downloads the oldest untouched image to a local
// temp file and moves the Drive original into the pool's "Done" subfolder
// (matching the DONE_FOLDER_ID/GK_JING_DONE naming used everywhere else in
// this pipeline) so it's never picked twice. Returns the local file path,
// or null if the pool is currently empty. Callers are responsible for
// deleting the local file once they're done with it.
export async function pickFromCoverPool(auth) {
  if (!config.coverPoolFolderId || !config.coverPoolDoneFolderId) return null;

  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: `'${config.coverPoolFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
    orderBy: 'createdTime',
    pageSize: 1,
    fields: 'files(id, name)',
  });

  const file = res.data.files?.[0];
  if (!file) return null;

  const localPath = path.join(os.tmpdir(), `cover-pool-${file.id}${path.extname(file.name) || '.png'}`);
  const download = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
  const dest = fs.createWriteStream(localPath);
  await new Promise((resolve, reject) => {
    download.data.pipe(dest).on('finish', resolve).on('error', reject);
  });

  await drive.files.update({
    fileId: file.id,
    addParents: config.coverPoolDoneFolderId,
    removeParents: config.coverPoolFolderId,
    fields: 'id, parents',
  });

  return localPath;
}
