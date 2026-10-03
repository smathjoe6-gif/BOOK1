import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './config.js';
import { bufferGraphQL } from './bufferTikTok.js';

// Posts one Drive video to Instagram, Facebook, Pinterest and X through
// Buffer's GraphQL API -- the replacement for Make scenario 9696465 (Oct 2026,
// Joe chose Buffer Essentials, 4 channels). YouTube stays on the Mac script,
// TikTok stays in src/tiktokQueue.js. Nothing here runs unless
// BUFFER_POST_SERVICES is set in .env.
//
// NOTE: the per-network metadata field names/enum values below came from
// Buffer's docs via search snippets (developers.buffer.com is not reachable
// from the cloud). Run `npm run buffer-channels` to check them against the
// live API before relying on it.

const RETRY_PATH = path.join(process.cwd(), 'buffer-retry.json');
const MAX_ATTEMPTS = 3;
const SERVICE_ALIASES = { x: 'twitter', twitter: 'twitter', instagram: 'instagram', facebook: 'facebook', pinterest: 'pinterest' };

export function bufferServices() {
  return config.bufferPostServices
    .split(',')
    .map((s) => SERVICE_ALIASES[s.trim().toLowerCase()])
    .filter(Boolean);
}

export const bufferPostingEnabled = () => Boolean(config.bufferAccessToken) && bufferServices().length > 0;

let channelCache = null;
export async function listBufferChannels() {
  if (channelCache) return channelCache;
  const { account } = await bufferGraphQL('query { account { organizations { id } } }');
  const all = [];
  for (const org of (account && account.organizations) || []) {
    const { channels } = await bufferGraphQL(
      'query GetChannels($input: ChannelsInput!) { channels(input: $input) { id name service } }',
      { input: { organizationId: org.id } }
    );
    all.push(...(channels || []));
  }
  channelCache = all;
  return all;
}

const CREATE_POST = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    }
  }
`;

function metadataFor(service, title) {
  if (service === 'instagram') {
    return { instagram: { type: config.bufferInstagramType, shouldShareToFeed: true } };
  }
  if (service === 'facebook') {
    return { facebook: { type: config.bufferFacebookType } };
  }
  if (service === 'pinterest') {
    if (!config.bufferPinterestBoardId) {
      throw new Error('Pinterest needs BUFFER_PINTEREST_BOARD_ID in .env (run "npm run buffer-channels" to see board ids).');
    }
    return { pinterest: { boardServiceId: config.bufferPinterestBoardId, title: String(title || '').slice(0, 100) } };
  }
  return undefined;
}

function textFor(service, caption) {
  if (service === 'twitter') return caption.length > 270 ? `${caption.slice(0, 267)}...` : caption;
  return caption;
}

class DailyLimitError extends Error {}

// Buffer reports, per channel, whether today's posting limit is used up
// (dailyPostingLimits in its GraphQL schema). Checking first means a busy day
// WAITS instead of failing and burning retry attempts.
async function assertUnderDailyLimit(channelId, service) {
  try {
    const { dailyPostingLimits } = await bufferGraphQL(
      'query L($input: DailyPostingLimitsInput!) { dailyPostingLimits(input: $input) { channelId isAtLimit limit sent scheduled } }',
      { input: { channelIds: [channelId] } }
    );
    const status = (dailyPostingLimits || [])[0];
    if (status && status.isAtLimit) {
      throw new DailyLimitError(`${service} is at its daily posting limit (${status.sent} sent, limit ${status.limit}) -- waiting until tomorrow.`);
    }
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    // The limit check itself failing must never block posting.
  }
}

async function postToService(service, { videoUrl, title, caption }) {
  const channels = (await listBufferChannels()).filter((c) => String(c.service).toLowerCase() === service);
  if (channels.length === 0) throw new Error(`No ${service} channel connected in Buffer.`);
  await assertUnderDailyLimit(channels[0].id, service);
  const input = {
    channelId: channels[0].id,
    text: textFor(service, caption),
    schedulingType: 'automatic',
    mode: config.bufferPostMode,
    assets: [{ video: { url: videoUrl } }],
  };
  const metadata = metadataFor(service, title);
  if (metadata) input.metadata = metadata;
  const { createPost } = await bufferGraphQL(CREATE_POST, { input });
  if (!createPost || !createPost.post) {
    throw new Error((createPost && createPost.message) || JSON.stringify(createPost));
  }
  return createPost.post.id;
}

function loadRetries() {
  try { return JSON.parse(fs.readFileSync(RETRY_PATH, 'utf8')); } catch { return []; }
}
function saveRetries(list) {
  fs.writeFileSync(RETRY_PATH, JSON.stringify(list, null, 2));
}

async function publicUrl(auth, fileId) {
  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } }, { timeout: 30000 });
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Each network is independent: one failing is queued for a retry on its own
// and never re-posts the networks that already worked (no duplicates).
export async function postToBuffer(auth, { fileId, name, title, caption }) {
  const videoUrl = await publicUrl(auth, fileId);
  const retries = loadRetries();
  for (const service of bufferServices()) {
    try {
      const id = await postToService(service, { videoUrl, title, caption });
      console.log(`Buffer ${service}: posted (${id}).`);
    } catch (err) {
      const waiting = err instanceof DailyLimitError;
      console.error(`Buffer ${service} ${waiting ? 'waiting' : `failed (will retry up to ${MAX_ATTEMPTS} times)`}:`, err.message);
      retries.push({ fileId, name, title, caption, service, attempts: waiting ? 0 : 1, queuedAt: Date.now() });
    }
  }
  saveRetries(retries);
}

// One retry per cycle at most, so a broken connection can't hammer the API.
export async function retryFailedBufferPosts(auth) {
  const retries = loadRetries();
  if (retries.length === 0) return;
  const item = retries.shift();
  try {
    const videoUrl = await publicUrl(auth, item.fileId);
    const id = await postToService(item.service, { videoUrl, title: item.title, caption: item.caption });
    console.log(`Buffer ${item.service}: retry posted "${item.name}" (${id}).`);
  } catch (err) {
    if (err instanceof DailyLimitError) {
      // Not a failure: keep waiting for a day with room, up to 3 days.
      if (Date.now() - (item.queuedAt || 0) < 3 * 24 * 3600 * 1000) retries.push(item);
      else console.error(`Buffer ${item.service}: gave up waiting for room to post "${item.name}".`);
      saveRetries(retries);
      return;
    }
    item.attempts += 1;
    if (item.attempts > MAX_ATTEMPTS) {
      console.error(`Buffer ${item.service}: giving up on "${item.name}" after ${MAX_ATTEMPTS} tries:`, err.message);
    } else {
      console.error(`Buffer ${item.service}: retry for "${item.name}" failed (try ${item.attempts}):`, err.message);
      retries.push(item);
    }
  }
  saveRetries(retries);
}
