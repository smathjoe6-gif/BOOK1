import { OAuth2Client } from 'google-auth-library';
import http from 'node:http';
import fs from 'node:fs';
import open from 'open';
import { config } from './config.js';

const TOKEN_PATH = new URL('../token.json', import.meta.url);
// Extra YouTube channels (e.g. the history channel @TotollsportGK) keep their
// own login in their own file, so signing in for them never replaces the
// main token.json that Drive + @PathFoundGK use. `npm run auth-history`
// passes that filename as the first argument.
const LOGIN_TOKEN_PATH = process.argv[2] ? new URL(`../${process.argv[2]}`, import.meta.url) : TOKEN_PATH;
const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth2callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export function loadOAuthClient(tokenFile) {
  const tokenPath = tokenFile ? new URL(`../${tokenFile}`, import.meta.url) : TOKEN_PATH;
  const client = new OAuth2Client(config.googleClientId, config.googleClientSecret, REDIRECT_URI);
  if (fs.existsSync(tokenPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    client.setCredentials(tokens);
  }
  return client;
}

export function hasSavedLogin(tokenFile) {
  return fs.existsSync(new URL(`../${tokenFile}`, import.meta.url));
}

async function runInteractiveLogin() {
  const client = new OAuth2Client(config.googleClientId, config.googleClientSecret, REDIRECT_URI);

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\nOpening your browser to log in with Google...');
  console.log('If it does not open automatically, visit this URL:\n');
  console.log(authUrl, '\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get('code');
      if (code) {
        res.end('Login successful! You can close this tab and go back to Terminal.');
        server.close();
        resolve(code);
      } else {
        res.end('No code received -- something went wrong.');
        server.close();
        reject(new Error('No authorization code received'));
      }
    });
    server.listen(REDIRECT_PORT, () => {
      open(authUrl).catch(() => {});
    });
  });

  const { tokens } = await client.getToken(code);
  fs.writeFileSync(LOGIN_TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`\nSaved login to ${LOGIN_TOKEN_PATH.pathname}. You only need to do this once.`);
  console.log('Run "npm start" to start the automation.\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractiveLogin().catch((err) => {
    console.error('Login failed:', err.message);
    process.exit(1);
  });
}
