import fs from 'node:fs';
import path from 'node:path';

// Shows (and, with --clear, empties) the script's own waiting lists for the
// Buffer networks: buffer-retry.json (networks still to post, one per check) and
// buffer-deferred.json (videos waiting for their hourly turn). Nothing is posted
// or deleted in Buffer itself. Before --clear, both files are copied to
// <name>.bak-<time> so nothing is lost.
//
//   npm run buffer-queue              (just shows what is waiting)
//   npm run buffer-queue -- --clear   (backs up, then empties both lists)
//
// Joe's rule (23 Oct 2026): videos that already posted must not wait in line
// again; the lists are emptied and the NEW videos are sent with
// `npm run buffer-send`.

const FILES = ['buffer-retry.json', 'buffer-deferred.json'];

function read(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const clear = process.argv.includes('--clear');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

for (const file of FILES) {
  const list = read(file);
  console.log(`\n${file}: ${list.length} waiting`);
  for (const item of list) {
    const when = item.queuedAt || item.deferredAt;
    const day = when ? new Date(when).toLocaleString('en-GB') : '';
    console.log(`  ${(item.service || 'all networks').padEnd(12)} ${day.padEnd(18)} ${(item.name || '').slice(0, 70)}`);
  }
  if (clear && list.length > 0) {
    const full = path.join(process.cwd(), file);
    fs.copyFileSync(full, `${full}.bak-${stamp}`);
    fs.writeFileSync(full, '[]');
    console.log(`  -> emptied (backup: ${file}.bak-${stamp})`);
  }
}
if (!clear) console.log('\nTo empty both lists run: npm run buffer-queue -- --clear');
