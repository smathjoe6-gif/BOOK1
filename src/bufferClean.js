import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { bufferGraphQL } from './bufferTikTok.js';
import { bufferInCooldown, isRateLimitError } from './bufferCooldown.js';

// "Clean system" (Joe, 11 Nov 2026): Buffer must not keep old videos. Every post the script creates is
// written to buffer-posts.json. About 10 minutes later each one is looked at (1 API call):
//   status error -> deleted from Buffer (the failure is kept in social-queue-history.json so it is seen);
//   status sent  -> deleted only if BUFFER_CLEAN_SENT=true (default OFF: it is unverified whether deleting a
//                   sent post could also touch the live post on the network; test with ONE video first);
//   anything else after 24 h -> forgotten (left in Buffer, never touched).
// BUFFER_CLEAN=false turns the whole thing off. The GraphQL delete mutation is a best guess from Buffer's
// naming (the MCP connector can delete); if Buffer says it does not exist the cleaner switches itself off and logs why.
const POSTS_PATH = path.join(process.cwd(), 'buffer-posts.json');
const HISTORY_PATH = path.join(process.cwd(), 'social-queue-history.json');
const MIN_AGE_MS = 10 * 60 * 1000;
const MAX_PER_RUN = 6;
let disabledReason = '';
let lastRun = 0;

const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

export function recordBufferPost({ postId, service, name }) {
  if (!postId || process.env.BUFFER_CLEAN === 'false') return;
  const list = read(POSTS_PATH, []);
  list.push({ postId, service, name: name || '', createdAt: Date.now() });
  fs.writeFileSync(POSTS_PATH, JSON.stringify(list.slice(-300), null, 2));
}

export async function cleanBufferPosts() {
  if (process.env.BUFFER_CLEAN === 'false' || disabledReason) return;
  if (Date.now() - lastRun < MIN_AGE_MS) return;
  lastRun = Date.now();
  if (bufferInCooldown()) return;
  const cleanSent = process.env.BUFFER_CLEAN_SENT === 'true';
  const list = read(POSTS_PATH, []);
  const due = list.filter((p) => Date.now() - p.createdAt >= MIN_AGE_MS).slice(0, MAX_PER_RUN);
  if (!due.length) return;
  const done = new Set();
  for (const p of due) {
    try {
      const { post } = await bufferGraphQL('query P($input: PostInput!) { post(input: $input) { status error { message } } }', { input: { id: p.postId } });
      if (!post) { done.add(p.postId); continue; }
      let remove = false;
      if (post.status === 'error') {
        remove = true;
        const history = read(HISTORY_PATH, []);
        history.unshift({ name: p.name, at: Date.now(), results: { [p.service]: `rejected later: ${String((post.error && post.error.message) || 'error').slice(0, 80)} (deleted from Buffer)` } });
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(0, 15), null, 2));
      } else if (post.status === 'sent') {
        remove = cleanSent;
        if (!cleanSent) done.add(p.postId);
      } else if (Date.now() - p.createdAt > 24 * 3600 * 1000) {
        done.add(p.postId);
      }
      if (remove) {
        await bufferGraphQL('mutation D($input: DeletePostInput!) { deletePost(input: $input) { __typename } }', { input: { id: p.postId } });
        console.log(`Buffer clean: deleted ${p.service} post for "${p.name}" (${post.status}).`);
        done.add(p.postId);
      }
    } catch (err) {
      if (isRateLimitError(err)) break;
      if (/Cannot query|Unknown type|not defined|Unknown argument/i.test(err.message)) {
        disabledReason = err.message.slice(0, 160);
        console.error(`Buffer clean: switched off for this run (${disabledReason}). Delete failed posts by hand or ask Claude.`);
        break;
      }
      console.error(`Buffer clean: could not handle ${p.service} post for "${p.name}" (will retry):`, err.message);
    }
  }
  fs.writeFileSync(POSTS_PATH, JSON.stringify(list.filter((p) => !done.has(p.postId)), null, 2));
}
