import { google } from 'googleapis';
import { config } from './config.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

// Posts a GK_TERMINAL video to TikTok via Buffer, replacing the direct
// TikTok Content Posting API integration in src/tiktok.js (added 21 Sep 2026
// after confirming with a real live test post that TikTok's unaudited/sandbox
// client key was forcing every direct post to SELF_ONLY/private, while
// Buffer's own already-approved TikTok connection -- "kamaldii1 TikTok
// Account" -- posts publicly). src/tiktok.js and src/tiktokAuth.js are left
// in place, not deleted, in case TikTok's own Production app is approved
// later and direct posting becomes worth switching back to.
//
// Buffer's API needs a URL it can fetch the video from, not a local file --
// this briefly makes the source Drive file's link public (the same
// "anyone: reader" pattern uploadPublicImage() already uses in drive.js) so
// Buffer can grab it. Deliberately left public afterward rather than revoked
// immediately: the same video is about to be public on YouTube/Twitter/
// Pinterest anyway via the rest of this pipeline, and revoking right away
// risks cutting off Buffer's own async fetch/transcoding before it finishes.
export async function uploadToTikTokViaBuffer(auth, { fileId, caption }) {
  if (!config.bufferAccessToken || !config.bufferTikTokProfileId) {
    throw new Error('Buffer is not configured -- set BUFFER_ACCESS_TOKEN and BUFFER_TIKTOK_PROFILE_ID in .env.');
  }

  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create(
    { fileId, requestBody: { role: 'reader', type: 'anyone' } },
    { timeout: 30000 }
  );
  const videoUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  const body = new URLSearchParams();
  body.append('access_token', config.bufferAccessToken);
  body.append('profile_ids[]', config.bufferTikTokProfileId);
  body.append('text', caption);
  body.append('now', 'true');
  body.append('media[video]', videoUrl);
  body.append('channel_data[tiktok][scheduling_type]', 'direct');

  const res = await fetchWithTimeout(
    'https://api.bufferapp.com/1/updates/create.json',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
    60000
  );
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Buffer TikTok post failed: ${data.message || JSON.stringify(data)}`);
  }
  const update = (data.updates || [])[0];
  return { updateId: update && update.id };
}
