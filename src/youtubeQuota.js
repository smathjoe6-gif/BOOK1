// YouTube's daily API quota resets at midnight Pacific time (about 08:00
// London in winter). Once YouTube answers "quota exceeded", the optional
// extras (first comments, comment replies) are skipped until the next reset,
// so the remaining quota goes to uploads. State survives restarts.
import fs from 'fs';

const FILE = 'youtube-quota-block.json';

export function isQuotaError(err) {
  const text = `${err?.message || ''} ${JSON.stringify(err?.errors || '')}`;
  return /quota/i.test(text) && /exceeded|exhausted|cannot be completed/i.test(text);
}

// Next midnight in America/Los_Angeles, as a UTC timestamp (ms).
export function nextQuotaReset(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const h = Number(parts.hour) % 24;
  const secondsSinceMidnight = h * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  return now.getTime() + (86400 - secondsSinceMidnight) * 1000;
}

export function markQuotaBlocked(now = new Date()) {
  try {
    fs.writeFileSync(FILE, JSON.stringify({ until: nextQuotaReset(now) }));
  } catch {}
}

export function quotaBlocked(now = new Date()) {
  try {
    const { until } = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Number(until) > now.getTime();
  } catch {
    return false;
  }
}
