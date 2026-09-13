import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fetch from 'node-fetch';
import { config } from './config.js';
import { getCanvaAccessToken } from './canvaAuth.js';

const API_BASE = 'https://api.canva.com/rest/v1';

async function pollJob(url, headers, extractStatus, extractResult, label) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Canva ${label} check failed: ${data.error?.message || res.status}`);
    }
    const status = extractStatus(data);
    if (status === 'success') return extractResult(data);
    if (status === 'failed') {
      throw new Error(`Canva ${label} job failed: ${data.job?.error?.message || 'unknown error'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Canva ${label} job timed out after 60 seconds`);
}

// Generates a unique Pinterest cover image for one video by autofilling the
// configured brand template's title field, then exporting it as a PNG.
// Returns a local file path. Callers are responsible for deleting it and for
// re-hosting it somewhere permanent -- Canva's own export links expire.
export async function generateCoverImage(title) {
  if (!config.canvaBrandTemplateId) {
    throw new Error('CANVA_BRAND_TEMPLATE_ID is not set -- run the Bulk create/brand template setup in Canva first.');
  }

  const accessToken = await getCanvaAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const autofillRes = await fetch(`${API_BASE}/autofills`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand_template_id: config.canvaBrandTemplateId,
      data: {
        [config.canvaTitleField]: { type: 'text', text: title },
      },
    }),
  });
  const autofillData = await autofillRes.json();
  if (!autofillRes.ok) {
    throw new Error(`Canva autofill request failed: ${autofillData.error?.message || autofillRes.status}`);
  }

  const designId = await pollJob(
    `${API_BASE}/autofills/${autofillData.job.id}`,
    headers,
    (d) => d.job?.status,
    (d) => d.job.result.design.id,
    'autofill'
  );

  const exportRes = await fetch(`${API_BASE}/exports`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ design_id: designId, format: { type: 'png' } }),
  });
  const exportData = await exportRes.json();
  if (!exportRes.ok) {
    throw new Error(`Canva export request failed: ${exportData.error?.message || exportRes.status}`);
  }

  const downloadUrl = await pollJob(
    `${API_BASE}/exports/${exportData.job.id}`,
    headers,
    (d) => d.job?.status,
    (d) => d.job.urls[0],
    'export'
  );

  const destPath = path.join(os.tmpdir(), `gk-pin-cover-${Date.now()}.png`);
  const imageRes = await fetch(downloadUrl);
  if (!imageRes.ok) {
    throw new Error(`Could not download the generated cover image: ${imageRes.status}`);
  }
  const dest = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    imageRes.body.pipe(dest).on('finish', resolve).on('error', reject);
  });

  return destPath;
}
