import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fetch from 'node-fetch';
import { config } from './config.js';

const OMNIROUTE_VIDEO_URL = 'http://localhost:20128/v1/videos/generations';

// OmniRoute's own docs don't pin down this provider's exact response shape,
// so (like grokVideo.js) this checks every field name video-gen APIs tend to
// use and logs the raw JSON if none match, so the right one can be added.
function extractVideoUrl(data) {
  return (
    data.video_url ||
    data.url ||
    data.data?.[0]?.url ||
    data.data?.[0]?.video_url ||
    data.data?.[0]?.b64_json ||
    data.output?.url ||
    data.result?.url ||
    null
  );
}

// Generates a short video with OmniRoute's free "Veo AI Free" provider and
// saves it to a temp file, returning the local path. Free and requires no
// API key, but its terms of service prohibit automated/scripted use -- see
// docs/reference/PROVIDER_REFERENCE.md and FREE_TIERS.md in the OmniRoute
// repo. It may also get silently rate-limited or blocked if the upstream
// site detects bot traffic; if that starts happening, switch autoGenerate.js
// back to grokVideo.js (paid, but not against xAI's terms to automate).
export async function generateVideo(prompt) {
  const res = await fetch(OMNIROUTE_VIDEO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.omnirouteApiKey ? { Authorization: `Bearer ${config.omnirouteApiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.omnirouteVideoModel,
      prompt,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Veo AI Free video request failed: ${data.error?.message || res.status}`);
  }

  const videoUrl = extractVideoUrl(data);
  if (!videoUrl) {
    throw new Error(`Veo AI Free finished but no video URL was found in the response: ${JSON.stringify(data)}`);
  }

  const destPath = path.join(os.tmpdir(), `gk-veo-${Date.now()}.mp4`);
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Could not download the generated video: ${videoRes.status}`);
  }
  const dest = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    videoRes.body.pipe(dest).on('finish', resolve).on('error', reject);
  });

  return destPath;
}
