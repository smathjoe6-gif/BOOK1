import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { run } from './aspectRatio.js';
import { google } from 'googleapis';
import { downloadFile } from './drive.js';
import { expandHome, listFinishedVideos } from './localDrop.js';
import {
  HOOKS, LABELS, SONGS_FOR, RateLimited,
  classifyClipFile, classifySongFile, labelFromName,
  loadClipTags, loadSongTags, saveClipTag, saveSongTag, songOverride,
} from './stitchMatch.js';
import { isShapeFolder, tidyStockFolder } from './stockTidy.js';
import { analyzeSong, cutLengthFor, planBeatCuts } from './stitchBeats.js';

// Video stacker: Joe keeps a stack of short clips (Grok Library downloads,
// stock footage he owns) in STITCH_FOLDER. Each cycle, up to STITCH_PER_DAY
// times a day, this joins enough of them to reach about STITCH_TARGET_SECONDS
// (default 60) into ONE vertical 9:16 video, adds a short GK text line, and
// saves it into LOCAL_DROP_FOLDER, from where localDrop.js sends it to
// GK_TERMINAL and the normal pipeline posts it. Used clips move to
// "<folder>/used" so a clip is never stacked twice. Off until
// STITCH_FOLDER and LOCAL_DROP_FOLDER are both set. Needs ffmpeg.

const STATE_PATH = path.join(process.cwd(), 'stitch-state.json');
const USED_PATH = path.join(process.cwd(), 'stitch-used.json');
const MAX_CLIPS = 20;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (parsed.day === todayKey()) return parsed;
  } catch {
    // fall through to a fresh day
  }
  return { day: todayKey(), made: 0, failedAt: 0, waitingLogged: false };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function probe(filePath) {
  const out = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type',
    '-of', 'json',
    filePath,
  ]);
  const info = JSON.parse(out);
  const duration = Number(info.format?.duration) || 0;
  const hasAudio = (info.streams || []).some((s) => s.codec_type === 'audio');
  return { duration, hasAudio };
}

// Only plain characters go into the drawtext filter, so quotes/colons in
// STITCH_TEXT can never break the ffmpeg command.
export function cleanText(text) {
  return String(text || '').replace(/[^A-Za-z0-9 .,!?&-]/g, '').trim();
}

export function chooseClips(clips, targetSeconds, maxClipSeconds) {
  const chosen = [];
  let total = 0;
  for (const clip of clips) {
    if (chosen.length >= MAX_CLIPS) break;
    const used = Math.min(clip.duration, maxClipSeconds);
    if (used < 1) continue;
    chosen.push({ ...clip, used });
    total += used;
    if (total >= targetSeconds) break;
  }
  return { chosen, total };
}

