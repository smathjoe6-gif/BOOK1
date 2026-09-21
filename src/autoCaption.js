import fs from 'node:fs';
import path from 'node:path';
import { writeCaptionWithAI } from './omniroute.js';

const THEME_STATE_PATH = path.join(process.cwd(), 'theme-caption-state.json');

const HASHTAG_BANK = [
  '#GKLegend', '#GKLegendStudio', '#SomaliHeritage', '#ViralVideo',
  '#LegacyInTheMaking', '#StudioSound', '#MustWatch', '#TrendingNow',
  '#CulturalPride', '#HeritageReimagined', '#RealStory', '#WatchThis',
  '#StudioVault', '#ViralMoment', '#LegendRises', '#SoulOfTheStory',
];

function pickRandomHashtags(count) {
  const shuffled = [...HASHTAG_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(' ');
}

const THEME_BANK = [
  { title: 'A Journey Through Legacy 🌅', capture: '🌅 Every frame tells a story — GK Legend Studio brings you a journey worth watching.' },
  { title: 'Moments Worth Keeping ✨', capture: '✨ Some moments deserve to live forever. GK Legend Studio captures them for you.' },
  { title: 'The Sound of Legacy 🎶', capture: '🎶 Real rhythm, real roots. This is GK Legend Studio at its best.' },
  { title: 'Where Culture Meets Craft 🏺', capture: '🏺 Tradition reimagined. GK Legend Studio brings heritage to life.' },
  { title: 'A Story Worth Telling 📖', capture: '📖 Every legend starts somewhere. GK Legend Studio tells it right.' },
  { title: 'Crafted With Purpose 🔥', capture: '🔥 Passion, precision, and pride. GK Legend Studio delivers.' },
  { title: 'The Legend Continues 👑', capture: '👑 The story doesn\'t stop here. GK Legend Studio keeps building the legacy.' },
  { title: 'Roots Run Deep 🌿', capture: '🌿 Deep roots, bold vision. GK Legend Studio honors both.' },
  { title: 'Somewhere Between Then and Now ⏳', capture: '⏳ The past and the present, in one frame. GK Legend Studio bridges both.' },
  { title: 'This Is How Legends Are Made 🎬', capture: '🎬 Behind every legend is a moment like this one. GK Legend Studio captures it.' },
  { title: 'Held Together by Heritage 🧵', capture: '🧵 Every thread, every note, every step — woven into who we are. GK Legend Studio.' },
  { title: 'Straight From the Source 🌍', capture: '🌍 No filter needed when the story is this real. GK Legend Studio brings it to you.' },
  { title: 'A Piece of the Legacy 🕊️', capture: '🕊️ Some things are made to be remembered. GK Legend Studio keeps them alive.' },
  { title: 'Built to Be Remembered 🏆', capture: '🏆 Legends aren\'t made overnight — they\'re built, frame by frame. GK Legend Studio.' },
  { title: 'The Story Behind the Story 🎙️', capture: '🎙️ There\'s always more beneath the surface. GK Legend Studio tells it all.' },
  { title: 'Nothing Like the Original 💫', capture: '💫 Authentic, unmistakable, unforgettable. GK Legend Studio at its core.' },
];

// Persisted to disk (not just kept in memory) so a script restart -- the
// Mac sleeping, launchd restarting the agent -- can't reset this and let two
// videos in a row land on the same fallback theme, which is exactly what
// caused two duplicate-looking posts on 15 Sep 2026 (two pairs of videos
// both got byte-identical "Where Culture Meets Craft"/"Roots Run Deep"
// captions right after a restart wiped the in-memory history).
function loadRecentThemeTitles() {
  try {
    const state = JSON.parse(fs.readFileSync(THEME_STATE_PATH, 'utf8'));
    return Array.isArray(state.recentThemeTitles) ? state.recentThemeTitles : [];
  } catch {
    return [];
  }
}

function saveRecentThemeTitles(titles) {
  try {
    fs.writeFileSync(THEME_STATE_PATH, JSON.stringify({ recentThemeTitles: titles }, null, 2));
  } catch (err) {
    console.log(`Could not persist theme caption state: ${err.message}`);
  }
}

function pickUnusedTheme() {
  const recentThemeTitles = loadRecentThemeTitles();
  const available = THEME_BANK.filter((t) => !recentThemeTitles.includes(t.title));
  const pool = available.length ? available : THEME_BANK;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  recentThemeTitles.push(pick.title);
  if (recentThemeTitles.length > Math.floor(THEME_BANK.length / 2)) {
    recentThemeTitles.shift();
  }
  saveRecentThemeTitles(recentThemeTitles);
  return pick;
}

const CAPTION_TAIL_BANK = [
  'Real sound, real story, real legacy.',
  'This is what GK Legend Studio stands for.',
  'Another piece of the legacy, captured for you.',
  'Heritage told the way it deserves to be told.',
  'GK Legend Studio brings you the real thing.',
  'Every frame here means something.',
  'Made to be watched, made to be remembered.',
];

const EMOJI_BANK = ['✨', '🌅', '🎬', '👑', '🌿', '🔥', '📖', '🕊️'];

function pickOne(bank) {
  return bank[Math.floor(Math.random() * bank.length)];
}

function isGenericIdFilename(filename) {
  return /^(grok-video-[0-9a-f-]+|grok-auto-\d+)( \(\d+\))?\.[a-zA-Z0-9]+$/i.test(filename);
}

function titleCase(text) {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function cleanFilenameToTitle(filename) {
  let name = filename.replace(/\.[^/.]+$/, '');
  name = name.replace(/_(\d{6,})(_\d+)?$/, '');
  name = name.replace(/_\d+$/, '');
  name = name.replace(/\b(4k|2k|1080p|720p|480p|360p)\b/gi, '');
  name = name.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return titleCase(name);
}

// A cleaned filename with 1 word or fewer (e.g. "gk_1080p_20260915030604.mp4"
// -> "Gk" once the resolution/timestamp are stripped) carries no real
// descriptive content -- there's nothing useful to build a title from, so
// treat it the same as a generic grok-video-<uuid> filename.
function isTooGenericForTitle(cleanedTitle) {
  return cleanedTitle.split(' ').filter(Boolean).length <= 1;
}

export function isLikelyDuplicateVariant(filename) {
  // "_2.mp4" etc is how Joe himself names an intentional extra copy of a
  // video he doesn't want auto-captioned as new content -- that's a
  // deliberate signal, safe to always skip.
  //
  // " (1).mp4" etc used to be treated the same way, but that was wrong: it's
  // just what Google Drive/macOS append automatically whenever two files
  // land with the same base name, which happens routinely for entirely
  // different videos (Grok's own generated filenames collide by chance, or
  // a video gets mirrored between GK_TERMINAL/GK_JING and re-lands under
  // that name) -- not a reliable "this is a duplicate" signal at all.
  // Treating it as skip-forever silently ate several genuinely new videos
  // before this was caught (recurred repeatedly through 17-21 Sep 2026,
  // each time requiring someone to notice and manually rename the file).
  // See stripCollisionSuffix() below for how these are handled instead.
  return /_\d{1,2}\.[a-zA-Z0-9]+$/.test(filename);
}

// Strips a Drive/macOS auto-appended " (1)", " (2)" etc collision suffix, so
// callers can look up (or generate) a caption under the file's real name
// instead of one that's cosmetically different only because of a filename
// collision. Returns the filename unchanged if it has no such suffix.
export function stripCollisionSuffix(filename) {
  return filename.replace(/ \(\d{1,2}\)(\.[a-zA-Z0-9]+)$/, '$1');
}

export function randomThemedCaption() {
  const pick = pickUnusedTheme();
  return { title: pick.title, capture: pick.capture, hashtag: pickRandomHashtags(6) };
}

export async function generateCaption(filename) {
  const hashtag = pickRandomHashtags(6);

  try {
    const ai = await writeCaptionWithAI(filename);
    console.log(`AI-written caption used for "${filename}"`);
    return { title: ai.title, capture: ai.capture, hashtag };
  } catch (err) {
    console.log(`OmniRoute unavailable, using template caption instead: ${err.message}`);
  }

  if (isGenericIdFilename(filename)) {
    return { ...randomThemedCaption(), hashtag };
  }

  const cleaned = cleanFilenameToTitle(filename);
  if (isTooGenericForTitle(cleaned)) {
    return { ...randomThemedCaption(), hashtag };
  }

  // The filename itself has real descriptive words worth keeping (e.g. "Two
  // Women Sharing Tea") -- so dress it up with an emoji and a rotating brand
  // line instead of ever posting the raw cleaned filename verbatim, or the
  // exact same boilerplate sentence, as the title/caption.
  const emoji = pickOne(EMOJI_BANK);
  const tail = pickOne(CAPTION_TAIL_BANK);
  const title = `${cleaned} ${emoji}`;
  const capture = `${emoji} ${cleaned} — ${tail}`;
  return { title, capture, hashtag };
}
