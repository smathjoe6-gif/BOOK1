import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { config } from './config.js';

// Joe (18 Oct 2026): older @TotollsportGK uploads got filename-fallback text: lost
// apostrophes ("Berbera S Deep Water") and a description that says "moments that shaped
// football" on non-football videos. This corrects them. DRY RUN by default (before/after);
// --do updates YouTube (videos.update = 50 quota units each, max HISTORY_META_FIX_MAX=25 per run).
//
//   npm run history-metadata                 (show changes, change nothing)
//   npm run history-metadata -- --do
//   npm run history-metadata -- --do --only "Berbera"

const STATE = path.join(process.cwd(), 'history-meta-done.json');
const MAX = Number(process.env.HISTORY_META_FIX_MAX || 25);
const DO = process.argv.includes('--do');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx > 0 ? String(process.argv[onlyIdx + 1] || '').toLowerCase() : '';

const NEUTRAL = "The story behind one of history's great moments, told from start to finish.";

export function fixTitle(title) {
  // "Berbera S Deep" -> "Berbera's Deep"; a lone S after an article ("The S Curve") is left alone.
  return String(title || '').replace(/(\b[A-Za-z0-9]+) S(?= [A-Za-z0-9]|$)/g, (m, w) =>
    /^(the|a|an|of|in|plan|type|vitamin|class)$/i.test(w) ? m : `${w}'s`);
}

export function fixDescription(desc) {
  return String(desc || '').replace(
    /The story behind one of the moments that shaped football and the world, told from start to finish\./g,
    NEUTRAL,
  );
}

function loadDone() {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE, 'utf8')).done || []);
  } catch {
    return new Set();
  }
}

async function main() {
  const yt = google.youtube({ version: 'v3', auth: loadOAuthClient(config.historyTokenFile) });
  const ch = await yt.channels.list({ part: 'contentDetails', mine: true });
  const uploads = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('no uploads playlist found for the history login (run npm run auth-history, pick "Jamal")');
  const ids = [];
  let pageToken;
  do {
    const res = await yt.playlistItems.list({ part: 'snippet', playlistId: uploads, maxResults: 50, pageToken });
    for (const it of res.data.items || []) ids.push(it.snippet.resourceId.videoId);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  const done = loadDone();
  let handled = 0;
  let changes = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const res = await yt.videos.list({ part: 'snippet', id: ids.slice(i, i + 50).join(',') });
    for (const v of res.data.items || []) {
      const sn = v.snippet;
      if (done.has(v.id) || (ONLY && !sn.title.toLowerCase().includes(ONLY))) continue;
      const title = fixTitle(sn.title);
      const description = fixDescription(sn.description);
      if (title === sn.title && description === sn.description) continue;
      changes += 1;
      console.log(`- ${v.id}`);
      if (title !== sn.title) console.log(`  title: "${sn.title}" -> "${title}"`);
      if (description !== sn.description) console.log('  description: football sentence replaced with the neutral one');
      if (!DO) continue;
      if (handled >= MAX) {
        console.log(`  (limit of ${MAX} per run reached; run again for the rest)`);
        continue;
      }
      try {
        // videos.update replaces the whole snippet, so send everything back (tags included).
        await yt.videos.update({
          part: 'snippet',
          requestBody: { id: v.id, snippet: { ...sn, title, description } },
        });
        done.add(v.id);
        fs.writeFileSync(STATE, JSON.stringify({ done: [...done] }, null, 2));
        handled += 1;
        console.log('  updated');
      } catch (err) {
        console.log(`  could not update: ${String(err.message).slice(0, 200)}`);
      }
    }
  }
  console.log(`${changes} video(s) need a fix.`);
  if (!DO) console.log('Dry run: nothing changed. Add -- --do to apply.');
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