async function normalizeClip(clip, outPath, design = false, first = false) {
  // Designed cut: each clip starts zoomed in and settles back over 10 frames
  // (a "punch"), with a very short white flash on the cut. zoompan works on
  // every ffmpeg version, unlike per-frame scale expressions.
  const filter = design
    ? '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,' +
      "zoompan=z='if(lt(on,10),1.14-0.14*on/10,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30," +
      // No white flash on the very first cut: TikTok/Reels use frame 0 as the cover (it came out white, 18 Oct).
      `setsar=1${first ? '' : ',fade=t=in:st=0:d=0.12:color=white'},format=yuv420p[v]`
    : '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[v]';
  const args = ['-y'];
  if (clip.start) args.push('-ss', clip.start.toFixed(3));
  args.push('-i', clip.full);
  if (!clip.hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
  args.push(
    '-filter_complex', filter,
    '-map', '[v]',
    '-map', clip.hasAudio ? '0:a:0' : '1:a:0',
    '-t', String(clip.used),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-shortest',
    outPath
  );
  await run('ffmpeg', args);
}

async function joinClips(partPaths, listPath, outPath, text) {
  fs.writeFileSync(listPath, partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  const joined = outPath.replace(/\.mp4$/, '.joined.mp4');
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', joined]);

  const label = cleanText(text);
  if (!label) {
    fs.renameSync(joined, outPath);
    return false;
  }
  const fontPart = config.stitchFont ? `fontfile='${config.stitchFont.replace(/'/g, '')}':` : '';
  const drawtext =
    `drawtext=${fontPart}text='${label}':fontsize=64:fontcolor=white:borderw=4:bordercolor=black:` +
    'x=(w-text_w)/2:y=h-300';
  try {
    await run('ffmpeg', ['-y', '-i', joined, '-vf', drawtext, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', outPath]);
    fs.rmSync(joined, { force: true });
    return true;
  } catch (err) {
    console.log(`Stitch: could not add the text line (${err.message.slice(-250).replace(/\s+/g, ' ')}) -- saving the video without it.`);
    fs.renameSync(joined, outPath);
    return false;
  }
}

function loadUsedIds() {
  try {
    const parsed = JSON.parse(fs.readFileSync(USED_PATH, 'utf8'));
    return Array.isArray(parsed.used) ? parsed.used : [];
  } catch {
    return [];
  }
}

function saveUsedIds(used) {
  fs.writeFileSync(USED_PATH, JSON.stringify({ used: used.slice(-5000) }, null, 2));
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Every video directly inside the Drive stock folder (all pages).
async function listDriveStock(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  const found = [];
  let pageToken;
  do {
    const res = await drive.files.list(
      {
        q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, createdTime)',
        pageSize: 1000,
        pageToken,
      },
      { timeout: 60 * 1000 }
    );
    found.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  // Oldest upload first: a story folder plays in the order Joe added the clips.
  return found.sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')));
}

// The loose pool: clips directly in the stock folder plus clips filed in the
// "9x16 (Vertical)" / "16x9 (Horizontal)" folders (stockTidy.js files them there).
// Story / theme folders Joe made are separate groups and are not part of it.
async function listLooseStock(auth, folderId) {
  let clips = await listDriveStock(auth, folderId);
  for (const sub of await listSubfolders(auth, folderId)) {
    if (isShapeFolder(sub.name)) clips = clips.concat(await listDriveStock(auth, sub.id));
  }
  return clips.sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')));
}

const MUSIC_USED_PATH = path.join(process.cwd(), 'stitch-music-used.json');
const MIN_MUSIC_BYTES = 8 * 1024 * 1024;

function loadMusicUsed() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MUSIC_USED_PATH, 'utf8'));
    return Array.isArray(parsed.used) ? parsed.used : [];
  } catch {
    return [];
  }
}

// Picks one of Joe's own songs from the Drive music folder (not one of the last
// 5 used) and downloads it. Returns { id, name, full, duration } or null.
// Songs directly in a Drive folder and, up to `depth` levels down, in its subfolders
// (Joe's vault is nested, e.g. GK_MUSIC_VAULT/01_SOMALI_HERITAGE/SOMALI_HIGH_ENERGY).
async function listSongsDeep(auth, folderId, depth = 3) {
  const drive = google.drive({ version: 'v3', auth });
  const songs = [];
  let pageToken;
  do {
    const res = await drive.files.list(
      {
        q: `'${folderId}' in parents and mimeType contains 'audio/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, size, createdTime, modifiedTime)',
        pageSize: 1000,
        pageToken,
      },
      { timeout: 60 * 1000 }
    );
    songs.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  if (depth > 0) {
    for (const sub of await listSubfolders(auth, folderId)) {
      songs.push(...(await listSongsDeep(auth, sub.id, depth - 1)));
    }
  }
  return songs;
}

// First music folder (searching down from the main one) whose name matches the
// clip theme exactly, ignoring case, digits and punctuation ("HIP_HOP" ~ "02_HIP_HOP").
async function findThemeMusicFolder(auth, rootId, themeName, depth = 3) {
  // The whole theme name first, then each word of it ("Blacksmith_hiphop" ->
  // "blacksmith", "hiphop"), so a clip folder can name its music style.
  const keys = [themeKey(themeName), ...String(themeName).split(/[^A-Za-z]+/).map(themeKey).filter((k) => k.length >= 4)];
  const wanted = [...new Set(keys.filter(Boolean))];
  if (wanted.length === 0) return null;
  const folders = [];
  let level = [{ id: rootId }];
  for (let d = 0; d <= depth && level.length > 0; d++) {
    const next = [];
    for (const parent of level) {
      for (const sub of await listSubfolders(auth, parent.id)) {
        folders.push({ ...sub, key: themeKey(sub.name) });
        next.push(sub);
      }
    }
    level = next;
  }
  for (const key of wanted) {
    // Exact name only: loose "contains" matching once picked a "Somali rap" folder for
    // Somali-women clips just because both names had the word "somali".
    const hit = folders.find((f) => f.key && f.key === key);
    if (hit) return hit;
  }
  return null;
}

// Joe's rule: songs he posts the same week must not be reused as background
// music, so only songs at least STITCH_MUSIC_MIN_AGE_DAYS old are used (the older
// of Drive's created/modified time, since an old file re-uploaded keeps its date).
function songIsOldEnough(f) {
  const days = config.stitchMusicMinAgeDays;
  if (!(days > 0)) return true;
  const times = [f.createdTime, f.modifiedTime].map((t) => Date.parse(t)).filter((t) => Number.isFinite(t));
  if (times.length === 0) return true;
  return Date.now() - Math.min(...times) >= days * 24 * 60 * 60 * 1000;
}

async function pickMusic(auth, themeName = '', label = null) {
  let folderId = config.stitchMusicDriveFolderId;
  if (!folderId) return null;
  try {
    // A music folder named like the clip theme is preferred; otherwise any
    // song anywhere under the main music folder.
    if (themeName) {
      const match = await findThemeMusicFolder(auth, folderId, themeName);
      if (match) {
        folderId = match.id;
        console.log(`Stitch: using the "${match.name}" music folder to match the "${themeName}" clips.`);
      }
    }
    const songs = await listSongsDeep(auth, folderId);
    const usable = songs.filter((f) => Number(f.size) >= MIN_MUSIC_BYTES && !/ssstik/i.test(f.name) && songIsOldEnough(f));
    if (usable.length === 0) {
      if (folderId !== config.stitchMusicDriveFolderId) {
        console.log('Stitch: that music folder has no usable songs -- using the main music folder.');
        return pickMusic(auth);
      }
      console.log('Stitch: no usable songs (old enough) in the music folder -- making the video without music.');
      return null;
    }
    // Songs Gemini has judged: take the kinds that suit these clips, best first.
    let candidates = usable;
    const kindLabel = label || labelFromName(themeName);
    if (kindLabel) {
      const songTags = loadSongTags();
      for (const kind of SONGS_FOR[kindLabel] || []) {
        const match = usable.filter((f) => (songOverride(f.name) || songTags[f.id]?.label) === kind);
        if (match.length > 0) {
          candidates = match;
          console.log(`Stitch: choosing a ${kind} song for the ${kindLabel} clips (${match.length} to pick from).`);
          break;
        }
      }
    }
    const recent = loadMusicUsed().slice(-5);
    const fresh = candidates.filter((f) => !recent.includes(f.id));
    const song = shuffled(fresh.length > 0 ? fresh : candidates)[0];
    const full = await downloadFile(auth, song.id, song.name.replace(/[^\w.-]+/g, '_'));
    const { duration } = await probe(full);
    if (duration < 20) {
      fs.rmSync(full, { force: true });
      console.log(`Stitch: song "${song.name}" is too short -- making the video without music.`);
      return null;
    }
    fs.writeFileSync(MUSIC_USED_PATH, JSON.stringify({ used: [...loadMusicUsed(), song.id].slice(-50) }, null, 2));
    return { id: song.id, name: song.name, full, duration };
  } catch (err) {
    console.log(`Stitch: could not get a song (${err.message.slice(0, 120)}) -- making the video without music.`);
    return null;
  }
}

// Instrumental-only music for the person stories (Joe: "only the music, no song"): songs come ONLY
// from Joe's instrumental folder (STORY_MUSIC_FOLDER_ID, default GK_MUSIC_VAULT/GK INSTRUMENTALS MUISC),
// else from a vault folder named MIX_CINEMATIC, never from the main folder, so a sung song is never
// used. He picks these tracks himself, so the old-songs rule and the 8 MB minimum do not apply here
// (1 MB minimum only). No folder / no song = no music.
export async function pickInstrumental(auth) {
  try {
    let folder = config.storyMusicFolderId ? { id: config.storyMusicFolderId, name: 'instrumentals' } : null;
    if (!folder && config.stitchMusicDriveFolderId) {
      folder = await findThemeMusicFolder(auth, config.stitchMusicDriveFolderId, 'MIX_CINEMATIC');
    }
    if (!folder) {
      console.log('Story video: no instrumental music folder found -- no music this time.');
      return null;
    }
    const songs = (await listSongsDeep(auth, folder.id)).filter(
      (f) => Number(f.size) >= 1024 * 1024 && !/ssstik/i.test(f.name)
    );
    if (songs.length === 0) {
      console.log('Story video: the instrumental music folder has no usable songs -- no music this time.');
      return null;
    }
    const recent = loadMusicUsed().slice(-5);
    const fresh = songs.filter((f) => !recent.includes(f.id));
    const song = shuffled(fresh.length > 0 ? fresh : songs)[0];
    const full = await downloadFile(auth, song.id, song.name.replace(/[^\w.-]+/g, '_'));
    const { duration } = await probe(full);
    fs.writeFileSync(MUSIC_USED_PATH, JSON.stringify({ used: [...loadMusicUsed(), song.id].slice(-50) }, null, 2));
    return { id: song.id, name: song.name, full, duration };
  } catch (err) {
    console.log(`Story video: could not get instrumental music (${err.message.slice(0, 120)}) -- no music this time.`);
    return null;
  }
}

// Puts the song under the video: starts partway into the song (skips long
// intros), fades in and out, and turns the clips' own sound down. If this
// fails the video is kept as it was.
async function addMusic(videoPath, music, outPath) {
  const { duration } = await probe(videoPath);
  const maxStart = Math.max(0, music.duration - duration - 3);
  // beatStart = a beat in the loudest part of the song (stitchBeats.js); the cuts are on the beat from there.
  const start = Number.isFinite(music.beatStart) ? music.beatStart : maxStart > 15 ? 8 + Math.random() * (maxStart - 8) : 0;
  const fadeOutAt = Math.max(0, duration - 2.5);
  const clipVol = Number.isFinite(config.stitchClipAudioVolume) ? config.stitchClipAudioVolume : 0.12;
  const filter =
    `[0:a]volume=${clipVol}[a0];` +
    `[1:a]atrim=0:${duration.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=in:d=1.2,afade=t=out:st=${fadeOutAt.toFixed(2)}:d=2.5[a1];` +
    '[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.95[a]';
  await run('ffmpeg', [
    '-y', '-i', videoPath,
    '-ss', start.toFixed(2), '-i', music.full,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', duration.toFixed(2),
    outPath,
  ]);
}

async function listSubfolders(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list(
    {
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 200,
    },
    { timeout: 60 * 1000 }
  );
  return res.data.files || [];
}

// "2_FAMILY_FUN" and "family fun" count as the same theme name.
export function themeKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z]/g, '');
}

// The designed look on the joined video: colour grade + vignette, a big hook
// line in the first 2.8 s, a small GK tag top-left, an end line in the last 6 s
// and a gold progress bar along the top. Any failure keeps the plain video.
async function designPass(videoPath, outPath, { hook, brand, endText }) {
  const { duration } = await probe(videoPath);
  const fontPart = config.stitchFont ? `fontfile='${config.stitchFont.replace(/'/g, '')}':` : '';
  // Biggest font that keeps the line inside the 1080 px frame (about 0.74 em, wide bold fonts per character).
  const fit = (label, max) => Math.max(40, Math.min(max, Math.floor(980 / (Math.max(1, String(label || '').length) * 0.74))));
  // Full strength from frame 0 so the cover frame already shows the hook line.
  const hookAlpha = "alpha='if(gt(t,2.5),(2.8-t)/0.3,1)'";
  const build = (withText) => {
    const text = (label, extra) =>
      withText && label ? `drawtext=${fontPart}text='${label}':fontcolor=white:borderw=5:bordercolor=black:${extra}` : '';
    const parts = [
      'eq=contrast=1.08:saturation=1.15',
      'vignette=PI/6',
      text(hook, `fontsize=${fit(hook, 96)}:x=(w-text_w)/2:y=h*0.14:enable='between(t,0,2.8)':${hookAlpha}`),
      text(brand, "fontsize=40:x=48:y=96:alpha=0.85"),
      text(endText, `fontsize=${fit(endText, 76)}:x=(w-text_w)/2:y=h*0.28:enable='gte(t,${Math.max(0, duration - 6).toFixed(2)})'`),
    ].filter(Boolean);
    const bar = `color=c=0xE8B84A:s=1080x12:d=${duration.toFixed(2)}:r=30[bar]`;
    return `[0:v]${parts.join(',')}[v0];${bar};[v0][bar]overlay=x='-w+W*t/${duration.toFixed(2)}':y=0[v]`;
  };
  const encode = (filter) =>
    run('ffmpeg', [
      '-y', '-i', videoPath,
      '-filter_complex', filter,
      '-map', '[v]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-t', duration.toFixed(2),
      outPath,
    ]);
  try {
    await encode(build(true));
  } catch (err) {
    // Usually this ffmpeg has no text filter (drawtext) or cannot open the font:
    // keep the grade + progress bar and drop only the text.
    console.log(`Stitch: designed look with text failed (${err.message.slice(-250).replace(/\s+/g, ' ')}) -- trying without text.`);
    await encode(build(false));
  }
}

// "2_FAMILY_FUN" / "Blacksmith_hiphop" -> the story word shown in the hook.
export function hookFor(themeName) {
  if (config.stitchHook) return cleanText(config.stitchHook).toUpperCase();
  if (HOOKS[themeName]) return HOOKS[themeName];
  const word = String(themeName || '')
    .split(/[^A-Za-z]+/)
    .find((w) => w.length >= 4 && !/^(hiphop|somali|slow|cinematic|music|mix|story|fun)$/i.test(w));
  return word ? cleanText(`WATCH THE ${word}`).toUpperCase() : 'WAIT FOR IT';
}

// Joins the chosen clips into one video in outDir. Returns { finalName, withText, withMusic, musicName }.
export async function buildStitch(chosen, outDir, stamp, music, themeName = '') {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-stitch-'));
  // The pipeline skips files whose name ends in _1/_2/... as "extra copies", so
  // the day and number are joined with "-v" instead.
  const kind = String(themeName || '').split(/[^A-Za-z]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
  const finalName = `GK_Stitch${kind ? `_${kind}` : ''}_${stamp}.mp4`;
  const hiddenOut = path.join(outDir, `.stitching-${stamp}.mp4`);
  try {
    // Beat mode: cut the clips on the song's beats and start the song at its loudest part.
    if (music && config.stitchBeatCuts) {
      try {
        const a = await analyzeSong(music.full, config.stitchBeatSeconds);
        if (a) {
          const cut = cutLengthFor(a.period);
          const segs = planBeatCuts(chosen, cut.seconds, config.stitchBeatSeconds);
          if (segs) {
            chosen = segs;
            music.beatStart = Math.min(a.start, Math.max(0, music.duration - config.stitchBeatSeconds - 3));
            console.log(`Stitch: beat cuts -- ${Math.round(a.bpm)} BPM, a cut every ${cut.beats} beats (${cut.seconds.toFixed(2)}s), ${segs.length} cuts, song from ${music.beatStart.toFixed(1)}s.`);
          }
        } else {
          console.log('Stitch: no clear beat in this song -- using normal cuts.');
        }
      } catch (err) {
        console.log(`Stitch: beat detection failed (${err.message.slice(0, 120)}) -- using normal cuts.`);
      }
    }
    const parts = [];
    for (let i = 0; i < chosen.length; i++) {
      const part = path.join(work, `part-${i}.mp4`);
      try {
        await normalizeClip(chosen[i], part, config.stitchDesign, i === 0);
      } catch (err) {
        if (!config.stitchDesign) throw err;
        console.log(`Stitch: designed cut failed (${err.message.slice(0, 100)}) -- using a plain cut for this clip.`);
        await normalizeClip(chosen[i], part, false, i === 0);
      }
      parts.push(part);
    }
    // With the designed edit the GK tag is drawn by designPass, not joinClips.
    let withText = await joinClips(parts, path.join(work, 'list.txt'), hiddenOut, config.stitchDesign ? '' : config.stitchText);
    if (config.stitchDesign) {
      const designed = path.join(work, 'designed.mp4');
      try {
        await designPass(hiddenOut, designed, {
          hook: hookFor(themeName),
          brand: cleanText(config.stitchText).toUpperCase(),
          endText: cleanText(config.stitchEndText),
        });
        fs.renameSync(designed, hiddenOut);
        withText = true;
      } catch (err) {
        console.log(`Stitch: could not add the designed look (${err.message.slice(-250).replace(/\s+/g, ' ')}) -- saving the plain stitch.`);
      }
    }
    let withMusic = false;
    if (music) {
      const musicOut = path.join(work, 'with-music.mp4');
      try {
        await addMusic(hiddenOut, music, musicOut);
        fs.renameSync(musicOut, hiddenOut);
        withMusic = true;
      } catch (err) {
        console.log(`Stitch: could not add the song (${err.message.slice(0, 120)}) -- saving the video without music.`);
      }
    }
    fs.renameSync(hiddenOut, path.join(outDir, finalName));
    return { finalName, withText, withMusic, musicName: music ? music.name : '' };
  } catch (err) {
    fs.rmSync(hiddenOut, { force: true });
    throw err;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Mac-folder mode: clips are consumed (moved to "used").
async function stitchFromFolder(auth, dir, outDir, state) {
  fs.mkdirSync(path.join(dir, 'used'), { recursive: true });
  const finished = listFinishedVideos(dir, config.localDropMinAgeSeconds);
  if (finished.length === 0) return;

  const probed = [];
  for (const f of finished.slice(0, MAX_CLIPS * 2)) {
    try {
      probed.push({ ...f, ...(await probe(f.full)) });
    } catch (err) {
      // Park unreadable files so they are not re-tried (and re-logged) every cycle.
      const badDir = path.join(dir, 'unreadable');
      fs.mkdirSync(badDir, { recursive: true });
      fs.renameSync(f.full, path.join(badDir, f.name));
      console.log(`Stitch: "${f.name}" is not a readable video -- moved it to "unreadable".`);
    }
  }
  const { chosen, total } = chooseClips(probed, config.stitchTargetSeconds, config.stitchMaxClipSeconds);
  if (total < config.stitchTargetSeconds * 0.8) {
    if (!state.waitingLogged) {
      console.log(`Stitch: waiting for more clips -- have about ${Math.round(total)}s, need about ${config.stitchTargetSeconds}s.`);
      state.waitingLogged = true;
      saveState(state);
    }
    return;
  }
  console.log(`Stitch: joining ${chosen.length} clips (about ${Math.round(total)}s)...`);
  const music = await pickMusic(auth);
  let result;
  try {
    result = await buildStitch(chosen, outDir, `${state.day}-v${state.made + 1}`, music);
  } finally {
    if (music) fs.rmSync(music.full, { force: true });
  }
  const { finalName, withText, withMusic, musicName } = result;
  for (const clip of chosen) {
    let dest = path.join(dir, 'used', clip.name);
    if (fs.existsSync(dest)) dest = path.join(dir, 'used', `${Date.now()}-${clip.name}`);
    fs.renameSync(clip.full, dest);
  }
  state.made += 1;
  state.waitingLogged = false;
  state.failedAt = 0;
  saveState(state);
  console.log(`Stitch: saved "${finalName}" to the drop folder${withText ? ' with the GK text line' : ''}${withMusic ? ` and the song "${musicName}"` : ''} (${state.made}/${config.stitchPerDay} today).`);
}

// Drive-stock mode: the library stays where it is. Random unused clips are
// downloaded, joined, and remembered in stitch-used.json; when every clip has
// been used the cycle starts again.
async function stitchFromDrive(auth, folderId, outDir, state) {
  const needed = Math.min(MAX_CLIPS, Math.ceil(config.stitchTargetSeconds / config.stitchMaxClipSeconds) + 2);
  const rootClips = await listLooseStock(auth, folderId);
  const themes = [];
  for (const sub of await listSubfolders(auth, folderId)) {
    if (isShapeFolder(sub.name)) continue;
    themes.push({ name: sub.name, clips: await listDriveStock(auth, sub.id) });
  }
  const stock = [...rootClips, ...themes.flatMap((t) => t.clips)];
  if (stock.length < needed) {
    if (!state.waitingLogged) {
      console.log(`Stitch: the Drive stock folder has ${stock.length} videos, need at least ${needed} -- waiting for more.`);
      state.waitingLogged = true;
      saveState(state);
    }
    return;
  }
  let used = loadUsedIds();
  // Prefer ONE group of clips that belong together: a folder Joe made (clips play
  // in upload order) or an automatic group (clips Gemini labelled the same kind).
  // A group is ready with about 5-6 unused clips (10 s each).
  let theme = null;
  let pool = [];
  const themeNeeded = Math.max(4, Math.ceil(config.stitchTargetSeconds / 10) - 1);
  const themeCount = Math.ceil(config.stitchTargetSeconds / 10);
  const clipTags = loadClipTags();
  const autoGroups = LABELS.map((label) => ({
    name: label,
    label,
    clips: rootClips.filter((c) => clipTags[c.id]?.label === label),
  }));
  const manualGroups = themes.map((t) => ({ name: t.name, label: labelFromName(t.name), clips: t.clips }));
  const ready = [...manualGroups, ...autoGroups].filter(
    (g) => g.clips.filter((f) => !used.includes(f.id)).length >= themeNeeded
  );
  let picked;
  if (ready.length > 0) {
    theme = shuffled(ready)[0];
    pool = theme.clips.filter((f) => !used.includes(f.id));
    picked = pool.slice(0, themeCount);
  } else {
    pool = stock.filter((f) => !used.includes(f.id));
    if (pool.length < needed) {
      console.log('Stitch: every stock clip has been used once -- starting a new round.');
      used = [];
      pool = stock;
    }
    picked = shuffled(pool).slice(0, needed);
  }
  if (theme) console.log(`Stitch: using the "${theme.name}" ${LABELS.includes(theme.name) ? 'clips Gemini matched together' : 'folder'} (${picked.length} clips).`);

  const downloaded = [];
  const probed = [];
  try {
    for (const f of picked) {
      try {
        const full = await downloadFile(auth, f.id, f.name.replace(/[^\w.-]+/g, '_'));
        downloaded.push(full);
        probed.push({ id: f.id, name: f.name, full, ...(await probe(full)) });
      } catch (err) {
        console.log(`Stitch: could not use "${f.name}" (${err.message.slice(0, 100)}) -- skipping it.`);
      }
    }
    const { chosen, total } = chooseClips(probed, config.stitchTargetSeconds, theme ? 10 : config.stitchMaxClipSeconds);
    if (total < config.stitchTargetSeconds * 0.8) {
      console.log(`Stitch: only ${Math.round(total)}s of readable clips this round -- will try again next cycle.`);
      return;
    }
    console.log(`Stitch: joining ${chosen.length} Drive stock clips (about ${Math.round(total)}s)...`);
    const music = await pickMusic(auth, theme ? theme.name : '', theme ? theme.label : null);
    let result;
    try {
      result = await buildStitch(chosen, outDir, `${state.day}-v${state.made + 1}`, music, theme ? theme.name : '');
    } finally {
      if (music) fs.rmSync(music.full, { force: true });
    }
    const { finalName, withText, withMusic, musicName } = result;
    saveUsedIds([...used, ...chosen.map((c) => c.id)]);
    state.made += 1;
    state.waitingLogged = false;
    state.failedAt = 0;
    saveState(state);
    console.log(`Stitch: saved "${finalName}" to the drop folder${withText ? ' with the GK text line' : ''}${withMusic ? ` and the song "${musicName}"` : ''} (${state.made}/${config.stitchPerDay} today).`);
  } finally {
    for (const f of downloaded) fs.rmSync(f, { force: true });
  }
}

// Judges clips and songs that Gemini has not seen yet (a few per cycle, cached
// forever). Quota answers stop it quietly until the next cycle.
async function matchBacklog(auth, folderId) {
  if (!config.stitchAutoMatch || !config.geminiApiKey) return;
  const started = Date.now();
  const budgetMs = 150 * 1000;
  // SOMALI_HERITAGE judged before the SOMALI_WOMEN label existed (no v) is judged again.
  const needsTag = (t) => !t || (t.failed && t.failed < 2) || (t.label === 'SOMALI_HERITAGE' && !t.v);
  let clipsDone = 0;
  let songsDone = 0;
  try {
    const clipTags = loadClipTags();
    const clips = (await listLooseStock(auth, folderId)).filter((c) => needsTag(clipTags[c.id]));
    for (const c of clips.slice(0, config.stitchClassifyPerCycle)) {
      if (Date.now() - started > budgetMs) break;
      let full;
      try {
        full = await downloadFile(auth, c.id, c.name.replace(/[^\w.-]+/g, '_'));
        saveClipTag(c.id, await classifyClipFile(full));
        clipsDone++;
      } catch (err) {
        if (err instanceof RateLimited) throw err;
        console.log(`Stitch: could not judge clip "${c.name}" (${err.message.slice(0, 100)}).`);
        saveClipTag(c.id, { label: 'OTHER', failed: (clipTags[c.id]?.failed || 0) + 1 });
      } finally {
        if (full) fs.rmSync(full, { force: true });
      }
    }

    const musicFolder = config.stitchMusicDriveFolderId;
    if (musicFolder && Date.now() - started < budgetMs) {
      const songTags = loadSongTags();
      const songs = (await listSongsDeep(auth, musicFolder)).filter(
        (f) => Number(f.size) >= MIN_MUSIC_BYTES && !/ssstik/i.test(f.name) && songIsOldEnough(f) && !songOverride(f.name) && needsTag(songTags[f.id])
      );
      for (const song of songs.slice(0, 2)) {
        if (Date.now() - started > budgetMs) break;
        let full;
        try {
          full = await downloadFile(auth, song.id, song.name.replace(/[^\w.-]+/g, '_'));
          saveSongTag(song.id, await classifySongFile(full));
          songsDone++;
        } catch (err) {
          if (err instanceof RateLimited) throw err;
          console.log(`Stitch: could not judge song "${song.name}" (${err.message.slice(0, 100)}).`);
          saveSongTag(song.id, { label: 'OTHER', failed: (songTags[song.id]?.failed || 0) + 1 });
        } finally {
          if (full) fs.rmSync(full, { force: true });
        }
      }
    }
  } catch (err) {
    if (err instanceof RateLimited) console.log('Stitch: Gemini quota used up for now -- matching resumes next cycle.');
    else console.log(`Stitch: matching step failed (${err.message.slice(0, 120)}).`);
  }
  if (clipsDone + songsDone > 0) {
    const tagged = Object.values(loadClipTags()).filter((t) => t.label && t.label !== 'OTHER').length;
    console.log(`Stitch: judged ${clipsDone} clip(s) and ${songsDone} song(s) (${tagged} clips matched into groups so far).`);
  }
}

export async function stitchOnce(auth) {
  const dir = expandHome(config.stitchFolder);
  const driveFolderId = config.stitchDriveFolderId;
  const outDir = expandHome(config.localDropFolder);
  if (!dir && !driveFolderId) return;
  if (!outDir) {
    console.log('Stitch: no LOCAL_DROP_FOLDER set -- nowhere to save the result, skipping.');
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });

  if (driveFolderId && config.stitchTidy) {
    try {
      await tidyStockFolder(auth, driveFolderId);
    } catch (err) {
      console.log(`Stock tidy failed (will retry next cycle): ${err.message.slice(0, 120)}`);
    }
  }
  if (driveFolderId) await matchBacklog(auth, driveFolderId);

  const state = loadState();
  if (state.made >= config.stitchPerDay) return;
  if (state.failedAt && Date.now() - state.failedAt < RETRY_AFTER_FAILURE_MS) return;

  try {
    if (driveFolderId) await stitchFromDrive(auth, driveFolderId, outDir, state);
    else await stitchFromFolder(auth, dir, outDir, state);
  } catch (err) {
    console.error(`Stitch failed (will try again in an hour): ${err.message}`);
    state.failedAt = Date.now();
    saveState(state);
  }
}
