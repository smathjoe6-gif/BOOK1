// Adds one honest "affiliate link" line to a video's caption when AFFILIATE_PICKS_URL is set.
// AFFILIATE_PICKS_URL = Joe's public "GK picks" page (blank = off, nothing changes).
// By default the line is added only when the title/caption mentions one of AFFILIATE_KEYWORDS
// (music and DIY words); AFFILIATE_ALL=true adds it to every video.
import { config } from './config.js';

export function affiliateLine(...texts) {
  const url = config.affiliatePicksUrl;
  if (!url) return '';
  if (!config.affiliateAll) {
    const hay = texts.join(' ').toLowerCase();
    if (!config.affiliateKeywords.some((w) => w && hay.includes(w))) return '';
  }
  return `Tools and lessons I recommend (affiliate link): ${url}`;
}

// One link per product (TikTok Shop test, 29 Oct 2026): PRODUCT_LINKS="goat=https://...;oukitel=https://...".
// A link is added when the video's FILE NAME contains the word (case ignored). Blank = off.
export function productLinkLine(fileName = '') {
  const name = String(fileName).toLowerCase();
  const hit = (config.productLinks || []).find(({ word }) => word && name.includes(word));
  return hit ? `Product link (affiliate): ${hit.url}` : '';
}

export function withAffiliateLine(caption, ...texts) {
  const lines = [affiliateLine(...texts), productLinkLine(texts[0])].filter(Boolean);
  return lines.length ? `${caption}\n\n${lines.join('\n')}` : caption;
}
