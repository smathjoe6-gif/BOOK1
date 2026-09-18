import fetch from 'node-fetch';

// Every external HTTP call in this pipeline used to be a plain, unbounded
// fetch() -- if TikTok/Pinterest/Canva's servers ever stalled mid-request
// instead of erroring, the call (and the whole check cycle behind it) would
// hang forever with no way to recover except a manual restart. This is the
// one thing every one of those call sites should go through instead.
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
