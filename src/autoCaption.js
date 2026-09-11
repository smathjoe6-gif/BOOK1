import { writeCaptionWithAI } from './omniroute.js';

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
];

function isGenericIdFilename(filename) {
  return /^(grok-video-[0-9a-f-]+|grok-auto-\d+)\.[a-zA-Z0-9]+$/i.test(filename);
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
  name = name.replace(/[_\-]+/g, ' ').trim();
  return titleCase(name) || 'GK Legend Studio Video';
}

export function isLikelyDuplicateVariant(filename) {
  return /_\d{1,2}\.[a-zA-Z0-9]+$/.test(filename);
}

export function randomThemedCaption() {
  const pick = THEME_BANK[Math.floor(Math.random() * THEME_BANK.length)];
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

  const title = cleanFilenameToTitle(filename);
  const capture = `✨ ${title} — brought to you by GK Legend Studio. Real sound, real story, real legacy.`;
  return { title, capture, hashtag };
}
