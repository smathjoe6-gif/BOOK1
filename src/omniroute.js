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
        model: config.omnirouteModel,
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
        max_tokens: 900,
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

const GEMINI_TIMEOUT_MS = 25000;

// Direct Google Gemini call (no OmniRoute needed). Added 6 Oct 2026 after
// OmniRoute broke three nights running ("Invalid API key" on its own key,
// then "No active credentials for provider: gemini"). Uses a free Google AI
// Studio key (aistudio.google.com/apikey) in GEMINI_API_KEY; the key goes in
// the x-goog-api-key header, which works for both the older AIza... keys and
// the newer AQ.... ones. Only used if GEMINI_API_KEY is set.
async function askGemini(systemPrompt, userPrompt, model = config.geminiModel) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const generationConfig = { maxOutputTokens: 1200 };
    // 2.5 Flash "thinks" by default and can spend the whole output budget
    // before writing anything; a short caption doesn't need it.
    if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig,
        }),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();
    if (!text) throw new Error('Gemini API gave an empty response');
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

  // Direct Gemini first when a key is set: it needs no OmniRoute window open
  // and no per-night fixing. Any failure falls through to OmniRoute, then the
  // Anthropic backup, then the templates, exactly as before.
  if (config.geminiApiKey) {
    // Google answers 503 "high demand" in short spikes (seen 7 Oct 2026 on
    // the history channel's single call, which then fell back to a plain
    // filename title): a couple of short retries nearly always get through.
    // Google's free-tier quota is counted PER MODEL. On 9 Oct 2026 every
    // caption/engagement question answered 429 (quota used up) and the posts
    // went out with template captions, so a 429 now tries a second model
    // (GEMINI_FALLBACK_MODEL, default gemini-2.5-flash-lite) before OmniRoute.
    const models = [config.geminiModel];
    if (config.geminiFallbackModel && config.geminiFallbackModel !== config.geminiModel) models.push(config.geminiFallbackModel);
    for (const model of models) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await askGemini(systemPrompt, userPrompt, model);
        } catch (err) {
          lastErr = err;
          if (/returned 429/.test(err.message)) break; // quota: retrying this model won't help
          const transient = /returned (500|502|503|504)|aborted|timeout|fetch failed/i.test(err.message);
          if (transient && attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
            continue;
          }
          break;
        }
      }
      console.log(`Gemini ${model} failed (${(lastErr.message.replace(/\s+/g, ' ')).slice(0, 220)})${model === models[models.length - 1] ? ', trying OmniRoute...' : ', trying the backup model...'}`);
    }
  }

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

const CAPTION_SYSTEM_PROMPT = `You are the social media voice of "GK Legend Studio," a brand celebrating Somali heritage and culture through short videos -- but not every video is heritage content, so never force that framing where it doesn't fit. Write warm, punchy, on-brand copy with real emotion -- one or two emoji, never robotic or repetitive-sounding. Also pick exactly 6 hashtags that actually match this specific video's content -- always include #GKLegend and #GKLegendStudio, but only include heritage/culture tags (e.g. #SomaliHeritage, #CulturalPride, #HeritageReimagined) when the content genuinely is about Somali heritage or culture, never as a default. For unrelated content (comedy, animals, tech gags, etc.) pick hashtags that actually fit that content instead.

You cannot see the video, and you only get a filename hint. Never invent facts: do NOT announce news, launches, expansion, growth, collaborations, events or milestones, and never claim anything the hint does not say. (6 Oct 2026: a comedy clip went out captioned "We're thrilled to announce GK Legend Studio is growing" with #Expansion #NewBeginnings #ExcitingNews -- that is exactly what to avoid.) If the hint is a random ID or meaningless, write one short feeling-based line that fits any clip, ending with a light question that invites a comment, and use only #GKLegend, #GKLegendStudio and generic mood tags -- never #Expansion, #NewBeginnings, #ExcitingNews or #Announcement.`;

