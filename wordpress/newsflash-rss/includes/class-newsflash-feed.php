<?php
/**
 * Feed fetching and normalization.
 *
 * Shared by the shortcode (which renders server-side by default) and the REST
 * route (which only exists for feeds that refresh in the browser), so both
 * paths produce byte-identical JSON.
 *
 * @package Newsflash
 */

defined( 'ABSPATH' ) || exit;

class Newsflash_Feed {

	/** Default cache lifetime for fetched feeds, in seconds. */
	const CACHE_LIFETIME = 900;

	/**
	 * Fetch one or more feeds and normalize them into the envelope the
	 * <newsflash-feed> component reads.
	 *
	 * @param string|string[] $urls  Feed URL, comma-separated list, or array.
	 * @param int             $limit Maximum number of items.
	 * @return array|WP_Error `array{title: string, link: string, items: array}`
	 */
	public static function get( $urls, $limit = 10 ) {
		$limit = max( 1, min( 50, (int) $limit ) );
		$urls  = self::split( $urls );

		if ( empty( $urls ) ) {
			return new WP_Error( 'newsflash_no_url', __( 'No feed URL given.', 'newsflash-rss' ) );
		}

		foreach ( $urls as $url ) {
			// Blocks non-http(s) schemes plus loopback and private ranges —
			// the SSRF guard that a URL signature alone does not provide.
			if ( ! wp_http_validate_url( $url ) ) {
				return new WP_Error(
					'newsflash_invalid_url',
					/* translators: %s: the rejected URL. */
					sprintf( __( 'Refusing to fetch %s.', 'newsflash-rss' ), $url )
				);
			}
		}

		$feed = self::fetch( count( $urls ) === 1 ? $urls[0] : $urls );

		if ( is_wp_error( $feed ) ) {
			return $feed;
		}

		$items = array();
		foreach ( $feed->get_items( 0, $limit ) as $item ) {
			$items[] = self::format_item( $item );
		}

		return array(
			'title' => self::text( $feed->get_title() ),
			'link'  => esc_url_raw( (string) $feed->get_permalink() ),
			'items' => $items,
		);
	}

	/**
	 * Normalize the `feed` attribute into a list of URLs.
	 *
	 * @param string|string[] $urls
	 * @return string[]
	 */
	public static function split( $urls ) {
		if ( ! is_array( $urls ) ) {
			$urls = explode( ',', (string) $urls );
		}
		return array_values( array_filter( array_map( 'trim', $urls ) ) );
	}

	/**
	 * Wrap fetch_feed() so our cache lifetime does not leak onto every other
	 * feed the site fetches.
	 *
	 * @param string|string[] $urls
	 * @return SimplePie|WP_Error
	 */
	private static function fetch( $urls ) {
		$lifetime = static function () {
			return (int) apply_filters( 'newsflash_cache_lifetime', self::CACHE_LIFETIME );
		};

		add_filter( 'wp_feed_cache_transient_lifetime', $lifetime, 20 );
		$feed = fetch_feed( $urls );
		remove_filter( 'wp_feed_cache_transient_lifetime', $lifetime, 20 );

		return $feed;
	}

	/**
	 * Normalize one SimplePie item.
	 *
	 * @param SimplePie_Item $item
	 * @return array
	 */
	private static function format_item( $item ) {
		$content = (string) $item->get_content();
		$author  = $item->get_author();
		$source  = $item->get_feed();

		return array(
			'title'   => self::text( $item->get_title() ),
			'link'    => esc_url_raw( (string) $item->get_permalink() ),
			'date'    => (string) $item->get_date( 'c' ),
			'author'  => $author ? self::text( $author->get_name() ) : '',
			'image'   => self::find_image( $item, $content ),
			'excerpt' => wp_trim_words( self::text( $content ), 40, '…' ),
			'source'  => $source ? self::text( $source->get_title() ) : '',
		);
	}

	/**
	 * Feeds advertise images in at least three places and agree on none of
	 * them: an enclosure, a media:thumbnail, or just an <img> in the body.
	 *
	 * @param SimplePie_Item $item
	 * @param string         $content Pre-fetched item content.
	 * @return string Image URL, or '' when there is none.
	 */
	private static function find_image( $item, $content ) {
		$enclosure = $item->get_enclosure();

		if ( $enclosure ) {
			$thumbnail = $enclosure->get_thumbnail();
			if ( $thumbnail ) {
				return esc_url_raw( (string) $thumbnail );
			}

			$link = (string) $enclosure->get_link();
			$type = (string) $enclosure->get_type();
			if ( $link && ( 0 === strpos( $type, 'image/' ) || preg_match( '/\.(jpe?g|png|gif|webp|avif)(\?|$)/i', $link ) ) ) {
				return esc_url_raw( $link );
			}
		}

		if ( $content && preg_match( '/<img[^>]+src=["\']([^"\']+)["\']/i', $content, $matches ) ) {
			return esc_url_raw( $matches[1] );
		}

		return '';
	}

	/** Feed text is HTML; the component renders plain text only. */
	private static function text( $value ) {
		return html_entity_decode( wp_strip_all_tags( (string) $value ), ENT_QUOTES, 'UTF-8' );
	}
}
