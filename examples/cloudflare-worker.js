/**
 * Cloudflare Worker feed proxy.
 *
 * The component can parse RSS/Atom XML itself, so a worker doesn't need an
 * XML library — its only jobs are adding CORS headers, enforcing an
 * allowlist, and caching. That keeps it dependency-free and inside the free
 * tier for most sites.
 *
 *   npx wrangler deploy examples/cloudflare-worker.js --name newsflash-proxy
 *
 * Then:
 *   <newsflash-feed src="https://newsflash-proxy.<you>.workers.dev/?url=https%3A%2F%2Fhnrss.org%2Ffrontpage" layout="list">
 *
 * The allowlist is the whole security model. Without it you have published an
 * open proxy that anyone can point at any URL — including addresses inside
 * Cloudflare's network — with your account paying for it.
 */

/** Hosts this proxy is willing to fetch. */
const ALLOWED_HOSTS = new Set(['hnrss.org', 'www.theverge.com', 'example.com']);

/** How long an edge-cached feed stays fresh, in seconds. */
const CACHE_SECONDS = 900;

/** Origins allowed to read the response. Replace with your own site. */
const ALLOWED_ORIGINS = new Set(['https://example.com', 'http://localhost:5173']);

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'null',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
      });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const target = new URL(request.url).searchParams.get('url') ?? '';
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Bad url', { status: 400, headers: cors });
    }

    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: cors });
    }

    // Key the edge cache on the normalized target, not the incoming request,
    // so `?url=x&foo=1` and `?url=x` share one entry.
    const cacheKey = new Request(`https://feed-cache/${encodeURIComponent(parsed.href)}`);
    const cache = caches.default;

    const cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: { ...Object.fromEntries(cached.headers), ...cors, 'X-Cache': 'HIT' },
      });
    }

    let upstream;
    try {
      upstream = await fetch(parsed.href, {
        headers: { 'User-Agent': 'newsflash-feed/0.1 (+https://example.com)' },
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      });
    } catch (error) {
      return new Response(`Upstream fetch failed: ${error}`, { status: 502, headers: cors });
    }

    if (!upstream.ok) {
      return new Response(`Upstream returned ${upstream.status}`, {
        status: 502,
        headers: cors,
      });
    }

    const body = await upstream.text();
    const response = new Response(body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return new Response(body, {
      headers: { ...Object.fromEntries(response.headers), ...cors, 'X-Cache': 'MISS' },
    });
  },
};
