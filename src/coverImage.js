import fs from 'node:fs';
import { config } from './config.js';
import { pickFromCoverPool } from './coverPool.js';
import { generateCoverImage } from './canvaCover.js';
import { uploadPublicImage } from './drive.js';

// Single entry point every call site should use to get a unique Pinterest
// cover for a video, instead of calling the pool or Canva individually.
// Tries the manual pool first (COVER_POOL_FOLDER_ID -- Joe drops images in
// himself, zero setup) since it's simpler and always available once he's
// using it; falls back to the Canva API (CANVA_BRAND_TEMPLATE_ID) if the
// pool is empty and Canva is configured. Returns a public URL, or '' if
// neither source has anything available (callers already treat a blank
// cover as "fall back to Make's generic rotation," so this degrades safely).
export async function getCoverImage(auth, title) {
  const pooled = await pickFromCoverPool(auth);
  if (pooled) return pooled;

  if (!config.canvaBrandTemplateId) return '';

  const localCoverPath = await generateCoverImage(title);
  try {
    return await uploadPublicImage(
      auth,
      localCoverPath,
      `pin-cover-${Date.now()}.png`,
      config.pinterestCoversFolderId
    );
  } finally {
    fs.unlink(localCoverPath, () => {});
  }
}
