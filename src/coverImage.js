import fs from 'node:fs';
import { config } from './config.js';
import { pickFromCoverPool } from './coverPool.js';
import { generateCoverImage } from './canvaCover.js';
import { uploadPublicImage } from './drive.js';

async function hostAndCleanUp(auth, localPath) {
  try {
    return await uploadPublicImage(auth, localPath, `pin-cover-${Date.now()}.png`, config.pinterestCoversFolderId);
  } finally {
    fs.unlink(localPath, () => {});
  }
}

// Single entry point every call site should use to get a unique Pinterest
// cover for a video, instead of calling the pool or Canva individually.
// Plan: Joe drops a raw/source photo into the manual pool
// (COVER_POOL_FOLDER_ID), which gets run through the Canva brand template
// (title + photo autofilled together) to render a polished, titled cover --
// that's the whole point of the pool, not just reusing the raw photo as-is.
// Falls back gracefully at each step: no pool photo -> Canva with text only
// (if configured) -> no pool photo and no Canva -> ''. A pool photo with
// Canva not configured (or a Canva run that fails) just uses the raw photo
// directly rather than losing it. Callers already treat a blank return as
// "fall back to Make's generic rotation," so this always degrades safely.
export async function getCoverImage(auth, title) {
  const poolImagePath = await pickFromCoverPool(auth, title);

  if (poolImagePath) {
    if (config.canvaBrandTemplateId && config.canvaImageField) {
      try {
        const designedPath = await generateCoverImage(title, poolImagePath);
        fs.unlink(poolImagePath, () => {});
        return await hostAndCleanUp(auth, designedPath);
      } catch (err) {
        console.error(`Could not run the pool photo through Canva (using it as the cover as-is instead): ${err.message}`);
      }
    }
    return await hostAndCleanUp(auth, poolImagePath);
  }

  if (!config.canvaBrandTemplateId) return '';

  const localCoverPath = await generateCoverImage(title);
  return await hostAndCleanUp(auth, localCoverPath);
}
