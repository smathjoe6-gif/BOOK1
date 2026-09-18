import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './config.js';
import { pipeWithTimeout } from './drive.js';

// Somali/heritage words are deliberately left out -- they're common across
// nearly every filename in the pool and would match everything, defeating
// the point of picking a distinctive photo.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'our', 'your', 'video', 'song', 'music', 'grok', 'auto', 'legend', 'gk',
]);

function keywordsFrom(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function scoreFilename(name, keywords) {
  const lower = name.toLowerCase();
  return keywords.reduce((score, word) => (lower.includes(word) ? score + 1 : score), 0);
}

// Manual cover-image pool: Joe drops a raw/source photo (designed or not --
// no Canva setup needed to use this) straight into COVER_POOL_FOLDER_ID in
// Drive. When a title is given, this looks at a batch of the oldest
// untouched photos and picks whichever filename best matches keywords from
// the title (e.g. "camel" in the title favors a photo with "camel" in its
// name) -- falls back to the plain oldest-first pick when nothing matches
// or no title is given, so behavior is unchanged for callers that don't
// pass one. Downloads the picked image to a local temp file and moves the
// Drive original into the pool's "Done" subfolder (matching the
// DONE_FOLDER_ID/GK_JING_DONE naming used everywhere else in this pipeline)
// so it's never picked twice. Returns the local file path, or null if the
// pool is currently empty. Callers are responsible for deleting the local
// file once they're done with it.
export async function pickFromCoverPool(auth, title = '') {
  if (!config.coverPoolFolderId || !config.coverPoolDoneFolderId) return null;

  const drive = google.drive({ version: 'v3', auth });
  const keywords = keywordsFrom(title);
  const res = await drive.files.list(
    {
      q: `'${config.coverPoolFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
      orderBy: 'createdTime',
      pageSize: keywords.length > 0 ? 50 : 1,
      fields: 'files(id, name)',
    },
    { timeout: 30000 }
  );

  const candidates = res.data.files || [];
  if (candidates.length === 0) return null;

  const file = keywords.length > 0
    ? candidates.reduce((best, candidate) => (
      scoreFilename(candidate.name, keywords) > scoreFilename(best.name, keywords) ? candidate : best
    ), candidates[0])
    : candidates[0];

  const localPath = path.join(os.tmpdir(), `cover-pool-${file.id}${path.extname(file.name) || '.png'}`);
  const download = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream', timeout: 30000 });
  const dest = fs.createWriteStream(localPath);
  await pipeWithTimeout(download.data, dest);

  await drive.files.update(
    {
      fileId: file.id,
      addParents: config.coverPoolDoneFolderId,
      removeParents: config.coverPoolFolderId,
      fields: 'id, parents',
    },
    { timeout: 30000 }
  );

  return localPath;
}
