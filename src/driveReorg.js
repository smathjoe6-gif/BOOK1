import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { isProtected } from './driveTidy.js';

// Joe (11 Oct 2026): "six or eight major folders, and inside them the rest"; his
// 02_Brand_Assets (where the posting pipeline lives) stays exactly as it is.
// This files the loose top-level folders of My Drive into 7 numbered folders by
// NAME (rules below). Only whole folders are moved, their contents are never
// touched, and a moved folder keeps its Drive id, so nothing in the posting
// pipeline (which finds folders by id) can break. Pipeline folders and anything
// the rules don't recognise STAY at the top level and are listed, so Joe decides.
// Default = DRY RUN (prints the plan, saves drive-reorg-report.txt); --do applies.
//
//   npm run reorg-drive            (look only)
//   npm run reorg-drive -- --do    (do it)

const FOLDER = 'application/vnd.google-apps.folder';

export const TARGETS = [
  { name: '01_Active_Projects', rule: /^(01_ACTIVE|ACTIVE_PROJECTS|03_Workflows|Build a workflow|Google AI Studio|GKwebfission|ORGANIZE_MY_VIDEOS)/i },
  { name: '03_Videos_and_Music', rule: /^(0\d_VIDEOS|0\d_AUDIO|Finish_Work_Posted|NIGH JAM|IGK BUSS|HIT SONG)/i },
  { name: '04_Entertainment_Creative', rule: /^(['"]*Think Tank|['"]*Omini-Legend|CREATIVE_CONTENT|Gemini Gems|From Canva|Image_Exports|CULTURE_COMMUNITY|0\d_IMAGES|04_PICTURES|05_PATRIOTIC|00_GK_PUBLISHED|BRAND_IDENTITY|03_GK_BRAND|FOLDER_0\d|GK_STUDIO_PUBLIC|GK_Studio_Memory)/i },
  { name: '05_Business', rule: /^(GK_FINANCIAL|GK_AGENCY|GK_AGEBCT|0\d_GK_AGENCY|08_OPPORTUNITY|STUCK_AGENCY|GK_FINAL_DIRECTION|gk_business|Money|Skiller)/i },
  { name: '06_Documentary_Education', rule: /^(01_DOCUMENTARY|0\d_DOCUMENTS|Family_Education|The Code of the Modern|The Guardian Guide|Concrete Legacy)/i },
  { name: '07_Archive', rule: /^(05_LEGEND_ARCHIVE|01_Vortex_Core|GK_VORTEX_CORE|Guardian Vortex|04_CHAMA_NINE|EVERYTHING FIX|GK_Legend_Rescued|diin2 downloads|gemin foder)/i },
];
const KEEP_AT_TOP = /^(02_Brand_Assets|0[1-7]_(Active_Projects|Videos_and_Music|Entertainment_Creative|Business|Documentary_Education|Archive))$/i;

async function listRootFolders(drive) {
  const found = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'root' in parents and mimeType = '${FOLDER}' and trashed = false`,
      fields: 'nextPageToken, files(id, name, ownedByMe)',
      pageSize: 1000,
      pageToken,
    });
    found.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return found;
}

export function planReorg(folders) {
  const plan = { moves: [], stay: [], unknown: [] };
  for (const f of folders) {
    const name = String(f.name || '').trim();
    if (KEEP_AT_TOP.test(name) || isProtected(f)) {
      plan.stay.push(f);
      continue;
    }
    const target = TARGETS.find((t) => t.rule.test(name));
    if (target) plan.moves.push({ folder: f, target: target.name });
    else plan.unknown.push(f);
  }
  return plan;
}

export function describeReorg(plan) {
  const lines = [];
  for (const t of TARGETS) {
    const mine = plan.moves.filter((m) => m.target === t.name);
    lines.push(`${t.name}  (${mine.length} folder(s) will go in)`);
    for (const m of mine) lines.push(`    "${m.folder.name}"`);
  }
  lines.push(`\nStay at the top level (pipeline folders and your 02_Brand_Assets): ${plan.stay.length}`);
  for (const f of plan.stay) lines.push(`    "${f.name}"`);
  lines.push(`\nNot recognised, left where they are for you to decide: ${plan.unknown.length}`);
  for (const f of plan.unknown) lines.push(`    "${f.name}"`);
  return lines.join('\n');
}

async function getOrCreate(drive, name) {
  const res = await drive.files.list({
    q: `'root' in parents and name = '${name}' and mimeType = '${FOLDER}' and trashed = false`,
    fields: 'files(id)',
  });
  if (res.data.files?.[0]) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER, parents: ['root'] },
    fields: 'id',
  });
  return created.data.id;
}

export async function applyReorg(drive, plan, log = console.log) {
  const ids = {};
  let moved = 0;
  // files.update wants the real id of the folder to remove, not the word "root".
  let rootId = 'root';
  try {
    rootId = (await drive.files.get({ fileId: 'root', fields: 'id' })).data.id || 'root';
  } catch {
    /* fall back to the alias */
  }
  for (const m of plan.moves) {
    try {
      if (!ids[m.target]) ids[m.target] = await getOrCreate(drive, m.target);
      await drive.files.update({ fileId: m.folder.id, addParents: ids[m.target], removeParents: rootId, fields: 'id' });
      moved += 1;
    } catch (err) {
      log(`  could not move "${m.folder.name}": ${String(err.message).slice(0, 200)} -- left where it is.`);
    }
  }
  return moved;
}

async function main() {
  const doIt = process.argv.includes('--do');
  const drive = google.drive({ version: 'v3', auth: loadOAuthClient() });
  const plan = planReorg(await listRootFolders(drive));
  const report = describeReorg(plan);
  console.log(report);
  (await import('node:fs')).writeFileSync('drive-reorg-report.txt', report + '\n');
  if (!doIt) {
    console.log('\nThis was only a look -- nothing was moved. To do it for real: npm run reorg-drive -- --do');
    return;
  }
  const moved = await applyReorg(drive, plan);
  console.log(`\nDone. ${moved} folder(s) moved into the 7 main folders. Drag any back if you disagree; nothing was deleted.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error('Drive reorganise failed:', err.message);
    process.exit(1);
  });
}
