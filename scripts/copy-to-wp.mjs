/**
 * Copy the built bundle into the WordPress plugin so the plugin directory is
 * self-contained and can be zipped or symlinked straight into wp-content.
 */
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'dist');
const to = join(root, 'wordpress', 'newsflash-rss', 'assets');

await mkdir(to, { recursive: true });

// The standalone (UMD, Lit bundled) build is the one WordPress loads — there
// is no bundler there to resolve a bare `lit` import.
const wanted = (name) => name.startsWith('newsflash-feed.standalone.js');
const files = (await readdir(from)).filter(wanted);

if (files.length === 0) {
  console.error('No standalone build in dist/. Run `npm run build:standalone` first.');
  process.exit(1);
}

for (const file of files) {
  await copyFile(join(from, file), join(to, file));
  console.log(`copied ${file} → wordpress/newsflash-rss/assets/`);
}
