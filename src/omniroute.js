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

const VIDEO_CONCEPT_SYSTEM_PROMPT = `You are the creative director for "GK Legend Studio," a brand celebrating Somali heritage and culture through short viral videos. Describe a single short video scene for an AI video generator to create -- vivid, cinematic, and specific (setting, subject, mood, camera feel). One or two sentences, no hashtags, no titles, just the visual description.`;

export async function writeVideoConceptWithAI() {
  const userPrompt = `Describe one new short video concept (5-10 seconds) that fits GK Legend Studio's brand. Make it different from generic stock footage -- give it real cultural warmth and specificity.`;
  return await askAI(VIDEO_CONCEPT_SYSTEM_PROMPT, userPrompt);
}
