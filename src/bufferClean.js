import fs from 'node:fs';
import path from 'node:path';
import fs2 from 'node:fs/promises';
import { config } from './config.js';
import { downloadFile, uploadVerticalCopy } from './drive.js';
import { ensureVerticalVideo, run } from './aspectRatio.js';
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

// What did the network say? -> what can be fixed (Joe, 11 Nov 2026: fix it and queue it again, else delete).
export function classifyError(message) {
  const m = String(message || '').toLowerCase();
  if (/thumbnail|cover|poster/.test(m)) return 'cover';
  if (/daily|limit|rate|too many|wait \d+ hour|try again later/.test(m)) return 'wait';
  if (/aspect|height|width|resolution|format|codec|pixel|dimension|960|ratio/.test(m)) return 'shape';
  if (/too long|duration|length|longer|too large|file size|size limit|too big|exceed|timing out|timed out/.test(m)) return 'long';
  return 'other';
}

// Makes a fixed copy in Drive and returns its file id (null = could not fix).
async function makeFixedCopy(auth, p, kind) {
  let local = null;
  try {
    local = await downloadFile(auth, p.fileId, p.name || 'video.mp4');
    let out = local;
    if (kind === 'long') {
      out = local.replace(/(\.[A-Za-z0-9]+)?$/, '') + '-short.mp4';
      await run('ffmpeg', ['-y', '-i', local, '-t', '59', '-vf', 'scale=-2:min(1920\\,ih)', '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
    } else {
      out = await ensureVerticalVideo(local);
    }
    return await uploadVerticalCopy(auth, out, p.name || 'video.mp4');
  } catch (err) {
    console.error(`Buffer clean: could not make a fixed copy of "${p.name}" (${kind}):`, err.message);
    return null;
  } finally {
    if (local) fs2.unlink(local).catch(() => {});
  }
}

function requeue(p, change) {
  if (p.service === 'tiktok') {
    // TikTok has its own queue (daily cap, gaps); take the video out of its 'sent' memory and put it back.
    const qf = path.join(process.cwd(), 'tiktok-queue.json');
    const st = read(qf, { queue: [], sent: [], postedToday: 0 });
    const key = `name:${p.name}`;
    st.sent = (st.sent || []).filter((k) => k !== key);
    st.queue = st.queue || [];
    if (!st.queue.some((q) => q.key === key)) st.queue.push({ fileId: change.fileId || p.fileId, name: p.name, caption: p.caption, key, attempts: 0, queuedAt: Date.now() });
    fs.writeFileSync(qf, JSON.stringify(st, null, 2));
    return;
  }
  const file = path.join(process.cwd(), 'buffer-retry.json');
  const list = read(file, []);
  list.push({ service: p.service === 'x' ? 'twitter' : p.service, fileId: p.fileId, name: p.name, title: p.title, caption: p.caption, firstComment: p.firstComment || '', coverUrl: p.coverUrl || '', attempts: 0, queuedAt: Date.now(), fixes: (p.fixes || 0) + 1, ...change });
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}
let lastRun = 0;

const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

export function recordBufferPost({ postId, service, name, item = {} }) {
  if (!postId || process.env.BUFFER_CLEAN === 'false') return;
  const list = read(POSTS_PATH, []);
  const { fileId, title, caption, firstComment, coverUrl, fixes } = item;
  list.push({ postId, service, name: name || '', createdAt: Date.now(), fileId, title, caption, firstComment, coverUrl, fixes: fixes || 0 });
  fs.writeFileSync(POSTS_PATH, JSON.stringify(list.slice(-300), null, 2));
}

export async function cleanBufferPosts(auth) {
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
        const msg = String((post.error && post.error.message) || 'error');
        const kind = classifyError(msg);
        let action = 'deleted from Buffer';
        // Fix and queue again ONCE per post; the rest is deleted (never loops).
        if (p.fileId && (p.fixes || 0) < 1) {
          if (kind === 'cover') { requeue(p, { coverUrl: '' }); action = 'deleted, queued again without the cover'; }
          else if (kind === 'wait') { requeue(p, {}); action = 'deleted, queued again for later'; }
          else if (kind === 'shape' || kind === 'long') {
            const newId = await makeFixedCopy(auth, p, kind);
            if (newId) { requeue(p, { fileId: newId }); action = `deleted, fixed (${kind === 'long' ? 'shortened/compressed' : 'made 9:16'}) and queued again`; }
          } else if (p.service === 'pinterest') { requeue(p, {}); action = 'deleted, queued again once'; }
        }
        const history = read(HISTORY_PATH, []);
        history.unshift({ name: p.name, at: Date.now(), results: { [p.service]: `rejected later: ${msg.slice(0, 80)} (${action})` } });
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
