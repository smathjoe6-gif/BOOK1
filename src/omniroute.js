import fetch from 'node-fetch';
import { config } from './config.js';

const OMNIROUTE_URL = 'http://localhost:20128/v1/chat/completions';
const TIMEOUT_MS = 25000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

async function requestOnce(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OMNIROUTE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.omnirouteApiKey ? { Authorization: `Bearer ${config.omnirouteApiKey}` } : {}),
      },
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

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_TIMEOUT_MS = 25000;

// Hard backup that doesn't go through OmniRoute at all -- called directly
// over the network, so it works even when OmniRoute itself isn't running on
// Joe's Mac (app closed, Mac asleep), not just when a connected provider is
// briefly unreachable. Only used if ANTHROPIC_API_KEY is set.
async function askAnthropic(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) throw new Error('Anthropic API gave an empty response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// OmniRoute already routes across whichever AI providers Joe has connected
// on his end -- "model: auto" picks one of them per request. A single failed
// attempt here (Mac just waking up, a provider cold-starting, one dropped
// connection) shouldn't immediately give up and fall back to a canned
// template, since a retry a few seconds later -- possibly landing on a
// different provider via "auto" -- often succeeds. So this retries a couple
// of times first. If OmniRoute is still down after that (most likely
// because it isn't running at all, not a transient blip), and a direct
// Anthropic key is configured, that's tried next as a hard backup that
// doesn't depend on OmniRoute or the Mac app being open. Only if both fail
// does the caller (autoCaption.js, the reply pipeline) fall back to its own
// built-in templates.
async function askAI(systemPrompt, userPrompt) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestOnce(systemPrompt, userPrompt);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        console.log(`OmniRoute attempt ${attempt}/${MAX_ATTEMPTS} failed (${err.message}), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }

  if (config.anthropicApiKey) {
    try {
      console.log('OmniRoute exhausted, falling back to direct Anthropic call...');
      return await askAnthropic(systemPrompt, userPrompt);
    } catch (err) {
      console.log(`Anthropic backup also failed (${err.message}), falling back to template.`);
      lastErr = err;
    }
  }

  throw lastErr;
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

const REPLY_SYSTEM_PROMPT = `You are the social media voice of "GK Legend Studio." Reply warmly and briefly (under 30 words) to a YouTube comment, genuine and specific to what they said where possible, with one emoji. Never sound like a canned template.

Always end the reply with a short question back to the commenter -- something that invites them to say more (their own memory, opinion, or experience related to what they said). This is the single biggest driver of reply engagement, so never skip it, even for a short or simple comment. If the comment is a vote or answer to a poll (e.g. naming a number, an instrument, a genre, a cultural element), acknowledge their specific choice by name before asking the follow-up question.`;

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
