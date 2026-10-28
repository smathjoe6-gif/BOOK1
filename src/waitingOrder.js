import { config } from './config.js';

// Which waiting video goes next (TikTok queue and the Buffer waiting list share
// this). Person-story videos first, then real videos (daily Grok drops, Joe's
// own files), and the machine-made clips from old stock (GK_Stitch_ / GK_Loop_,
// pattern in TIKTOK_LOW_PRIORITY_PATTERN) only when nothing else is waiting.
// Inside each group: newest first, or oldest first when `newestFirst` is false.
export function pickWaitingIndex(list, newestFirst = true) {
  const rank = (item) => {
    const name = item?.name || '';
    if (/_story_/i.test(name)) return 0;
    if (config.lowPriorityPattern && config.lowPriorityPattern.test(name)) return 2;
    return 1;
  };
  let best = -1;
  list.forEach((item, i) => {
    if (best === -1) {
      best = i;
      return;
    }
    const r = rank(item);
    const b = rank(list[best]);
    // On equal rank a later index (newer) wins when newestFirst, an earlier one is kept otherwise.
    if (r < b || (r === b && newestFirst)) best = i;
  });
  return best;
}
