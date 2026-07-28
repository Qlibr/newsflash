import { LitElement } from 'lit';

export declare const LAYOUTS: readonly ['list', 'grid', 'cards', 'magazine', 'ticker'];

export type NewsflashLayout = (typeof LAYOUTS)[number];
export type NewsflashTheme = 'auto' | 'light' | 'dark' | 'matrix';
export type NewsflashDateStyle = 'relative' | 'absolute';

/** One feed item after normalization. */
export interface NewsflashItem {
  /** Plain text; `"(untitled)"` when the feed omitted a title. */
  title: string;
  /** http(s) only; `''` when missing or unsafe. */
  link: string;
  /** As published — ISO 8601, RFC 822, or whatever the feed used. */
  date: string;
  /** Parsed but not rendered by any layout. */
  author: string;
  /** http(s) only; `''` when the item has no usable image. */
  image: string;
  /** Plain text, truncated to `excerptWords`. */
  excerpt: string;
  /** Feed title, falling back to the link's hostname. */
  source: string;
}

export declare class NewsflashFeed extends LitElement {
  /** Fully-formed URL returning JSON or XML. Takes precedence over `feed`. */
  src: string;
  /** Feed URL(s), comma separated, resolved through `endpoint`. */
  feed: string;
  /** Proxy base used with `feed`. */
  endpoint: string;
  layout: NewsflashLayout;
  /** `matrix` is a dot-matrix LED sign, not a light/dark pair. */
  theme: NewsflashTheme;
  limit: number;
  columns: number;
  heading: string;
  images: boolean;
  excerpt: boolean;
  dates: boolean;
  sources: boolean;
  excerptWords: number;
  dateStyle: NewsflashDateStyle;
  /** BCP 47 tag; defaults to `<html lang>`. */
  locale: string | undefined;
  target: '_blank' | '_self' | string;
  /** Re-fetch interval in seconds. `0` disables. */
  refresh: number;
  lazy: boolean;

  /** The URL that will be fetched, or `''` when there is none. */
  readonly resolvedUrl: string;

  /** Re-fetch now, aborting any in-flight request first. */
  load(): Promise<void>;
}

export type NewsflashLoadEvent = CustomEvent<{ items: NewsflashItem[] }>;
export type NewsflashErrorEvent = CustomEvent<{ error: Error }>;

declare global {
  interface HTMLElementTagNameMap {
    'newsflash-feed': NewsflashFeed;
  }
  interface HTMLElementEventMap {
    'newsflash-load': NewsflashLoadEvent;
    'newsflash-error': NewsflashErrorEvent;
  }
}

export default NewsflashFeed;
