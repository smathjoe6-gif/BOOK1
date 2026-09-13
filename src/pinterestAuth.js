// One-time setup: run `node src/pinterestAuth.js` to log in with the
// Pinterest account this app posts to. Opens a browser, you approve access,
// and a refresh token gets saved to pinterest_token.json so the app can
// post on its own after that without logging in again.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fetch from 'node-fetch';
import open from 'open';
import { config } from './config.js';

const TOKEN_PATH = new URL('../pinterest_token.json', import.meta.url);
const REDIRECT_PORT = 53684;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/pinterest/callback`;
const AUTHORIZE_URL = 'https://www.pinterest.com/oauth/';
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
const SCOPES = 'pins:read,pins:write,boards:read';

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function loadPinterestToken() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function savePinterestToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function runInteractiveLogin() {
  if (!config.pinterestClientId || !config.pinterestClientSecret) {
    console.error('Set PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET in .env first.');
    process.exit(1);
  }

  const state = base64url(crypto.randomBytes(16));
  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.pinterestClientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);

  console.log('\nOpening your browser to log in with Pinterest...');
  console.log('If it does not open automatically, visit this URL:\n');
  console.log(authUrl.toString(), '\n');
  console.log(`Make sure ${REDIRECT_URI} is registered as a redirect URI for App ID 1607774 at developers.pinterest.com.\n`);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const returnedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      if (code && returnedState === state) {
        res.end('Pinterest login successful! You can close this tab and go back to Terminal.');
        server.close();
        resolve(code);
      } else {
        res.end('No code received -- something went wrong.');
        server.close();
        reject(new Error('No authorization code received (or state mismatch)'));
      }
    });
    server.listen(REDIRECT_PORT, () => {
      open(authUrl.toString()).catch(() => {});
    });
  });

  const basic = Buffer.from(`${config.pinterestClientId}:${config.pinterestClientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Pinterest login failed: ${data.message || data.error || res.status}`);
  }
  savePinterestToken({ ...data, obtained_at: Date.now() });
  console.log(`\nSaved Pinterest login to ${TOKEN_PATH.pathname}. You only need to do this once.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractiveLogin().catch((err) => {
    console.error('Pinterest login failed:', err.message);
    process.exit(1);
  });
}
