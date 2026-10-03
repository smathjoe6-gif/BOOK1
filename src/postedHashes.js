import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { listAllVideoHashes } from './drive.js';

// Remembers the content fingerprint (Drive's md5Checksum) of every video
// that has been posted, so the SAME video can never be posted twice -- even
// when it shows up again under a different name. That is what happens when
// Joe downloads one Grok video twice: Drive/macOS name the second copy
// "...(1).mp4", and until now it was treated as a brand-new video and went to
// YouTube and the TikTok queue a second time (seen 30 Sep - 1 Oct 2026).
//
// A " (1)" name alone is NOT proof of a duplicate (two different Grok videos
// can collide by chance -- see isLikelyDuplicateVariant() in autoCaption.js),
// so this only skips a file whose bytes are identical to one already posted.
const STATE_PATH = path.join(process.cwd(), 'posted-hashes.json');

function load() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { seeded: !!state.seeded, hashes: state.hashes || {} };
  } catch {
    return { seeded: false, hashes: {} };
  }
}

function save(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function isAlreadyPosted(md5) {
  if (!md5) return false;
  return Boolean(load().hashes[md5]);
}

export function rememberPosted(md5, name) {
  if (!md5) return;
  const state = load();
  state.hashes[md5] = { name, at: new Date().toISOString() };
  save(state);
}

// Run once (the first cycle after this feature ships): learns the
// fingerprint of every video already sitting in the DONE folder, so copies of
// videos posted BEFORE this change are caught too.
export async function seedPostedHashes(auth) {
  const state = load();
  if (state.seeded || !config.doneFolderId) return;
  const found = await listAllVideoHashes(auth, config.doneFolderId);
  for (const { name, md5 } of found) {
    if (!state.hashes[md5]) state.hashes[md5] = { name, at: 'seeded' };
  }
  state.seeded = true;
  save(state);
  console.log(`Duplicate guard: learned ${found.length} already-posted video(s) from the DONE folder.`);
}
