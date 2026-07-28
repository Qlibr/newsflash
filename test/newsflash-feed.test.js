import { expect, oneEvent, aTimeout } from '@open-wc/testing';
import { NewsflashFeed, LAYOUTS } from '../src/newsflash-feed.js';

// A minimal, valid RSS document reused by the XML-path tests.
const RSS = `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    <title>Chan</title><link>https://example.com</link>
    <item><title>XML item</title><link>https://example.com/x</link></item>
  </channel></rss>`;

/** Mount a fresh element, optionally with an inline JSON <script> child. */
async function mount({ attrs = {}, inline } = {}) {
  const el = document.createElement('newsflash-feed');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  if (inline !== undefined) {
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = typeof inline === 'string' ? inline : JSON.stringify(inline);
    el.appendChild(script);
  }
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function fakeResponse({ ok = true, status = 200, contentType = 'application/json', body = '' }) {
  return {
    ok,
    status,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  };
}

let originalFetch;
beforeEach(() => {
  originalFetch = window.fetch;
});
afterEach(() => {
  window.fetch = originalFetch;
  document.querySelectorAll('newsflash-feed').forEach((el) => el.remove());
});

// ---------------------------------------------------------------------------
// _normalize — the loose key matching across rss-parser, feed-extractor,
// JSON Feed and rss2json. The README documents the exact fallback orders.
// ---------------------------------------------------------------------------
describe('_normalize', () => {
  const el = document.createElement('newsflash-feed'); // not attached; method is pure

  it('resolves link through link -> url -> guid', () => {
    expect(el._normalize({ link: 'https://e.com/1' }).link).to.equal('https://e.com/1');
    expect(el._normalize({ url: 'https://e.com/2' }).link).to.equal('https://e.com/2');
    expect(el._normalize({ guid: 'https://e.com/3' }).link).to.equal('https://e.com/3');
  });

  it('runs the link through safeUrl', () => {
    expect(el._normalize({ link: 'javascript:alert(1)' }).link).to.equal('');
  });

  it('strips markup from the title and falls back to (untitled)', () => {
    expect(el._normalize({ title: '<b>Hi</b>' }).title).to.equal('Hi');
    expect(el._normalize({}).title).to.equal('(untitled)');
  });

  it('picks the excerpt from the first present body field, truncated', () => {
    el.excerptWords = 3;
    expect(el._normalize({ description: 'one two three four' }).excerpt).to.equal('one two three…');
    // excerpt/contentSnippet/summary win over the full-content fields.
    expect(
      el._normalize({ excerpt: 'short one', content: 'the whole article body here' }).excerpt
    ).to.equal('short one');
    el.excerptWords = 22;
  });

  it('resolves date through the documented fallback chain', () => {
    expect(el._normalize({ pubDate: 'PUB' }).date).to.equal('PUB');
    expect(el._normalize({ date: 'D', pubDate: 'PUB' }).date).to.equal('D');
    expect(el._normalize({ date_published: 'JF' }).date).to.equal('JF');
  });

  it('reads the author from a string or an object', () => {
    expect(el._normalize({ author: 'Bob' }).author).to.equal('Bob');
    expect(el._normalize({ author: { name: 'Bob' } }).author).to.equal('Bob');
    expect(el._normalize({ creator: 'Bob' }).author).to.equal('Bob');
  });

  it('reads images from direct fields, enclosure, then the body', () => {
    expect(el._normalize({ image: 'https://e.com/a.jpg' }).image).to.equal('https://e.com/a.jpg');
    expect(el._normalize({ enclosure: { url: 'https://e.com/b.jpg' } }).image).to.equal(
      'https://e.com/b.jpg'
    );
    expect(
      el._normalize({ content_html: '<p><img src="https://e.com/c.jpg"></p>' }).image
    ).to.equal('https://e.com/c.jpg');
    // An unsafe direct image falls through to the body image.
    expect(
      el._normalize({ image: 'javascript:x', content: '<img src="https://e.com/d.jpg">' }).image
    ).to.equal('https://e.com/d.jpg');
  });

  it('resolves source through source -> envelope -> feed.title -> hostname', () => {
    expect(el._normalize({ source: 'Named' }).source).to.equal('Named');
    expect(el._normalize({ source: { title: 'Obj' } }).source).to.equal('Obj');
    expect(el._normalize({ link: 'https://e.com/1' }, { title: 'Env' }).source).to.equal('Env');
    expect(el._normalize({ link: 'https://e.com/1' }, { feed: { title: 'R2J' } }).source).to.equal(
      'R2J'
    );
    // Nothing named anywhere: fall back to the link's hostname.
    expect(el._normalize({ link: 'https://news.example.com/1' }).source).to.equal(
      'news.example.com'
    );
  });
});

// ---------------------------------------------------------------------------
// _parse — sniff the body rather than trust a content type passthrough proxies
// routinely get wrong.
// ---------------------------------------------------------------------------
describe('_parse', () => {
  const el = document.createElement('newsflash-feed');

  it('parses JSON identified by content type', () => {
    expect(el._parse('{"items":[{"title":"a"}]}', 'application/json').items).to.have.lengthOf(1);
  });

  it('parses JSON identified by a leading brace despite a wrong content type', () => {
    expect(el._parse('[{"title":"a"}]', 'text/plain')).to.be.an('array');
  });

  it('parses XML when the body is not JSON-shaped', () => {
    expect(el._parse(RSS, 'text/xml').items[0].title).to.equal('XML item');
  });

  it("unwraps AllOrigins' { contents: '<rss>' } envelope", () => {
    const body = JSON.stringify({ contents: RSS });
    expect(el._parse(body, 'application/json').items[0].title).to.equal('XML item');
  });
});

// ---------------------------------------------------------------------------
// resolvedUrl
// ---------------------------------------------------------------------------
describe('resolvedUrl', () => {
  it('is empty when nothing is set', () => {
    const el = document.createElement('newsflash-feed');
    expect(el.resolvedUrl).to.equal('');
  });

  it('prefers src over feed', () => {
    const el = document.createElement('newsflash-feed');
    el.src = 'https://e.com/feed.json';
    el.feed = 'https://e.com/rss';
    expect(el.resolvedUrl).to.equal('https://e.com/feed.json');
  });

  it('builds endpoint?url=&limit= from feed + endpoint', () => {
    const el = document.createElement('newsflash-feed');
    el.feed = 'https://e.com/rss';
    el.endpoint = '/proxy';
    el.limit = 4;
    const url = new URL(el.resolvedUrl);
    expect(url.pathname).to.equal('/proxy');
    expect(url.searchParams.get('url')).to.equal('https://e.com/rss');
    expect(url.searchParams.get('limit')).to.equal('4');
  });
});

// ---------------------------------------------------------------------------
// load() — fetch flow, with a stubbed fetch.
// ---------------------------------------------------------------------------
describe('load', () => {
  it('adopts items and fires newsflash-load on success', async () => {
    window.fetch = async () =>
      fakeResponse({ body: JSON.stringify({ items: [{ title: 'A', link: 'https://e.com/a' }] }) });

    const el = document.createElement('newsflash-feed');
    el.src = '/feed.json';
    document.body.appendChild(el);

    const event = await oneEvent(el, 'newsflash-load');
    expect(event.detail.items).to.have.lengthOf(1);
    expect(event.detail.items[0].title).to.equal('A');
  });

  it('fires newsflash-error and shows the status on a non-2xx response', async () => {
    window.fetch = async () => fakeResponse({ ok: false, status: 503 });

    const el = document.createElement('newsflash-feed');
    el.src = '/feed.json';
    document.body.appendChild(el);

    const event = await oneEvent(el, 'newsflash-error');
    expect(event.detail.error.message).to.contain('503');
    await el.updateComplete;
    const status = el.shadowRoot.querySelector('[part~="error"]');
    expect(status).to.exist;
  });

  it('slices adopted items to the limit', async () => {
    window.fetch = async () =>
      fakeResponse({
        body: JSON.stringify({ items: [1, 2, 3, 4, 5].map((n) => ({ title: `t${n}` })) }),
      });

    const el = document.createElement('newsflash-feed');
    el.limit = 2;
    el.src = '/feed.json';
    document.body.appendChild(el);

    const event = await oneEvent(el, 'newsflash-load');
    expect(event.detail.items).to.have.lengthOf(2);
  });
});

// ---------------------------------------------------------------------------
// Inline data
// ---------------------------------------------------------------------------
describe('inline data', () => {
  it('renders from an inline <script> without fetching', async () => {
    let fetched = false;
    window.fetch = async () => {
      fetched = true;
      return fakeResponse({ body: '{}' });
    };
    const el = await mount({ inline: { items: [{ title: 'Inline', link: 'https://e.com/i' }] } });
    expect(fetched).to.be.false;
    expect(el.shadowRoot.querySelector('[part="title"]').textContent.trim()).to.equal('Inline');
  });

  it('shows an error status when inline JSON is malformed and there is no endpoint', async () => {
    const el = await mount({ inline: '{ not json' });
    const status = el.shadowRoot.querySelector('[part~="error"]');
    expect(status).to.exist;
  });
});

// ---------------------------------------------------------------------------
// Rendering, layouts and accessibility
// ---------------------------------------------------------------------------
describe('rendering', () => {
  const data = {
    items: [
      { title: 'One', link: 'https://e.com/1', date: '2026-07-24T12:00:00Z' },
      { title: 'Two', link: 'https://e.com/2', date: '2026-07-25T12:00:00Z' },
    ],
  };

  it('renders a real list with headings and time elements', async () => {
    const el = await mount({ attrs: { layout: 'list' }, inline: data });
    const items = el.shadowRoot.querySelectorAll('li[part="item"]');
    expect(items).to.have.lengthOf(2);
    expect(el.shadowRoot.querySelector('h3[part="title"]')).to.exist;
    expect(el.shadowRoot.querySelector('time[datetime]')).to.exist;
    expect(el.shadowRoot.querySelector('[part="container"]').getAttribute('aria-busy')).to.equal(
      'false'
    );
  });

  it('falls back to the grid layout for an unknown layout', async () => {
    const el = await mount({ attrs: { layout: 'nope' }, inline: data });
    expect(el.shadowRoot.querySelector('.container').classList.contains('layout-grid')).to.be.true;
  });

  it('escapes feed markup instead of rendering it', async () => {
    const el = await mount({ inline: { items: [{ title: '<img src=x onerror=alert(1)>' }] } });
    const title = el.shadowRoot.querySelector('[part="title"]');
    expect(title.querySelector('img')).to.equal(null);
  });

  it('duplicates ticker items as aria-hidden, out of tab order', async () => {
    const el = await mount({ attrs: { layout: 'ticker' }, inline: data });
    const items = el.shadowRoot.querySelectorAll('li[part="item"]');
    expect(items.length).to.equal(4); // 2 real + 2 clones
    const clones = [...items].filter((li) => li.getAttribute('aria-hidden') === 'true');
    expect(clones).to.have.lengthOf(2);
    expect(clones[0].querySelector('a').getAttribute('tabindex')).to.equal('-1');
  });

  it('shows an empty state for a feed with no items', async () => {
    const el = await mount({ inline: { items: [] } });
    const empty = el.shadowRoot.querySelector('[part~="empty"]');
    expect(empty).to.exist;
    expect(empty.textContent).to.contain('No items');
  });

  it('removes a thumbnail whose image fails to load', async () => {
    const el = await mount({
      attrs: { images: '' },
      inline: { items: [{ title: 'x', image: 'https://e.com/broken.jpg' }] },
    });
    const thumb = el.shadowRoot.querySelector('[part="thumb"]');
    expect(thumb).to.exist;
    thumb.querySelector('img').dispatchEvent(new Event('error'));
    expect(el.shadowRoot.querySelector('[part="thumb"]')).to.equal(null);
  });
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
describe('module exports', () => {
  it('exposes the five layout names', () => {
    expect(LAYOUTS).to.deep.equal(['list', 'grid', 'cards', 'magazine', 'ticker']);
  });

  it('registers the custom element', () => {
    expect(customElements.get('newsflash-feed')).to.equal(NewsflashFeed);
  });
});