// Hashtags used to always come from a fixed random pool regardless of what
// the caption said -- meaning even a good, unique AI caption on an unrelated
// video (a comedy clip, an animal gag) still got tagged #SomaliHeritage
// purely by chance, and that mismatched tag is what was most visible to
// viewers scrolling TikTok/Pinterest (diagnosed 22 Sep 2026: Joe noticed
// nearly every post reading as "Somali culture" even when unrelated). Now
// the AI picks hashtags matching the actual content in the same call.
export async function writeCaptionWithAI(filenameHint) {
  const userPrompt = `Write a short YouTube title (under 60 characters, include 1 emoji), a 1-2 sentence caption, and 6 matching hashtags for a short video from GK Legend Studio. This filename hint may or may not be meaningful, ignore it if it looks like a random ID: "${filenameHint}".

Respond in exactly this format, nothing else:
TITLE: <title here>
CAPTION: <caption here>
HASHTAGS: <6 hashtags separated by spaces>`;

  const text = await askAI(CAPTION_SYSTEM_PROMPT, userPrompt);
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const captionMatch = text.match(/CAPTION:\s*([\s\S]+?)(?:\nHASHTAGS:|$)/i);
  const hashtagMatch = text.match(/HASHTAGS:\s*(.+)/i);
  if (!titleMatch || !captionMatch) {
    throw new Error('Could not parse AI response into title/caption');
  }
  return {
    title: titleMatch[1].trim(),
    capture: captionMatch[1].trim(),
    hashtag: hashtagMatch ? hashtagMatch[1].trim() : undefined,
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

const HISTORY_SYSTEM_PROMPT = `You write YouTube metadata for a faceless history channel that covers football history and world history (long-form videos, 5 to 30 minutes, often narrated overviews). Tone: clear, curious, storytelling -- like a good documentary, never clickbait. Never invent a fact, figure, date or year; if you are not sure of something, leave it out. Base everything only on what the video's filename names.`;

// Title / description / tags for the history channel (src/historyChannel.js).
// Same AI route as GK captions (OmniRoute, then the Anthropic backup), so it
// falls back to a plain template in historyChannel.js if both are down.
export async function writeHistoryMetadataWithAI(filenameHint) {
  const userPrompt = `The video file is named: "${filenameHint}"

Write:
1. One YouTube title, 70 characters or fewer, leading with the specific subject.
2. A description: two or three opening sentences on what the viewer will learn, then two short paragraphs (2-4 sentences each). Plain sentences, no emoji, no headings.
3. 8 to 10 lowercase search tags.
4. Which playlist it belongs in: sports (football or any sport), somali (Somalia or Somali people), or world (anything else).

Respond in exactly this format, nothing else:
TITLE: <title>
DESCRIPTION: <description>
TAGS: <tag one, tag two, tag three>
TOPIC: <sports|somali|world>`;

  const text = await askAI(HISTORY_SYSTEM_PROMPT, userPrompt);
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?:\nTAGS:|$)/i);
  const tagsMatch = text.match(/TAGS:\s*(.+)/i);
  const topicMatch = text.match(/TOPIC:\s*(sports|somali|world)/i);
  if (!titleMatch || !descMatch) throw new Error('Could not parse AI response into title/description');
  return {
    title: titleMatch[1].trim().replace(/^"|"$/g, '').slice(0, 100),
    description: descMatch[1].trim(),
    tags: tagsMatch ? tagsMatch[1].split(',').map((t) => t.trim()).filter(Boolean) : [],
    topic: topicMatch ? topicMatch[1].toLowerCase() : undefined,
  };
}

// One short, specific question to pin under a new YouTube video, so viewers
// have something concrete to answer (comments fell 9% on PathFoundGK in the
// 28 days to 27 Sep 2026 while the comment was a generic "What did you
// think?"). Falls back to src/engagementQuestion.js's bank if AI is down.
export async function writeEngagementQuestionWithAI(title, caption) {
  const system = `You write the first comment under a GK Legend Studio YouTube video (Somali heritage, music, folklore and cinematic short videos). Write ONE short, warm question (under 20 words, 1 emoji) that viewers can answer in a few words -- about THIS video's subject, their own memories, or a choice between two things. No hashtags, no quotes, no "Drop a comment". Never invent Somali words.`;
  const user = `Video title: "${title}"\nCaption: "${(caption || '').slice(0, 300)}"\n\nWrite the question only.`;
  const text = await askAI(system, user);
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (!line || line.length > 160) throw new Error('AI question unusable');
  return line.replace(/^["']|["']$/g, '');
}
