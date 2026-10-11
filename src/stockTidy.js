import { google } from 'googleapis';

// Joe (11 Oct 2026): the stock folder GK_STOCK_VIDEOS must tidy itself. Exact
// duplicate clips go to the Drive Bin (only the oldest copy stays), and every
// clip is filed in "9x16 (Vertical)" or "16x9 (Horizontal)" by Drive's own
// video width/height. Folders Joe made himself (story / theme folders such as
// blacksmith_hiphop) are never touched. A duplicate is the same Drive md5, i.e.
// the same bytes, never just the same name. Bin = recoverable for 30 days.
// STITCH_TIDY=false turns it off. The two shape folders count as part of the
// loose pool for the stacker (see listLooseStock in stitchVideos.js).

export const VERTICAL = '9x16 (Vertical)';
export const HORIZONTAL = '16x9 (Horizontal)';
const MAX_ACTIONS_PER_RUN = 150;
const API_TIMEOUT_MS = 30000;

export function isShapeFolder(name) {
  return /^\s*(9\s*x\s*16|16\s*x\s*9)\b/i.test(String(name || ''));
}

async function listFolders(drive, parentId) {
  const res = await drive.files.list(
    {
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 200,
    },
    { timeout: API_TIMEOUT_MS }
  );
  return res.data.files || [];
}

async function listVideos(drive, parentId) {
  const found = [];
  let pageToken;
  do {
    const res = await drive.files.list(
      {
        q: `'${parentId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, createdTime, md5Checksum, videoMediaMetadata(width, height))',
        pageSize: 1000,
        pageToken,
      },
      { timeout: API_TIMEOUT_MS }
    );
    found.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return found;
}

async function getOrCreateFolder(drive, parentId, name) {
  const existing = (await listFolders(drive, parentId)).find((f) => f.name === name);
  if (existing) return existing.id;
  const created = await drive.files.create(
    { requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' },
    { timeout: API_TIMEOUT_MS }
  );
  return created.data.id;
}

export async function tidyStockFolder(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });

  // Loose clips and clips already filed by shape; theme folders are left alone.
  const places = [{ id: folderId, shape: null }];
  for (const sub of await listFolders(drive, folderId)) {
    if (isShapeFolder(sub.name)) places.push({ id: sub.id, shape: /^\s*9/.test(sub.name) ? VERTICAL : HORIZONTAL });
  }
  const clips = [];
  for (const place of places) {
    for (const f of await listVideos(drive, place.id)) clips.push({ ...f, parent: place.id, parentShape: place.shape });
  }
  if (clips.length === 0) return;

  let actions = 0;

  // 1) Exact duplicates (same md5): keep the oldest, Bin the rest.
  const byHash = new Map();
  for (const c of clips) {
    if (!c.md5Checksum) continue;
    if (!byHash.has(c.md5Checksum)) byHash.set(c.md5Checksum, []);
    byHash.get(c.md5Checksum).push(c);
  }
  const binned = new Set();
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')) || a.id.localeCompare(b.id));
    for (const extra of group.slice(1)) {
      if (actions >= MAX_ACTIONS_PER_RUN) break;
      try {
        await drive.files.update({ fileId: extra.id, requestBody: { trashed: true }, fields: 'id' }, { timeout: API_TIMEOUT_MS });
        binned.add(extra.id);
        actions += 1;
      } catch (err) {
        console.error(`Stock tidy: could not Bin duplicate "${extra.name}" (will retry next cycle):`, err.message);
      }
    }
  }

  // 2) File every remaining clip by shape (square or unmeasured clips stay put).
  const targetIds = {};
  let moved = 0;
  for (const c of clips) {
    if (binned.has(c.id) || actions >= MAX_ACTIONS_PER_RUN) continue;
    const { width, height } = c.videoMediaMetadata || {};
    if (!width || !height || width === height) continue;
    const target = height > width ? VERTICAL : HORIZONTAL;
    if (c.parentShape === target) continue;
    try {
      if (!targetIds[target]) targetIds[target] = await getOrCreateFolder(drive, folderId, target);
      await drive.files.update(
        { fileId: c.id, addParents: targetIds[target], removeParents: c.parent, fields: 'id' },
        { timeout: API_TIMEOUT_MS }
      );
      moved += 1;
      actions += 1;
    } catch (err) {
      console.error(`Stock tidy: could not file "${c.name}" (will retry next cycle):`, err.message);
    }
  }
  if (binned.size + moved > 0) {
    console.log(`Stock tidy: moved ${binned.size} exact duplicate(s) to the Bin and filed ${moved} clip(s) into 9x16 / 16x9.`);
  }
}
