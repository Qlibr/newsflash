// The component is loaded as an external resource (see demo.details) and
// registers <newsflash-feed> itself. Everything here is just the demo's
// layout/theme switcher.

const feed = document.getElementById('demo');
const snippet = document.getElementById('snippet');

function paint() {
  const layout = feed.getAttribute('layout');
  const theme = feed.getAttribute('theme') || 'auto';
  const lines = ['<newsflash-feed', '  src="/feed.xml"', `  layout="${layout}"`];
  if (layout !== 'ticker') lines.push('  columns="3"');
  lines.push(`  limit="${feed.getAttribute('limit')}"`);
  if (theme !== 'auto') lines.push(`  theme="${theme}"`);
  snippet.textContent = `${lines.join('\n')}\n></newsflash-feed>`;
}

function wire(selector, apply) {
  const buttons = [...document.querySelectorAll(selector)];
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      apply(button);
      paint();
    });
  });
}

wire('button[data-layout]', (button) => {
  const layout = button.dataset.layout;
  feed.setAttribute('layout', layout);
  // The ticker is headline-only, so it can carry more items.
  feed.setAttribute('limit', layout === 'ticker' ? '12' : '6');
});

wire('button[data-theme]', (button) => {
  feed.setAttribute('theme', button.dataset.theme);
});

// Fires for inlined data as well as fetched feeds.
feed.addEventListener('newsflash-load', (event) => {
  console.log(`newsflash-load: ${event.detail.items.length} items`);
});

feed.addEventListener('newsflash-error', (event) => {
  console.warn('newsflash-error:', event.detail.error.message);
});

paint();
