import fetch from 'node-fetch';
import { config } from './config.js';

const GRAPHQL_URL = 'https://api.buffer.com';

async function graphql(query, variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.bufferAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(`Buffer GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

let channelCache = null;
export async function getChannels() {
  if (channelCache) return channelCache;

  const data = await graphql(`
    query {
      account {
        id
        channels {
          id
          service
        }
      }
    }
  `);

  channelCache = {};
  for (const c of data.account.channels) {
    channelCache[c.service] = c.id;
  }
  return channelCache;
}

export async function postVideoToBuffer({ channelId, text, videoUrl }) {
  const data = await graphql(
    `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            __typename
            post { id status }
          }
          ... on NotFoundError { __typename message }
          ... on UnauthorizedError { __typename message }
          ... on UnexpectedError { __typename message }
          ... on InvalidInputError { __typename message }
          ... on LimitReachedError { __typename message }
          ... on RestProxyError { __typename message }
        }
      }
    `,
    {
      input: {
        channelId,
        text,
        mode: 'addToQueue',
        assets: [{ video: { url: videoUrl } }],
      },
    }
  );

  const result = data.createPost;
  if (result.__typename !== 'PostActionSuccess') {
    throw new Error(`Buffer post failed for channel ${channelId}: ${result.__typename} — ${result.message || 'no message'}`);
  }
  return result.post;
}

async function printChannels() {
  const channels = await getChannels();
  console.log('\nConnected Buffer channels detected:\n');
  for (const [platform, id] of Object.entries(channels)) {
    console.log(`  ${platform.padEnd(12)} id: ${id}`);
  }
  console.log('\nThese are used automatically — no need to copy anything into .env.\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  printChannels().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
