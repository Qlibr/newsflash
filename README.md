# newsflash

`<newsflash-feed>` is a themable web component that renders an RSS or Atom feed
in one of five layouts. It ships with a WordPress plugin, works in React with
no wrapper, and needs no build step to use.

[![npm](https://img.shields.io/npm/v/@qlibr/newsflash-feed)](https://www.npmjs.com/package/@qlibr/newsflash-feed)
[![Run on Replit](https://replit.com/badge/github/Qlibr/newsflash)](https://replit.com/github/Qlibr/newsflash)

```html
<newsflash-feed src="/feed.xml" layout="cards" columns="3" limit="6"></newsflash-feed>
```

- **Five layouts** — `list` `grid` `cards` `magazine` `ticker`, one attribute apart
- **Themable** — 25 CSS custom properties and 16 `::part()` hooks, no CSS-in-JS
- **Any input** — RSS XML, Atom XML, JSON feeds, or data inlined by your server
- **~13 kB gzipped**, Lit bundled in, zero runtime dependencies
- Dark mode, container queries, `prefers-reduced-motion`, keyboard focus states

---

## Contents

1. [Install](#install) · 2. [Layouts](#layouts) · 3. [Where the data comes
from](#where-the-data-comes-from) · 4. [Attributes](#attributes) ·
5. [Theming](#theming) · 6. [JavaScript API](#javascript-api) ·
7. [React](#react) · 8. [WordPress](#wordpress) · 9. [Behaviour and
limits](#behaviour-and-limits)

---

## Install

**Bundler** — import once anywhere in your app:

```sh
npm install @qlibr/newsflash-feed
```

```js
import '@qlibr/newsflash-feed'; // side-effect import registers <newsflash-feed>
```

This entry leaves `lit` as a normal dependency so your bundler dedupes it
against any Lit you already use. TypeScript definitions are included.

**CDN / script tag** — the standalone build has Lit bundled in, so it needs
nothing else. Publishing to npm is all it takes to be on a CDN; unpkg,
jsDelivr and esm.sh serve straight from the registry, with no second publish
step.

```html
<!-- pin the version in production -->
<script src="https://cdn.jsdelivr.net/npm/@qlibr/newsflash-feed@0.1/dist/newsflash-feed.standalone.js" defer></script>
<newsflash-feed src="/feed.xml" layout="list"></newsflash-feed>
```

| CDN | URL |
|---|---|
| jsDelivr | `https://cdn.jsdelivr.net/npm/@qlibr/newsflash-feed@0.1.1/dist/newsflash-feed.standalone.js` |
| unpkg | `https://unpkg.com/@qlibr/newsflash-feed@0.1.1/dist/newsflash-feed.standalone.js` |
| esm.sh | `https://esm.sh/@qlibr/newsflash-feed@0.1.1` (ESM, Lit resolved for you) |

Pin the **exact** version, not a range. CDNs cache ranges like `@0.1` for
hours, so a range URL can keep serving the previous build after you publish a
patch; exact versions are immutable and go live immediately.

`examples/cdn.html` is a complete page using this — one file, no build step.
Self-hosting works too: copy that one file anywhere.
`import '@qlibr/newsflash-feed/standalone'` also works.

**WordPress** — see [WordPress](#wordpress); the plugin ships the standalone
build and handles loading.

**From source:**

```sh
npm install
npm run dev      # http://localhost:5173 — every layout on mock data
npm run build    # both bundles + copies the standalone one into the WP plugin
```

**On Replit** — click the badge above, or Create App → Import from GitHub →
`Qlibr/newsflash` → Run. The checked-in `.replit` installs dependencies and
starts the dev server, giving you all five layouts on a public URL. The host
and HMR settings Replit's proxy needs are in `vite.config.js`, keyed off
`REPL_ID` so local development is unaffected.

For a lighter version, `examples/replit/` is a single HTML file that loads the
component from a CDN — nothing installed, nothing compiled — with layout and
theme switchers and a live-feed toggle. It renders from inlined JSON by
default, so it works with no network access to a feed at all.

**Other playgrounds**, none needing an account:

| | |
|---|---|
| Live, no setup | [raw.githack.com/Qlibr/newsflash/main/examples/replit/index.html](https://raw.githack.com/Qlibr/newsflash/main/examples/replit/index.html) |
| StackBlitz | [stackblitz.com/github/Qlibr/newsflash](https://stackblitz.com/github/Qlibr/newsflash) |
| CodeSandbox | [codesandbox.io/s/github/Qlibr/newsflash](https://codesandbox.io/s/github/Qlibr/newsflash) |
| JSFiddle | `examples/jsfiddle/` — panels plus a launcher, see its README |

| Entry | Lit | Runs under Node | Use for |
|---|---|---|---|
| `@qlibr/newsflash-feed` | external | yes | bundlers, npm consumers |
| `@qlibr/newsflash-feed/standalone` | bundled | no | `<script>` tags, WordPress, no build step |

The element self-registers on import and guards against double registration,
so importing it twice from different bundles is safe.

**Server-side rendering.** Importing the main entry under Node does not crash:
`lit` resolves through its Node build, which installs a `customElements` shim,
so the element registers and simply never renders server-side. The standalone
build is browser-only — its bundled copy of Lit touches `HTMLElement` at module
scope — so never import it from code that runs on the server.

---

## Layouts

Every layout renders the same DOM and the same data — only geometry changes, so
your theme survives a layout switch. `npm run dev` shows all five side by side.

### `list` — compact rows, square thumbnail left

Sidebars, "related posts", anywhere vertical space is tight.

```html
<newsflash-feed src="/feed.xml" layout="list" limit="5" sources></newsflash-feed>
```

### `grid` — borderless columns, image on top

Clean and quiet; inherits the page background.

```html
<newsflash-feed src="/feed.xml" layout="grid" columns="4" limit="8" excerpt="false"></newsflash-feed>
```

### `cards` — grid plus card chrome

Background, border, shadow and a hover lift. The default choice on a light page.

```html
<newsflash-feed src="/feed.xml" layout="cards" columns="3" limit="6"></newsflash-feed>
```

### `magazine` — one lead story, the rest as a sidebar

The first item gets a large image and a 1.65× title; the remainder stack
beside it. Below 900px it collapses to a single column.

```html
<newsflash-feed src="/feed.xml" layout="magazine" limit="5"></newsflash-feed>
```

### `ticker` — a single scrolling line

Headlines only. Pauses on hover; under `prefers-reduced-motion` the animation
is dropped and the strip becomes horizontally scrollable instead.

```html
<newsflash-feed src="/feed.xml" layout="ticker" images="false"
                style="--nf-ticker-duration: 60s"></newsflash-feed>
```

Grid and card columns collapse via **container queries**, not viewport media
queries: `--nf-columns` is the maximum, and a feed in a 300px sidebar drops to
one column even on a wide screen.

---

## Where the data comes from

A browser cannot fetch a cross-origin URL unless that server sends
`Access-Control-Allow-Origin`, and almost no feed publisher does. That is the
only hard constraint — **a proxy is not required**, something just has to do
the fetching. Five ways, in rough order of preference:

### 1. Your server inlines it (no fetch at all)

The component reads a `<script type="application/json">` child instead of
making a request. This is what the WordPress shortcode emits by default, and
it works from any server-side language.

```html
<newsflash-feed layout="cards" columns="2">
  <script type="application/json" slot="data">
    {
      "title": "Newsroom",
      "items": [
        {
          "title": "Harbour cranes go quiet as the night shift ends",
          "link": "https://example.com/harbour-cranes",
          "date": "2026-07-27T06:12:00+02:00",
          "excerpt": "The last container came off the deck just after five.",
          "image": "https://example.com/crane.jpg",
          "source": "Harbour Weekly"
        }
      ]
    }
  </script>
</newsflash-feed>
```

One round-trip, no loading skeleton, content visible to crawlers and to
visitors without JavaScript. The `slot="data"` is documentation only — the
script is found by type — but it does keep the JSON from ever rendering.

> **Escape `<` when generating that block.** A feed item containing
> `</script>` will otherwise break out of it. PHP: `JSON_HEX_TAG`. JS:
> `JSON.stringify(data).replace(/</g, '\\u003C')`.

### 2. A same-origin or CORS-enabled feed (no server work)

Point `src` straight at XML. The component parses RSS 2.0, RDF and Atom
itself.

```html
<!-- your own site's feed -->
<newsflash-feed src="/feed/" layout="list"></newsflash-feed>
```

### 3. Build-time fetch (no runtime server)

Next.js, Astro, 11ty: fetch during the build or on ISR revalidate, write JSON
to your public directory, and point `src` at it.

```js
// scripts/build-feed.mjs
import { writeFile } from 'node:fs/promises';
import { extract } from '@extractus/feed-extractor';

const feed = await extract('https://example.com/feed.xml');
await writeFile(
  'public/feed.json',
  JSON.stringify({
    title: feed.title,
    items: feed.entries.map((e) => ({
      title: e.title,
      link: e.link,
      date: e.published,
      excerpt: e.description,
    })),
  })
);
```

```html
<newsflash-feed src="/feed.json" layout="grid"></newsflash-feed>
```

### 4. Your own proxy

Two ready to deploy: `examples/feed-proxy.mjs` (Node, ~90 lines) and
`examples/cloudflare-worker.js` (edge, allowlist + Cache API).

```html
<newsflash-feed
  feed="https://example.com/feed.xml"
  endpoint="/api/feed"
  layout="cards"
></newsflash-feed>
```

With `feed` + `endpoint` the component builds
`<endpoint>?url=<feed>&limit=<limit>` for you. With `src` you control the whole
URL. `src` wins if both are set.

> **Always allowlist the hosts your proxy will fetch.** Without one you have
> published an open proxy that anyone can aim at any URL, including addresses
> inside your own network.

### 5. A hosted proxy

No infrastructure, but a third party sees every reader's IP and reading
habits, and your feed breaks when they do.

```html
<!-- rss2json: returns normalized JSON. Works keyless at a low rate limit,
     but count/order_by are paid parameters that make it return HTTP 422 —
     use the component's own limit instead. -->
<newsflash-feed
  src="https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fnews.ycombinator.com%2Frss"
  layout="list" limit="5" images="false" sources
></newsflash-feed>

<!-- AllOrigins: generic CORS passthrough, returns the untouched XML -->
<newsflash-feed
  src="https://api.allorigins.win/raw?url=https%3A%2F%2Fhnrss.org%2Ffrontpage"
  layout="list" limit="5"
></newsflash-feed>
```

`examples/hosted-proxies.html` runs all of these live — open it under
`npm run dev`.

### Accepted response shapes

The body is sniffed rather than trusted, because passthrough proxies routinely
mislabel content types. All of these work:

| Shape | Example source |
|---|---|
| `{ title, link, items: [...] }` | WordPress plugin, your own proxy |
| A bare `[ ... ]` array | anything |
| RSS 2.0 / RDF / Atom XML | the feed itself, AllOrigins `/raw` |
| `{ contents: "<rss>…" }` | AllOrigins `/get` |
| `{ feed: {...}, items: [...] }` | rss2json |

Item keys are matched loosely, so `rss-parser`, `@extractus/feed-extractor`,
rss2json and JSON Feed all work unchanged:

| Field | Keys tried, in order |
|---|---|
| title | `title` |
| link | `link` → `url` → `guid` |
| date | `date` → `published` → `isoDate` → `pubDate` → `date_published` |
| excerpt | `excerpt` → `contentSnippet` → `summary` → `description` → `content_text` → `content_html` → `content` |
| image | `image` → `thumbnail` → `banner_image` → `enclosure.url` → first `<img>` in the content |
| source | `source.title` → `source` → feed title → the link's hostname |
| author | `author.name` → `author` → `creator` |

---

## Attributes

Every attribute is also a property, so `el.layout = 'list'` works and
re-renders. Booleans accept a bare attribute (`sources`) or an explicit string
(`sources="false"`), because WordPress shortcodes can only emit strings.

| Attribute | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | Fully-formed URL returning JSON or XML. Takes precedence over `feed`. |
| `feed` | string | — | Feed URL(s), comma separated, resolved through `endpoint`. |
| `endpoint` | string | `/wp-json/newsflash/v1/feed` | Proxy base used with `feed`. |
| `layout` | string | `grid` | `list` `grid` `cards` `magazine` `ticker`. Reflected. |
| `theme` | string | `auto` | `auto` `light` `dark`. Reflected. |
| `limit` | number | `9` | Maximum items rendered. |
| `columns` | number | `3` | Column ceiling for `grid` and `cards`. |
| `heading` | string | — | Renders an `<h2>` above the list. |
| `images` | boolean | `true` | Show thumbnails. |
| `excerpt` | boolean | `true` | Show excerpt text. |
| `dates` | boolean | `true` | Show the timestamp. |
| `sources` | boolean | `false` | Show the feed/source name. Useful when merging feeds. |
| `excerpt-words` | number | `22` | Word count before truncation. |
| `date-style` | string | `relative` | `relative` ("3 days ago") or `absolute` ("24 Jul 2026"). |
| `locale` | string | `<html lang>` | BCP 47 tag for date formatting. |
| `target` | string | `_blank` | `_blank` adds `rel="noopener noreferrer"`; or `_self`. |
| `refresh` | number | `0` | Re-fetch interval in seconds. `0` disables. Ignored without a URL. |
| `lazy` | boolean | `false` | Defer the first fetch until 200px from the viewport. |

### Slots

| Slot | Purpose |
|---|---|
| `header` | Extra content beside `heading` — a "view all" link, a filter control. |
| *(unnamed script)* | `<script type="application/json">` child, read as inline data. |

```html
<newsflash-feed src="/feed.json" heading="Latest">
  <a slot="header" href="/blog">View all →</a>
</newsflash-feed>
```

---

## Theming

Two levers, both plain CSS from the host page. No build step, no theme object.

### Custom properties

They cascade through the shadow root, so setting them on the element (or any
ancestor) is enough.

```css
newsflash-feed {
  --nf-accent: #b8235a;
  --nf-font: Georgia, serif;
  --nf-radius: 2px;
  --nf-gap: 2rem;
}
```

| Property | Default | Notes |
|---|---|---|
| `--nf-bg` | `transparent` | Component background |
| `--nf-color` | `#16181d` | Body text |
| `--nf-muted` | `#5f6672` | Excerpt and meta text |
| `--nf-accent` | `#1d4ed8` | Hover titles, focus ring |
| `--nf-card-bg` | `#ffffff` | `cards` layout surface |
| `--nf-border` | `#e3e6ea` | Rules and card borders |
| `--nf-shadow` | *(two-layer)* | Card resting shadow |
| `--nf-skeleton` | `#e9ecf1` | Loading placeholder fill |
| `--nf-font` | `system-ui, …` | Font stack |
| `--nf-font-size` | `1rem` | Base size |
| `--nf-heading-size` | `1.375rem` | The `heading` attribute's `<h2>` |
| `--nf-title-size` | `1.0625rem` | Item title |
| `--nf-title-weight` | `600` | Item title weight |
| `--nf-title-lines` | `3` | Title clamp |
| `--nf-meta-size` | `0.8125rem` | Source and date |
| `--nf-excerpt-size` | `0.9375rem` | Excerpt |
| `--nf-excerpt-lines` | `3` | Excerpt clamp |
| `--nf-gap` | `1.5rem` | Grid and row gap |
| `--nf-columns` | `3` | Column ceiling (set via the `columns` attribute) |
| `--nf-radius` | `10px` | Corner radius |
| `--nf-padding` | `1rem` | Card interior padding |
| `--nf-image-ratio` | `16 / 9` | Large thumbnail aspect ratio |
| `--nf-thumb-size` | `88px` | Small thumbnail edge (`list`, `magazine`) |
| `--nf-ticker-duration` | `40s` | One full ticker loop |
| `--nf-ticker-gap` | `3rem` | Ticker item spacing |

Dark equivalents apply automatically under `prefers-color-scheme: dark`.
`theme="light"` opts out; `theme="dark"` forces dark regardless.

### Parts

```css
newsflash-feed::part(title) { text-transform: uppercase; letter-spacing: .04em; }
newsflash-feed::part(thumb) { border-radius: 50%; }
newsflash-feed::part(item):first-child { grid-column: span 2; }
```

`container` `header` `heading` `list` `item` `link` `thumb` `image` `body`
`title` `excerpt` `meta` `source` `date`, plus `status error` and
`status empty` on the two message states.

### Recipes

**Match a dark brand regardless of OS setting:**

```html
<newsflash-feed theme="dark" src="/feed.json" layout="cards"></newsflash-feed>
```

```css
newsflash-feed[theme='dark'] {
  --nf-card-bg: #14161b;
  --nf-accent: #ffcc66;
  --nf-border: #262a31;
}
```

**Dense sidebar, no images, tight rhythm:**

```html
<newsflash-feed src="/feed.json" layout="list" limit="6" images="false"
                excerpt="false" date-style="absolute"></newsflash-feed>
```

```css
newsflash-feed { --nf-gap: .75rem; --nf-title-size: .9375rem; --nf-title-lines: 2; }
```

**Editorial serif with square images:**

```css
newsflash-feed.editorial {
  --nf-font: 'Iowan Old Style', Georgia, serif;
  --nf-radius: 0;
  --nf-image-ratio: 1;
  --nf-title-weight: 700;
}
newsflash-feed.editorial::part(meta) { font-variant-caps: all-small-caps; }
```

---

## JavaScript API

```js
import { NewsflashFeed, LAYOUTS } from '@qlibr/newsflash-feed';

LAYOUTS; // ['list', 'grid', 'cards', 'magazine', 'ticker']
```

### Properties and methods

| Member | Description |
|---|---|
| *(all attributes above)* | Readable and writable as properties; camelCase for `excerptWords`, `dateStyle`. |
| `resolvedUrl` | Getter. The URL that will be fetched, or `''` when there is none. |
| `load()` | Re-fetch now. Returns a promise; aborts any in-flight request first. |

```js
const feed = document.querySelector('newsflash-feed');

feed.layout = 'ticker';       // re-renders
feed.limit = 3;               // re-renders and re-fetches
await feed.load();            // manual refresh, e.g. from a button
```

### Events

Both bubble and cross the shadow boundary, so you can listen on an ancestor.

| Event | `detail` | Fires |
|---|---|---|
| `newsflash-load` | `{ items }` | After data is adopted, from fetch **or** inline JSON |
| `newsflash-error` | `{ error }` | On network failure, non-2xx, or unparseable body |

```js
feed.addEventListener('newsflash-load', (e) => {
  console.log(`${e.detail.items.length} items`, e.detail.items[0].title);
});

feed.addEventListener('newsflash-error', (e) => {
  console.warn('feed unavailable:', e.detail.error.message);
});
```

Each item in `detail.items` is normalized to:

```ts
{
  title: string;    // plain text, "(untitled)" if the feed omitted one
  link: string;     // http(s) only, '' if unsafe or missing
  date: string;     // as published — ISO 8601, RFC 822, whatever the feed used
  author: string;   // parsed but not rendered; see Behaviour and limits
  image: string;    // http(s) only, '' if none
  excerpt: string;  // plain text, truncated to excerpt-words
  source: string;   // feed title, falling back to the link's hostname
}
```

---

## React

React 19 supports custom elements natively — properties and `on*` events pass
straight through, so there is no wrapper package.

```jsx
import { useCallback, useState } from 'react';
import '@qlibr/newsflash-feed';

export function LatestNews() {
  const [count, setCount] = useState(0);
  const handleLoad = useCallback((e) => setCount(e.detail.items.length), []);

  return (
    <>
      <newsflash-feed
        src="/api/feed.json"
        layout="cards"
        columns={3}
        limit={9}
        heading="Latest news"
        onnewsflash-load={handleLoad}
      />
      <p>{count} stories</p>
    </>
  );
}
```

On **React 18 and older**, camelCase props and custom events do not work — use
a ref:

```jsx
const ref = useRef(null);

useEffect(() => {
  const el = ref.current;
  const onLoad = (e) => console.log(e.detail.items);
  el.addEventListener('newsflash-load', onLoad);
  return () => el.removeEventListener('newsflash-load', onLoad);
}, []);

return <newsflash-feed ref={ref} src="/api/feed.json" layout="grid" columns="3" />;
```

Both forms are in `examples/ReactExample.jsx`.

### Other frameworks

No adapters exist or are needed, but two compilers need to be told the tag is
a custom element:

```js
// Vue — vite.config.js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('newsflash-') } } });
```

```ts
// Angular — the module or component that uses it
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
@Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA], /* … */ })
```

Svelte, Astro, Solid and plain HTML need nothing. In Svelte, use
`on:newsflash-load` for the events.

---

## WordPress

Copy or symlink `wordpress/newsflash-rss/` into `wp-content/plugins/`, run
`npm run build` (which drops the bundle into the plugin's `assets/`), and
activate.

```
[newsflash feed="https://example.com/feed.xml" layout="cards" columns="3" limit="9" heading="From the blog"]
```

Merge several feeds by comma-separating them:

```
[newsflash feed="https://a.example/feed, https://b.example/rss" layout="list" sources="true"]
```

### Shortcode attributes

Everything in [Attributes](#attributes) plus:

| Attribute | Default | Description |
|---|---|---|
| `mode` | `inline` | `inline` renders server-side; `ajax` fetches in the browser |
| `class` | — | Passed through to the element for theming |

The script is registered on init but only enqueued by the shortcode, so pages
without a feed ship no JavaScript.

### Modes

**`inline` (default)** fetches the feed in PHP while rendering the page and
embeds the items as a JSON island. One round-trip, no loading skeleton,
content visible to crawlers and to visitors without JavaScript. Freshness then
follows your page cache rather than the feed cache.

**`ajax`** emits a signed REST URL and lets the browser fetch. Needed only for
`refresh` (polling) or `lazy`. Setting either of those on an inline feed adds
the endpoint automatically.

If you use neither, remove the endpoint entirely:

```php
add_filter( 'newsflash_enable_rest', '__return_false' );
```

### Security

When the REST route is enabled it is public — feeds render for logged-out
visitors — so it must not become an open proxy. The shortcode signs each feed
URL with an HMAC derived from the site salt, and the handler refuses anything
it did not sign. URLs also pass `wp_http_validate_url()`, which blocks loopback
and private ranges. Only URLs an editor put on a page are ever fetchable.

### Filters

```php
// Feed cache lifetime (default 15 minutes). Scoped to this plugin's fetches.
add_filter( 'newsflash_cache_lifetime', fn() => 5 * MINUTE_IN_SECONDS );

// Change shortcode defaults site-wide.
add_filter( 'newsflash_shortcode_defaults', function ( $defaults ) {
    $defaults['layout']  = 'list';
    $defaults['columns'] = 2;
    return $defaults;
} );

// Drop the REST endpoint.
add_filter( 'newsflash_enable_rest', '__return_false' );
```

### Rendering it from PHP without the shortcode

```php
$data = Newsflash_Feed::get( 'https://example.com/feed.xml', 6 );

if ( ! is_wp_error( $data ) ) {
    wp_enqueue_script( NEWSFLASH_HANDLE );
    printf(
        '<newsflash-feed layout="cards" columns="3"><script type="application/json">%s</script></newsflash-feed>',
        wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP )
    );
}
```

---

## Behaviour and limits

**Loading.** A skeleton matching the chosen layout shows on first load only;
refreshes keep the current items on screen until new ones arrive. In-flight
requests are aborted when the source changes or the element is removed.

**Failures.** A network error, non-2xx response or unparseable body renders a
short red message (`part="status error"`, restyle it there) and fires
`newsflash-error`. An empty feed renders "No items to show." An image that
404s removes its own container rather than leaving a grey box.

**Escaping.** Titles, excerpts and source names are stripped to plain text
before rendering, and only `http(s)` URLs are emitted for links and images.
Feed content is never injected as HTML — a feed cannot inject script,
`javascript:` URLs, or markup into your page.

**Accessibility.** Items render as a real `<ul>`/`<li>` with `<h3>` titles and
`<time datetime>`; the container carries `aria-busy` while loading; the
ticker's duplicated items are `aria-hidden` and removed from tab order; focus
rings use `--nf-accent`.

**Motion.** The ticker animation, card hover lift and skeleton pulse are all
disabled under `prefers-reduced-motion: reduce`, where the ticker becomes a
scrollable strip instead.

**Known gaps**

- `author` is parsed and exposed in `newsflash-load` but never rendered; the
  meta line shows source and date only.
- Dates are formatted from whatever string the feed supplied. Non-ISO formats
  (RFC 822, or rss2json's `"2026-07-27 06:18:10"`) rely on the browser's
  `Date` parsing and are interpreted as local time.
- The WordPress plugin has not been exercised against a running install.

---

## Repo layout

```
src/                      the web component (Lit)
  newsflash-feed.js       element, fetching, normalization
  styles.js               design tokens + the five layouts
  format.js               date/text/URL helpers, RSS/Atom parser
wordpress/newsflash-rss/  the plugin
  newsflash-rss.php       bootstrap + asset registration
  includes/               feed fetching, shortcode, optional REST route
examples/
  ReactExample.jsx        React 19 and React 18 usage
  replit/                 zero-install CDN demo with layout/theme switchers
  jsfiddle/               JSFiddle panels + prefill launcher
  hosted-proxies.html     five data sources side by side, live
  cloudflare-worker.js    allowlisted edge proxy
  feed-proxy.mjs          minimal Node proxy
index.html                layout demo (npm run dev)
public/                   mock JSON and XML feeds for the demos
```

MIT.
