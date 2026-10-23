import { google } from 'googleapis';
import { loadOAuthClient } from './googleAuth.js';
import { writeReplyWithAI } from './omniroute.js';

// Replies to OLD comments under ONE video (the normal reply step only looks at
// the 25 newest comments of the whole channel, so old ones are never reached).
// Comments that already have a reply, and your own comments, are skipped.
//
//   npm run reply-old-comments -- <video link or id>             (dry run: shows who would get which reply)
//   npm run reply-old-comments -- <video link or id> --do        (really replies, max 10 per run)
//   npm run reply-old-comments -- <video link or id> --do --max=5
//
// Replies use the same AI writer as the normal reply step. Read the dry run
// first: comments about religion or politics should be answered by a person.
// Each reply costs 50 YouTube quota units. Wait a few seconds between replies.

const SKIP_WORDS = /\b(nuah|nuh|hud|lud|ibrahim|prophet|allah|politic|president|clan|tribe|government|war)\b/i;

function videoIdFrom(arg) {
  const m = String(arg || '').match(/[?&]v=([\w-]{11})/) || String(arg || '').match(/youtu\.be\/([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(arg || '') ? arg : '';
}

async function main() {
  const args = process.argv.slice(2);
  const videoId = videoIdFrom(args.find((a) => !a.startsWith('--')));
  const doIt = args.includes('--do');
  const max = Number((args.find((a) => a.startsWith('--max=')) || '--max=10').split('=')[1]) || 10;
  if (!videoId) {
    console.log('Give the video link or its 11-character id, e.g. npm run reply-old-comments -- "https://www.youtube.com/watch?v=XXXXXXXXXXX"');
    return;
  }

  const auth = await loadOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });
  const me = (await youtube.channels.list({ part: ['id'], mine: true })).data.items?.[0]?.id;

  const todo = [];
  let pageToken;
  let seen = 0;
  do {
    const res = await youtube.commentThreads.list({
      part: ['snippet'],
      videoId,
      maxResults: 100,
      order: 'time',
      textFormat: 'plainText',
      pageToken,
    });
    for (const t of res.data.items || []) {
      seen++;
      const s = t.snippet;
      const c = s?.topLevelComment?.snippet;
      if (!c || s.totalReplyCount > 0 || c.authorChannelId?.value === me) continue;
      const text = c.textOriginal || c.textDisplay || '';
      if (SKIP_WORDS.test(text)) {
        console.log(`skip (religion/politics, answer by hand): ${c.authorDisplayName}: ${text.slice(0, 80)}`);
        continue;
      }
      todo.push({ id: s.topLevelComment.id, who: c.authorDisplayName, text });
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`${seen} comment thread(s) read, ${todo.length} without a reply.`);
  let done = 0;
  for (const item of todo) {
    if (done >= max) { console.log(`Stopped at --max=${max}. Run again for more.`); break; }
    let reply;
    try { reply = await writeReplyWithAI(item.text); } catch { reply = '🙏 Thank you for the love -- welcome to the GK Legend family!'; }
    console.log(`${item.who}: "${item.text.slice(0, 70)}"\n   -> ${reply}`);
    if (!doIt) continue;
    try {
      await youtube.comments.insert({ part: ['snippet'], requestBody: { snippet: { parentId: item.id, textOriginal: reply } } });
      done++;
      await new Promise((r) => setTimeout(r, 4000));
    } catch (err) {
      console.error('  could not reply:', err.message);
    }
  }
  if (!doIt) console.log('\nDry run only. Add --do to really reply.');
  else console.log(`\nReplied to ${done} comment(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
