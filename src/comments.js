import { google } from 'googleapis';
import { writeReplyWithAI } from './omniroute.js';
import { quotaBlocked, markQuotaBlocked, isQuotaError } from './youtubeQuota.js';

const REPLY_BANK = [
  "🙏 Thank you for watching -- GK Legend Studio appreciates you!",
  "🎉 So glad this landed with you -- more coming from GK Legend Studio soon.",
  "❤️ Thanks for the love! GK Legend Studio sees you.",
  "🙌 Appreciate you stopping by -- stay tuned for more from GK Legend Studio.",
];

const cachedChannelIds = new Map();
async function getOwnChannelId(youtube, key) {
  if (cachedChannelIds.get(key)) return cachedChannelIds.get(key);
  const res = await youtube.channels.list({ part: ['id'], mine: true });
  const id = res.data.items?.[0]?.id;
  if (id) cachedChannelIds.set(key, id);
  return id;
}

// opts.history = true: the history channel (@TotollsportGK, its own login).
export async function replyToNewComments(auth, opts = {}) {
  if (quotaBlocked()) {
    console.log('Comment replies skipped: YouTube quota is used up until the next reset.');
    return;
  }
  const youtube = google.youtube({ version: 'v3', auth });
  const channelId = await getOwnChannelId(youtube, opts.history ? 'history' : 'main');
  if (!channelId) return;

  let res;
  try {
    res = await youtube.commentThreads.list({
    part: ['snippet'],
    allThreadsRelatedToChannelId: channelId,
    order: 'time',
    maxResults: 25,
    textFormat: 'plainText',
    });
  } catch (err) {
    if (isQuotaError(err)) markQuotaBlocked();
    throw err;
  }

  const threads = res.data.items || [];
  let repliedCount = 0;

  for (const thread of threads) {
    const snippet = thread.snippet;
    if (!snippet || snippet.totalReplyCount > 0) continue;

    const topComment = snippet.topLevelComment?.snippet;
    if (!topComment || topComment.authorChannelId?.value === channelId) continue;

    let replyText;
    try {
      replyText = await writeReplyWithAI(topComment.textOriginal || topComment.textDisplay || '', opts);
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
      console.log(`${opts.history ? 'History channel: replied' : 'Replied'} to ${topComment.authorDisplayName}: "${replyText}"`);
    } catch (err) {
      console.error(`Could not reply to a comment from ${topComment.authorDisplayName}:`, err.message);
      if (isQuotaError(err)) {
        markQuotaBlocked();
        break;
      }
    }
  }

  if (repliedCount === 0) {
    console.log(`No new unanswered comments${opts.history ? ' (history channel)' : ''}.`);
  }
}
