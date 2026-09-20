import { google } from 'googleapis';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { findRowForFile } from './sheets.js';

// Once a filename has been mirrored one way, it must never be mirrored again --
// even if it briefly vanishes from the destination folder's live listing (Make's
// move-to-done step silently fails sometimes, or something else moves/relabels
// it for a moment). Without this, mirrorNewVideos() re-derives "already mirrored"
// purely from a live folder scan every cycle, and GK_TERMINAL_DONE never gets
// cleaned out -- it only grows -- so EVERY video ever posted stays a permanent
// mirror candidate. Any gap, however brief, in the destination folder's listing
// re-copies it right back in, posting an already-finished video again. This was
// the actual cause of videos "reappearing" repeatedly (confirmed 20 Sep 2026 --
// several already-posted videos got re-mirrored into GK_JING within seconds of
// the very first checkOnce() after a token refresh, straight from the ever-
// growing GK_TERMINAL_DONE archive).
const MIRRORED_STATE_PATH = path.join(process.cwd(), 'mirrored-state.json');

function loadMirroredNames() {
  try {
    return new Set(JSON.parse(fs.readFileSync(MIRRORED_STATE_PATH, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveMirroredNames(names) {
  try {
    fs.writeFileSync(MIRRORED_STATE_PATH, JSON.stringify([...names]));
  } catch (err) {
    console.error('Could not persist mirrored-file state:', err.message);
  }
}

// No timeout on any of these Drive API calls used to mean a stalled request
// could hang the whole check cycle forever -- some of these (listing files)
// run at the very start of every single cycle, so a hang here blocked
// everything downstream too, not just one video.
const API_TIMEOUT_MS = 30000;

// Joe sometimes drops videos straight into a watched folder, and sometimes
// into whatever subfolder happens to be open (out of habit from the old
// Make.com setup) — so instead of watching one fixed subfolder, we look up
// every subfolder under it each time and watch all of them too.
async function listWatchedFolderIds(drive, rootFolderId) {
  const res = await drive.files.list(
    {
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      pageSize: 50,
    },
    { timeout: API_TIMEOUT_MS }
  );
  const subfolderIds = (res.data.files || []).map((f) => f.id);
  return [rootFolderId, ...subfolderIds];
}

// Lists video files sitting in the given folder or any subfolder inside it,
// oldest first — same order the Make.com scenario used.
export async function listVideosInFolder(auth, rootFolderId) {
  const drive = google.drive({ version: 'v3', auth });
  const folderIds = await listWatchedFolderIds(drive, rootFolderId);
  const parentClause = folderIds.map((id) => `'${id}' in parents`).join(' or ');

  const res = await drive.files.list(
    {
      q: `(${parentClause}) and mimeType contains 'video/' and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime)',
      orderBy: 'createdTime',
      pageSize: 50,
    },
    { timeout: API_TIMEOUT_MS }
  );
  return res.data.files || [];
}

// Lists video files in GK_TERMINAL (this script's own watched folder).
export async function listNewVideos(auth) {
  return listVideosInFolder(auth, config.driveFolderId);
}

// Every Drive stream download in this file used to have no time limit at
// all -- a stalled connection mid-download would hang the whole check cycle
// forever instead of failing and letting the next video through. This bounds
// the WHOLE transfer (not just time-to-first-byte), destroying the stream on
// timeout so the underlying request doesn't linger either.
const DOWNLOAD_TIMEOUT_MS = 4 * 60 * 1000;

export function pipeWithTimeout(readable, dest, timeoutMs = DOWNLOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      readable.destroy(new Error(`Download timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    readable
      .on('end', () => {
        clearTimeout(timer);
        resolve();
      })
      .on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      })
      .pipe(dest);
  });
}

// Downloads a file to a temp path and returns that path.
export async function downloadFile(auth, fileId, fileName) {
  const drive = google.drive({ version: 'v3', auth });
  const destPath = path.join(os.tmpdir(), `gk-${fileId}-${fileName}`);
  const dest = fs.createWriteStream(destPath);

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream', timeout: API_TIMEOUT_MS });
  await pipeWithTimeout(res.data, dest);

  return destPath;
}

// Uploads a local video file straight into the watched folder (GK_TERMINAL),
// so auto-generated videos show up alongside the ones Joe drops in by hand
// and get picked up by the normal listNewVideos()/processVideo() flow.
export async function uploadFile(auth, localPath, fileName) {
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.create(
    {
      requestBody: { name: fileName, parents: [config.driveFolderId] },
      media: { mimeType: 'video/mp4', body: fs.createReadStream(localPath) },
      fields: 'id',
    },
    { timeout: 4 * 60 * 1000 }
  );
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
  const mirroredNames = loadMirroredNames();

  // Done folders in particular can easily hold 100+ videos after a few weeks
  // -- a single unpaginated page (there used to be a flat pageSize:50 here)
  // silently hid anything past the first page from the "already done" check
  // below, making an old, already-posted video look brand new again and get
  // copied right back in. This was a real, confirmed source of videos
  // reposting (20 Sep 2026), not just theoretical -- always page through the
  // full folder.
  const listVideos = async (folderId) => {
    if (!folderId) return [];
    const files = [];
    let pageToken;
    do {
      const res = await drive.files.list(
        {
          q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
          fields: 'nextPageToken, files(id, name)',
          pageSize: 1000,
          pageToken,
        },
        { timeout: API_TIMEOUT_MS }
      );
      files.push(...(res.data.files || []));
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    return files;
  };

  const [own, mirror, ownDone, mirrorDone] = await Promise.all([
    listVideos(config.driveFolderId),
    listVideos(config.mirrorFolderId),
    listVideos(config.doneFolderId),
    listVideos(config.mirrorDoneFolderId),
  ]);

  // A video already sitting in either side's DONE folder counts as "already
  // there" too -- otherwise a video that's finished on one side but still
  // pending on the other looks "missing" and gets copied right back,
  // reposting it a second time once the still-pending side processes it.
  const ownNames = new Set([...own, ...ownDone].map((f) => f.name));
  const mirrorNames = new Set([...mirror, ...mirrorDone].map((f) => f.name));

  // Candidates for the GK_TERMINAL -> GK_JING direction include GK_TERMINAL's
  // own DONE folder, not just its current contents -- processVideo() writes
  // the caption row and moves a video to DONE in the same step (right after
  // YouTube succeeds), so a video is never simultaneously "still in
  // GK_TERMINAL" and "has a row." Checking only `own` meant this direction
  // could never find an eligible file and silently mirrored nothing, ever.
  const ownMirrorCandidates = [...own, ...ownDone];
  for (const file of ownMirrorCandidates) {
    if (mirrorNames.has(file.name) || mirroredNames.has(file.name)) continue;
    // Don't mirror a GK_TERMINAL video into GK_JING until it already has its
    // caption + Pinterest cover row written. Make polls independently and
    // can pick the video up the moment it appears in GK_JING -- if that
    // happens before processVideo() has written column G (which can take a
    // while, since it runs after the YouTube upload), Make falls back to
    // its generic rotation cover, and since Pinterest pins don't update
    // after publishing, that pin is stuck looking that way forever. Safer
    // to wait: it'll mirror on a later cycle, once its row exists.
    try {
      const row = await findRowForFile(auth, file.name);
      if (!row) continue;
    } catch (err) {
      console.error(`Could not check for a caption row for "${file.name}" (skipping mirroring it this cycle):`, err.message);
      continue;
    }
    try {
      await drive.files.copy(
        {
          fileId: file.id,
          requestBody: { name: file.name, parents: [config.mirrorFolderId] },
        },
        { timeout: 4 * 60 * 1000 }
      );
      mirroredNames.add(file.name);
      saveMirroredNames(mirroredNames);
      console.log(`Mirrored "${file.name}" into the other folder so it posts everywhere.`);
    } catch (err) {
      console.error(`Could not mirror "${file.name}" into GK_JING (skipping it, other files still mirrored):`, err.message);
    }
  }
  for (const file of mirror) {
    if (ownNames.has(file.name) || mirroredNames.has(file.name)) continue;
    try {
      await drive.files.copy(
        {
          fileId: file.id,
          requestBody: { name: file.name, parents: [config.driveFolderId] },
        },
        { timeout: 4 * 60 * 1000 }
      );
      mirroredNames.add(file.name);
      saveMirroredNames(mirroredNames);
      console.log(`Mirrored "${file.name}" into the other folder so it posts everywhere.`);
    } catch (err) {
      console.error(`Could not mirror "${file.name}" into GK_TERMINAL (skipping it, other files still mirrored):`, err.message);
    }
  }
}

// Uploads a local image and makes it publicly viewable, returning a stable
// direct-image URL (Canva's own export links expire after a few hours, so
// generated cover images get rehosted here for the spreadsheet/Make to use
// indefinitely).
export async function uploadPublicImage(auth, localPath, fileName, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  const file = await drive.files.create(
    {
      requestBody: { name: fileName, parents: folderId ? [folderId] : undefined },
      media: { mimeType: 'image/png', body: fs.createReadStream(localPath) },
      fields: 'id',
    },
    { timeout: 60000 }
  );
  await drive.permissions.create(
    {
      fileId: file.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    },
    { timeout: API_TIMEOUT_MS }
  );
  // NOT drive.google.com/uc?export=view -- that endpoint is built for a
  // browser tab, and frequently serves an HTML "can't scan this file"
  // interstitial instead of raw image bytes when a server (like Pinterest's
  // own fetcher, not a person's browser) requests it directly. The
  // ifempty() check in Make's blueprint only looks at whether this string
  // is blank, so a technically-non-empty-but-unfetchable link like that
  // slips through as "ready" and Pinterest is left with nothing usable --
  // silently falling back to its own default rather than erroring loudly.
  // The /thumbnail endpoint is built for exactly this (external, non-browser
  // fetches) and reliably returns the actual image.
  return `https://drive.google.com/thumbnail?id=${file.data.id}&sz=w1000`;
}

// Moves a file into the DONE folder once it's been posted everywhere.
export async function moveToDone(auth, fileId) {
  if (!config.doneFolderId) return;
  const drive = google.drive({ version: 'v3', auth });
  const file = await drive.files.get({ fileId, fields: 'parents' }, { timeout: API_TIMEOUT_MS });
  const previousParents = (file.data.parents || []).join(',');
  await drive.files.update(
    {
      fileId,
      addParents: config.doneFolderId,
      removeParents: previousParents,
      fields: 'id, parents',
    },
    { timeout: API_TIMEOUT_MS }
  );
}
