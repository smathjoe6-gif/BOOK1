import { google } from 'googleapis';
import { config } from './config.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

// Posts a GK_TERMINAL video to TikTok via Buffer, replacing the direct
// TikTok Content Posting API integration in src/tiktok.js (added 21 Sep 2026
// after confirming with a real live test post that TikTok's unaudited/sandbox
// client key was forcing every direct post to SELF_ONLY/private, while
// Buffer's own already-approved TikTok connection -- "kamaldii1 TikTok
// Account" -- posts publicly). src/tiktok.js and src/tiktokAuth.js are left
// in place, not deleted, in case TikTok's own Production app is approved
// later and direct posting becomes worth switching back to.
//
// Uses Buffer's GraphQL API (https://api.buffer.com), not the legacy REST
// API (api.bufferapp.com/1/...). The key in BUFFER_ACCESS_TOKEN is a new-style
// Buffer API key, which the REST API rejects outright ("Public API tokens are
// not accepted for REST API access", 401) -- found 22 Sep 2026 when the first
// real post failed that way. REST is also being retired on 1 Feb 2027.
//
// Buffer's API needs a URL it can fetch the video from, not a local file --
// this briefly makes the source Drive file's link public (the same
// "anyone: reader" pattern uploadPublicImage() already uses in drive.js) so
// Buffer can grab it. Deliberately left public afterward rather than revoked
// immediately: the same video is about to be public on YouTube/Twitter/
// Pinterest anyway via the rest of this pipeline, and revoking right away
// risks cutting off Buffer's own async fetch/transcoding before it finishes.

const BUFFER_API_URL = 'https://api.buffer.com';

async function bufferGraphQL(query, variables) {
  const res = await fetchWithTimeout(
    BUFFER_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.bufferAccessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    },
    60000
  );
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Buffer returned HTTP ${res.status} with a non-JSON body: ${text.slice(0, 300)}`);
  }
  if (data.errors && data.errors.length) {
    throw new Error(data.errors.map((e) => e.message).join('; '));
  }
  if (!res.ok) {
    throw new Error(`Buffer returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return data.data;
}

// The old REST "profile id" in BUFFER_TIKTOK_PROFILE_ID may or may not be the
// same string as the GraphQL "channel id" -- rather than gamble on that, look
// up the account's channels once and use the configured id if it's really a
// channel, otherwise the (only) TikTok channel on the account.
let cachedChannelId = null;
async function resolveTikTokChannelId() {
  if (cachedChannelId) return cachedChannelId;

  const { account } = await bufferGraphQL('query { account { organizations { id } } }');
  const orgs = (account && account.organizations) || [];
  const tiktokChannels = [];
  for (const org of orgs) {
    const { channels } = await bufferGraphQL(
      'query GetChannels($input: ChannelsInput!) { channels(input: $input) { id name service } }',
      { input: { organizationId: org.id } }
    );
    for (const ch of channels || []) {
      if (ch.id === config.bufferTikTokProfileId) {
        cachedChannelId = ch.id;
        return cachedChannelId;
      }
      if (String(ch.service).toLowerCase() === 'tiktok') tiktokChannels.push(ch);
    }
  }
  if (tiktokChannels.length === 0) {
    throw new Error('No TikTok channel found on this Buffer account -- check the TikTok connection in Buffer\'s dashboard.');
  }
  cachedChannelId = tiktokChannels[0].id;
  console.log(`Buffer: using TikTok channel "${tiktokChannels[0].name}" (id ${cachedChannelId}).`);
  return cachedChannelId;
}

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    }
  }
`;

export async function uploadToTikTokViaBuffer(auth, { fileId, caption }) {
  if (!config.bufferAccessToken) {
    throw new Error('Buffer is not configured -- set BUFFER_ACCESS_TOKEN in .env.');
  }

  const channelId = await resolveTikTokChannelId();

  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create(
    { fileId, requestBody: { role: 'reader', type: 'anyone' } },
    { timeout: 30000 }
  );
  const videoUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  const { createPost } = await bufferGraphQL(CREATE_POST_MUTATION, {
    input: {
      channelId,
      text: caption,
      schedulingType: 'automatic',
      mode: 'shareNow',
      assets: [{ video: { url: videoUrl } }],
    },
  });
  if (!createPost || !createPost.post) {
    throw new Error(`Buffer TikTok post failed: ${(createPost && createPost.message) || JSON.stringify(createPost)}`);
  }
  return { updateId: createPost.post.id };
}
