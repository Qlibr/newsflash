/**
 * Minimal feed proxy for non-WordPress sites.
 *
 * The component needs a same-origin endpoint returning
 * `{ title, link, items: [...] }`. On WordPress the plugin provides this; for
 * a React app running anywhere else, this is the smallest thing that works.
 *
 *   npm i @extractus/feed-extractor
 *   node examples/feed-proxy.mjs
 *
 * Then point the component at it:
 *   <newsflash-feed feed="https://…/rss" endpoint="http://localhost:8787/api/feed">
 *
 * Two things to keep before shipping this: the allowlist (otherwise you have
 * built an open proxy anyone can point at your internal network) and the
 * cache (otherwise every page view hits the origin feed).
 */
import { createServer } from 'node:http';
import { extract } from '@extractus/feed-extractor';

const PORT = 8787;
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Only these hosts may be fetched. Never accept an arbitrary URL. */
const ALLOWED_HOSTS = new Set(['example.com', 'www.theverge.com', 'hnrss.org']);

const cache = new Map();

async function getFeed(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) return hit.data;

  const parsed = await extract(url, { descriptionMaxLen: 240, getExtraEntryFields: (entry) => ({
    image:
      entry['media:content']?.['@_url'] ||
      entry['media:thumbnail']?.['@_url'] ||
      entry.enclosure?.['@_url'] ||
      '',
  }) });

  const data = {
    title: parsed.title ?? '',
    link: parsed.link ?? '',
    items: (parsed.entries ?? []).map((entry) => ({
      title: entry.title ?? '',
      link: entry.link ?? '',
      date: entry.published ?? '',
      excerpt: entry.description ?? '',
      image: entry.image ?? '',
      source: parsed.title ?? '',
    })),
  };

  cache.set(url, { time: Date.now(), data });
  return data;
}

createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (requestUrl.pathname !== '/api/feed') {
    res.writeHead(404).end('Not found');
    return;
  }

  const target = requestUrl.searchParams.get('url') ?? '';
  let host;
  try {
    host = new URL(target).hostname;
  } catch {
    res.writeHead(400).end('Bad url');
    return;
  }

  if (!ALLOWED_HOSTS.has(host)) {
    res.writeHead(403).end('Host not allowed');
    return;
  }

  try {
    const data = await getFeed(target);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=900',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(error.message ?? error) }));
  }
}).listen(PORT, () => console.log(`feed proxy on http://localhost:${PORT}/api/feed`));
