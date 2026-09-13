import { google } from 'googleapis';
import { config } from './config.js';

export async function findRowForFile(auth, filename) {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: 'Sheet1!A2:G',
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === filename);
  if (rowIndex === -1) return null;

  const [originalFilename, newFilename, time, title, capture, hashtag, coverImageUrl] = rows[rowIndex];
  if (!title) return null;

  return {
    rowNumber: rowIndex + 2,
    originalFilename,
    newFilename,
    title,
    capture: capture || '',
    hashtag: hashtag || '',
    coverImageUrl: coverImageUrl || '',
  };
}

export async function appendGeneratedRow(auth, filename, generated, coverImageUrl = '') {
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: 'Sheet1!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[filename, '', '', generated.title, generated.capture, generated.hashtag, coverImageUrl]],
    },
  });
}

// Fills in just the Pinterest cover image column (G) for a row that already has its
// caption -- used when the caption row was written by something else (e.g. the hourly
// Claude Code backfill routine, which only writes text) before this script had a chance
// to generate a cover for that video.
export async function updateCoverImage(auth, rowNumber, coverImageUrl) {
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `Sheet1!G${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[coverImageUrl]] },
  });
}
