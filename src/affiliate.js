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

export function withAffiliateLine(caption, ...texts) {
  const line = affiliateLine(...texts);
  return line ? `${caption}\n\n${line}` : caption;
}
