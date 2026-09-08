import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required setting: ${name}. Check your .env file (copy .env.example to .env and fill it in).`);
    process.exit(1);
  }
  return value;
}

export const config = {
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  driveFolderId: required('DRIVE_FOLDER_ID'),
  doneFolderId: process.env.DONE_FOLDER_ID || '',
  spreadsheetId: required('SPREADSHEET_ID'),
  pollIntervalMinutes: Number(process.env.POLL_INTERVAL_MINUTES || 10),
  postStaggerMinutes: Number(process.env.POST_STAGGER_MINUTES || 15),
  tiktokUseSandbox: process.env.TIKTOK_USE_SANDBOX === 'true',
  tiktokClientKey: process.env.TIKTOK_USE_SANDBOX === 'true'
    ? (process.env.TIKTOK_SANDBOX_CLIENT_KEY || '')
    : (process.env.TIKTOK_CLIENT_KEY || ''),
  tiktokClientSecret: process.env.TIKTOK_USE_SANDBOX === 'true'
    ? (process.env.TIKTOK_SANDBOX_CLIENT_SECRET || '')
    : (process.env.TIKTOK_CLIENT_SECRET || ''),
};
