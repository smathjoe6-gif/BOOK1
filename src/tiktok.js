import fs from 'node:fs';
import fetch from 'node-fetch';
import { config } from './config.js';
import { loadTikTokToken, saveTikTokToken } from './tiktokAuth.js';

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: config.tiktokClientKey,
      client_secret: config.tiktokClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`TikTok token refresh failed: ${data.error_description || data.error}`);
  }
  saveTikTokToken(data);
  return data.access_token;
}

async function getAccessToken() {
  const token = loadTikTokToken();
  if (!token) {
    throw new Error('Not logged in to TikTok yet. Run "node src/tiktokAuth.js" first.');
  }
  // TikTok access tokens are short-lived, so we always refresh before use.
  return refreshAccessToken(token.refresh_token);
}

// TikTok requires this call before every post — it returns the creator's
// current interaction settings (which privacy levels they're allowed to post
// with, and whether they've turned off duet/comment/stitch). Posting without
// checking this first, or posting with settings it doesn't allow, is exactly
// what triggers the "review our integration guidelines" error.
async function queryCreatorInfo(accessToken) {
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  });
  const data = await res.json();
  if (data.error && data.error.code !== 'ok') {
    throw new Error(`TikTok creator info query failed [${data.error.code}]: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data.data;
}

// TikTok allows a whole video up to 64MB to go up as a single chunk (chunk_size
// equal to the exact video size). Only videos bigger than that need to be
// split into multiple 64MB chunks (the last one holding the remainder).
const MAX_CHUNK_SIZE = 64 * 1024 * 1024;

function planChunks(videoSize) {
  if (videoSize <= MAX_CHUNK_SIZE) {
    return { chunkSize: videoSize, chunkCount: 1 };
  }
  const chunkCount = Math.ceil(videoSize / MAX_CHUNK_SIZE);
  return { chunkSize: MAX_CHUNK_SIZE, chunkCount };
}

// Posts a video directly to the TikTok account that logged in via tiktokAuth.js.
// privacyLevel is only a preference — if the creator's account doesn't allow
// it (per queryCreatorInfo), we fall back to whatever they do allow.
export async function uploadToTikTok({ filePath, caption, privacyLevel = 'SELF_ONLY' }) {
  const accessToken = await getAccessToken();
  const stats = fs.statSync(filePath);
  const videoSize = stats.size;
  const { chunkSize, chunkCount } = planChunks(videoSize);

  const creatorInfo = await queryCreatorInfo(accessToken);
  const allowedPrivacyLevels = creatorInfo.privacy_level_options || [];
  // TikTok requires unaudited apps (sandbox client keys are always unaudited)
  // to post as SELF_ONLY no matter what the creator's account otherwise
  // allows -- posting any wider visibility is exactly what triggers the
  // "review our integration guidelines" rejection.
  const resolvedPrivacyLevel = config.tiktokUseSandbox
    ? 'SELF_ONLY'
    : (allowedPrivacyLevels.includes(privacyLevel) ? privacyLevel : (allowedPrivacyLevels[0] || privacyLevel));

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: resolvedPrivacyLevel,
        // Can only disable an interaction the creator hasn't already disabled
        // themselves — TikTok rejects the post if we try to re-enable one.
        disable_duet: Boolean(creatorInfo.duet_disabled),
        disable_comment: Boolean(creatorInfo.comment_disabled),
        disable_stitch: Boolean(creatorInfo.stitch_disabled),
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: chunkCount,
      },
    }),
  });
  const initData = await initRes.json();
  if (initData.error && initData.error.code !== 'ok') {
    throw new Error(`TikTok init failed [${initData.error.code}]: ${initData.error.message || JSON.stringify(initData.error)}`);
  }

  const { publish_id, upload_url } = initData.data;

  const fileBuffer = fs.readFileSync(filePath);
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, videoSize) - 1;
    const chunk = fileBuffer.subarray(start, end + 1);
    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      },
      body: chunk,
    });
    if (!uploadRes.ok) {
      throw new Error(`TikTok video upload failed on chunk ${i + 1}/${chunkCount}: ${uploadRes.status}`);
    }
  }

  return { publishId: publish_id };
}
