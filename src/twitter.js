import fs from 'node:fs';
import crypto from 'node:crypto';
import { FormData, Blob } from 'node-fetch';
import { config } from './config.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

const UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const TWEET_URL = 'https://api.twitter.com/2/tweets';
// Twitter's documented chunk-upload limit is 5MB per APPEND -- stay comfortably under it.
const CHUNK_SIZE = 4 * 1024 * 1024;

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// The v1.1 media-upload and v2 tweet-creation endpoints both still accept
// OAuth 1.0a "user context" auth -- the four static credentials Joe copies
// once from the app's "Keys and tokens" page at developer.x.com (API Key,
// API Key Secret, Access Token, Access Token Secret). No interactive login
// flow needed, unlike Pinterest/TikTok's OAuth2 authorization-code dance.
//
// `signedParams` are the params that actually get included in the OAuth
// signature base string -- per the OAuth1 spec that's the URL's query
// params and any application/x-www-form-urlencoded body params, but NOT a
// multipart/form-data body (the raw video bytes) or a JSON body. Callers
// that send those pass the params separately via `signedParams` instead of
// relying on this to inspect the request body.
function buildAuthHeader(method, url, signedParams = {}) {
  const oauthParams = {
    oauth_consumer_key: config.xApiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: config.xAccessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...signedParams };
  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(
      Object.keys(allParams)
        .sort()
        .map((key) => `${percentEncode(key)}=${percentEncode(String(allParams[key]))}`)
        .join('&')
    ),
  ].join('&');

  const signingKey = `${percentEncode(config.xApiSecret)}&${percentEncode(config.xAccessTokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const header = Object.keys(headerParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
    .join(', ');

  return `OAuth ${header}`;
}

async function initUpload(totalBytes) {
  const params = {
    command: 'INIT',
    media_category: 'tweet_video',
    media_type: 'video/mp4',
    total_bytes: String(totalBytes),
  };
  const res = await fetchWithTimeout(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader('POST', UPLOAD_URL, params),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  }, 30000);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`X media INIT failed: ${data.errors?.[0]?.message || res.status}`);
  }
  return data.media_id_string;
}

async function appendChunk(mediaId, chunk, segmentIndex) {
  // command/media_id/segment_index go on the URL (and get signed) -- the
  // binary itself goes in the multipart body, which OAuth1 explicitly
  // excludes from the signature base string.
  const url = `${UPLOAD_URL}?command=APPEND&media_id=${mediaId}&segment_index=${segmentIndex}`;
  const authHeader = buildAuthHeader('POST', UPLOAD_URL, {
    command: 'APPEND',
    media_id: mediaId,
    segment_index: String(segmentIndex),
  });

  const form = new FormData();
  form.append('media', new Blob([chunk]));

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: form,
  }, 3 * 60 * 1000);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`X media APPEND (segment ${segmentIndex}) failed: ${res.status} ${text.slice(0, 300)}`);
  }
}

async function finalizeUpload(mediaId) {
  const params = { command: 'FINALIZE', media_id: mediaId };
  const res = await fetchWithTimeout(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader('POST', UPLOAD_URL, params),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  }, 30000);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`X media FINALIZE failed: ${data.errors?.[0]?.message || res.status}`);
  }
  return data;
}

// Video processing on Twitter's side happens after FINALIZE -- posting the
// tweet before it's done fails, so this polls the same way pinterest.js and
// tiktok.js already do for their own async processing steps.
async function waitForProcessing(mediaId, initialCheckAfterSecs = 0) {
  let waitSecs = initialCheckAfterSecs;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (waitSecs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
    }
    const params = { command: 'STATUS', media_id: mediaId };
    const url = `${UPLOAD_URL}?command=STATUS&media_id=${mediaId}`;
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: buildAuthHeader('GET', UPLOAD_URL, params) },
    }, 30000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`X media STATUS check failed: ${data.errors?.[0]?.message || res.status}`);
    }
    const state = data.processing_info?.state;
    if (!state || state === 'succeeded') return;
    if (state === 'failed') {
      throw new Error(`X reported the video failed processing: ${data.processing_info?.error?.message || 'unknown error'}`);
    }
    waitSecs = data.processing_info?.check_after_secs || 3;
  }
  throw new Error('X video processing timed out');
}

async function postTweet(text, mediaId) {
  // A JSON body is excluded from OAuth1 signing (only form-urlencoded body
  // params and query params get signed) -- so only the oauth_* params go
  // into this one's signature base string.
  const authHeader = buildAuthHeader('POST', TWEET_URL, {});
  const res = await fetchWithTimeout(TWEET_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
  }, 30000);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`X tweet creation failed: ${data.detail || data.title || res.status}`);
  }
  return data.data; // includes data.id
}

// Posts a video tweet for a GK_TERMINAL video, mirroring the same
// upload -> poll -> post flow uploadToTikTok()/uploadToPinterest() use.
// Twitter/X caps a tweet's text at 280 characters, so the caption is
// trimmed the same way title gets trimmed for Pinterest.
export async function uploadToTwitter({ filePath, caption }) {
  const buffer = fs.readFileSync(filePath);
  const totalBytes = buffer.length;

  const mediaId = await initUpload(totalBytes);

  const chunkCount = Math.ceil(totalBytes / CHUNK_SIZE);
  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    await appendChunk(mediaId, buffer.subarray(start, end), i);
  }

  const finalizeData = await finalizeUpload(mediaId);
  if (finalizeData.processing_info) {
    await waitForProcessing(mediaId, finalizeData.processing_info.check_after_secs || 3);
  }

  const tweet = await postTweet(caption.slice(0, 280), mediaId);
  return { tweetId: tweet.id };
}
