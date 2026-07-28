import { expect } from '@open-wc/testing';
import {
  boolAttr,
  formatDate,
  truncate,
  stripHtml,
  firstImage,
  safeUrl,
  hostname,
  parseFeedXml,
} from '../src/format.js';

// ---------------------------------------------------------------------------
// safeUrl — the component's XSS defence. The README promises a feed "cannot
// inject script, javascript: URLs, or markup"; this is where that holds.
// ---------------------------------------------------------------------------
describe('safeUrl', () => {
  it('returns empty string for missing input', () => {
    expect(safeUrl('')).to.equal('');
    expect(safeUrl(null)).to.equal('');
    expect(safeUrl(undefined)).to.equal('');
  });

  it('passes http(s) URLs through', () => {
    expect(safeUrl('https://example.com/a')).to.equal('https://example.com/a');
    expect(safeUrl('http://example.com/a')).to.equal('http://example.com/a');
  });

  it('blocks javascript: URLs', () => {
    expect(safeUrl('javascript:alert(1)')).to.equal('');
    // Leading whitespace and mixed case must not smuggle the scheme past.
    expect(safeUrl('  javascript:alert(1)')).to.equal('');
    expect(safeUrl('JavaScript:alert(1)')).to.equal('');
    expect(safeUrl('\tjavascript:alert(1)')).to.equal('');
  });

  it('blocks data:, vbscript: and file: URLs', () => {
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).to.equal('');
    expect(safeUrl('vbscript:msgbox(1)')).to.equal('');
    expect(safeUrl('file:///etc/passwd')).to.equal('');
  });

  it('resolves relative and protocol-relative URLs against the page origin', () => {
    // The test page is served over http(s), so both resolve to an allowed scheme.
    const relative = safeUrl('/feed/item');
    expect(relative).to.match(/^https?:\/\//);
    expect(relative.endsWith('/feed/item')).to.be.true;

    const protocolRelative = safeUrl('//example.com/x');
    expect(protocolRelative).to.match(/^https?:\/\/example\.com\/x$/);
  });

  it('returns empty string for unparseable input', () => {
    expect(safeUrl('http://')).to.equal('');
  });
});

// ---------------------------------------------------------------------------
// boolAttr — WordPress shortcodes can only emit strings, so false/0/no/off all
// have to mean false while a bare attribute means true.
// ---------------------------------------------------------------------------
describe('boolAttr.fromAttribute', () => {
  it('treats an absent attribute as false', () => {
    expect(boolAttr.fromAttribute(null)).to.be.false;
  });

  it('treats a bare attribute as true', () => {
    expect(boolAttr.fromAttribute('')).to.be.true;
  });

  it('treats false/0/no/off (any case, padded) as false', () => {
    for (const value of ['false', '0', 'no', 'off', 'FALSE', ' Off ', 'No']) {
      expect(boolAttr.fromAttribute(value), value).to.be.false;
    }
  });

  it('treats any other string as true', () => {
    for (const value of ['true', 'yes', '1', 'on']) {
      expect(boolAttr.fromAttribute(value), value).to.be.true;
    }
  });
});

