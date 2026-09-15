import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';

// Joe's music (song demos, video-generation source tracks, everything) is scattered
// across dozens of folders in his Drive with no consistent home. This finds every
// audio file anywhere in the Drive and consolidates it into 02_AUDIO, sorted by
// language based on the words in its filename/title -- the only signal available
// without actually listening to the track. The Somali/English word lists are a best
// effort, not a transcription: anything with no confident match (words from neither
// list, or a filename that's just a random ID) goes into "Needs Review" instead of
// being guessed wrong. Safe to run again any time -- files already sitting in one of
// the sorted subfolders are left alone.
//
// Run with: npm run organize-music

const DEST_FOLDER_NAME = '02_AUDIO';

const SOMALI_WORDS = new Set([
  'waa', 'iyo', 'maan', 'aad', 'sidee', 'oo', 'ee', 'uu', 'ku', 'ka', 'la', 'wax',
  'wixii', 'dhulka', 'dadka', 'nolol', 'jacayl', 'jecel', 'macaan', 'qurux',
  'wanaagsan', 'wanaag', 'geeraar', 'gabay', 'hooyo', 'aabo', 'walaal', 'dhaqan',
  'dhaqanka', 'soomaaliya', 'soomaali', 'somali', 'xamari', 'banaadiri', 'qaraami',
  'subax', 'habeen', 'geel', 'ilaahay', 'alle', 'nafta', 'qosol', 'farxad',
  'murugo', 'kaban', 'meeshii', 'meeshaydu', 'iftiin', 'saaxiibka', 'jawiga',
  'sacab', 'dhalinyaro', 'waxaan', 'waxaad', 'waxay', 'lulotira', 'madalayo',
]);

const ENGLISH_WORDS = new Set([
  'the', 'and', 'of', 'to', 'in', 'is', 'my', 'your', 'our', 'we', 'you', 'he',
  'she', 'it', 'love', 'heart', 'dream', 'story', 'life', 'world', 'legend',
  'night', 'day', 'king', 'queen', 'song', 'music', 'feel', 'feeling', 'soul',
  'home', 'free', 'freedom', 'rise', 'shine', 'light', 'stars', 'tearing',
  'seams', 'under', 'legacy', 'guardian', 'desert',
]);

function classifyLanguage(title) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let somaliHits = 0;
  let englishHits = 0;
  for (const word of words) {
    if (SOMALI_WORDS.has(word)) somaliHits += 1;
    if (ENGLISH_WORDS.has(word)) englishHits += 1;
  }

  if (somaliHits > 0 && englishHits > 0) return 'Mixed';
  if (somaliHits > 0) return 'Somali';
  if (englishHits > 0) return 'English';
  return 'Needs Review';
}

async function getOrCreateFolder(drive, parentId, name) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  if (res.data.files?.[0]) return res.data.files[0].id;

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return created.data.id;
}

async function listAllAudioFiles(drive) {
  let files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: "mimeType contains 'audio/' and trashed = false",
      fields: 'nextPageToken, files(id, name, parents)',
      pageToken,
      pageSize: 1000,
    });
    files = files.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function moveFile(drive, fileId, fromParents, toParent) {
  await drive.files.update({
    fileId,
    addParents: toParent,
    removeParents: fromParents.join(','),
    fields: 'id',
  });
}

async function main() {
  const auth = loadOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const rootRes = await drive.files.list({
    q: `'root' in parents and name = '${DEST_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  const destFolderId = rootRes.data.files?.[0]?.id;
  if (!destFolderId) {
    console.error(`Could not find a "${DEST_FOLDER_NAME}" folder at your Drive root -- nothing to organize into.`);
    process.exit(1);
  }

  const categoryIds = {
    Somali: await getOrCreateFolder(drive, destFolderId, 'Somali'),
    English: await getOrCreateFolder(drive, destFolderId, 'English'),
    Mixed: await getOrCreateFolder(drive, destFolderId, 'Mixed'),
    'Needs Review': await getOrCreateFolder(drive, destFolderId, 'Needs Review'),
  };
  const categoryIdSet = new Set(Object.values(categoryIds));

  const files = await listAllAudioFiles(drive);
  const counts = { Somali: 0, English: 0, Mixed: 0, 'Needs Review': 0, alreadySorted: 0 };

  for (const file of files) {
    const parents = file.parents || [];
    if (parents.some((p) => categoryIdSet.has(p))) {
      counts.alreadySorted += 1;
      continue;
    }

    const category = classifyLanguage(file.name);
    await moveFile(drive, file.id, parents, categoryIds[category]);
    counts[category] += 1;
  }

  console.log(
    `Done. Found ${files.length} audio file(s) across your whole Drive. ` +
      `${counts.alreadySorted} were already sorted. Moved: Somali ${counts.Somali}, ` +
      `English ${counts.English}, Mixed ${counts.Mixed}, Needs Review ${counts['Needs Review']} ` +
      `(filename-based best guess -- check that folder yourself for anything it couldn't confidently tell apart).`
  );
}

main().catch((err) => {
  console.error('Music organize failed:', err.message);
  process.exit(1);
});
