// One-time setup: run `node src/tiktokAuth.js` to log in with the TikTok
// account this app posts to. Opens a browser, you approve access, and a
// refresh token gets saved to tiktok_token.json so the app can post on its
// own after that without logging in again.

import fs from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline';
import open from 'open';
import fetch from 'node-fetch';
import { config } from './config.js';

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// TikTok requires PKCE on the login request: a random secret (code_verifier)
// plus a hash of it (code_challenge) sent up front, then the same secret
// sent again when exchanging the code for a token, proving it's the same
// app that started the login.
function generatePkcePair() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

// Sandbox and Production logins are kept in separate files so switching
// TIKTOK_USE_SANDBOX in .env never clobbers the other one's saved login.
const TOKEN_PATH = new URL(
  config.tiktokUseSandbox ? '../tiktok_token.sandbox.json' : '../tiktok_token.json',
  import.meta.url
);
// TikTok already accepts this link fine (confirmed twice) — the only issue
// was the page inside it couldn't read the code back out automatically.
// So we keep this link, and read the code from the address bar by hand.
const REDIRECT_URI = 'https://claude.ai/code/artifact/0f683505-a67f-4895-b91d-2e389cfaac36';

function askForCode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('\nPaste the code (or the whole address bar URL) here, then press Enter: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Accepts either the bare code, or the whole URL Joe copied from the address
// bar — pulls "code=..." out of it either way, and undoes any %-encoding.
function extractCode(raw) {
  const trimmed = raw.trim();
  const match = trimmed.match(/[?&]code=([^&\s]+)/);
  const value = match ? match[1] : trimmed;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function loadTikTokToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  }
  return null;
}

export function saveTikTokToken(data) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
}

async function runInteractiveLogin() {
  const state = Math.random().toString(36).slice(2);
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const authUrl =
    `https://www.tiktok.com/v2/auth/authorize/?client_key=${config.tiktokClientKey}` +
    `&response_type=code&scope=video.publish&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}` +
    `&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  console.log('\nOpening your browser to log in with TikTok...');
  console.log('If it does not open automatically, visit this URL:\n');
  console.log(authUrl, '\n');
  console.log(`Make sure ${REDIRECT_URI} is registered as a redirect URI in this app's Login Kit settings (Sandbox or Production, matching TIKTOK_USE_SANDBOX).`);
  console.log('After you approve, look at the address bar — copy the code, or just copy the whole URL.\n');

  open(authUrl).catch(() => {});

  const code = extractCode(await askForCode());

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: config.tiktokClientKey,
      client_secret: config.tiktokClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`TikTok token exchange failed: ${data.error_description || data.error}`);
  }
  saveTikTokToken(data);
  console.log(`\nSaved TikTok login to ${TOKEN_PATH.pathname}. You only need to do this once.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractiveLogin().catch((err) => {
    console.error('TikTok login failed:', err.message);
    process.exit(1);
  });
}
