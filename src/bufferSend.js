import fs from 'node:fs';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { downloadFile, uploadVerticalCopy } from './drive.js';
import { ensureVerticalVideo } from './aspectRatio.js';
import { findRowForFile } from './sheets.js';
import { postOneServiceNow } from './bufferPost.js';
import { config } from './config.js';

// Sends videos that are already on YouTube but never reached the Buffer
// networks (Instagram, Facebook, Pinterest, X) to those networks, one network
// at a time (BUFFER_GAP_SECONDS apart) and one video at a time (2 minutes
// apart). Nothing is put back into the watched folders, so nothing is posted
// to YouTube or TikTok twice.
//
//   npm run buffer-send -- <part of file name> [more parts...] [--services=instagram,facebook] [--dry]
//
// Example:
//   npm run buffer-send -- Abdi_Bile_story --dry
//   npm run buffer-send -- Abdi_Bile_story
//
// Send at most 3 videos at a time: each network has a daily posting limit.

const VIDEO_GAP_MS = 2 * 60 * 1000;
const DEFAULT_SERVICES = ['instagram', 'facebook', 'pinterest', 'twitter'];

async function findVideo(drive, fragment) {
  const safe = fragment.replace(/'/g, "\\'");
  const res = await drive.files.list(
    {
      q: `name contains '${safe}' and mimeType contains 'video/' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 20,
    },
    { timeout: 30000 }
  );
  return (res.data.files || []).filter((f) => !f.name.startsWith('vertical-'));
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const servicesArg = args.find((a) => a.startsWith('--services='));
  const services = servicesArg ? servicesArg.slice(11).split(',').map((s) => s.trim().replace(/^x$/i, 'twitter')).filter(Boolean) : DEFAULT_SERVICES;
  const fragments = args.filter((a) => !a.startsWith('--'));
  if (fragments.length === 0) {
    console.log('Usage: npm run buffer-send -- <part of the file name> [more...] [--services=instagram,facebook] [--dry]');
    process.exit(1);
  }
  if (fragments.length > 3) console.log('Careful: more than 3 videos at once can hit the daily posting limits.');

  const auth = await loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    const matches = await findVideo(drive, fragment);
    if (matches.length === 0) {
      console.log(`"${fragment}": no video found in Drive -- skipped.`);
      continue;
    }
    const file = matches[0];
    console.log(`"${fragment}": found "${file.name}" (newest of ${matches.length} copy/copies). Networks: ${services.join(', ')}.`);
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
      }
      const row = await findRowForFile(auth, file.name);
      const title = row?.title || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      const caption = row ? `${row.capture || ''} ${row.hashtag || ''}`.trim() : title;
      for (let s = 0; s < services.length; s++) {
        if (s > 0 && config.bufferGapSeconds > 0) await new Promise((r) => setTimeout(r, config.bufferGapSeconds * 1000));
        try {
          const id = await postOneServiceNow(auth, services[s], { fileId, name: file.name, title, caption });
          console.log(`  ${services[s]}: posted (${id}).`);
        } catch (err) {
          console.error(`  ${services[s]} failed:`, err.message);
          if (/rate|too many|cooling/i.test(err.message)) {
            console.error('  Buffer limit -- stopping here. Try again later.');
            return;
          }
        }
      }
    } catch (err) {
      console.error(`  Send failed for "${file.name}":`, err.message);
    } finally {
      if (localPath) fs.unlink(localPath, () => {});
    }
    if (i < fragments.length - 1) await new Promise((r) => setTimeout(r, VIDEO_GAP_MS));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
