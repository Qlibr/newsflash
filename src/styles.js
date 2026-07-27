import { css } from 'lit';

/**
 * Design tokens + shared structure.
 *
 * Everything a themer needs is a `--nf-*` custom property, and every node the
 * component renders carries a `part=` so a host page can reach past the shadow
 * boundary with `newsflash-feed::part(title) { ... }`.
 */
export const baseStyles = css`
  :host {
    /* Palette */
    --nf-bg: transparent;
    --nf-color: #16181d;
    --nf-muted: #5f6672;
    --nf-accent: #1d4ed8;
    --nf-card-bg: #ffffff;
    --nf-border: #e3e6ea;
    --nf-shadow: 0 1px 2px rgb(16 24 40 / 6%), 0 4px 12px rgb(16 24 40 / 4%);
    --nf-skeleton: #e9ecf1;

    /* Typography */
    --nf-font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --nf-font-size: 1rem;
    --nf-heading-size: 1.375rem;
    --nf-title-size: 1.0625rem;
    --nf-title-weight: 600;
    --nf-title-lines: 3;
    --nf-meta-size: 0.8125rem;
    --nf-excerpt-size: 0.9375rem;
    --nf-excerpt-lines: 3;

    /* Layout */
    --nf-gap: 1.5rem;
    --nf-columns: 3;
    --nf-radius: 10px;
    --nf-padding: 1rem;
    --nf-image-ratio: 16 / 9;
    --nf-thumb-size: 88px;
    --nf-ticker-duration: 40s;
    --nf-ticker-gap: 3rem;

    display: block;
    background: var(--nf-bg);
    color: var(--nf-color);
    font-family: var(--nf-font);
    font-size: var(--nf-font-size);
    line-height: 1.45;
    container-type: inline-size;
  }

  @media (prefers-color-scheme: dark) {
    :host(:not([theme='light'])) {
      --nf-color: #e8eaed;
      --nf-muted: #9aa2af;
      --nf-accent: #7ea6ff;
      --nf-card-bg: #16181d;
      --nf-border: #2b2f36;
      --nf-shadow: 0 1px 2px rgb(0 0 0 / 40%);
      --nf-skeleton: #24272e;
    }
  }

  :host([theme='dark']) {
    --nf-color: #e8eaed;
    --nf-muted: #9aa2af;
    --nf-accent: #7ea6ff;
    --nf-card-bg: #16181d;
    --nf-border: #2b2f36;
    --nf-shadow: 0 1px 2px rgb(0 0 0 / 40%);
    --nf-skeleton: #24272e;
  }

  :host([hidden]) {
    display: none;
  }

  * {
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: var(--nf-gap);
  }

  .heading {
    margin: 0;
    font-size: var(--nf-heading-size);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .list {
    display: grid;
    gap: var(--nf-gap);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    min-width: 0;
  }

  .link {
    display: grid;
    gap: 0.75rem;
    color: inherit;
    text-decoration: none;
    min-width: 0;
    height: 100%;
  }

  .link:focus-visible {
    outline: 2px solid var(--nf-accent);
    outline-offset: 3px;
    border-radius: calc(var(--nf-radius) / 2);
  }

  .thumb {
    position: relative;
    overflow: hidden;
    border-radius: var(--nf-radius);
    background: var(--nf-skeleton);
    aspect-ratio: var(--nf-image-ratio);
  }

  .image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  .title {
    margin: 0;
    font-size: var(--nf-title-size);
    font-weight: var(--nf-title-weight);
    line-height: 1.3;
    letter-spacing: -0.005em;
    display: -webkit-box;
    -webkit-line-clamp: var(--nf-title-lines);
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .link:hover .title {
    color: var(--nf-accent);
  }

  .excerpt {
    margin: 0;
    color: var(--nf-muted);
    font-size: var(--nf-excerpt-size);
    display: -webkit-box;
    -webkit-line-clamp: var(--nf-excerpt-lines);
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    color: var(--nf-muted);
    font-size: var(--nf-meta-size);
    margin-block-start: auto;
    padding-block-start: 0.125rem;
  }

  .meta > * + *::before {
    content: '·';
    margin-inline-end: 0.5rem;
  }

  .source {
    font-weight: 500;
  }

  .status {
    padding: var(--nf-padding);
    color: var(--nf-muted);
    font-size: var(--nf-meta-size);
  }

  .status[data-kind='error'] {
    color: #b42318;
  }

  @media (prefers-color-scheme: dark) {
    :host(:not([theme='light'])) .status[data-kind='error'] {
      color: #ff9c92;
    }
  }

  /* Loading skeleton — same grid as the real list so nothing shifts. */
  .skeleton .thumb,
  .skeleton .bar {
    animation: nf-pulse 1.4s ease-in-out infinite;
  }

  .bar {
    height: 0.75rem;
    border-radius: 999px;
    background: var(--nf-skeleton);
  }

  .bar.short {
    width: 45%;
  }

  @keyframes nf-pulse {
    50% {
      opacity: 0.55;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton .thumb,
    .skeleton .bar {
      animation: none;
    }
  }
`;

