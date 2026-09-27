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

// Used only for the blind fallback path below (THEME_BANK / cleaned-filename
// captions), where there's no real understanding of what the video actually
// shows -- no heritage/culture-specific tags here, since randomly attaching
// #SomaliHeritage etc. to content we know nothing about is exactly what made
// TikTok/Pinterest look repetitive and mismatched (diagnosed 22 Sep 2026).
// The AI caption path (writeCaptionWithAI) picks its own content-matched
// hashtags instead of drawing from either bank.
const NEUTRAL_HASHTAG_BANK = [
  '#GKLegend', '#GKLegendStudio', '#ViralVideo', '#MustWatch', '#TrendingNow',
  '#RealStory', '#WatchThis', '#StudioVault', '#ViralMoment', '#StudioSound',
];

function pickRandomHashtags(count, bank = HASHTAG_BANK) {
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
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
  { title: 'Watch Until the End 👀', capture: '👀 The best part is the last second. GK Legend Studio made this one for you.' },
  { title: 'Carried by the Wind 🌬️', capture: '🌬️ Some stories travel further than we do. GK Legend Studio follows them.' },
  { title: 'Gold in Every Frame 🟡', capture: '🟡 Light, texture, feeling — nothing wasted. GK Legend Studio.' },
  { title: 'Quiet Power 🌙', capture: '🌙 Not every legend shouts. Some just stand still and let you feel it.' },
  { title: 'Made by Hand, Held by Heart 🤲', capture: '🤲 The hands tell you everything. GK Legend Studio keeps the craft alive.' },
  { title: 'Before the World Woke Up 🌄', capture: '🌄 First light, first story. GK Legend Studio was there.' },
  { title: 'You Have to See This 🎥', capture: '🎥 Stop scrolling for ten seconds. This one is worth it.' },
  { title: 'The Moment Everything Changed ⚡', capture: '⚡ One second, one frame, one feeling you won\'t forget.' },
  { title: 'Echoes of Home 🏡', capture: '🏡 Wherever you are, this is where you come from. GK Legend Studio.' },
  { title: 'Rhythm of the Land 🥁', capture: '🥁 Feel it before you hear it. GK Legend Studio brings the beat of the land.' },
  { title: 'Light Finds a Way 🌤️', capture: '🌤️ Even the smallest moment can shine. GK Legend Studio saw it.' },
  { title: 'Stories Our Elders Told 📜', capture: '📜 Passed down, never lost. GK Legend Studio keeps the telling going.' },
  { title: 'Pure Focus 🎯', capture: '🎯 Patience, balance, precision — watch it all come together.' },
  { title: 'Simple Things, Big Feelings 💛', capture: '💛 The everyday, seen the way it deserves. GK Legend Studio.' },
  { title: 'A Scene You Can Feel 🌊', capture: '🌊 Turn the sound up and let it wash over you.' },
  { title: 'Bold Vision, Deep Roots 🌳', capture: '🌳 Where tradition meets tomorrow. Join the GK Legend family.' },
  { title: 'Every Detail Matters 🔍', capture: '🔍 Look closer — every detail was made to be noticed.' },
  { title: 'Legends Walk Among Us 🚶', capture: '🚶 Ordinary people, extraordinary stories. GK Legend Studio.' },
  { title: 'The Calm Before the Legend 🌫️', capture: '🌫️ Stillness first, then the story begins.' },
  { title: 'Proud and Unfiltered 🦅', capture: '🦅 No filter needed. Just the real thing, from GK Legend Studio.' },
  { title: 'This Deserves a Replay 🔁', capture: '🔁 Watch it once, then watch it again. You\'ll see something new.' },
  { title: 'Sunset Stories 🌇', capture: '🌇 As the day ends, the legend begins. GK Legend Studio.' },
  { title: 'A Gift for the Eyes 🎁', capture: '🎁 Made with care, shared with love. Welcome to GK Legend Studio.' },
  { title: 'From Our World to Yours 🌐', capture: '🌐 A piece of the legacy, delivered to your screen. Join the family.' },
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
  name = name.replace(/[_\-]+/g, ' ');
  name = name.replace(/\b(4k|2k|1080p|720p|480p|360p)\b/gi, '');
  name = name.replace(/\s+/g, ' ').trim();
  return titleCase(name);
}

// A cleaned filename with 1 word or fewer (e.g. "gk_1080p_20260915030604.mp4"
// -> "Gk" once the resolution/timestamp are stripped) carries no real
// descriptive content -- there's nothing useful to build a title from, so
// treat it the same as a generic grok-video-<uuid> filename.
function isTooGenericForTitle(cleanedTitle) {
  return cleanedTitle.split(' ').filter(Boolean).length <= 1;
}

// Gemini/Google (and other AI tools) name the downloaded file after the
// start of the prompt Joe typed, cut off mid-word -- "go_now_Photorealistic_
// cinemat.mp4", "create_video_make_II_The_Dh.mp4", "make_video.mp4". Those
// are instructions, not a description of the video, and posting them as the
// title made every Google video look the same (Joe, 27 Sep 2026). If the
// name contains any of these prompt words it's treated like a Grok
// uuid filename: it gets a fresh rotating title instead.
const PROMPT_WORDS = new Set([
  'create', 'make', 'generate', 'video', 'go', 'now', 'please', 'prompt',
  'photorealistic', 'photorea', 'photoreal', 'cinematic', 'cinemat', 'cinema',
  'realistic', 'ultra', 'hyper', 'hd', 'veo', 'gemini', 'sora', 'kling',
  'runway', 'grok', 'ai', 'ii', 'shot', 'scene', 'style',
]);

function looksLikePromptFilename(cleanedTitle) {
  return cleanedTitle
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .some((word) => PROMPT_WORDS.has(word));
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
  return { title: pick.title, capture: pick.capture, hashtag: pickRandomHashtags(6, NEUTRAL_HASHTAG_BANK) };
}

export async function generateCaption(filename) {
  try {
    const ai = await writeCaptionWithAI(filename);
    console.log(`AI-written caption used for "${filename}"`);
    // The AI now picks hashtags matching the actual content in the same
    // call -- fall back to a random pick only if it didn't return any.
    const hashtag = ai.hashtag || pickRandomHashtags(6);
    return { title: ai.title, capture: ai.capture, hashtag };
  } catch (err) {
    console.log(`OmniRoute unavailable, using template caption instead: ${err.message}`);
  }

  // Everything below this point has zero real understanding of the video's
  // actual content (no AI available), so it sticks to the neutral hashtag
  // bank rather than guessing at heritage/culture tags that may not fit.
  if (isGenericIdFilename(filename)) {
    return randomThemedCaption();
  }

  const cleaned = cleanFilenameToTitle(filename);
  if (isTooGenericForTitle(cleaned) || looksLikePromptFilename(cleaned)) {
    return randomThemedCaption();
  }

  // The filename describes the video (e.g. "Man Balancing Stones On Beach").
  // Joe wants every video to get its own fresh title whatever tool made it
  // (27 Sep 2026), so the title still comes from the rotating theme bank --
  // the filename's description only goes into the caption text, where it
  // tells viewers what they're watching. A truncated name ("Develo…") is
  // left out of the caption too.
  const theme = randomThemedCaption();
  if (cleaned.includes('…')) return theme;
  const tail = pickOne(CAPTION_TAIL_BANK);
  const capture = `${theme.capture}\n\n${cleaned}. ${tail}`;
  return { title: theme.title, capture, hashtag: theme.hashtag };
}
