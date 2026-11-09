import { google } from 'googleapis';
import { addVideoToPlaylist } from './youtube.js';
import { choosePlaylistWithAI } from './omniroute.js';
import { isQuotaError, markQuotaBlocked, quotaBlocked } from './youtubeQuota.js';

// Joe (9 Nov 2026): every new @PathFoundGK video (shorts and long ones) must go into one of his playlists
// by itself, not only when `npm run organize-playlists` is run by hand. Called right after a successful
// upload in processVideo(); a failure here never affects the upload. Only his six real playlists are
// targets (same words as organizePlaylists.js; ORGANIZE_PLAYLISTS_ONLY overrides). AUTO_PLAYLIST=false
// turns it off. Costs 50 YouTube quota units per add; skipped while the quota block is active.

const WORDS = () => (process.env.ORGANIZE_PLAYLISTS_ONLY || 'modern legend,heritage archive,rap revolution,global grooves,filmmaker,golden sounds')
  .split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);

let cache = { at: 0, targets: [] };

async function targetPlaylists(yt) {
  if (Date.now() - cache.at < 60 * 60 * 1000 && cache.targets.length) return cache.targets;
  const all = [];
  let token;
  do {
    const res = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: token }, { timeout: 30000 });
    for (const p of res.data.items || []) all.push({ id: p.id, title: p.snippet?.title || '' });
    token = res.data.nextPageToken;
  } while (token);
  const words = WORDS();
  cache = { at: Date.now(), targets: all.filter((p) => words.some((w) => p.title.toLowerCase().includes(w))) };
  return cache.targets;
}

function minutesOf(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [];
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0) + Number(m[3] || 0) / 60;
}

export async function autoAddToPlaylist(auth, { videoId, title, description }) {
  if (process.env.AUTO_PLAYLIST === 'false' || quotaBlocked()) return null;
  try {
    const yt = google.youtube({ version: 'v3', auth });
    const targets = await targetPlaylists(yt);
    if (!targets.length) return null;
    let minutes = 0.2;
    try {
      const v = await yt.videos.list({ part: ['contentDetails'], id: videoId }, { timeout: 30000 });
      minutes = minutesOf(v.data.items?.[0]?.contentDetails?.duration) || minutes;
    } catch { /* length is only a hint for the AI */ }
    const pick = await choosePlaylistWithAI({ title, description, minutes, playlists: targets.map((p) => p.title) });
    if (!pick) {
      console.log(`Playlist: no playlist fits "${title}" (left alone).`);
      return null;
    }
    const target = targets[pick - 1];
    await addVideoToPlaylist(auth, target.id, videoId);
    console.log(`Playlist: added "${title}" to "${target.title}".`);
    return target.title;
  } catch (err) {
    if (isQuotaError(err)) markQuotaBlocked();
    console.error('Playlist step failed (video still posted fine):', String(err.message).slice(0, 160));
    return null;
  }
}
