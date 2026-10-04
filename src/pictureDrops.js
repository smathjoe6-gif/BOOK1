import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './config.js';
import { bufferGraphQL } from './bufferTikTok.js';
import { bufferInCooldown, isRateLimitError } from './bufferCooldown.js';
import { listBufferChannels } from './bufferPost.js';
import { generateCaption } from './autoCaption.js';
import { listCanvaPictures, exportCanvaPng } from './canvaPictures.js';

// Picture posts for Facebook (+ Pinterest): Joe keeps ready-made post pictures
// (his Canva "Daily Drops" designs) in two Drive folders under
// PICTURE_FOLDER_ID -- HERITAGE and WILDLIFE. Three times a day (PICTURE_SLOTS,
// default 09:00, 13:00, 19:00 Mac time) ONE picture is posted, alternating
// between the two folders, each picture once only (picture-posts.json).
// A slot is only posted if the script is awake within 4 hours of it, so a
// sleeping Mac never causes a pile-up of missed posts afterwards.
const STATE_PATH = path.join(process.cwd(), 'picture-posts.json');
const MAX_LATE_MS = 4 * 60 * 60 * 1000;
const MAX_TRIES_PER_SLOT = 3;
const KINDS = ['HERITAGE', 'WILDLIFE'];
const FOOTER = '© 2026 GK Legend Studio. All rights reserved.\nhttps://www.youtube.com/@PathFoundGK';

function load() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { posted: s.posted || {}, slots: s.slots || {}, lastKind: s.lastKind || '', tries: s.tries || {} };
  } catch {
    return { posted: {}, slots: {}, lastKind: '', tries: {} };
  }
}
function save(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const todayKey = () => new Date().toLocaleDateString('en-CA');

function slotTimes() {
  return config.pictureSlots
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{1,2}:\d{2}$/.test(s));
}

