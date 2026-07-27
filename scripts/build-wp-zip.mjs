/**
 * Package the plugin the way WordPress.org expects: a zip whose single
 * top-level directory is the plugin slug.
 *
 * The directory's assets/ bundle is produced by `npm run build`, so this only
 * checks that it is there and current rather than building it again.
 *
 * Also fails on the mistakes that cost a review round-trip: a readme.txt
 * "Stable tag" that disagrees with the plugin header's Version, or a header
 * that disagrees with package.json.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slug = 'newsflash-rss';
const pluginDir = join(root, 'wordpress', slug);
const outDir = join(root, 'dist-wp');

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const field = (text, label) => {
  const match = text.match(new RegExp(`^\\s*\\*?\\s*${label}:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : null;
};

const main = join(pluginDir, `${slug}.php`);
const header = await readFile(main, 'utf8');
const readme = await readFile(join(pluginDir, 'readme.txt'), 'utf8');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

const version = field(header, 'Version');
const stableTag = field(readme, 'Stable tag');

if (!version) {
  fail(`No "Version" header in ${slug}.php`);
}
if (version !== stableTag) {
  fail(`readme.txt Stable tag (${stableTag}) does not match the plugin Version (${version})`);
}
if (version !== pkg.version) {
  fail(`Plugin Version (${version}) does not match package.json (${pkg.version})`);
}
if (!header.includes(`NEWSFLASH_VERSION', '${version}'`)) {
  fail(`NEWSFLASH_VERSION does not match the plugin Version (${version})`);
}

// The bundle is the one file that is generated rather than committed by hand,
// so a stale or missing one is the likeliest packaging mistake.
const bundle = join(pluginDir, 'assets', 'newsflash-feed.standalone.js');
const built = join(root, 'dist', 'newsflash-feed.standalone.js');

let bundleStat;
try {
  bundleStat = await stat(bundle);
} catch {
  fail('assets/newsflash-feed.standalone.js is missing. Run `npm run build` first.');
}

try {
  const distStat = await stat(built);
  if (distStat.mtimeMs > bundleStat.mtimeMs) {
    fail('dist/ is newer than the plugin bundle. Run `npm run build` first.');
  }
} catch {
  // No dist/ at all is fine: the plugin copy is what ships.
}

// Anything the directory should never carry into the directory listing.
const disallowed = /(^\.|node_modules|package(-lock)?\.json|\.zip$|\.map\.gz$)/;
const walk = async (dir, prefix = '') => {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (disallowed.test(entry.name)) {
      found.push(rel);
    }
    if (entry.isDirectory()) {
      found.push(...(await walk(join(dir, entry.name), rel)));
    }
  }
  return found;
};

const junk = await walk(pluginDir);
if (junk.length > 0) {
  fail(`Unexpected files in the plugin directory:\n  ${junk.join('\n  ')}`);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const zipName = `${slug}-${version}.zip`;

// -x excludes are belt-and-braces; the walk above already refuses to package
// a directory containing them.
execFileSync(
  'zip',
  ['-r', '-q', join(outDir, zipName), slug, '-x', '*/.*', '.*'],
  { cwd: join(root, 'wordpress'), stdio: 'inherit' }
);

const listed = execFileSync('unzip', ['-Z1', join(outDir, zipName)], { encoding: 'utf8' })
  .trim()
  .split('\n');

const stray = listed.filter((name) => !name.startsWith(`${slug}/`));
if (stray.length > 0) {
  fail(`Zip has entries outside ${slug}/:\n  ${stray.join('\n  ')}`);
}

const { size } = await stat(join(outDir, zipName));
console.log(`✓ dist-wp/${zipName} — ${listed.length} files, ${(size / 1024).toFixed(0)} kB`);
console.log(`  version ${version}, stable tag ${stableTag}`);
