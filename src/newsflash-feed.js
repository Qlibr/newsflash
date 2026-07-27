import { LitElement, html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { baseStyles, layoutStyles } from './styles.js';
import {
  boolAttr,
  formatDate,
  truncate,
  stripHtml,
  firstImage,
  safeUrl,
  hostname,
  parseFeedXml,
} from './format.js';

export const LAYOUTS = ['list', 'grid', 'cards', 'magazine', 'ticker'];

/**
 * `<newsflash-feed>` — renders an RSS/Atom/JSON feed in one of several
 * layouts. See README.md for the full reference.
 *
 * Data reaches it three ways, in priority order:
 *
 *   1. A `<script type="application/json">` child — inlined by the server, no
 *      request made. What the WordPress shortcode emits by default.
 *   2. `src` — a fully-formed URL returning JSON or XML.
 *   3. `feed` + `endpoint` — the component builds
 *      `<endpoint>?url=<feed>&limit=<limit>` itself.
 *
 * Cross-origin feeds still need a server that sends CORS headers (a proxy, or
 * the publisher itself); same-origin XML can be read directly.
 *
 * @fires newsflash-load  {{ items: Array }} after data is adopted
 * @fires newsflash-error {{ error: Error }} when loading or parsing fails
 */
export class NewsflashFeed extends LitElement {
  static styles = [baseStyles, layoutStyles];

  static properties = {
    /** Fully-formed JSON endpoint. Takes precedence over `feed`. */
    src: { type: String },
    /** Feed URL(s), comma separated, resolved through `endpoint`. */
    feed: { type: String },
    /** Proxy base that turns a feed URL into JSON. */
    endpoint: { type: String },
    /** One of LAYOUTS. */
    layout: { type: String, reflect: true },
    /** Colour scheme: `auto` (default), `light` or `dark`. */
    theme: { type: String, reflect: true },
    limit: { type: Number },
    columns: { type: Number },
    heading: { type: String },
    images: { converter: boolAttr },
    excerpt: { converter: boolAttr },
    dates: { converter: boolAttr },
    sources: { converter: boolAttr },
    excerptWords: { type: Number, attribute: 'excerpt-words' },
    dateStyle: { type: String, attribute: 'date-style' },
    locale: { type: String },
    target: { type: String },
    /** Auto-refresh interval in seconds. 0 disables it. */
    refresh: { type: Number },
    /** Defer the first fetch until the element scrolls into view. */
    lazy: { converter: boolAttr },

    _items: { state: true },
    _status: { state: true },
    _error: { state: true },
  };

  constructor() {
    super();
    this.src = '';
    this.feed = '';
    this.endpoint = '/wp-json/newsflash/v1/feed';
    this.layout = 'grid';
    this.theme = 'auto';
    this.limit = 9;
    this.columns = 3;
    this.heading = '';
    this.images = true;
    this.excerpt = true;
    this.dates = true;
    this.sources = false;
    this.excerptWords = 22;
    this.dateStyle = 'relative';
    this.locale = document.documentElement.lang || undefined;
    this.target = '_blank';
    this.refresh = 0;
    this.lazy = false;

    this._items = [];
    this._payload = null;
    this._status = 'idle';
    this._error = null;
    this._controller = null;
    this._timer = null;
    this._observer = null;
    this._firstUpdate = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this._start();
    this._scheduleRefresh();
  }

  /**
   * Decide where the first paint's data comes from. Server-rendered JSON wins
   * over fetching: it is already here, it survives JS-disabled visitors as
   * markup the server can also emit, and it needs no public endpoint.
   */
  _start() {
    // A synchronously-loaded bundle can upgrade this element before its own
    // children have been parsed, which would hide inline data from us.
    if (this.ownerDocument.readyState === 'loading') {
      this.ownerDocument.addEventListener('DOMContentLoaded', () => this._start(), {
        once: true,
      });
      return;
    }
    if (!this.isConnected) return;
    if (this._readInlineData()) return;

    if (this.lazy) {
      this._observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this._observer.disconnect();
            this._observer = null;
            this.load();
          }
        },
        { rootMargin: '200px' }
      );
      this._observer.observe(this);
    } else {
      this.load();
    }
  }

  /**
   * Read a `<script type="application/json">` child, as emitted by the
   * WordPress shortcode in its default server-rendered mode.
   *
   * @returns {boolean} true when inline data was used and no fetch is needed.
   */
  _readInlineData() {
    const script = this.querySelector('script[type="application/json"]');
    if (!script) return false;

    try {
      const data = JSON.parse(script.textContent || '{}');
      this._apply(data);
      return true;
    } catch (error) {
      // Malformed inline data shouldn't be fatal when there is an endpoint
      // to fall back to.
      console.warn('<newsflash-feed>: inline data is not valid JSON.', error);
      if (this.resolvedUrl) return false;
      this._status = 'error';
      this._error = new Error('Inline feed data is not valid JSON.');
      return true;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._controller?.abort();
    this._observer?.disconnect();
    clearInterval(this._timer);
    this._timer = null;
  }

  updated(changed) {
    // The first update reports every property set in the constructor, which
    // would look like a source change and trigger a second, redundant load —
    // and would stomp on data that came from an inline <script>.
    if (this._firstUpdate) {
      this._firstUpdate = false;
      return;
    }

    const sourceKeys = ['src', 'feed', 'endpoint', 'limit'];
    if (sourceKeys.some((k) => changed.has(k))) {
      if (this.resolvedUrl) {
        this.load();
      } else if (!this._readInlineData() && this._payload) {
        // No endpoint to re-fetch from — an inline-data element whose `limit`
        // changed. Re-slice what we already have instead of erroring.
        this._apply(this._payload);
      }
    }
    if (changed.has('refresh')) this._scheduleRefresh();
  }

  _scheduleRefresh() {
    clearInterval(this._timer);
    this._timer = null;
    const seconds = Number(this.refresh);
    // Nothing to poll when the data was inlined and no endpoint was given.
    if (seconds > 0 && this.resolvedUrl) {
      this._timer = setInterval(() => this.load(), seconds * 1000);
    }
  }

  /**
   * Turn a response body into a feed envelope. Endpoints in the wild return
   * JSON items, a JSON envelope wrapping raw XML, or the XML itself — sniff
   * rather than trust the content type, which passthrough proxies often get
   * wrong.
   *
   * @param {string} text
   * @param {string|null} contentType
   */
  _parse(text, contentType) {
    const looksJson = /json/i.test(contentType || '') || /^\s*[[{]/.test(text);
    if (!looksJson) return parseFeedXml(text);

    const data = JSON.parse(text);
    // AllOrigins' /get endpoint wraps the untouched feed body in `contents`.
    if (typeof data?.contents === 'string') return parseFeedXml(data.contents);
    return data;
  }

  /**
   * Adopt a feed payload from any source. Accepts `{ items: [...] }` or a
   * bare array.
   */
  _apply(data) {
    // Kept so a later `limit` change can re-slice without a network round-trip.
    this._payload = data;
    const raw = Array.isArray(data) ? data : data.items || [];
    this._items = raw.slice(0, this.limit).map((item) => this._normalize(item, data));
    this._status = 'ready';
    this._error = null;
    this.dispatchEvent(
      new CustomEvent('newsflash-load', {
        detail: { items: this._items },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Resolved endpoint, or '' when the element has nothing to fetch. */
  get resolvedUrl() {
    if (this.src) return this.src;
    if (!this.feed || !this.endpoint) return '';
    const url = new URL(this.endpoint, window.location.href);
    url.searchParams.set('url', this.feed);
    url.searchParams.set('limit', String(this.limit));
    return url.href;
  }

  /** Fetch (or re-fetch) the feed. Safe to call at any time. */
  async load() {
    const url = this.resolvedUrl;
    if (!url) {
      this._status = 'error';
      this._error = new Error('No `src` or `feed` set.');
      return;
    }

    this._controller?.abort();
    this._controller = new AbortController();
    // Keep old items on screen while refreshing; only show the skeleton on
    // the very first load.
    this._status = this._items.length ? 'ready' : 'loading';

    try {
      const response = await fetch(url, {
        signal: this._controller.signal,
        headers: { Accept: 'application/json, application/rss+xml, application/xml' },
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error(`Feed request failed (${response.status})`);
      }
      this._apply(this._parse(await response.text(), response.headers.get('content-type')));
    } catch (error) {
      if (error.name === 'AbortError') return;
      this._status = 'error';
      this._error = error;
      this.dispatchEvent(
        new CustomEvent('newsflash-error', {
          detail: { error },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  /**
   * Map whatever the endpoint returned onto the shape the template expects.
   * Accepts the key names used by the WordPress proxy, rss-parser,
   * @extractus/feed-extractor and JSON Feed.
   */
  _normalize(item, envelope = {}) {
    const link = safeUrl(item.link || item.url || item.guid || '');
    // Prefer a field the endpoint already trimmed for us, and only fall back
    // to full content — otherwise every card carries a whole article.
    const body =
      item.excerpt ||
      item.contentSnippet ||
      item.summary ||
      item.description ||
      item.content_text ||
      item.content_html ||
      item.content ||
      '';
    const image =
      safeUrl(
        item.image || item.thumbnail || item.banner_image || item.enclosure?.url || ''
      ) || safeUrl(firstImage(item.content_html || item.content || item.description || ''));

    return {
      title: stripHtml(item.title || '') || '(untitled)',
      link,
      date: item.date || item.published || item.isoDate || item.pubDate || item.date_published || '',
      author: stripHtml(item.author?.name || item.author || item.creator || ''),
      image,
      excerpt: truncate(stripHtml(body), this.excerptWords),
      source:
        stripHtml(
          // rss2json nests the channel under `feed`; everything else is flat.
          item.source?.title || item.source || envelope.title || envelope.feed?.title || ''
        ) || hostname(link),
    };
  }

  render() {
    const containerClasses = {
      container: true,
      [`layout-${LAYOUTS.includes(this.layout) ? this.layout : 'grid'}`]: true,
    };
    const containerStyles = {
      '--nf-columns': String(this.columns),
      // Rows the magazine sidebar will occupy, so the lead item can span
      // exactly that many and no further.
      '--nf-lead-span': String(Math.max(1, this._items.length - 1)),
    };

    return html`
      <section
        part="container"
        class=${classMap(containerClasses)}
        style=${styleMap(containerStyles)}
        aria-busy=${this._status === 'loading' ? 'true' : 'false'}
      >
        ${this.heading || this.querySelector('[slot="header"]')
          ? html`
              <header part="header" class="header">
                ${this.heading
                  ? html`<h2 part="heading" class="heading">${this.heading}</h2>`
                  : nothing}
                <slot name="header"></slot>
              </header>
            `
          : nothing}
        ${this._renderContents()}
      </section>
    `;
  }

  _renderContents() {
    if (this._status === 'loading') return this._renderSkeleton();
    if (this._status === 'error') {
      return html`
        <p part="status error" class="status" data-kind="error" role="status">
          ${this._error?.message || 'Could not load this feed.'}
        </p>
      `;
    }
    if (this._status === 'ready' && !this._items.length) {
      return html`
        <p part="status empty" class="status" role="status">No items to show.</p>
      `;
    }
    if (!this._items.length) return nothing;

    const items = this._items.map((item) => this._renderItem(item));
    return html`
      <ul part="list" class="list">
        ${items}
        <!-- The ticker scrolls by 50%, so it needs a second copy to loop
             seamlessly. The clone is hidden from assistive tech. -->
        ${this.layout === 'ticker'
          ? this._items.map((item) => this._renderItem(item, true))
          : nothing}
      </ul>
    `;
  }

  _renderItem(item, isClone = false) {
    const rel = this.target === '_blank' ? 'noopener noreferrer' : nothing;
    const date = this.dates ? formatDate(item.date, this.dateStyle, this.locale) : '';
    const showMeta = (this.sources && item.source) || date;

    return html`
      <li part="item" class="item" aria-hidden=${isClone ? 'true' : nothing}>
        <a
          part="link"
          class="link"
          href=${item.link || '#'}
          target=${this.target}
          rel=${rel}
          tabindex=${isClone ? '-1' : nothing}
        >
          ${this.images && item.image
            ? html`
                <div part="thumb" class="thumb">
                  <img
                    part="image"
                    class="image"
                    src=${item.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    @error=${this._onImageError}
                  />
                </div>
              `
            : nothing}
          <div part="body" class="body">
            <h3 part="title" class="title">${item.title}</h3>
            ${this.excerpt && item.excerpt
              ? html`<p part="excerpt" class="excerpt">${item.excerpt}</p>`
              : nothing}
            ${showMeta
              ? html`
                  <div part="meta" class="meta">
                    ${this.sources && item.source
                      ? html`<span part="source" class="source">${item.source}</span>`
                      : nothing}
                    ${date
                      ? html`<time part="date" datetime=${item.date}>${date}</time>`
                      : nothing}
                  </div>
                `
              : nothing}
          </div>
        </a>
      </li>
    `;
  }

  /** A dead image URL shouldn't leave an empty grey box behind. */
  _onImageError(event) {
    event.target.closest('.thumb')?.remove();
  }

  _renderSkeleton() {
    const count = this.layout === 'ticker' ? 4 : Math.min(this.limit, 6);
    return html`
      <ul part="list" class="list skeleton" aria-hidden="true">
        ${Array.from(
          { length: count },
          () => html`
            <li part="item" class="item">
              <div class="link">
                ${this.images ? html`<div part="thumb" class="thumb"></div>` : nothing}
                <div class="body">
                  <div class="bar"></div>
                  <div class="bar short"></div>
                </div>
              </div>
            </li>
          `
        )}
      </ul>
    `;
  }
}

if (!customElements.get('newsflash-feed')) {
  customElements.define('newsflash-feed', NewsflashFeed);
}

export default NewsflashFeed;
