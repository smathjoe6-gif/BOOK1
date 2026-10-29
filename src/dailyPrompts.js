// Writes the day's "GK_Viral_Prompts_<date>" Google Doc by itself, with no Claude chat session
// needed (added 29 Oct 2026: the routine that did this ran inside one chat session and was
// missed when that session restarted). Uses Gemini WITH Google Search (so trends and documentary
// facts come from the live web), reads the 3 newest docs so nothing repeats, checks the answer
// has 10 prompts with FILE NAME lines, and saves the doc into the GK_Viral_Prompts folder.
// If a doc for today already exists (for example the Claude routine wrote it first) nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { config } from './config.js';

const STATE_PATH = path.join(process.cwd(), 'daily-prompts-state.json');
const FOOTER = [
  'Drop-folder note: make the clips in Grok, then drop the finished .mp4 files into GK_TERMINAL (or GK_JING); they post by themselves.',
  '',
  'Copyright Notice © 2026 GK Legend Studio. All rights reserved.',
  'https://www.youtube.com/@PathFoundGK',
  '',
  'New prompts land here daily.',
].join('\n');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}
function saveState(s) { fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2)); }

// London date, because the doc name uses it.
export function londonDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function londonHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(d)) % 24;
}

// 10 numbered headings, each followed by a FILE NAME line, and the footer.
export function looksLikeValidDoc(text) {
  const heads = text.match(/^=== \d+\. .+ ===$/gm) || [];
  const files = text.match(/^FILE NAME: \d\d_[A-Za-z0-9_]+$/gm) || [];
  return heads.length === 10 && files.length === 10;
}

async function askGeminiWithSearch(model, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 12000, temperature: 0.9 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    const data = await res.json();
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini gave an empty answer');
    const sources = (cand?.groundingMetadata?.groundingChunks || [])
      .map((c) => c.web).filter((w) => w?.uri).map((w) => `${w.title || 'source'}: ${w.uri}`);
    return { text, sources: [...new Set(sources)].slice(0, 12) };
  } finally {
    clearTimeout(timer);
  }
}

const RULES = `You write GK Legend Studio's daily 10 viral video prompts for Grok (10-second vertical 9:16 videos). Output ONLY the document text, nothing before or after it.

LAYOUT (exactly this):
GK LEGEND STUDIO - DAILY VIRAL VIDEO PROMPTS - <DATE>

(Ready to paste into Grok. Every prompt has a first-second hook, a loud described sound, GK branding in the scene, photorealism and anatomy language, close framing for interactions, and a short bold white subtitle for the full length. Each prompt heading is followed by a FILE NAME line that GK Bot uses to name the video. Documentary prompts use a real researched fact, with its source underneath. No Somali verse is written here; any Somali on screen is a real, common word.)

NOTE ON TODAY'S SET: <which short-form (TikTok) trends from this week's search you used, and which gabay / buraanbur / heritage / documentary topics you chose and why they differ from recent days>

Then 10 prompts. Each prompt is: a heading line exactly like === N. LANE - "Title" ===, then the next line exactly FILE NAME: NN_Title_With_Underscores (NN = 01 to 10, title words joined by underscores, letters and digits only, no punctuation, no extension), then a blank line, then the prompt paragraph. Documentary prompts also have, before the paragraph, a line starting "(Real detail:" with the checked fact and what the video must NOT state where sources disagree, and, after the paragraph, a line "Source: <page 1> and <page 2>" (real page names/URLs you found by search).

LANES (in order): 1 GABAY, 2 BURAANBUR, 3 and 4 Broad viral (use this week's trends you found), 5 6 7 GK Legend heritage (hands crafts: close-ups of a craft with an apprentice or relative beside them), 8 9 10 Documentary (a real place or fact verified by search with two agreeing sources; drop any detail the sources disagree on; no portraits of real people; no atrocity or conflict topics; not Somali-political).

EVERY PROMPT must contain: a first-second hook with a loud described SOUND in capitals; a GK Legend crest or emblem worked ONTO an object in the scene (drum rim, stone, cloth, plaque), never a watermark; photorealism and anatomy words: "Accurate anatomy and correct proportions, no duplicated fingers or distorted features, natural true-to-life colour grading, correct <materials> physics with no warping, real <named> light."; a short bold white subtitle: A short bold white subtitle reads "..." across the bottom third for the full 10 seconds.; and end with "10 seconds." People always appear together in one frame (e.g. "elder and child together in one frame"). Never use the words high-fashion or stylized. No animals. No violence, drugs, addiction or distress. NEVER invent Somali verse; the Gabay (elder man reciting, long weighty poem) and Buraanbur (women, frame drum, call-and-answer, one dancer with a shawl over one shoulder stepping on one leg) subtitles are English, e.g. "Gabay: the poem that moves a nation. Turn your volume up." Real instruments and cloth only (Kaban, dhaanto drum, Alindi, Guntiino, Dirac). Use a NEW setting for the gabay and buraanbur scenes every day.

Never reuse a Broad-viral idea, gabay or buraanbur setting, heritage craft, or documentary topic from the recent docs below.`;

