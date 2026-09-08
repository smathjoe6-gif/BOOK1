import fetch from 'node-fetch';

const OMNIROUTE_URL = 'http://localhost:20128/v1/chat/completions';
const TIMEOUT_MS = 15000;

async function askAI(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OMNIROUTE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OmniRoute returned ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OmniRoute gave an empty response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

const CAPTION_SYSTEM_PROMPT = `You are the social media voice of "GK Legend Studio," a brand celebrating Somali heritage and culture through short videos. Write warm, punchy, on-brand copy with real emotion -- one or two emoji, never robotic or repetitive-sounding. Never include hashtags in your response.`;

export async function writeCaptionWithAI(filenameHint) {
  const userPrompt = `Write a short YouTube title (under 60 characters, include 1 emoji) and a 1-2 sentence caption for a short video from GK Legend Studio. This filename hint may or may not be meaningful, ignore it if it looks like a random ID: "${filenameHint}".

Respond in exactly this format, nothing else:
TITLE: <title here>
CAPTION: <caption here>`;

  const text = await askAI(CAPTION_SYSTEM_PROMPT, userPrompt);
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const captionMatch = text.match(/CAPTION:\s*([\s\S]+)/i);
  if (!titleMatch || !captionMatch) {
    throw new Error('Could not parse AI response into title/caption');
  }
  return {
    title: titleMatch[1].trim(),
    capture: captionMatch[1].trim(),
  };
}

const REPLY_SYSTEM_PROMPT = `You are the social media voice of "GK Legend Studio." Reply warmly and briefly (under 25 words) to a YouTube comment, genuine and specific to what they said where possible, with one emoji. Never sound like a canned template.`;

export async function writeReplyWithAI(commentText) {
  const userPrompt = `Someone commented this on one of our videos: "${commentText}"\n\nWrite a short, warm reply.`;
  return await askAI(REPLY_SYSTEM_PROMPT, userPrompt);
}

const VIDEO_CONCEPT_SYSTEM_PROMPT = `You are the creative director for "GK Legend Studio," making short AI-generated videos meant to actually go viral and grow followers -- not just look nice.

What's working on TikTok/Reels/Shorts right now: the hook has to land in the very first second (something visually striking or surprising happening immediately, not a slow establishing shot), the clip should be only as long as its payoff needs (nothing dragging), and raw/authentic energy beats overly polished stock-footage vibes. Generic "wait for it" setups are dead -- make the first frame itself the hook.

Alternate between two lanes across requests: (1) broad, universally engaging content with no cultural framing needed -- oddly satisfying moments, striking nature/animal/food/craft visuals, the kind of thing anyone scrolling would stop for -- and (2) GK Legend Studio's Somali heritage and culture lane, but shot with the same punchy, arresting energy as lane 1, not slow or documentary-style.

Describe a single short video scene for an AI video generator to create -- vivid, specific, and describe what's happening in the very first moment. Also describe the sound: name the actual ambient sound, music, or noise happening in the scene (the video generator produces synced audio, so describing it gets you real sound, not a silent clip). One to three sentences, no hashtags, no titles, just the scene and its sound.`;

export async function writeVideoConceptWithAI() {
  const userPrompt = `Describe one new short video concept (about 10 seconds) with a first-second hook and real ambient sound described. Pick whichever of the two lanes (broad viral appeal, or GK Legend Studio's Somali heritage) feels freshest right now -- don't repeat the same lane every time.`;
  return await askAI(VIDEO_CONCEPT_SYSTEM_PROMPT, userPrompt);
}
