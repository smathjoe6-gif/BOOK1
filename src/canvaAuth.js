import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fetch from 'node-fetch';
import open from 'open';
import { config } from './config.js';

const TOKEN_PATH = new URL('../canva-token.json', import.meta.url);
const REDIRECT_PORT = 53683;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/canva/callback`;
const AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
const TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

const SCOPES = [
  'asset:read', 'asset:write',
  'brandtemplate:content:read', 'brandtemplate:content:write',
  'design:content:read', 'design:content:write',
].join(' ');

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadStoredToken() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveToken(token) {
  const withExpiry = { ...token, obtained_at: Date.now() };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(withExpiry, null, 2));
  return withExpiry;
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.canvaClientId,
      client_secret: config.canvaClientSecret,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Canva token refresh failed: ${data.error_description || data.error || res.status}`);
  }
  return saveToken(data);
}

// Returns a valid access token, refreshing the stored one if it's expired.
// Throws if no one has ever run the interactive login (node src/canvaAuth.js).
export async function getCanvaAccessToken() {
  if (!config.canvaClientId || !config.canvaClientSecret) {
    throw new Error('Canva is not configured (CANVA_CLIENT_ID/CANVA_CLIENT_SECRET missing from .env)');
  }
  const stored = loadStoredToken();
  if (!stored) {
    throw new Error('Not logged in to Canva yet. Run "node src/canvaAuth.js" once, then try again.');
  }
  const ageSeconds = (Date.now() - stored.obtained_at) / 1000;
  if (ageSeconds < (stored.expires_in || 0) - 60) {
    return stored.access_token;
  }
  const refreshed = await refreshAccessToken(stored.refresh_token);
  return refreshed.access_token;
}

async function runInteractiveLogin() {
  if (!config.canvaClientId || !config.canvaClientSecret) {
    console.error('Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET in .env first.');
    process.exit(1);
  }

  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set('code_challenge_method', 's256');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.canvaClientId);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);

  console.log('\nOpening your browser to log in with Canva...');
  console.log('If it does not open automatically, visit this URL:\n');
  console.log(authUrl.toString(), '\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const returnedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      if (code && returnedState === state) {
        res.end('Canva login successful! You can close this tab and go back to Terminal.');
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

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: config.canvaClientId,
      client_secret: config.canvaClientSecret,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Canva login failed: ${data.error_description || data.error || res.status}`);
  }
  saveToken(data);
  console.log(`\nSaved Canva login to ${TOKEN_PATH.pathname}. You only need to do this once.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractiveLogin().catch((err) => {
    console.error('Canva login failed:', err.message);
    process.exit(1);
  });
}
