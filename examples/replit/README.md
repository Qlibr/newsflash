# Replit demo

An interactive `<newsflash-feed>` demo with no install and no build step: the
component is loaded from a CDN, so `index.html` is the entire application.

[![Run on Replit](https://replit.com/badge/github/Qlibr/newsflash)](https://replit.com/github/Qlibr/newsflash)

## Two ways to run it on Replit

**Import the whole repository** (what the badge does). Replit reads the root
`.replit`, runs `npm install && npm run dev`, and serves the full Vite demo —
all five layouts side by side on bundled mock data, so it needs no network
access to a feed.

**Or run just this folder.** Create a Repl, drop in `index.html` and the
`.replit` here, and press Run. It serves this single page, which pulls the
component from jsDelivr and live headlines from Hacker News. Nothing is
installed and nothing is compiled.

## Running it anywhere else

It is one static file with no dependencies, so it also works on GitHub Pages,
Netlify, Cloudflare Pages, S3, or straight off your disk:

```sh
python3 -m http.server 8000    # then open http://localhost:8000
```

Opening `index.html` directly with `file://` works too, though the feed fetch
may be blocked by your browser's file-origin rules.

## What it shows

Layout and theme buttons rewrite attributes on a single element — the markup
never changes — and the snippet below the feed updates to match, so you can
copy the exact tag for whatever you have selected.

The demo fetches through [AllOrigins](https://allorigins.win) because
hnrss.org sends no CORS headers. That is fine for a demo and wrong for
production: a third party sees every reader. Use server-side rendering or your
own proxy instead — see [Where the data comes
from](https://github.com/Qlibr/newsflash#where-the-data-comes-from).
