import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { addVideoToPlaylist } from './youtube.js';
import { choosePlaylistWithAI } from './omniroute.js';

// Joe (4 Nov 2026): put the @PathFoundGK videos into his existing playlists (Filmmaker / Visual Artist for
// the shorts, the music ones, the fashion / GK collection one ...). Nothing is moved or deleted: a video is
// only ADDED to one playlist, and only if it is not already in any of them.
//
//   npm run organize-playlists                 (shows the plan, changes nothing)
//   npm run organize-playlists -- --do         (adds up to 40 videos; each add costs 50 YouTube quota units)
//   npm run organize-playlists -- --do --max=100
//
// Uses the main login (token.json, scopes youtube.upload + youtube.force-ssl). Decisions are made by the
// AI route (Gemini first); every video is judged once and remembered in playlist-organize.json.

const STATE = path.join(process.cwd(), 'playlist-organize.json');
const DO = process.argv.includes('--do');
const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX = maxArg ? Number(maxArg.split('=')[1]) || 40 : 40;

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { judged: {} }; }
}
function saveState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }

// ISO 8601 duration (PT1M12S) -> minutes
function minutesOf(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [];
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0) + Number(m[3] || 0) / 60;
}

async function main() {
  const auth = loadOAuthClient();
  const yt = google.youtube({ version: 'v3', auth });

  // Joe's playlists
  const playlists = [];
  let token;
  do {
    const res = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: token });
    for (const p of res.data.items || []) playlists.push({ id: p.id, title: p.snippet?.title || '' });
    token = res.data.nextPageToken;
  } while (token);
  if (playlists.length === 0) throw new Error('no playlists found on this channel');
  console.log(`Playlists (${playlists.length}):`);
  playlists.forEach((p, i) => console.log(`  ${i + 1}. ${p.title}`));

  // Videos already in any playlist stay where they are
  const placed = new Set();
  for (const p of playlists) {
    let t;
    do {
      const res = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: p.id, maxResults: 50, pageToken: t });
      for (const it of res.data.items || []) placed.add(it.contentDetails?.videoId);
      t = res.data.nextPageToken;
    } while (t);
  }

  // All uploads
  const ch = await yt.channels.list({ part: ['contentDetails'], mine: true });
  const uploads = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('no uploads playlist found for this login');
  const ids = [];
  let pt;
  do {
    const res = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: uploads, maxResults: 50, pageToken: pt });
    for (const it of res.data.items || []) ids.push(it.contentDetails.videoId);
    pt = res.data.nextPageToken;
  } while (pt);
  console.log(`${ids.length} upload(s); ${ids.filter((i) => placed.has(i)).length} already in a playlist.`);

  const state = loadState();
  let added = 0;
  let planned = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const res = await yt.videos.list({ part: ['snippet', 'contentDetails'], id: ids.slice(i, i + 50).join(',') });
    for (const v of res.data.items || []) {
      if (placed.has(v.id) || state.judged[v.id] !== undefined) continue;
      if (planned >= MAX) break; // at most MAX videos judged per run (also in the dry run)
      let pick = 0;
      try {
        pick = await choosePlaylistWithAI({
          title: v.snippet.title,
          description: v.snippet.description,
          minutes: minutesOf(v.contentDetails.duration),
          playlists: playlists.map((p) => p.title),
        });
      } catch (err) {
        console.log(`  AI unavailable (${String(err.message).slice(0, 80)}) -- stopping; run again later.`);
        saveState(state);
        return;
      }
      planned += 1;
      const target = pick ? playlists[pick - 1] : null;
      console.log(`- "${v.snippet.title}" -> ${target ? `"${target.title}"` : 'no playlist fits (left alone)'}`);
      if (!DO) continue; // dry run: decisions are NOT remembered, so the real run judges again
      state.judged[v.id] = pick;
      if (target) {
        try {
          await addVideoToPlaylist(auth, target.id, v.id);
          added += 1;
        } catch (err) {
          console.log(`  could not add: ${String(err.message).slice(0, 160)}`);
          delete state.judged[v.id];
          if (/quota/i.test(err.message)) { saveState(state); console.log('YouTube quota used up for today -- run again tomorrow.'); return; }
        }
      }
      saveState(state);
    }
  }
  console.log(`${planned} video(s) judged${DO ? `, ${added} added` : ''}.`);
  if (!DO) console.log('Dry run: nothing changed. Add -- --do to apply.');
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