describe('boolAttr.toAttribute', () => {
  it('reflects truthy as a bare attribute and falsy as removed', () => {
    expect(boolAttr.toAttribute(true)).to.equal('');
    expect(boolAttr.toAttribute(false)).to.equal(null);
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------
describe('truncate', () => {
  it('returns empty string for missing input', () => {
    expect(truncate('', 5)).to.equal('');
    expect(truncate(undefined, 5)).to.equal('');
  });

  it('leaves text at or under the limit untouched (but trimmed)', () => {
    expect(truncate('one two three', 5)).to.equal('one two three');
    expect(truncate('  one two  ', 5)).to.equal('one two');
    expect(truncate('one two three', 3)).to.equal('one two three');
  });

  it('cuts on a word boundary and appends an ellipsis', () => {
    expect(truncate('one two three four five', 3)).to.equal('one two three…');
  });

  it('collapses internal whitespace when splitting', () => {
    expect(truncate('one   two\n\nthree four', 2)).to.equal('one two…');
  });
});

// ---------------------------------------------------------------------------
// stripHtml / firstImage — feeds hand us HTML; we only ever render plain text.
// ---------------------------------------------------------------------------
describe('stripHtml', () => {
  it('returns empty string for missing input', () => {
    expect(stripHtml('')).to.equal('');
  });

  it('removes tags and keeps text', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).to.equal('Hello world');
  });

  it('does not let markup survive as markup', () => {
    expect(stripHtml('<img src=x onerror=alert(1)>hi')).to.equal('hi');
    expect(stripHtml('<script>alert(1)</script>text')).to.not.contain('<');
  });

  it('decodes entities and collapses whitespace', () => {
    expect(stripHtml('a &amp; b')).to.equal('a & b');
    expect(stripHtml('one\n\n   two')).to.equal('one two');
  });
});

describe('firstImage', () => {
  it('returns empty string when there is no image', () => {
    expect(firstImage('')).to.equal('');
    expect(firstImage('<p>no pictures here</p>')).to.equal('');
  });

  it('returns the first img[src] in the body', () => {
    expect(firstImage('<p>x</p><img src="a.jpg"><img src="b.jpg">')).to.equal('a.jpg');
  });
});

// ---------------------------------------------------------------------------
// hostname
// ---------------------------------------------------------------------------
describe('hostname', () => {
  it('strips a leading www.', () => {
    expect(hostname('https://www.example.com/a')).to.equal('example.com');
  });

  it('keeps other subdomains', () => {
    expect(hostname('https://news.example.com')).to.equal('news.example.com');
  });

  it('returns empty string for a non-URL', () => {
    expect(hostname('not a url')).to.equal('');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('returns empty string for missing or unparseable dates', () => {
    expect(formatDate('', 'relative', 'en')).to.equal('');
    expect(formatDate('not a date', 'relative', 'en')).to.equal('');
  });

  it('formats a past date relatively', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatDate(twoDaysAgo, 'relative', 'en')).to.equal('2 days ago');
  });

  it('formats an absolute date with month and year', () => {
    const out = formatDate('2026-07-24T12:00:00Z', 'absolute', 'en-US');
    expect(out).to.contain('2026');
    expect(out).to.contain('Jul');
  });
});

// ---------------------------------------------------------------------------
// parseFeedXml — the hand-rolled RSS 2.0 / RDF / Atom parser, the most
// branch-heavy code in the component.
// ---------------------------------------------------------------------------
describe('parseFeedXml', () => {
  it('parses an RSS 2.0 item with namespaced fields', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"
           xmlns:content="http://purl.org/rss/1.0/modules/content/"
           xmlns:dc="http://purl.org/dc/elements/1.1/"
           xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>Example Feed</title>
          <link>https://example.com</link>
          <item>
            <title>First post</title>
            <link>https://example.com/1</link>
            <pubDate>Mon, 27 Jul 2026 06:12:00 +0200</pubDate>
            <dc:creator>Jane Doe</dc:creator>
            <description>A short summary.</description>
            <content:encoded><![CDATA[<p>Full <b>body</b></p>]]></content:encoded>
            <media:thumbnail url="https://example.com/thumb.jpg"/>
          </item>
        </channel>
      </rss>`;

    const feed = parseFeedXml(xml);
    expect(feed.title).to.equal('Example Feed');
    expect(feed.link).to.equal('https://example.com');
    expect(feed.items).to.have.lengthOf(1);

    const item = feed.items[0];
    expect(item.title).to.equal('First post');
    expect(item.link).to.equal('https://example.com/1');
    expect(item.date).to.equal('Mon, 27 Jul 2026 06:12:00 +0200');
    expect(item.author).to.equal('Jane Doe'); // dc:creator matched by localName
    expect(item.description).to.equal('A short summary.');
    expect(item.content).to.equal('<p>Full <b>body</b></p>'); // content:encoded
    expect(item.image).to.equal('https://example.com/thumb.jpg'); // media:thumbnail
  });

  it('parses an Atom entry, honouring rel="alternate" links', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Example</title>
        <link rel="self" href="https://example.com/atom.xml"/>
        <link rel="alternate" href="https://example.com/atom"/>
        <entry>
          <title>Atom entry</title>
          <link rel="self" href="https://example.com/atom/1.xml"/>
          <link rel="alternate" href="https://example.com/atom/1"/>
          <published>2026-07-27T06:12:00Z</published>
          <author><name>Atom Author</name></author>
          <summary>Atom summary.</summary>
        </entry>
      </feed>`;

    const feed = parseFeedXml(xml);
    expect(feed.title).to.equal('Atom Example');
    expect(feed.link).to.equal('https://example.com/atom'); // self is skipped

    const item = feed.items[0];
    expect(item.title).to.equal('Atom entry');
    expect(item.link).to.equal('https://example.com/atom/1'); // self is skipped
    expect(item.date).to.equal('2026-07-27T06:12:00Z');
    expect(item.author).to.equal('Atom Author');
    expect(item.description).to.equal('Atom summary.');
    expect(item.image).to.equal(''); // link href must not be mistaken for an image
  });

  it('falls back to guid/id when an item has no link', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>F</title>
        <item>
          <title>No link</title>
          <guid>https://example.com/permalink</guid>
        </item>
      </channel></rss>`;

    expect(parseFeedXml(xml).items[0].link).to.equal('https://example.com/permalink');
  });

  it('reads images from an image enclosure and from media:content', () => {
    const enclosure = `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>F</title>
        <item><title>a</title>
          <enclosure url="https://example.com/e.jpg" type="image/jpeg"/>
        </item>
      </channel></rss>`;
    expect(parseFeedXml(enclosure).items[0].image).to.equal('https://example.com/e.jpg');

    const media = `<?xml version="1.0"?>
      <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
        <channel><title>F</title>
          <item><title>a</title>
            <media:content url="https://example.com/m.jpg" medium="image"/>
          </item>
        </channel></rss>`;
    expect(parseFeedXml(media).items[0].image).to.equal('https://example.com/m.jpg');
  });

  it('throws on unparseable XML', () => {
    expect(() => parseFeedXml('<rss><channel></rss>')).to.throw(/valid XML/);
    expect(() => parseFeedXml('not xml at all <')).to.throw(/valid XML/);
  });
});
