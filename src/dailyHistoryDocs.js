// Writes the day's three NotebookLM source docs for @TotollsportGK by itself (A world, B Africa/Horn,
// C sports) into NOTEBOOKLM_SOURCES, with no Claude chat session needed. Added 13 Nov 2026 because the
// routine that did this fired into one chat session and was skipped on days that session restarted
// (Joe: "every day I need 3 history docs to create"). Uses Gemini WITH Google Search, reads the newest
// doc names so topics do not repeat, validates the doc, and skips a letter that already exists today.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { config } from './config.js';
import { londonDate, askGeminiWithSearch } from './dailyPrompts.js';

const STATE_PATH = path.join(process.cwd(), 'daily-history-docs-state.json');
const FOLDER_ID = (process.env.HISTORY_DOCS_FOLDER_ID || '1YIcfycSNpjFuK0_MkERQhNXwJ00gixh1').trim();
const HOUR = process.env.HISTORY_DOCS_HOUR === undefined || process.env.HISTORY_DOCS_HOUR === '' ? 8 : Number(process.env.HISTORY_DOCS_HOUR);
const ON = process.env.HISTORY_DOCS_AUTO !== 'false';
const FOOTER = '© 2026 GK Legend Studio. All rights reserved.\nhttps://www.youtube.com/@PathFoundGK';

const LANES = {
  A: { folder: 'WORLD_HISTORY', brief: 'WORLD history from any region.' },
  B: { folder: 'WORLD_HISTORY (African, not Somali) or SOMALI_HISTORY (Somali)', brief: 'AFRICAN history centred on the Horn and East Africa (about one doc in three is Somali; otherwise another African country or the whole region). Say the country or region in the title. No mass-atrocity topics, no party politics, Idi Amin only as short neutral dated facts.' },
  C: { folder: 'SPORTS_HISTORY', brief: 'SPORT of the last ~20 years (2006 to now): a famous moment, rivalry or record, ideally an anniversary of today\'s date; about one in three is Africa\'s success in sport starting from the Horn. Leans baseball, boxing, athletics records, engineered records.' },
};

const RULES = (letter, date) => `You write ONE source+prompt document for Joe's YouTube channel @TotollsportGK (long 16:9 NotebookLM Video Overviews). Output ONLY the document text. Doc ${letter} of today (${date}): ${LANES[letter].brief}
Every doc is ONE of three shapes: (1) DUEL / SHOWDOWN, (2) THE LOGIC / ENGINEERING / SCIENCE BEHIND AN IMPOSSIBLE FEAT, (3) A TRUE MYSTERY (what we know, what we don't). Title names the feat or the duel, never a museum or an era. Label every fact PROVEN / DEBATED / REPORTED / UNKNOWN; never say "solved" without two reliable sources; no conspiracy, no ancient aliens, no atrocity or gore, no real people's quotes. Every fact needs 2 agreeing sources found by web search; drop a fact if sources disagree; never invent URLs.
LAYOUT (exactly): line 1 "FOR @TotollsportGK - <FOLDER> - NotebookLM Video Overview"; "SHAPE: <shape>"; "THE STORY IN SHORT (checked facts)" with "- " bullet lines; "HOOK (first 10 seconds): <a question or surprise, never 'Welcome'>"; "DID YOU KNOW: ..."; "CLOSING: ... Comment, and subscribe."; "PINNED COMMENT IDEA: ..."; "STEP 1 - Add sources (+ Add source > Website)" then 3-4 real https URLs; "STEP 2 - Paste into Customize (Video Overview)" then one paragraph with a 6-part structure; "STEP 3 - Download and drop" then "File name: <Topic_Words>_<World_History|Sports_History>.mp4 into TOTOLL_HISTORY > <FOLDER>."; "LENGTH: aim for 6-9 minutes, fastest pace, no filler."
FIRST LINE OF YOUR ANSWER must be exactly: TITLE: <Short_Topic_With_Underscores_No_Punctuation>
Folder name for this doc: ${LANES[letter].folder}. Do not include the copyright footer; it is added for you.`;

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2)); }
function londonHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(d)) % 24;
}

export function parseDoc(text) {
  const m = text.match(/^TITLE:\s*([A-Za-z0-9_]{6,80})\s*\n/);
  if (!m) return null;
  const body = text.slice(m[0].length).trim();
  const ok = /STEP 1/.test(body) && /STEP 2/.test(body) && /STEP 3/.test(body) && /HOOK/.test(body) && /LENGTH:/.test(body) && /PINNED COMMENT IDEA/.test(body) && /https?:\/\//.test(body);
  return ok ? { title: m[1], body } : null;
}

export async function dailyHistoryDocsOnce(auth) {
  if (!ON || !config.geminiApiKey) return;
  const today = londonDate();
  let state = loadState();
  if (state.date !== today) state = { date: today, done: [], failures: 0, lastTry: 0 };
  if (state.done.length === 3 || londonHour() < HOUR) return;
  if (state.failures >= 6) return;
  if (Date.now() - state.lastTry < 15 * 60 * 1000) return;
  const drive = google.drive({ version: 'v3', auth });
  const list = await drive.files.list({ q: `'${FOLDER_ID}' in parents and trashed=false`, orderBy: 'createdTime desc', pageSize: 60, fields: 'files(name)' });
  const names = (list.data.files || []).map((f) => f.name);
  for (const L of ['A', 'B', 'C']) if (names.some((n) => n.startsWith(`${today}_${L}_`)) && !state.done.includes(L)) state.done.push(L);
  const next = ['A', 'B', 'C'].find((L) => !state.done.includes(L));
  if (!next) { saveState(state); return; }
  state.lastTry = Date.now(); saveState(state);
  console.log(`History docs: writing ${today}_${next} with Gemini + Google Search...`);
  try {
    const user = `Today's date (London): ${today}. Already covered (do not repeat any topic):\n${names.slice(0, 45).join('\n')}\nSearch the web, then write doc ${next}.`;
    const r = await askGeminiWithSearch(config.geminiModel, RULES(next, today), user);
    const doc = parseDoc(r.text);
    if (!doc) throw new Error('the answer was missing required parts');
    const body = `${doc.body}\n\n${FOOTER}\n`;
    await drive.files.create({
      requestBody: { name: `${today}_${next}_${doc.title}`, parents: [FOLDER_ID], mimeType: 'application/vnd.google-apps.document' },
      media: { mimeType: 'text/plain', body: Readable.from([body]) }, fields: 'id',
    });
    state.done.push(next); state.failures = 0; saveState(state);
    console.log(`History docs: saved ${today}_${next}_${doc.title}`);
  } catch (err) {
    state.failures += 1; saveState(state);
    console.error(`History docs failed (try ${state.failures}/6, retrying later): ${err.message}`);
  }
}
