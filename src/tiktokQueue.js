import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { uploadToTikTokViaBuffer } from './bufferTikTok.js';
import { bufferInCooldown, isRateLimitError } from './bufferCooldown.js';

// TikTok caps how many videos one account may publish through the API in a
// day. On 23 Sep 2026 ~30 videos went to Buffer within 24 hours; Buffer
// accepted every one (so the log said "posted"), but TikTok then rejected
// the last ~12 with "TikTok has detected a large number of posts published
// through the API for this channel. Wait 24 hours before trying to publish
// again." So TikTok posts now go through this queue: every video that
// finishes on YouTube is added here, and at most TIKTOK_DAILY_LIMIT are sent
// to Buffer per day (one per check cycle). Anything over the limit simply
// waits for tomorrow instead of being thrown away by TikTok. The Drive file
// keeps its id after moving to the DONE folder and stays link-public, so
// Buffer can still fetch it days later.
const QUEUE_PATH = path.join(process.cwd(), 'tiktok-queue.json');
const MAX_ATTEMPTS = 3;

// The Mac's local date, so the daily count resets at local midnight.
function todayKey() {
  return new Date().toLocaleDateString('en-CA');
}

function loadState() {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  } catch {
    state = {};
  }
  if (!Array.isArray(state.queue)) state.queue = [];
  if (state.date !== todayKey()) {
    state.date = todayKey();
    state.postedToday = 0;
  }
  return state;
}

function saveState(state) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(state, null, 2));
}

// One video, one TikTok post. A video is identified by its content hash (md5)
// when known, else its file name -- NOT by Drive file id alone, because the
// 9:16 copy made for Buffer gets a brand-new Drive id every time, so the same
// video could otherwise be queued (and posted) again under a different id.
// Every video sent is remembered in `sent` (last SENT_MEMORY) so it can never
// go to TikTok twice, even across restarts or a re-queue.
const SENT_MEMORY = 1000;
function videoKey({ md5, name }) {
  return md5 ? `md5:${md5}` : `name:${name}`;
}

export function queueTikTok({ fileId, name, caption, md5 }) {
  const state = loadState();
  const key = videoKey({ md5, name });
  if (state.queue.some((item) => item.fileId === fileId || item.key === key)) return;
  if ((state.sent || []).includes(key)) {
    console.log(`TikTok: "${name}" was already sent to TikTok -- not queuing it again.`);
    return;
  }
  state.queue.push({ fileId, name, caption, key, attempts: 0 });
  saveState(state);
  console.log(`TikTok: queued "${name}" (${state.queue.length} waiting, ${state.postedToday}/${config.tiktokDailyLimit} posted today).`);
}

// Sends one queued video to Buffer, if today's limit allows. NEWEST first by
// default (TIKTOK_ORDER=oldest for the old behaviour): a video Joe just
// dropped goes to TikTok within the daily cap instead of waiting behind a
// backlog of dozens (3 Oct 2026: new videos reached IG/FB/Pinterest/X at once
// while TikTok kept posting week-old ones). The backlog drains in the
// leftover slots. Safe to call every cycle -- does nothing when the queue is
// empty.
export async function postNextQueuedTikTok(auth) {
  const state = loadState();
  if (state.queue.length === 0) return;

  // TikTok's "Wait 24 hours" block: Buffer still accepts posts during it,
  // but TikTok rejects every one (and may extend the block), so hold the
  // queue until TIKTOK_PAUSE_UNTIL has passed. Videos keep queuing meanwhile.
  if (config.tiktokPauseUntil && Date.now() < config.tiktokPauseUntil.getTime()) {
    console.log(`TikTok: paused until ${config.tiktokPauseUntil.toLocaleString()} (TikTok's 24h block) -- ${state.queue.length} video(s) waiting.`);
    return;
  }

  // Buffer's API limit was hit: wait, keep every video (and its attempts).
  if (bufferInCooldown()) return;

  // Spread posts out: TikTok flags bursts of API posts, not just the total.
  const minGapMs = config.tiktokMinGapMinutes * 60 * 1000;
  if (state.lastPostedAt && Date.now() - state.lastPostedAt < minGapMs) {
    return;
  }

  if (state.postedToday >= config.tiktokDailyLimit) {
    console.log(`TikTok: today's limit reached (${config.tiktokDailyLimit}/day) -- ${state.queue.length} video(s) waiting for tomorrow.`);
    saveState(state);
    return;
  }

  // A video marked `sending` was being handed to Buffer when the script was
  // stopped/restarted -- nobody knows if Buffer accepted it. Re-sending it is
  // exactly how the same video used to appear on TikTok again and again, so
  // drop it and ask Joe to check instead of risking a duplicate.
  const interrupted = state.queue.filter((q) => q.sending);
  if (interrupted.length) {
    for (const q of interrupted) {
      console.error(`TikTok: "${q.name}" was interrupted mid-send last time -- NOT sending it again (check Buffer/TikTok; post by hand if it is missing).`);
      state.sent = [...(state.sent || []), q.key || videoKey({ name: q.name })].slice(-SENT_MEMORY);
    }
    state.queue = state.queue.filter((q) => !q.sending);
    saveState(state);
    if (state.queue.length === 0) return;
  }

  const newestFirst = config.tiktokOrder !== 'oldest';
  const item = newestFirst ? state.queue[state.queue.length - 1] : state.queue[0];
  const removeItem = () => (newestFirst ? state.queue.pop() : state.queue.shift());
  console.log(`Posting to TikTok via Buffer: "${item.name}"...`);
  // Written to disk BEFORE calling Buffer (see "interrupted" above).
  item.sending = true;
  saveState(state);
  try {
    const tk = await uploadToTikTokViaBuffer(auth, { fileId: item.fileId, caption: item.caption });
    removeItem();
    state.sent = [...(state.sent || []), item.key || videoKey({ name: item.name })].slice(-SENT_MEMORY);
    state.postedToday += 1;
    state.lastPostedAt = Date.now();
    console.log(`TikTok (via Buffer): posted, update id ${tk.updateId} (${state.postedToday}/${config.tiktokDailyLimit} today, ${state.queue.length} still waiting).`);
  } catch (err) {
    // Buffer answered with an error, so nothing was posted: safe to retry.
    delete item.sending;
    // TikTok switched off / not connected in Buffer is not the video's fault:
    // keep it queued and don't burn its attempts (3 Oct 2026: ~20 videos were
    // dropped this way while TikTok was disconnected).
    if (/channel not found|no tiktok channel/i.test(err.message)) {
      console.error(`TikTok (via Buffer): no TikTok channel connected in Buffer -- keeping ${state.queue.length} video(s) queued until it is reconnected.`);
      saveState(state);
      return;
    }
    // Rate-limited by Buffer's own API: not this video's fault, keep it.
    if (isRateLimitError(err)) {
      console.error('TikTok (via Buffer): Buffer API limit reached -- keeping the video queued until it recovers.');
      saveState(state);
      return;
    }
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts >= MAX_ATTEMPTS) {
      removeItem();
      console.error(`TikTok (via Buffer) failed ${item.attempts} times for "${item.name}" -- dropping it from the queue: ${err.message}`);
    } else {
      console.error(`TikTok (via Buffer) upload failed for "${item.name}" (will retry next cycle): ${err.message}`);
    }
  }
  saveState(state);
}
