/**
 * React usage.
 *
 * React 19 has first-class custom element support: unknown props are set as
 * properties when the element defines them and as attributes otherwise, and
 * `on*` handlers bind real DOM events. So the component needs no wrapper.
 *
 * On React 18 or older, camelCase props and custom events do NOT work — use
 * the ref-based variant at the bottom of this file.
 */
import { useCallback, useRef, useEffect, useState } from 'react';
import '@qlibr/newsflash-feed'; // side-effect import: defines <newsflash-feed>

export function LatestNews() {
  const [count, setCount] = useState(0);

  // `newsflash-load` is a CustomEvent; React 19 binds it from the prop name.
  const handleLoad = useCallback((event) => {
    setCount(event.detail.items.length);
  }, []);

  return (
    <section>
      <newsflash-feed
        feed="https://example.com/feed.xml"
        endpoint="/api/feed"
        layout="cards"
        columns={3}
        limit={9}
        heading="Latest news"
        onnewsflash-load={handleLoad}
      />
      <p>{count} stories</p>
    </section>
  );
}

/** React 18 and older: attach listeners and set properties through a ref. */
export function LatestNewsLegacy({ feed }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onLoad = (event) => console.log('loaded', event.detail.items);
    element.addEventListener('newsflash-load', onLoad);
    return () => element.removeEventListener('newsflash-load', onLoad);
  }, []);

  return (
    <newsflash-feed
      ref={ref}
      feed={feed}
      endpoint="/api/feed"
      layout="grid"
      columns="3"
      limit="6"
    />
  );
}
