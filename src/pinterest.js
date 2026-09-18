import fs from 'node:fs';
import { FormData, Blob } from 'node-fetch';
import { config } from './config.js';
import { loadPinterestToken, savePinterestToken } from './pinterestAuth.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

const API_BASE = 'https://api.pinterest.com/v5';

async function refreshAccessToken(refreshToken) {
  const basic = Buffer.from(`${config.pinterestClientId}:${config.pinterestClientSecret}`).toString('base64');
  const res = await fetchWithTimeout(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Pinterest token refresh failed: ${data.message || data.error || res.status}`);
  }
  const withRefresh = { ...data, refresh_token: data.refresh_token || refreshToken, obtained_at: Date.now() };
  savePinterestToken(withRefresh);
  return withRefresh.access_token;
}

async function getAccessToken() {
  const stored = loadPinterestToken();
  if (!stored) {
    throw new Error('Not logged in to Pinterest yet. Run "node src/pinterestAuth.js" first.');
  }
  const ageSeconds = (Date.now() - stored.obtained_at) / 1000;
  if (ageSeconds < (stored.expires_in || 0) - 60) {
    return stored.access_token;
  }
  return refreshAccessToken(stored.refresh_token);
}

async function pollMediaStatus(accessToken, mediaId) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetchWithTimeout(`${API_BASE}/media/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Pinterest media status check failed: ${data.message || res.status}`);
    }
    if (data.status === 'succeeded') return;
    if (data.status === 'failed') {
      throw new Error('Pinterest reported the video failed processing');
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('Pinterest video processing timed out after 90 seconds');
}

// Posts a video pin for a GK_TERMINAL video, mirroring the same
// register -> upload -> poll -> create-pin flow the Make.com scenario uses
// for GK_JING videos. coverImageUrl is optional -- Pinterest auto-generates
// a thumbnail from the video if it's left out.
export async function uploadToPinterest({ filePath, title, description, coverImageUrl }) {
  const accessToken = await getAccessToken();

  const initRes = await fetchWithTimeout(`${API_BASE}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ media_type: 'video' }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) {
    throw new Error(`Pinterest media registration failed: ${initData.message || initRes.status}`);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(initData.upload_parameters)) {
    form.append(key, value);
  }
  form.append('file', new Blob([fs.readFileSync(filePath)]), 'video.mp4');

  const uploadRes = await fetchWithTimeout(initData.upload_url, { method: 'POST', body: form }, 3 * 60 * 1000);
  if (!uploadRes.ok) {
    throw new Error(`Pinterest video upload failed: ${uploadRes.status}`);
  }

  await pollMediaStatus(accessToken, initData.media_id);

  const mediaSource = { source_type: 'video_id', media_id: initData.media_id };
  if (coverImageUrl) mediaSource.cover_image_url = coverImageUrl;

  const pinRes = await fetchWithTimeout(`${API_BASE}/pins`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      board_id: config.pinterestBoardId,
      title: title.slice(0, 100),
      description,
      media_source: mediaSource,
    }),
  });
  const pinData = await pinRes.json();
  if (!pinRes.ok) {
    throw new Error(`Pinterest pin creation failed: ${pinData.message || pinRes.status}`);
  }

  return pinData; // includes pinData.id
}
