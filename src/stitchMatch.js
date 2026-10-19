import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { run } from './aspectRatio.js';

// Automatic matching for the video stacker. Gemini looks at a few frames of each
// stock clip and listens to a short piece of each song and gives both the same
// kind of label, so clips of one kind are stacked together and get a song of the
// same kind. Joe sorts nothing by hand. Everything is cached in two JSON files so
// a clip or song is judged once. Needs GEMINI_API_KEY (free AI Studio key) and ffmpeg.
// This is analysis of existing files, not image/video generation.

export const LABELS = [
  'SOMALI_WOMEN', // Somali women: hijab/jilbaab, women's strength, intelligence, motherhood
  'SOMALI_HERITAGE', // Somali people/culture/dress/places, kaban, Somali language
  'HIPHOP_URBAN', // hip-hop/rap, streets, city, street style, attitude
  'SLOW_EMOTIONAL', // calm, sad, reflective, tender, sunset, slow ballad
  'STORY_CINEMATIC', // dramatic story, epic, history, documentary, cinematic
  'FUNNY_VIRAL', // comedy, pranks, kids/family fun, playful, upbeat
  'NATURE_ANIMALS', // animals, wildlife, landscapes
  'CRAFT_FOOD', // hands making things, cooking, workshops, markets
];

// Which song kinds suit each clip kind, best first.
export const SONGS_FOR = {
  SOMALI_WOMEN: ['SOMALI_WOMEN', 'SOMALI_HERITAGE', 'SLOW_EMOTIONAL'],
  SOMALI_HERITAGE: ['SOMALI_HERITAGE', 'SOMALI_WOMEN', 'SLOW_EMOTIONAL'],
  HIPHOP_URBAN: ['HIPHOP_URBAN'],
  SLOW_EMOTIONAL: ['SLOW_EMOTIONAL', 'SOMALI_HERITAGE'],
  STORY_CINEMATIC: ['STORY_CINEMATIC', 'SLOW_EMOTIONAL'],
  FUNNY_VIRAL: ['FUNNY_VIRAL', 'HIPHOP_URBAN'],
  NATURE_ANIMALS: ['STORY_CINEMATIC', 'SLOW_EMOTIONAL', 'SOMALI_HERITAGE'],
  CRAFT_FOOD: ['SOMALI_HERITAGE', 'STORY_CINEMATIC', 'HIPHOP_URBAN'],
};

export const HOOKS = {
  SOMALI_WOMEN: 'THE GENIUS UNDER THE HIJAB',
  SOMALI_HERITAGE: 'OUR HERITAGE',
  HIPHOP_URBAN: 'TURN IT UP',
  SLOW_EMOTIONAL: 'FEEL THIS',
  STORY_CINEMATIC: 'WATCH TILL THE END',
  FUNNY_VIRAL: 'WAIT FOR IT',
  NATURE_ANIMALS: 'WATCH THIS',
  CRAFT_FOOD: 'WATCH HOW ITS MADE',
};

// Joe can tell the matcher what a song is about without waiting for Gemini:
// STITCH_SONG_LABELS="solo=SOMALI_WOMEN;awood=SOMALI_WOMEN" (part of the file
// name, lowercase = LABEL). Used for songs whose words Gemini may not follow.
export function songOverride(name) {
  const raw = process.env.STITCH_SONG_LABELS || '';
  const lower = String(name || '').toLowerCase();
  for (const pair of raw.split(';')) {
    const [key, label] = pair.split('=').map((x) => (x || '').trim());
    if (key && LABELS.includes(label) && lower.includes(key.toLowerCase())) return label;
  }
  return null;
}

const CLIP_TAGS_PATH = path.join(process.cwd(), 'stitch-clip-tags.json');
const SONG_TAGS_PATH = path.join(process.cwd(), 'stitch-song-tags.json');
const TIMEOUT_MS = 60 * 1000;

export class RateLimited extends Error {}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

export const loadClipTags = () => loadJson(CLIP_TAGS_PATH);
export const loadSongTags = () => loadJson(SONG_TAGS_PATH);

