import { google } from 'googleapis';
import fs from 'node:fs';

export async function uploadToYouTube(auth, { filePath, title, description, tags, categoryId = '24', containsSyntheticMedia, timeoutMs = 5 * 60 * 1000 }) {
  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          categoryId, // default 24 = Entertainment, same as the Make.com scenario used
          ...(tags ? { tags } : {}),
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
          ...(containsSyntheticMedia !== undefined ? { containsSyntheticMedia } : {}),
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    },
    // No timeout here used to mean a stalled upload could hang the whole
    // check cycle forever instead of failing and letting the queue move on.
    { timeout: timeoutMs }
  );

  return res.data; // includes res.data.id — the new video's YouTube ID
}

// Posts a top-level engagement-invite comment on a video, same idea as the
// Facebook route's "Drop a comment below" comment. Failing to post this
// should never block anything else -- callers should wrap it in try/catch.
export async function postEngagementComment(auth, videoId, text) {
  const youtube = google.youtube({ version: 'v3', auth });
  await youtube.commentThreads.insert(
    {
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: {
            snippet: { textOriginal: text },
          },
        },
      },
    },
    { timeout: 30000 }
  );
}

// Finds a playlist on the signed-in channel whose title matches `matcher`
// (a RegExp), or creates one with `title`/`description` if none exists.
// Used by the history channel (src/historyChannel.js) to sort videos into
// Sports / World / Somali history playlists by the Drive folder they came from.
export async function findOrCreatePlaylist(auth, { matcher, title, description }) {
  const youtube = google.youtube({ version: 'v3', auth });
  let pageToken;
  do {
    const res = await youtube.playlists.list(
      { part: ['snippet'], mine: true, maxResults: 50, pageToken },
      { timeout: 30000 }
    );
    const hit = (res.data.items || []).find((p) => matcher.test(p.snippet?.title || ''));
    if (hit) return hit.id;
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  const created = await youtube.playlists.insert(
    {
      part: ['snippet', 'status'],
      requestBody: { snippet: { title, description }, status: { privacyStatus: 'public' } },
    },
    { timeout: 30000 }
  );
  return created.data.id;
}

export async function addVideoToPlaylist(auth, playlistId, videoId) {
  const youtube = google.youtube({ version: 'v3', auth });
  await youtube.playlistItems.insert(
    {
      part: ['snippet'],
      requestBody: { snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } },
    },
    { timeout: 30000 }
  );
}
