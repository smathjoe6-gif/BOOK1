import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { config } from './config.js';
import { getCoverImage } from './coverImage.js';
import { updateCoverImage } from './sheets.js';

// One-off catch-up for caption-sheet rows that never got a Pinterest cover
// written to column G -- e.g. every row so far, because GK_JING_FOLDER_ID
// wasn't set on this Mac, so backfillGkJingCaptions() (the only thing that
// fills column G for GK_JING videos) has been silently skipping itself on
// every cycle. Pulls one photo per row from the GK_Pinterest_Covers pool
// (Canva-designed if configured, raw photo otherwise) and writes it into
// column G. Safe to run more than once -- already-filled rows are skipped.
//
// IMPORTANT: this only helps videos that Make hasn't posted to Pinterest
// yet. A row for a video that already posted with the generic rotation
// image stays posted that way on Pinterest itself -- filling in column G
// afterward just completes the sheet's record, it doesn't edit a pin that
// already went out. Since most rows here are old/already-posted, running
// this against the WHOLE sheet would burn through the entire cover pool
// (100+ photos) for rows that get no real benefit. Defaults to just the
// most recent LIMIT rows instead, which are the ones most likely still
// pending. Override with: LIMIT=50 node src/backfillCoverImages.js
//
// Run with: npm run backfill-covers

const LIMIT = Number(process.env.LIMIT || 20);

async function main() {
  const auth = loadOAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: 'Sheet1!A2:G',
  });
  const rows = res.data.values || [];

  const needsCover = rows
    .map((row, i) => ({ rowNumber: i + 2, title: row[3], coverImageUrl: row[6] }))
    .filter((row) => row.title && !row.coverImageUrl)
    .slice(-LIMIT);

  console.log(
    `Found ${needsCover.length} row(s) (out of ${rows.length} total, capped at the most recent ${LIMIT}) ` +
      `with a title but no cover image.`
  );

  let filled = 0;
  let skipped = 0;
  for (const row of needsCover) {
    const coverImageUrl = await getCoverImage(auth, row.title);
    if (!coverImageUrl) {
      skipped += 1;
      continue;
    }
    await updateCoverImage(auth, row.rowNumber, coverImageUrl);
    filled += 1;
    console.log(`Row ${row.rowNumber}: "${row.title}" -> cover set.`);
  }

  console.log(
    `Done. Filled ${filled} row(s), ${skipped} had no cover available (empty pool and no Canva template). ` +
      `Re-run with LIMIT=<n> node src/backfillCoverImages.js for more rows if needed.`
  );
}

main().catch((err) => {
  console.error('Cover backfill failed:', err.message);
  process.exit(1);
});