async function recentDocsText(drive, folderId) {
  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'GK_Viral_Prompts_' and mimeType='application/vnd.google-apps.document' and trashed=false`,
    orderBy: 'createdTime desc', pageSize: 3, fields: 'files(id,name)',
  });
  let out = '';
  for (const f of list.data.files || []) {
    try {
      const r = await drive.files.export({ fileId: f.id, mimeType: 'text/plain' }, { responseType: 'text' });
      out += `\n\n--- RECENT DOC ${f.name} ---\n${String(r.data).slice(0, 9000)}`;
    } catch { /* skip a doc that cannot be read */ }
  }
  return out;
}

export async function dailyPromptsOnce(auth) {
  if (!config.dailyPromptsAuto || !config.geminiApiKey) return;
  const today = londonDate();
  const state = loadState();
  if (state.doneDate === today) return;
  if (londonHour() < config.dailyPromptsHour) return;
  if (state.failedDate === today && (state.failures || 0) >= 4) return; // give up for today after 4 tries
  if (state.lastTry && Date.now() - state.lastTry < 20 * 60 * 1000) return; // one try per 20 minutes

  const drive = google.drive({ version: 'v3', auth });
  const folderId = config.dailyPromptsFolderId;
  const name = `GK_Viral_Prompts_${today}`;
  const found = await drive.files.list({ q: `'${folderId}' in parents and name='${name}' and trashed=false`, fields: 'files(id)', pageSize: 1 });
  if (found.data.files?.length) { saveState({ ...state, doneDate: today }); return; }

  saveState({ ...state, lastTry: Date.now() });
  console.log(`Daily prompts: writing ${name} with Gemini + Google Search...`);
  const recent = await recentDocsText(drive, folderId);
  const user = `Today's date (London): ${today}. Search the web for this week's short-form (TikTok) trends and for the documentary facts, then write the document.${recent}`;
  const system = RULES.replace('<DATE>', today);
  let result;
  try {
    result = await askGeminiWithSearch(config.geminiModel, system, user);
    if (!looksLikeValidDoc(result.text)) throw new Error('the answer did not have 10 prompts with FILE NAME lines');
  } catch (err) {
    const failures = (state.failedDate === today ? state.failures || 0 : 0) + 1;
    saveState({ ...loadState(), failedDate: today, failures });
    console.error(`Daily prompts failed (try ${failures}/4, retrying later): ${err.message}`);
    return;
  }
  let body = result.text.replace(/\n*Drop-folder note:[\s\S]*$/i, '').trim();
  if (result.sources.length) body += `\n\nSEARCH SOURCES (found by the web search while writing this):\n${result.sources.join('\n')}`;
  body += `\n\n---\n\n${FOOTER}\n`;
  await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType: 'application/vnd.google-apps.document' },
    media: { mimeType: 'text/plain', body: Readable.from([body]) },
    fields: 'id',
  });
  saveState({ ...loadState(), doneDate: today, failures: 0 });
  console.log(`Daily prompts: saved ${name} (10 prompts).`);
}
