import { google } from 'googleapis';
import fs from 'node:fs';

export async function uploadToYouTube(auth, { filePath, title, description }) {
  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.videos.insert({
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
  });

  return res.data; // includes res.data.id — the new video's YouTube ID
}
