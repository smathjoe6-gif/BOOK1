import { google } from 'googleapis';
import { config } from './config.js';

// Manual cover-image pool: Joe drops finished cover images (designed by hand
// in Canva or anything else, exported himself -- no Canva API/OAuth setup
// needed) straight into COVER_POOL_FOLDER_ID in Drive. Each call here takes
// the oldest untouched image, makes it publicly viewable the same way
// uploadPublicImage() does for Canva-API covers, and moves it into the
// pool's "Used" subfolder so the same image never gets assigned twice.
// Returns its public view URL, or null if the pool is currently empty.
export async function pickFromCoverPool(auth) {
  if (!config.coverPoolFolderId || !config.coverPoolUsedFolderId) return null;

  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: `'${config.coverPoolFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
    orderBy: 'createdTime',
    pageSize: 1,
    fields: 'files(id, name)',
  });

  const file = res.data.files?.[0];
  if (!file) return null;

  await drive.permissions.create({
    fileId: file.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  await drive.files.update({
    fileId: file.id,
    addParents: config.coverPoolUsedFolderId,
    removeParents: config.coverPoolFolderId,
    fields: 'id, parents',
  });

  return `https://drive.google.com/uc?export=view&id=${file.id}`;
}
