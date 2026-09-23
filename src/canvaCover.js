import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { getCanvaAccessToken } from './canvaAuth.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';
import { pipeWithTimeout } from './drive.js';

const API_BASE = 'https://api.canva.com/rest/v1';

// Canva's error bodies are { code, message } at the top level (not nested
// under "error"), so without this every failure only showed the HTTP status.
function canvaError(data, res) {
  const detail = data?.message || data?.error?.message || data?.code;
  return detail ? `${res.status} -- ${detail}` : `${res.status}`;
}

async function pollJob(url, headers, extractStatus, extractResult, label) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetchWithTimeout(url, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Canva ${label} check failed: ${canvaError(data, res)}`);
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

// Uploads a local image to Canva as an asset (for autofilling an image
// placeholder field) and waits for it to finish processing. Returns the
// asset ID.
async function uploadAsset(localPath, authHeader) {
  const fileBuffer = fs.readFileSync(localPath);
  // Canva expects this header to be JSON with the file name base64-encoded
  // inside it: {"name_base64": "..."}. It used to be base64 of the whole
  // JSON, which Canva rejected with a 400 on every upload (23 Sep 2026).
  const metadata = JSON.stringify({ name_base64: Buffer.from(`pool-cover-${Date.now()}`).toString('base64') });

  const res = await fetchWithTimeout(`${API_BASE}/asset-uploads`, {
    method: 'POST',
    headers: {
      ...authHeader,
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': metadata,
    },
    body: fileBuffer,
  }, 60000);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Canva asset upload failed: ${canvaError(data, res)}`);
  }

  return pollJob(
    `${API_BASE}/asset-uploads/${data.job.id}`,
    authHeader,
    (d) => d.job?.status,
    (d) => d.job.asset.id,
    'asset upload'
  );
}

// Generates a unique Pinterest cover image for one video by autofilling the
// configured brand template's title field (and, if sourceImagePath is
// given, its image placeholder field too -- e.g. a raw photo Joe dropped
// into the manual cover pool, run through the template to get a polished,
// titled design instead of using the raw photo as-is), then exporting the
// result as a PNG. Returns a local file path. Callers are responsible for
// deleting it and for re-hosting it somewhere permanent -- Canva's own
// export links expire.
export async function generateCoverImage(title, sourceImagePath) {
  if (!config.canvaBrandTemplateId) {
    throw new Error('CANVA_BRAND_TEMPLATE_ID is not set -- run the Bulk create/brand template setup in Canva first.');
  }

  const accessToken = await getCanvaAccessToken();
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const headers = { ...authHeader, 'Content-Type': 'application/json' };

  const data = {
    [config.canvaTitleField]: { type: 'text', text: title },
  };

  if (sourceImagePath) {
    if (!config.canvaImageField) {
      throw new Error('CANVA_IMAGE_FIELD is not set -- tag an image placeholder as a data field in the brand template first.');
    }
    const assetId = await uploadAsset(sourceImagePath, authHeader);
    data[config.canvaImageField] = { type: 'image', asset_id: assetId };
  }

  const autofillRes = await fetchWithTimeout(`${API_BASE}/autofills`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand_template_id: config.canvaBrandTemplateId,
      data,
    }),
  });
  const autofillData = await autofillRes.json();
  if (!autofillRes.ok) {
    throw new Error(`Canva autofill request failed: ${canvaError(autofillData, autofillRes)}`);
  }

  const designId = await pollJob(
    `${API_BASE}/autofills/${autofillData.job.id}`,
    headers,
    (d) => d.job?.status,
    (d) => d.job.result.design.id,
    'autofill'
  );

  const exportRes = await fetchWithTimeout(`${API_BASE}/exports`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ design_id: designId, format: { type: 'png' } }),
  });
  const exportData = await exportRes.json();
  if (!exportRes.ok) {
    throw new Error(`Canva export request failed: ${canvaError(exportData, exportRes)}`);
  }

  const downloadUrl = await pollJob(
    `${API_BASE}/exports/${exportData.job.id}`,
    headers,
    (d) => d.job?.status,
    (d) => d.job.urls[0],
    'export'
  );

  const destPath = path.join(os.tmpdir(), `gk-pin-cover-${Date.now()}.png`);
  const imageRes = await fetchWithTimeout(downloadUrl);
  if (!imageRes.ok) {
    throw new Error(`Could not download the generated cover image: ${imageRes.status}`);
  }
  const dest = fs.createWriteStream(destPath);
  await pipeWithTimeout(imageRes.body, dest);

  return destPath;
}
