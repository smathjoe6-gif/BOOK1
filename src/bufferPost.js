import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './config.js';
import { bufferGraphQL } from './bufferTikTok.js';
import { bufferInCooldown, bufferCooldownUntil, isRateLimitError } from './bufferCooldown.js';

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

function metadataFor(service, title, firstComment) {
  // firstComment = the engagement question Buffer posts as the first comment
  // under the video (Instagram + Facebook support it).
  const comment = firstComment ? { firstComment } : {};
  if (service === 'instagram') {
    return { instagram: { type: config.bufferInstagramType, shouldShareToFeed: true, ...comment } };
  }
  if (service === 'facebook') {
    return { facebook: { type: config.bufferFacebookType, ...comment } };
  }
  if (service === 'pinterest') {
    if (!config.bufferPinterestBoardId) {
      throw new Error('Pinterest needs BUFFER_PINTEREST_BOARD_ID in .env (run "npm run buffer-channels" to see board ids).');
    }
    return { pinterest: { boardServiceId: config.bufferPinterestBoardId, title: String(title || '').slice(0, 100) } };
  }
  return undefined;
}

// Pinterest and X have no "first comment" in Buffer's API, so for them the
// engagement question goes into the post text itself (first on X, where the
// text is cut at ~270 characters; last in the Pinterest description).
function textFor(service, caption, firstComment) {
  if (service === 'twitter') {
    const text = firstComment ? `${firstComment}\n\n${caption}` : caption;
    return text.length > 270 ? `${text.slice(0, 267)}...` : text;
  }
  if (service === 'pinterest' && firstComment) return `${caption}\n\n${firstComment}`;
  return caption;
}

class DailyLimitError extends Error {}

// A network's OWN daily limit (Pinterest: "The daily posting limit for this
// channel has been reached") is only visible AFTER Buffer accepted a post and
// the network rejected it, so Buffer's dailyPostingLimits check can't see it.
// On 9 Oct 2026 the old code answered every such rejection by posting the
// video again -- each retry left another failed copy in Buffer's queue (37 of
// them) and burned Buffer's ~250 API calls/day until everything stalled. Now
// the first "daily limit" rejection blocks that network for the rest of the
// day: new posts wait (no failed copies, no API calls) and go out tomorrow.
const DAY_BLOCK_PATH = path.join(process.cwd(), 'buffer-day-block.json');
function dayKey() {
  return new Date().toLocaleDateString('en-CA');
}
function loadDayBlock() {
  try { return JSON.parse(fs.readFileSync(DAY_BLOCK_PATH, 'utf8')); } catch { return {}; }
}
function blockServiceToday(service) {
  const block = loadDayBlock();
  block[service] = dayKey();
  fs.writeFileSync(DAY_BLOCK_PATH, JSON.stringify(block, null, 2));
}
function serviceBlockedToday(service) {
  return loadDayBlock()[service] === dayKey();
}
const isNetworkDailyLimit = (message) => /daily posting limit/i.test(message || '');

// Buffer reports, per channel, whether today's posting limit is used up
// (dailyPostingLimits in its GraphQL schema). Checking first means a busy day
// WAITS instead of failing and burning retry attempts.
const limitCheckedAt = {};
async function assertUnderDailyLimit(channelId, service) {
  // Checked at most every 30 min per network: each check is one of Buffer's
  // ~250 daily API calls.
  if (Date.now() - (limitCheckedAt[service] || 0) < 30 * 60 * 1000) return;
  try {
    const { dailyPostingLimits } = await bufferGraphQL(
      'query L($input: DailyPostingLimitsInput!) { dailyPostingLimits(input: $input) { channelId isAtLimit limit sent scheduled } }',
      { input: { channelIds: [channelId] } }
    );
    const status = (dailyPostingLimits || [])[0];
    if (status && status.isAtLimit) {
      throw new DailyLimitError(`${service} is at its daily posting limit (${status.sent} sent, limit ${status.limit}) -- waiting until tomorrow.`);
    }
    limitCheckedAt[service] = Date.now();
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    // The limit check itself failing must never block posting.
  }
}

