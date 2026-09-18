import { google } from 'googleapis';
import fs from 'node:fs';

export async function uploadToYouTube(auth, { filePath, title, description }) {
  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          categoryId: '24', // Entertainment, same as the Make.com scenario used
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    },
    // No timeout here used to mean a stalled upload could hang the whole
    // check cycle forever instead of failing and letting the queue move on.
    { timeout: 5 * 60 * 1000 }
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
