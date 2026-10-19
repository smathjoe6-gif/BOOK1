import { config } from './config.js';
import { bufferGraphQL } from './bufferTikTok.js';
import { listBufferChannels } from './bufferPost.js';

// `npm run buffer-channels` -- shows what Buffer sees (channel names, services,
// ids; never the key) and checks the post-input fields exist in the live API.
if (!config.bufferAccessToken) {
  console.error('BUFFER_ACCESS_TOKEN is not set in .env.');
  process.exit(1);
}

const channels = await listBufferChannels();
console.log('\nChannels connected in Buffer:');
for (const c of channels) console.log(`  ${String(c.service).padEnd(10)} ${c.name}  (id ${c.id})`);
if (channels.length === 0) console.log('  (none yet -- connect them in Buffer first)');

for (const type of ['CreatePostInput', 'InstagramPostMetadataInput', 'FacebookPostMetadataInput', 'PinterestPostMetadataInput', 'PostMetadataInput']) {
  try {
    const r = await bufferGraphQL(
      'query T($n: String!) { __type(name: $n) { name inputFields { name type { name kind ofType { name } } } enumValues { name } } }',
      { n: type }
    );
    const t = r.__type;
    if (!t) { console.log(`\n${type}: not found`); continue; }
    console.log(`\n${type}: ${(t.inputFields || []).map((f) => f.name).join(', ')}`);
  } catch (err) {
    console.log(`\n${type}: could not inspect (${err.message})`);
  }
}
for (const e of ['InstagramPostType', 'FacebookPostType']) {
  try {
    const r = await bufferGraphQL('query T($n: String!) { __type(name: $n) { enumValues { name } } }', { n: e });
    if (r.__type) console.log(`\n${e} values: ${r.__type.enumValues.map((v) => v.name).join(', ')}`);
  } catch { /* optional */ }
}