/**
 * One DOM tree, five presentations. Each layout only redefines geometry, so a
 * theme's colour/typography overrides survive a layout switch.
 */
export const layoutStyles = css`
  /* ---------- list ---------- */
  .layout-list .list {
    gap: calc(var(--nf-gap) * 0.75);
  }

  .layout-list .item + .item {
    border-block-start: 1px solid var(--nf-border);
    padding-block-start: calc(var(--nf-gap) * 0.75);
  }

  .layout-list .link {
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 1rem;
  }

  .layout-list .thumb {
    width: var(--nf-thumb-size);
    aspect-ratio: 1;
  }

  .layout-list .link:not(:has(.thumb)) {
    grid-template-columns: 1fr;
  }

  /* ---------- grid ---------- */
  .layout-grid .list {
    grid-template-columns: repeat(var(--nf-columns), minmax(0, 1fr));
  }

  /* ---------- cards ---------- */
  .layout-cards .list {
    grid-template-columns: repeat(var(--nf-columns), minmax(0, 1fr));
  }

  .layout-cards .item {
    background: var(--nf-card-bg);
    border: 1px solid var(--nf-border);
    border-radius: var(--nf-radius);
    box-shadow: var(--nf-shadow);
    overflow: hidden;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }

  .layout-cards .item:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgb(16 24 40 / 10%);
  }

  .layout-cards .link {
    gap: 0;
    align-content: start;
  }

  .layout-cards .thumb {
    border-radius: 0;
  }

  .layout-cards .body {
    padding: var(--nf-padding);
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .layout-cards .item {
      transition: none;
    }
    .layout-cards .item:hover {
      transform: none;
    }
  }

  /* ---------- magazine ---------- */
  .layout-magazine .list {
    grid-template-columns: 1.6fr 1fr;
    align-items: start;
  }

  /* The lead item spans however many rows the sidebar items occupy. The
     component sets --nf-lead-span from the item count — a hard-coded span
     would leave empty rows (and their gaps) hanging below the sidebar. */
  .layout-magazine .item:first-child {
    grid-row: span var(--nf-lead-span, 3);
  }

  .layout-magazine .item:first-child .title {
    font-size: calc(var(--nf-title-size) * 1.65);
  }

  .layout-magazine .item:not(:first-child) .link {
    grid-template-columns: auto 1fr;
    gap: 0.875rem;
  }

  .layout-magazine .item:not(:first-child) .thumb {
    width: calc(var(--nf-thumb-size) * 0.75);
    aspect-ratio: 1;
  }

  .layout-magazine .item:not(:first-child) .excerpt {
    display: none;
  }

  /* ---------- ticker ---------- */
  .layout-ticker {
    overflow: hidden;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      #000 3rem,
      #000 calc(100% - 3rem),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 3rem,
      #000 calc(100% - 3rem),
      transparent
    );
  }

  .layout-ticker .list {
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    gap: var(--nf-ticker-gap);
    width: max-content;
    animation: nf-scroll var(--nf-ticker-duration) linear infinite;
  }

  .layout-ticker:hover .list {
    animation-play-state: paused;
  }

  .layout-ticker .link {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.625rem;
    white-space: nowrap;
  }

  .layout-ticker .thumb {
    width: 1.75rem;
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .layout-ticker .title {
    display: block;
    overflow: visible;
    font-size: var(--nf-font-size);
  }

  .layout-ticker .excerpt,
  .layout-ticker .item + .item::before {
    display: none;
  }

  @keyframes nf-scroll {
    from {
      transform: translateX(0);
    }
    /* The item list is rendered twice, so -50% is one seamless loop. */
    to {
      transform: translateX(-50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .layout-ticker {
      overflow-x: auto;
    }
    .layout-ticker .list {
      animation: none;
    }
  }

  /* ---------- responsive ---------- */
  @container (max-width: 900px) {
    .layout-grid .list,
    .layout-cards .list {
      grid-template-columns: repeat(min(var(--nf-columns), 2), minmax(0, 1fr));
    }
    .layout-magazine .list {
      grid-template-columns: 1fr;
    }
    .layout-magazine .item:first-child {
      grid-row: auto;
    }
  }

  @container (max-width: 560px) {
    .layout-grid .list,
    .layout-cards .list {
      grid-template-columns: 1fr;
    }
    .layout-magazine .item:first-child .title {
      font-size: calc(var(--nf-title-size) * 1.25);
    }
  }
`;
