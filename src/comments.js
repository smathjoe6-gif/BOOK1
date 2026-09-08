import { google } from 'googleapis';
import { writeReplyWithAI } from './omniroute.js';

const REPLY_BANK = [
  "🙏 Thank you for watching -- GK Legend Studio appreciates you!",
  "🎉 So glad this landed with you -- more coming from GK Legend Studio soon.",
  "❤️ Thanks for the love! GK Legend Studio sees you.",
  "🙌 Appreciate you stopping by -- stay tuned for more from GK Legend Studio.",
];

let cachedChannelId = null;
async function getOwnChannelId(youtube) {
  if (cachedChannelId) return cachedChannelId;
  const res = await youtube.channels.list({ part: ['id'], mine: true });
  cachedChannelId = res.data.items?.[0]?.id;
  return cachedChannelId;
}

export async function replyToNewComments(auth) {
  const youtube = google.youtube({ version: 'v3', auth });
  const channelId = await getOwnChannelId(youtube);
  if (!channelId) return;

  const res = await youtube.commentThreads.list({
    part: ['snippet'],
    allThreadsRelatedToChannelId: channelId,
    order: 'time',
    maxResults: 25,
    textFormat: 'plainText',
  });

  const threads = res.data.items || [];
  let repliedCount = 0;

  for (const thread of threads) {
    const snippet = thread.snippet;
    if (!snippet || snippet.totalReplyCount > 0) continue;

    const topComment = snippet.topLevelComment?.snippet;
    if (!topComment || topComment.authorChannelId?.value === channelId) continue;

    let replyText;
    try {
      replyText = await writeReplyWithAI(topComment.textOriginal || topComment.textDisplay || '');
    } catch (err) {
      replyText = REPLY_BANK[Math.floor(Math.random() * REPLY_BANK.length)];
    }

    try {
      await youtube.comments.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId: snippet.topLevelComment.id,
            textOriginal: replyText,
          },
        },
      });
      repliedCount++;
      console.log(`Replied to ${topComment.authorDisplayName}: "${replyText}"`);
    } catch (err) {
      console.error(`Could not reply to a comment from ${topComment.authorDisplayName}:`, err.message);
    }
  }

  if (repliedCount === 0) {
    console.log('No new unanswered comments.');
  }
}