function slotDate(slot) {
  const [h, m] = slot.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// The slot to post now, or null. Slots that are already more than 4 hours past
// are marked skipped so they can never fire late.
function dueSlot(state) {
  const day = todayKey();
  const done = (state.slots[day] = state.slots[day] || []);
  let due = null;
  for (const slot of slotTimes()) {
    if (done.includes(slot)) continue;
    const when = slotDate(slot).getTime();
    const age = Date.now() - when;
    if (age < 0) continue;
    if (age > MAX_LATE_MS) {
      done.push(slot);
      continue;
    }
    if (!due) due = slot;
  }
  return due;
}

async function findSubfolder(drive, name) {
  const res = await drive.files.list(
    { q: `'${config.pictureFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false`, fields: 'files(id)', pageSize: 5 },
    { timeout: 30000 }
  );
  return res.data.files && res.data.files[0] && res.data.files[0].id;
}

function canvaFolderFor(kind) {
  for (const part of config.pictureCanvaFolders.split(',')) {
    const [name, id] = part.split('=').map((x) => (x || '').trim());
    if (name.toUpperCase() === kind && id) return id;
  }
  return '';
}

async function nextPicture(drive, kind, posted) {
  if (config.pictureCanvaFolders) {
    const canvaId = canvaFolderFor(kind);
    if (!canvaId) return null;
    const designs = await listCanvaPictures(canvaId);
    const design = designs.find((d) => !posted[d.id]);
    return design ? { ...design, kind, canva: true } : null;
  }
  const folderId = await findSubfolder(drive, kind);
  if (!folderId) return null;
  const res = await drive.files.list(
    { q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`, orderBy: 'createdTime', fields: 'files(id, name)', pageSize: 200 },
    { timeout: 30000 }
  );
  const file = (res.data.files || []).find((f) => !posted[f.id]);
  return file ? { ...file, kind } : null;
}

function prettyName(filename) {
  return filename.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function postToChannel(service, { imageUrl, title, text, kind }) {
  const channel = (await listBufferChannels()).find((c) => String(c.service).toLowerCase() === service);
  if (!channel) throw new Error(`No ${service} channel connected in Buffer.`);
  const input = {
    channelId: channel.id,
    text,
    schedulingType: 'automatic',
    mode: 'shareNow',
    assets: [{ image: { url: imageUrl, metadata: { altText: title.slice(0, 200) } } }],
  };
  if (service === 'facebook') input.metadata = { facebook: { type: 'post' } };
  if (service === 'pinterest') {
    const board = (kind === 'WILDLIFE' && config.picturePinterestWildlifeBoardId) || config.bufferPinterestBoardId;
    if (!board) throw new Error('Pinterest needs BUFFER_PINTEREST_BOARD_ID in .env.');
    input.metadata = { pinterest: { boardServiceId: board, title: title.slice(0, 100) } };
  }
  const { createPost } = await bufferGraphQL(
    `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { __typename ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`,
    { input }
  );
  if (!createPost || !createPost.post) throw new Error((createPost && createPost.message) || JSON.stringify(createPost));
  return createPost.post.id;
}

export async function postDuePicture(auth) {
  if ((!config.pictureFolderId && !config.pictureCanvaFolders) || !config.bufferAccessToken) return;
  if (bufferInCooldown()) return; // Buffer API limit hit: the slot stays due (skipped only if >4 h late)
  const state = load();
  const slot = dueSlot(state);
  save(state);
  if (!slot) return;

  const day = todayKey();
  const tryKey = `${day} ${slot}`;
  if ((state.tries[tryKey] || 0) >= MAX_TRIES_PER_SLOT) {
    state.slots[day].push(slot);
    save(state);
    return;
  }

  const drive = google.drive({ version: 'v3', auth });
  const order = state.lastKind === KINDS[0] ? [KINDS[1], KINDS[0]] : KINDS;
  let pic = null;
  for (const kind of order) {
    pic = await nextPicture(drive, kind, state.posted);
    if (pic) break;
  }
  if (!pic) {
    console.log(`Pictures: nothing left to post in ${config.pictureCanvaFolders || config.pictureFolderId} (drop more into HERITAGE / WILDLIFE).`);
    state.slots[day].push(slot);
    save(state);
    return;
  }

  console.log(`Pictures: ${slot} slot -- posting "${pic.name}" (${pic.kind}).`);
  state.tries[tryKey] = (state.tries[tryKey] || 0) + 1;
  save(state);

  let imageUrl;
  if (pic.canva) {
    imageUrl = await exportCanvaPng(pic.id);
  } else {
    await drive.permissions.create({ fileId: pic.id, requestBody: { role: 'reader', type: 'anyone' } }, { timeout: 30000 });
    imageUrl = `https://drive.google.com/uc?export=download&id=${pic.id}`;
  }
  const gen = await generateCaption(prettyName(pic.name));
  const text = `${gen.title}\n\n${gen.capture}\n\n${gen.hashtag}\n\n${FOOTER}`.trim();

  const services = config.pictureServices.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  let okCount = 0;
  let rateLimited = false;
  for (let i = 0; i < services.length; i++) {
    if (rateLimited) break;
    if (i > 0 && config.bufferGapSeconds > 0) await new Promise((r) => setTimeout(r, config.bufferGapSeconds * 1000));
    try {
      const id = await postToChannel(services[i], { imageUrl, title: gen.title, text, kind: pic.kind });
      okCount += 1;
      console.log(`Pictures: ${services[i]} posted (${id}).`);
    } catch (err) {
      console.error(`Pictures: ${services[i]} failed:`, err.message);
      if (isRateLimitError(err)) rateLimited = true;
    }
  }
  // A rate-limited try doesn't count against the slot's 3 tries.
  if (rateLimited && okCount === 0) {
    state.tries[tryKey] = Math.max(0, (state.tries[tryKey] || 1) - 1);
    save(state);
  }

  if (okCount > 0) {
    state.posted[pic.id] = { name: pic.name, kind: pic.kind, at: new Date().toISOString() };
    state.lastKind = pic.kind;
    state.slots[day].push(slot);
    save(state);
  }
}
