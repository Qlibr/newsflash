# JSFiddle example

The three files are the JSFiddle panels:

| File | Panel |
|---|---|
| `demo.html` | HTML |
| `demo.css` | CSS |
| `demo.js` | JavaScript |

Plus one external resource, the component itself:

```
https://cdn.jsdelivr.net/npm/@qlibr/newsflash-feed@0.1.3/dist/newsflash-feed.standalone.js
```

The demo renders from an inlined JSON island, so the fiddle works with no
network request to any feed. Swap the `<script type="application/json">` child
for `src="…"` to fetch a real one.

## Opening it

`index.html` is a launcher: it fetches the three panels from this repository
and posts them to JSFiddle, opening a populated editor. Serve it from
anywhere, or use the hosted copy:

```sh
npx serve examples/jsfiddle    # then click the button
```

No JSFiddle account is needed. Save or fork it there only if you want to keep
changes.

## Why a launcher instead of a link

JSFiddle has no way to create a persistent, shareable fiddle without an
account:

- **The POST API** (`/api/post/library/pure/`) opens a populated editor but
  never assigns a URL — the fiddle is unsaved, so there is nothing to link to.
- **The GitHub-gist import** (`/gh/gist/library/pure/<gist-id>/`) responds
  `200` but loads an empty editor. It is no longer functional.

Prefill-by-POST is what works, and a form has to be submitted from a page —
hence `index.html`. If you would rather do it by hand: create a fiddle, paste
the three files into their panels, and add the CDN URL above under
**Resources**.
