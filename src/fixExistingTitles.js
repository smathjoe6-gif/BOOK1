import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { randomThemedCaption } from './autoCaption.js';

const auth = loadOAuthClient();
const youtube = google.youtube({ version: 'v3', auth });

const UGLY_TITLE_PATTERN = /^Grok Video [0-9a-f]{6,}/i;

async function run() {
  const channelRes = await youtube.channels.list({ part: ['contentDetails'], mine: true });
  const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

  let pageToken;
  let fixedCount = 0;
  let checkedCount = 0;

  do {
    const res = await youtube.playlistItems.list({
      part: ['snippet'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });

    for (const item of res.data.items || []) {
      checkedCount++;
      const title = item.snippet.title;
      if (!UGLY_TITLE_PATTERN.test(title)) continue;

      const videoId = item.snippet.resourceId.videoId;

      try {
        const videoRes = await youtube.videos.list({ part: ['snippet'], id: [videoId] });
        const snippet = videoRes.data.items[0].snippet;

        const themed = randomThemedCaption();
        snippet.title = themed.title;
        snippet.description = `${themed.capture} ${themed.hashtag}`;

        await youtube.videos.update({ part: ['snippet'], requestBody: { id: videoId, snippet } });
        console.log(`Fixed: "${title}" -> "${themed.title}"`);
        fixedCount++;
      } catch (err) {
        console.error(`Could not fix "${title}":`, err.message);
      }
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`\nChecked ${checkedCount} video(s), fixed ${fixedCount} with ugly titles.`);
}

run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
