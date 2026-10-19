import { getCanvaAccessToken } from './canvaAuth.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

// Reads Joe's finished post pictures straight from his Canva folders and
// exports a fresh PNG link for the one being posted -- so nothing has to be
// downloaded or copied into Drive by hand. Needs the Canva login scopes
// folder:read + design:content:read (npm run canva-auth, once).
const API_BASE = 'https://api.canva.com/rest/v1';

function canvaError(data, res) {
  const detail = data && (data.message || (data.error && data.error.message) || data.code);
  return detail ? `${res.status} -- ${detail}` : `${res.status}`;
}

async function headers() {
  return { Authorization: `Bearer ${await getCanvaAccessToken()}`, 'Content-Type': 'application/json' };
}

// Canva Docs (text documents) are portrait A4-ish (~0.707 wide/high); the
// finished post pictures are landscape, square, 4:5 or 9:16. Only pictures
// are wanted, so anything shaped like a Doc is left out.
function looksLikePicture(thumb) {
  if (!thumb || !thumb.width || !thumb.height) return true;
  const ratio = thumb.width / thumb.height;
  return Math.abs(ratio - 0.707) > 0.025;
}

export async function listCanvaPictures(folderId) {
  const h = await headers();
  const found = [];
  let continuation = '';
  for (let page = 0; page < 5; page++) {
    const url = new URL(`${API_BASE}/folders/${folderId}/items`);
    url.searchParams.set('item_types', 'design');
    url.searchParams.set('sort_by', 'modified_descending');
    url.searchParams.set('limit', '50');
    if (continuation) url.searchParams.set('continuation', continuation);
    const res = await fetchWithTimeout(url.toString(), { headers: h });
    const data = await res.json();
    if (!res.ok) throw new Error(`Canva folder listing failed: ${canvaError(data, res)}`);
    for (const item of data.items || []) {
      const d = item.design;
      if (item.type === 'design' && d && d.id && looksLikePicture(d.thumbnail)) {
        found.push({ id: d.id, name: d.title || d.id });
      }
    }
    continuation = data.continuation;
    if (!continuation) break;
  }
  return found;
}

// Exports one design as a PNG and returns a fresh download link.
export async function exportCanvaPng(designId) {
  const h = await headers();
  const res = await fetchWithTimeout(`${API_BASE}/exports`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ design_id: designId, format: { type: 'png', as_single_image: true } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Canva export request failed: ${canvaError(data, res)}`);
  for (let i = 0; i < 30; i++) {
    const check = await fetchWithTimeout(`${API_BASE}/exports/${data.job.id}`, { headers: h });
    const body = await check.json();
    if (!check.ok) throw new Error(`Canva export check failed: ${canvaError(body, check)}`);
    const status = body.job && body.job.status;
    if (status === 'success') return body.job.urls[0];
    if (status === 'failed') throw new Error(`Canva export failed: ${(body.job.error && body.job.error.message) || 'unknown error'}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Canva export timed out after 60 seconds');
}