async function postToService(service, { videoUrl, title, caption, firstComment, coverUrl }, withComment = true, withCover = true) {
  if (serviceBlockedToday(service)) {
    throw new DailyLimitError(`${service} said its daily posting limit is reached -- waiting until tomorrow.`);
  }
  const channels = (await listBufferChannels()).filter((c) => String(c.service).toLowerCase() === service);
  if (channels.length === 0) throw new Error(`No ${service} channel connected in Buffer.`);
  await assertUnderDailyLimit(channels[0].id, service);
  const input = {
    channelId: channels[0].id,
    text: textFor(service, caption, firstComment),
    schedulingType: 'automatic',
    mode: config.bufferPostMode,
    // Pinterest shows the video's cover image: pass ours as the thumbnail
    // (Buffer's VideoAssetInput.thumbnailUrl) instead of a random frame.
    assets: [{ video: service === 'pinterest' && coverUrl && withCover ? { url: videoUrl, thumbnailUrl: coverUrl } : { url: videoUrl } }],
  };
  const metadata = metadataFor(service, title, withComment ? firstComment : '');
  if (metadata) input.metadata = metadata;
  let result;
  try {
    result = (await bufferGraphQL(CREATE_POST, { input })).createPost;
  } catch (err) {
    // The first comment is a bonus: if Buffer refuses it, post without it.
    if (firstComment && withComment && /comment/i.test(err.message)) {
      return postToService(service, { videoUrl, title, caption, firstComment, coverUrl }, false, withCover);
    }
    if (coverUrl && withCover && /thumbnail|cover/i.test(err.message)) {
      return postToService(service, { videoUrl, title, caption, firstComment, coverUrl }, withComment, false);
    }
    throw err;
  }
  if (!result || !result.post) {
    const message = (result && result.message) || JSON.stringify(result);
    if (firstComment && withComment && /comment/i.test(message)) {
      return postToService(service, { videoUrl, title, caption, firstComment, coverUrl }, false, withCover);
    }
    if (coverUrl && withCover && /thumbnail|cover/i.test(message)) {
      return postToService(service, { videoUrl, title, caption, firstComment, coverUrl }, withComment, false);
    }
    throw new Error(message);
  }
  return result.post.id;
}

function loadRetries() {
  try { return JSON.parse(fs.readFileSync(RETRY_PATH, 'utf8')); } catch { return []; }
}
function saveRetries(list) {
  fs.writeFileSync(RETRY_PATH, JSON.stringify(list, null, 2));
}

// Buffer accepts a post first and the network (Pinterest especially) can still
// reject it a minute later -- status "error" in Buffer while the script's log
// says "posted". Every accepted post is therefore checked again a few minutes
// later (buffer-verify.json); if it ended in error it is posted again, up to
// MAX_REDO times (3 Oct 2026: Pinterest said "this site doesn't allow pins to
// be saved" on first try, then accepted the identical retry).
const VERIFY_PATH = path.join(process.cwd(), 'buffer-verify.json');
const MAX_REDO = 2;
function loadVerify() {
  try { return JSON.parse(fs.readFileSync(VERIFY_PATH, 'utf8')); } catch { return []; }
}
function saveVerify(list) {
  fs.writeFileSync(VERIFY_PATH, JSON.stringify(list, null, 2));
}
function addVerify(postId, item, redo = 0) {
  // Only networks that really reject posts after accepting them (Pinterest) are
  // re-checked; every check costs one Buffer API call.
  const verifyServices = (process.env.BUFFER_VERIFY_SERVICES || 'pinterest').split(',').map((x) => x.trim().toLowerCase());
  if (!verifyServices.includes(item.service)) return;
  const list = loadVerify();
  list.push({ postId, service: item.service, fileId: item.fileId, name: item.name, title: item.title, caption: item.caption, firstComment: item.firstComment, coverUrl: item.coverUrl, redo, checks: 0, dueAt: Date.now() + 3 * 60 * 1000 });
  saveVerify(list);
}

async function verifyDueBufferPosts() {
  const list = loadVerify();
  const due = list.filter((v) => v.dueAt <= Date.now()).slice(0, 3);
  if (due.length === 0) return;
  let retries = null;
  for (const v of due) {
    let status = '';
    let message = '';
    try {
      const { post } = await bufferGraphQL('query P($input: PostInput!) { post(input: $input) { status error { message } } }', { input: { id: v.postId } });
      status = post && post.status;
      message = post && post.error && post.error.message;
    } catch (err) {
      console.error(`Buffer: could not check post ${v.postId}:`, err.message);
      v.dueAt = Date.now() + 5 * 60 * 1000;
      continue;
    }
    if (status === 'error') {
      list.splice(list.indexOf(v), 1);
      if (isNetworkDailyLimit(message)) {
        // Posting again today can only fail again (and add another failed copy
        // to Buffer's queue): block the network for today, retry tomorrow.
        blockServiceToday(v.service);
        retries = retries || loadRetries();
        retries.push({ ...v, attempts: 0, queuedAt: Date.now() });
        console.error(`Buffer ${v.service}: "${v.name}" was rejected (daily posting limit reached) -- NOT posting again today; it goes out tomorrow. Delete the failed copy in Buffer by hand.`);
      } else if (v.redo < MAX_REDO) {
        retries = retries || loadRetries();
        retries.push({ ...v, attempts: 0, queuedAt: Date.now() });
        console.error(`Buffer ${v.service}: "${v.name}" was rejected after posting (${message || 'no reason given'}) -- posting it again (${v.redo + 1}/${MAX_REDO}).`);
      } else {
        console.error(`Buffer ${v.service}: "${v.name}" was rejected again (${message || 'no reason given'}) -- giving up; delete the failed post in Buffer and post it by hand if you want it there.`);
      }
    } else if (status === 'sent' || (v.checks || 0) >= 5) {
      list.splice(list.indexOf(v), 1);
    } else {
      v.checks = (v.checks || 0) + 1;
      v.dueAt = Date.now() + 3 * 60 * 1000;
    }
  }
  saveVerify(list);
  if (retries) saveRetries(retries);
}

