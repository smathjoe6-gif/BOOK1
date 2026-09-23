import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { uploadToTikTokViaBuffer } from './bufferTikTok.js';

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

export function queueTikTok({ fileId, name, caption }) {
  const state = loadState();
  if (state.queue.some((item) => item.fileId === fileId)) return;
  state.queue.push({ fileId, name, caption, attempts: 0 });
  saveState(state);
  console.log(`TikTok: queued "${name}" (${state.queue.length} waiting, ${state.postedToday}/${config.tiktokDailyLimit} posted today).`);
}

// Sends the oldest queued video to Buffer, if today's limit allows. Safe to
// call every cycle -- does nothing when the queue is empty.
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

  const item = state.queue[0];
  console.log(`Posting to TikTok via Buffer: "${item.name}"...`);
  try {
    const tk = await uploadToTikTokViaBuffer(auth, { fileId: item.fileId, caption: item.caption });
    state.queue.shift();
    state.postedToday += 1;
    state.lastPostedAt = Date.now();
    console.log(`TikTok (via Buffer): posted, update id ${tk.updateId} (${state.postedToday}/${config.tiktokDailyLimit} today, ${state.queue.length} still waiting).`);
  } catch (err) {
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts >= MAX_ATTEMPTS) {
      state.queue.shift();
      console.error(`TikTok (via Buffer) failed ${item.attempts} times for "${item.name}" -- dropping it from the queue: ${err.message}`);
    } else {
      console.error(`TikTok (via Buffer) upload failed for "${item.name}" (will retry next cycle): ${err.message}`);
    }
  }
  saveState(state);
}
