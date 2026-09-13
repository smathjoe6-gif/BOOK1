import { google } from 'googleapis';
import { config } from './config.js';

export async function findRowForFile(auth, filename) {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: 'Sheet1!A2:F',
  });

  const rows = res.data.values || [];
  const match = rows.find((row) => row[0] === filename);
  if (!match) return null;

  const [originalFilename, newFilename, time, title, capture, hashtag] = match;
  if (!title) return null;

  return { originalFilename, newFilename, title, capture: capture || '', hashtag: hashtag || '' };
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