async function publicUrl(auth, fileId) {
  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } }, { timeout: 30000 });
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Each network is independent: one failing is queued for a retry on its own
// and never re-posts the networks that already worked (no duplicates).
//
// Every network is written to buffer-retry.json BEFORE anything is posted and
// removed only once it succeeds. So if the script is stopped or restarted
// halfway (3 Oct 2026: three restarts in an hour re-posted one video to
// Instagram 3x), the networks not yet done simply resume from the queue and
// the ones already done are never repeated.
export async function postToBuffer(auth, { fileId, name, title, caption, firstComment = '', coverUrl = '' }) {
  const videoUrl = await publicUrl(auth, fileId);
  const services = bufferServices();
  const base = { fileId, name, title, caption, firstComment, coverUrl, attempts: 0, queuedAt: Date.now() };
  const pending = loadRetries().filter((r) => !(r.fileId === fileId && services.includes(r.service)));
  saveRetries([...pending, ...services.map((service) => ({ ...base, service }))]);

  const update = (service, change) => {
    const list = loadRetries();
    const idx = list.findIndex((r) => r.fileId === fileId && r.service === service);
    if (idx === -1) return;
    if (change === null) list.splice(idx, 1);
    else list[idx] = { ...list[idx], ...change };
    saveRetries(list);
  };

  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    // One network at a time, with a pause between them (BUFFER_GAP_SECONDS,
    // default 60) so the five platforms never all get hit in the same second.
    if (i > 0 && config.bufferGapSeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.bufferGapSeconds * 1000));
    }
    try {
      const id = await postToService(service, { videoUrl, title, caption, firstComment, coverUrl });
      update(service, null);
      addVerify(id, { service, fileId, name, title, caption, firstComment, coverUrl });
      console.log(`Buffer ${service}: posted (${id}).`);
    } catch (err) {
      const waiting = err instanceof DailyLimitError || isRateLimitError(err);
      console.error(`Buffer ${service} ${waiting ? 'waiting' : `failed (will retry up to ${MAX_ATTEMPTS} times)`}:`, err.message);
      update(service, { attempts: waiting ? 0 : 1 });
      // Rate limited: the other networks would fail too -- leave them queued.
      if (isRateLimitError(err)) break;
    }
  }
}

// One network only, right now, no retry queue -- used by `npm run facebook-redo`
// to re-send a video to just Facebook (its other networks already posted).
export async function postOneServiceNow(auth, service, { fileId, name, title, caption, firstComment = '', coverUrl = '' }) {
  if (bufferInCooldown()) {
    throw new Error(`Buffer is cooling down after hitting its API limit until ${new Date(bufferCooldownUntil()).toLocaleTimeString()} -- try again after that.`);
  }
  const videoUrl = await publicUrl(auth, fileId);
  const id = await postToService(service, { videoUrl, title, caption, firstComment, coverUrl });
  addVerify(id, { service, fileId, name, title, caption, firstComment, coverUrl });
  return id;
}

// One retry per cycle at most, so a broken connection can't hammer the API.
export async function retryFailedBufferPosts(auth) {
  if (bufferInCooldown()) {
    console.log(`Buffer: cooling down after hitting its API limit until ${new Date(bufferCooldownUntil()).toLocaleTimeString()} -- queued posts wait.`);
    return;
  }
  try {
    await verifyDueBufferPosts();
  } catch (err) {
    console.error('Buffer post check failed (will retry next cycle):', err.message);
  }
  const retries = loadRetries();
  if (retries.length === 0) return;
  const item = retries.shift();
  try {
    const videoUrl = await publicUrl(auth, item.fileId);
    const id = await postToService(item.service, { videoUrl, title: item.title, caption: item.caption, firstComment: item.firstComment, coverUrl: item.coverUrl });
    addVerify(id, item, (item.redo || 0) + (item.postId ? 1 : 0));
    console.log(`Buffer ${item.service}: retry posted "${item.name}" (${id}).`);
  } catch (err) {
    if (err instanceof DailyLimitError) {
      // Not a failure: keep waiting for a day with room, up to 3 days.
      if (Date.now() - (item.queuedAt || 0) < 3 * 24 * 3600 * 1000) retries.push(item);
      else console.error(`Buffer ${item.service}: gave up waiting for room to post "${item.name}".`);
      saveRetries(retries);
      return;
    }
    if (isRateLimitError(err)) {
      // Not the post's fault: keep it (and its attempts) for after the cooldown.
      retries.push(item);
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
