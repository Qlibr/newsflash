/**
 * Small formatting helpers shared by the component. Kept free of DOM/Lit
 * dependencies so they stay easy to unit test.
 */

/**
 * Attribute converter that treats a bare attribute (`excerpt`) as true but
 * still honours an explicit `excerpt="false"`. WordPress shortcodes always
 * emit string values, so `false`/`0`/`no`/`off` all have to mean false.
 */
export const boolAttr = {
  fromAttribute(value) {
    if (value === null) return false;
    if (value === '') return true;
    return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
  },
  toAttribute(value) {
    return value ? '' : null;
  },
};

const RELATIVE_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * @param {string} iso ISO 8601 date string
 * @param {'relative'|'absolute'} style
 * @param {string} locale BCP 47 tag
 * @returns {string} empty string when the date is missing or unparseable
 */
export function formatDate(iso, style, locale) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  if (style === 'relative' && typeof Intl.RelativeTimeFormat === 'function') {
    const seconds = (date.getTime() - Date.now()) / 1000;
    const abs = Math.abs(seconds);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (abs < 60) return rtf.format(Math.round(seconds), 'second');
    for (const [unit, size] of RELATIVE_UNITS) {
      if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
    }
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Truncate on a word boundary without cutting a word in half. */
export function truncate(text, maxWords) {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

/**
 * Feeds hand us HTML in <description>/<content:encoded>. We only ever render
 * plain text, so strip tags via the parser rather than a regex — this also
 * decodes entities like &amp;amp; correctly.
 */
export function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Pull the first <img src> out of a feed item's HTML body. */
export function firstImage(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const img = doc.querySelector('img[src]');
  return img ? img.getAttribute('src') : '';
}

/** Only http(s) links are ever rendered — blocks javascript:/data: in feeds. */
export function safeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

/**
 * Read a direct child's text by tag name, trying each name in order.
 * Matches on `localName` so namespaced tags (`content:encoded`, `dc:date`)
 * are found regardless of the prefix the publisher happened to pick.
 */
function childText(element, ...names) {
  for (const name of names) {
    for (const child of element.children) {
      if (child.localName === name || child.nodeName.toLowerCase() === name) {
        const text = (child.textContent || '').trim();
        if (text) return text;
      }
    }
  }
  return '';
}

/** RSS puts the URL in the text node, Atom in a `href` attribute. */
function childLink(element) {
  for (const child of element.children) {
    if (child.localName !== 'link') continue;
    const rel = child.getAttribute('rel');
    if (rel && rel !== 'alternate') continue;
    const href = child.getAttribute('href');
    if (href) return href.trim();
    const text = (child.textContent || '').trim();
    if (text) return text;
  }
  // A guid/id is a permalink often enough to be worth the fallback.
  return childText(element, 'guid', 'id');
}

function childImage(element) {
  for (const child of element.children) {
    const url = child.getAttribute?.('url') || child.getAttribute?.('href') || '';
    if (!url) continue;
    const type = child.getAttribute('type') || '';
    const medium = child.getAttribute('medium') || '';
    if (child.localName === 'thumbnail') return url;
    if (child.localName === 'content' && (medium === 'image' || type.startsWith('image/'))) {
      return url;
    }
    if (child.localName === 'enclosure' && type.startsWith('image/')) return url;
  }
  return '';
}

/**
 * Parse an RSS 2.0 / RDF / Atom document into the same envelope shape the
 * JSON endpoints return. Used when a feed is same-origin, sends CORS headers,
 * or comes back as raw XML through a passthrough proxy.
 *
 * @param {string} text
 * @returns {{title: string, link: string, items: Array}}
 * @throws {Error} when the document is not parseable XML
 */
export function parseFeedXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.documentElement.localName === 'parsererror' || doc.querySelector('parsererror')) {
    throw new Error('Feed is not valid XML.');
  }

  const root = doc.querySelector('channel') || doc.documentElement;
  const nodes = Array.from(doc.querySelectorAll('item, entry'));

  return {
    title: childText(root, 'title'),
    link: childLink(root),
    items: nodes.map((node) => ({
      title: childText(node, 'title'),
      link: childLink(node),
      date: childText(node, 'pubDate', 'published', 'updated', 'date'),
      author: childText(node, 'creator', 'author', 'name'),
      image: childImage(node),
      description: childText(node, 'description', 'summary'),
      content: childText(node, 'encoded', 'content'),
    })),
  };
}

export function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
