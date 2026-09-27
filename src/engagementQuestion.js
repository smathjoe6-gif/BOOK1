import { writeEngagementQuestionWithAI } from './omniroute.js';

// The pinned first comment under every new YouTube video. Used to be the same
// generic "What did you think? Drop a comment below" every time; now it's a
// real question matched to the video, which people actually answer.
const TOPIC_QUESTIONS = [
  {
    match: /lion|libaax|hyena|waraabe|fox|dawaco|hare|bakayle|camel|geel|animal|fable|folklore/i,
    questions: [
      'Which animal in this story would you trust the most? 🦁',
      'Did you hear stories like this growing up? Which one do you remember? 📖',
      'Lion or hyena — who was the real winner here? 🤔',
      'What lesson did your elders teach with a story like this? 🌙',
    ],
  },
  {
    match: /kaban|oud|music|song|hees|qaraami|dhaanto|buraanbur|rhythm|drum|sound|beat/i,
    questions: [
      'Which Somali song could you listen to forever? 🎶',
      'Kaban or drum — which sound hits your heart first? 🥁',
      'Who is the Somali singer your family always played at home? 🎵',
      'Should we make a full song version of this? Yes or no? 🎧',
    ],
  },
  {
    match: /gabay|poem|poet|poetry|verse|geeraar/i,
    questions: [
      'Do you know a gabay by heart? Share one line below ✍️',
      'Who is the greatest Somali poet of all time? 📜',
      'Poetry or song — which carries our history better? 🤔',
    ],
  },
  {
    match: /heritage|legacy|culture|roots|home|elders|tradition|somali/i,
    questions: [
      'Where is your family from? Tell us your city or region 🌍',
      'What tradition do you want the next generation to keep? 🕊️',
      'What does home mean to you in one word? 🏡',
    ],
  },
];

const GENERAL_QUESTIONS = [
  'What should our next video be about? Give us one idea 💡',
  'Rate this one from 1 to 10 — be honest! ⭐',
  'Which moment in this video hit you the hardest? 🎬',
  'Where are you watching from today? 🌍',
  'Who would you share this with first? 👀',
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export async function engagementQuestion(title, caption) {
  try {
    return await writeEngagementQuestionWithAI(title, caption);
  } catch {
    const text = `${title} ${caption || ''}`;
    const topic = TOPIC_QUESTIONS.find((t) => t.match.test(text));
    return pick(topic ? topic.questions : GENERAL_QUESTIONS);
  }
}
