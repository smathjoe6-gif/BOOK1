import fs from 'node:fs';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { downloadFile, uploadVerticalCopy } from './drive.js';
import { ensureVerticalVideo } from './aspectRatio.js';
import { findRowForFile } from './sheets.js';
import { postOneServiceNow } from './bufferPost.js';

// Re-sends videos that FACEBOOK rejected ("height must be at least 960px",
// "aspect ratio too wide") to Facebook ONLY, using a 9:16 copy. The other
// networks already posted those videos, so nothing is posted twice and
// nothing is put back into the watched folders.
//
//   npm run facebook-redo -- <part of file name> [more parts...] [--dry]
//
// Example:
//   npm run facebook-redo -- gemini_generated_video_11cb15a3 --dry     (only shows what it found)
//   npm run facebook-redo -- gemini_generated_video_11cb15a3           (really posts it)
//
// Run one video first, check it on Facebook, then do the rest. Videos are
// sent one minute apart so Buffer's API limit is not hit.

const GAP_MS = 60 * 1000;

async function findVideo(drive, fragment) {
  const safe = fragment.replace(/'/g, "\\'");
  const res = await drive.files.list(
    {
      q: `name contains '${safe}' and mimeType contains 'video/' and trashed = false`,
      fields: 'files(id, name, md5Checksum, createdTime)',
      orderBy: 'createdTime',
      pageSize: 20,
    },
    { timeout: 30000 }
  );
  // Skip the 9:16 copies this feature makes itself.
  return (res.data.files || []).filter((f) => !f.name.startsWith('vertical-'));
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const fragments = args.filter((a) => !a.startsWith('--'));
  if (fragments.length === 0) {
    console.log('Usage: npm run facebook-redo -- <part of the file name> [more...] [--dry]');
    process.exit(1);
  }

  const auth = await loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    const matches = await findVideo(drive, fragment);
    if (matches.length === 0) {
      console.log(`"${fragment}": no video found in Drive -- skipped.`);
      continue;
    }
    // Same video can exist as a GK_TERMINAL copy and a GK_JING copy: use one.
    const file = matches[0];
    console.log(`"${fragment}": found "${file.name}" (${matches.length} copy/copies in Drive).`);
    if (dry) continue;

    let localPath;
    try {
      localPath = await downloadFile(auth, file.id, file.name);
      const converted = await ensureVerticalVideo(localPath);
      let fileId = file.id;
      if (converted !== localPath) {
        fileId = await uploadVerticalCopy(auth, converted, file.name);
        console.log('  Made and uploaded the 9:16 copy.');
        fs.unlink(converted, () => {});
      } else {
        console.log('  Already vertical -- nothing to convert (Facebook may reject it for another reason).');
      }
      const row = await findRowForFile(auth, file.name);
      const title = row?.title || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      const caption = row ? `${row.capture || ''} ${row.hashtag || ''}`.trim() : title;
      const id = await postOneServiceNow(auth, 'facebook', { fileId, name: file.name, title, caption });
      console.log(`  Facebook: posted (${id}).`);
    } catch (err) {
      console.error(`  Facebook redo failed for "${file.name}":`, err.message);
      if (/rate|too many|cooling/i.test(err.message)) {
        console.error('  Buffer limit -- stopping here. Try again later.');
        break;
      }
    }
    if (i < fragments.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