export function saveClipTag(id, tag) {
  const tags = loadClipTags();
  tags[id] = tag;
  fs.writeFileSync(CLIP_TAGS_PATH, JSON.stringify(tags, null, 2));
}

export function saveSongTag(id, tag) {
  const tags = loadSongTags();
  tags[id] = tag;
  fs.writeFileSync(SONG_TAGS_PATH, JSON.stringify(tags, null, 2));
}

// "2_FAMILY_FUN" / "hiphop" / "Somali" -> a label, so a folder name Joe typed can
// pick songs the same way an automatic label does. null = no idea.
export function labelFromName(name) {
  const words = String(name || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  // A music-style word wins over a topic word: "blacksmith_hiphop" is a hip-hop story.
  const styleTable = [
    [/^(hiphop|rap|urban|street)$/, 'HIPHOP_URBAN'],
    [/^(women|woman|hijab|jilbaab|jilbab|girls|ladies|mothers)$/, 'SOMALI_WOMEN'],
    [/^(somali|heritage)$/, 'SOMALI_HERITAGE'],
    [/^(slow|sad|calm|emotional|ballad)$/, 'SLOW_EMOTIONAL'],
    [/^(cinematic|epic)$/, 'STORY_CINEMATIC'],
  ];
  const topicTable = [
    [/^(story|history|historical|documentary)$/, 'STORY_CINEMATIC'],
    [/^(funny|fun|family|viral|comedy|kids)$/, 'FUNNY_VIRAL'],
    [/^(animals|animal|nature|wildlife)$/, 'NATURE_ANIMALS'],
    [/^(craft|food|cooking|blacksmith|market)$/, 'CRAFT_FOOD'],
  ];
  for (const table of [styleTable, topicTable]) {
    for (const w of words) {
      for (const [re, label] of table) if (re.test(w)) return label;
    }
  }
  return null;
}

function geminiModels() {
  return [config.geminiModel, ...(config.geminiFallbackModels || [])].filter(Boolean);
}

// One Gemini request with media + a question; tries the backup models on a quota
// answer (429). Returns the text, or throws (RateLimited when every model is out).
async function askGeminiAbout(mimeType, base64, question) {
  let lastRate = null;
  for (const model of geminiModels()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const generationConfig = { maxOutputTokens: 200 };
      if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: question }, { inlineData: { mimeType, data: base64 } }] }],
            generationConfig,
          }),
          signal: controller.signal,
        }
      );
      if (res.status === 429) {
        lastRate = new RateLimited(`Gemini ${model} is out of quota`);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gemini ${model} returned ${res.status}: ${body.slice(0, 150)}`);
      }
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
      if (!text) throw new Error('Gemini gave an empty answer');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastRate || new Error('No Gemini model configured');
}

function parseLabel(text) {
  const upper = String(text || '').toUpperCase();
  const label = LABELS.find((l) => upper.includes(l)) || null;
  const subject = (String(text).match(/subject"?\s*[:=]\s*"?([^"\n,}]{2,40})/i) || [])[1] || '';
  return { label: label || 'OTHER', subject: subject.trim(), v: 2 };
}

async function probeDuration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file]);
  return Number(JSON.parse(out).format?.duration) || 0;
}

const CLIP_QUESTION =
  'These 3 frames are from one short video, left to right. Decide what KIND of video it is and answer with ONE label from this list, ' +
  `then a short subject (2-4 words):\n${LABELS.join(', ')}.\n` +
  'SOMALI_WOMEN = Somali women (hijab, jilbaab, women\'s strength, intelligence, mothers). SOMALI_HERITAGE = Somali people, dress, places, culture. HIPHOP_URBAN = streets, city, hip-hop attitude. ' +
  'SLOW_EMOTIONAL = calm, sad or tender mood. STORY_CINEMATIC = dramatic story, epic or historical scene. ' +
  'FUNNY_VIRAL = comedy, pranks, kids/family fun, playful. NATURE_ANIMALS = animals, wildlife, landscapes. ' +
  'CRAFT_FOOD = hands making things, cooking, workshops, markets.\n' +
  'Answer exactly like: label=HIPHOP_URBAN subject=man rapping on street';

const SONG_QUESTION =
  'Listen to this piece of a song and decide what KIND of song it is. Answer with ONE label from this list, then a short subject (2-4 words):\n' +
  `${LABELS.join(', ')}.\n` +
  'SOMALI_WOMEN = lyrics or mood about Somali women (hijab, jilbaab, women\'s strength, intelligence). SOMALI_HERITAGE = Somali language or traditional Somali sound (kaban/oud, dhaanto). HIPHOP_URBAN = rap/hip-hop/trap beat. ' +
  'SLOW_EMOTIONAL = slow, sad or tender ballad. STORY_CINEMATIC = epic, orchestral, dramatic, cinematic. ' +
  'FUNNY_VIRAL = playful, upbeat, bouncy, party. NATURE_ANIMALS = calm ambient/nature. CRAFT_FOOD = warm acoustic, work-song feel.\n' +
  'Answer exactly like: label=SLOW_EMOTIONAL subject=sad kaban ballad';

// Three frames spread across the clip, side by side in one picture.
export async function classifyClipFile(videoPath) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-tag-'));
  try {
    const duration = await probeDuration(videoPath);
    if (duration < 1) throw new Error('clip has no length');
    const jpg = path.join(work, 'tile.jpg');
    await run('ffmpeg', [
      '-y', '-i', videoPath,
      '-vf', `fps=${(3.2 / duration).toFixed(4)},scale=360:-2,tile=3x1`,
      '-frames:v', '1', '-q:v', '4', jpg,
    ]);
    const answer = await askGeminiAbout('image/jpeg', fs.readFileSync(jpg).toString('base64'), CLIP_QUESTION);
    return parseLabel(answer);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// 40 s from partway into the song, small mono mp3.
export async function classifySongFile(audioPath) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-tag-'));
  try {
    const duration = await probeDuration(audioPath);
    const start = duration > 90 ? Math.min(duration * 0.3, duration - 50) : 0;
    const mp3 = path.join(work, 'snippet.mp3');
    await run('ffmpeg', ['-y', '-ss', start.toFixed(1), '-t', '40', '-i', audioPath, '-ac', '1', '-ar', '22050', '-b:a', '48k', mp3]);
    const answer = await askGeminiAbout('audio/mp3', fs.readFileSync(mp3).toString('base64'), SONG_QUESTION);
    return parseLabel(answer);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const LANGUAGE_QUESTION =
  'Listen to this piece of a song. Decide the language of the SUNG or SPOKEN words and answer with exactly ONE of: SOMALI, ENGLISH, MIXED, INSTRUMENTAL, UNSURE.\n' +
  'MIXED = both Somali and English (or another language) in the same song. INSTRUMENTAL = no words. UNSURE = you cannot tell.\n' +
  'Answer exactly like: language=SOMALI';

// Language of a song's words, from a short snippet (Joe 12 Oct 2026: Somali / English / Mixed vault folders).
export async function classifySongLanguage(audioPath) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-lang-'));
  try {
    let duration = 0;
    try {
      duration = await probeDuration(audioPath);
    } catch {}
    const start = duration > 120 ? Math.min(duration * 0.25, duration - 60) : 0;
    const mp3 = path.join(work, 'snippet.mp3');
    await run('ffmpeg', ['-y', '-ss', start.toFixed(1), '-t', '45', '-i', audioPath, '-ac', '1', '-ar', '22050', '-b:a', '48k', mp3]);
    const answer = String(await askGeminiAbout('audio/mp3', fs.readFileSync(mp3).toString('base64'), LANGUAGE_QUESTION)).toUpperCase();
    return ['SOMALI', 'ENGLISH', 'MIXED', 'INSTRUMENTAL'].find((l) => answer.includes(l)) || 'UNSURE';
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
