import fs from 'node:fs';
import path from 'node:path';

// Buffer's API allows ~250 calls per 24 h ("Too many requests from this
// client" once it is used up). On 3-4 Oct 2026, after ~25 videos in a day, every
// Buffer call started failing at 23:52 and each failure burned one of a post's
// 3 attempts -- so posts to Instagram/Facebook/Pinterest/X and TikTok were being
// dropped for no fault of their own. Now the first rate-limit answer starts a
// cooldown: nothing calls Buffer until it ends, and a rate-limited post keeps
// its attempts and simply waits.
const PATH = path.join(process.cwd(), 'buffer-cooldown.json');
export const COOLDOWN_MINUTES = 45;

export class BufferRateLimitError extends Error {}

export function isRateLimitError(err) {
  return err instanceof BufferRateLimitError || /too many requests|rate limit|\b429\b/i.test((err && err.message) || '');
}

export function bufferCooldownUntil() {
  try {
    return JSON.parse(fs.readFileSync(PATH, 'utf8')).until || 0;
  } catch {
    return 0;
  }
}

export const bufferInCooldown = () => Date.now() < bufferCooldownUntil();

export function startBufferCooldown(minutes = COOLDOWN_MINUTES) {
  const until = Date.now() + minutes * 60 * 1000;
  fs.writeFileSync(PATH, JSON.stringify({ until, at: new Date().toISOString() }));
  return until;
}
