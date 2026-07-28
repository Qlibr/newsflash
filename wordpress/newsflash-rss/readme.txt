=== Newsflash RSS ===
Contributors: qlibr
Tags: rss, feed, atom, news, shortcode
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.1.4
License: MIT
License URI: https://opensource.org/license/mit

Render any RSS or Atom feed in five themable layouts with one shortcode. Server-rendered by default, so feeds are visible to crawlers.

== Description ==

Newsflash RSS turns a feed URL into a styled block of news. Drop the shortcode
on a page, pick one of five layouts, and you are done:

`[newsflash feed="https://example.com/feed.xml" layout="cards" columns="3" limit="9"]`

= Five layouts =

* **list** — compact, one item per row
* **grid** — even columns, optional images
* **cards** — image-led cards with excerpts
* **magazine** — one lead story, the rest smaller
* **ticker** — a single scrolling line

= Rendered on the server by default =

Most feed plugins fetch in the browser, which means search engines see an
empty box and visitors see a loading skeleton. Newsflash fetches the feed in
PHP while the page renders and embeds the items directly in the HTML. One
round-trip, no skeleton, content present for crawlers and for visitors without
JavaScript.

An optional `ajax` mode is available when you need polling (`refresh`) or
load-on-scroll (`lazy`).

= Merge several feeds =

Comma-separate them and turn on source labels:

`[newsflash feed="https://a.example/feed, https://b.example/rss" layout="list" sources="true"]`

= Themable without touching PHP =

The markup is a web component exposing 25 CSS custom properties and 16
`::part()` hooks, so your theme's CSS can restyle every element. Dark mode,
container queries and `prefers-reduced-motion` are handled.

= Light on the page =

The script is registered on init but only enqueued by a shortcode that is
actually rendered, so pages without a feed ship no extra JavaScript. The
bundle is roughly 13 kB gzipped with no runtime dependencies.

= Shortcode attributes =

| Attribute | Default | Notes |
|---|---|---|
| `feed` | — | Required. One URL or a comma-separated list |
| `mode` | `inline` | `inline` renders server-side, `ajax` fetches in the browser |
| `layout` | `grid` | `list` `grid` `cards` `magazine` `ticker` |
| `theme` | `auto` | `auto` `light` `dark` `matrix` (a dot-matrix LED sign) |
| `limit` | `9` | 1–50 |
| `columns` | `3` | 1–6 |
| `heading` | — | Optional heading above the feed |
| `images` | `true` | Show item images |
| `excerpt` | `true` | Show item excerpts |
| `dates` | `true` | Show item dates |
| `sources` | `false` | Label each item with its feed |
| `date-style` | `relative` | `relative` or `absolute` |
| `target` | `_blank` | Link target |
| `refresh` | `0` | Seconds between refetches (needs the REST route) |
| `lazy` | `false` | Load when scrolled into view (needs the REST route) |
| `class` | — | Extra class on the element |

= Filters =

`
// Feed cache lifetime (default 15 minutes), scoped to this plugin's fetches.
add_filter( 'newsflash_cache_lifetime', fn() => 5 * MINUTE_IN_SECONDS );

// Change shortcode defaults site-wide.
add_filter( 'newsflash_shortcode_defaults', function ( $defaults ) {
    $defaults['layout'] = 'list';
    return $defaults;
} );

// Remove the REST endpoint entirely.
add_filter( 'newsflash_enable_rest', '__return_false' );
`

== Installation ==

1. Upload the plugin through **Plugins → Add New → Upload Plugin**, or install
   it from the plugin directory.
2. Activate it.
3. Add `[newsflash feed="https://example.com/feed.xml"]` to any post, page or
   text widget. In the block editor, use a Shortcode block.

There is no settings screen — everything is set per shortcode, and defaults
can be changed site-wide with the `newsflash_shortcode_defaults` filter.

== Frequently Asked Questions ==

= Does it work in the block editor? =

Yes, through the core Shortcode block. A native block is planned.

= Where does the feed data go? =

Nowhere but your server. The plugin makes no calls to any service of ours; the
only outbound requests are to the feed URLs you put in the shortcode. Fetched
feeds are cached in WordPress transients for 15 minutes by default.

= Is the REST endpoint an open proxy? =

No. It only exists for browser-side modes (`refresh` and `lazy`), and it is
public because feeds have to render for logged-out visitors. Every URL is
signed by the shortcode with an HMAC derived from your site salts, and the
handler refuses any URL it did not sign, so visitors can only request feeds an
editor already put on a page.

On top of that, every host is resolved and each resulting address is checked
against the private *and* reserved IP ranges before any fetch.
`wp_http_validate_url()` alone is not enough here: it blocks loopback and
RFC1918 but permits 169.254.0.0/16, which is where cloud instance metadata
lives. The connection is then pinned to the vetted address so it cannot be
DNS-rebound, and every redirect hop is validated the same way.

If your site only ever renders feeds server-side, remove the route entirely:

`add_filter( 'newsflash_enable_rest', '__return_false' );`

= The feed shows nothing =

Only users who can edit posts see the reason, so check the page while logged
in as an editor or administrator. The usual causes are a URL that is not
actually a feed, a host that refuses WordPress's user agent, or an outbound
firewall on your host.

= Can I restyle it? =

Yes, with plain CSS in your theme — see the CSS custom properties and
`::part()` hooks documented in the project README.

= Does it store any personal data? =

No. The plugin sets no cookies, creates no database tables and stores no
options. It only writes WordPress's own feed cache transients.

== Screenshots ==

1. The `cards` layout in three columns.
2. The `magazine` layout — one lead story with the rest smaller.
3. The `list` layout with two merged feeds and source labels.
4. The shortcode in the block editor.

== Source code ==

The JavaScript in `assets/` is a compiled, minified bundle. Its unminified
source, the build configuration and instructions live in the public
repository: https://github.com/Qlibr/newsflash

Build it with `npm install && npm run build`, which writes the bundle back
into this plugin's `assets/` directory. A source map is shipped alongside the
bundle, so the original sources are also readable directly in a browser's
developer tools.

The plugin is MIT licensed, which the directory accepts as a
GPLv2-compatible license. The bundle includes Lit, which is BSD-3-Clause.

== Changelog ==

= 0.1.4 =
* Security: close the DNS-rebinding window on server-side feed fetches by
  pinning each request to the exact address it validated (CURLOPT_RESOLVE), so
  a low-TTL record cannot rebind the host to an internal address after the
  check.
* Security: validate and pin every redirect hop, so a feed can no longer
  redirect the server into a private or link-local address such as the cloud
  instance metadata endpoint.
* Refuse to fetch when the connection cannot be pinned (no cURL extension)
  rather than fall through to an unpinnable transport; opt back in with the
  `newsflash_require_pinned_transport` filter.

= 0.1.3 =
* First release in the WordPress plugin directory.
* Server-side (`inline`) rendering with an optional signed REST proxy.
* Five layouts, 25 CSS custom properties, 16 `::part()` hooks.
* Feed fetches are checked against private and reserved IP ranges before
  the request is made.

== Upgrade Notice ==

= 0.1.4 =
Security hardening for the server-side feed fetcher: closes a DNS-rebinding
window and blocks redirect-based SSRF into internal addresses. Recommended for
all sites.

= 0.1.3 =
First public release.
