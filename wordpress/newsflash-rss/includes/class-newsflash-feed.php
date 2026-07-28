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

		// Validate every URL up front and remember the addresses each one was
		// approved for, so the fetch can be pinned to exactly those (see fetch()).
		$pins = array();
		foreach ( $urls as $url ) {
			$addresses = self::validate( $url );
			if ( false === $addresses ) {
				return new WP_Error(
					'newsflash_invalid_url',
					/* translators: %s: the rejected URL. */
					sprintf( __( 'Refusing to fetch %s.', 'newsflash-rss' ), $url )
				);
			}
			$pins += self::pins_for( $url, $addresses );
		}

		$feed = self::fetch( count( $urls ) === 1 ? $urls[0] : $urls, $pins );

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
	 * Validate a URL for server-side fetching and return the addresses it was
	 * approved for, or false if it must not be fetched.
	 *
	 * wp_http_validate_url() rejects non-http(s) schemes, loopback and the
	 * RFC1918 private ranges, but it permits 169.254.0.0/16 — the link-local
	 * range holding cloud instance metadata (169.254.169.254) and ECS task
	 * credentials (169.254.170.2). A signed URL is still attacker-influenced
	 * (anyone who can place a shortcode chooses it), so relying on
	 * wp_http_validate_url() alone leaves a blind SSRF into the metadata
	 * service. Every resolved address is therefore checked against PHP's
	 * private *and* reserved ranges, which do cover link-local.
	 *
	 * The returned addresses are handed to fetch(), which pins the connection
	 * to them (CURLOPT_RESOLVE). That is what closes the DNS-rebinding window:
	 * without pinning, cURL would resolve the name a second time when it
	 * connects, letting a low-TTL record rebind to an internal address between
	 * this check and the request.
	 *
	 * @param string $url
	 * @return string[]|false The vetted addresses, or false when unfetchable.
	 */
	private static function validate( $url ) {
		if ( ! wp_http_validate_url( $url ) ) {
			return false;
		}

		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( ! $host ) {
			return false;
		}

		$addresses = self::resolve( trim( $host, '[]' ) );
		if ( empty( $addresses ) ) {
			return false;
		}

		foreach ( $addresses as $address ) {
			$public = filter_var(
				$address,
				FILTER_VALIDATE_IP,
				FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
			);
			if ( ! $public ) {
				return false;
			}
		}

		return $addresses;
	}

	/**
	 * Build the CURLOPT_RESOLVE entry that pins a URL's host to the exact
	 * addresses validate() approved, keyed by "host:port".
	 *
	 * @param string   $url
	 * @param string[] $addresses Vetted addresses from validate().
	 * @return array<string,string> Map of "host:port" => comma-joined addresses.
	 */
	private static function pins_for( $url, array $addresses ) {
		$host = trim( (string) wp_parse_url( $url, PHP_URL_HOST ), '[]' );
		$port = (int) wp_parse_url( $url, PHP_URL_PORT );
		if ( ! $port ) {
			$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
			$port   = 'https' === $scheme ? 443 : 80;
		}

		return array( $host . ':' . $port => implode( ',', $addresses ) );
	}

	/**
	 * Every address a host resolves to, so a name pointing at both a public
	 * and an internal address is rejected rather than sampled.
	 *
	 * @param string $host Hostname or IP literal.
	 * @return string[]
	 */
	private static function resolve( $host ) {
		if ( filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return array( $host );
		}

		$addresses = array();

		$records = @dns_get_record( $host, DNS_A | DNS_AAAA ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( is_array( $records ) ) {
			foreach ( $records as $record ) {
				if ( ! empty( $record['ip'] ) ) {
					$addresses[] = $record['ip'];
				}
				if ( ! empty( $record['ipv6'] ) ) {
					$addresses[] = $record['ipv6'];
				}
			}
		}

		// dns_get_record can be unavailable or blocked; fall back to the
		// resolver gethostbyname uses rather than failing open.
		if ( empty( $addresses ) ) {
			$ipv4 = gethostbyname( $host );
			if ( $ipv4 && $ipv4 !== $host ) {
				$addresses[] = $ipv4;
			}
		}

		return $addresses;
	}

	/**
	 * Wrap fetch_feed() so our cache lifetime does not leak onto every other
	 * feed the site fetches.
	 *
	 * @param string|string[] $urls
	 * @return SimplePie|WP_Error
	 */
	private static function fetch( $urls, array $pins = array() ) {
		$lifetime = static function () {
			return (int) apply_filters( 'newsflash_cache_lifetime', self::CACHE_LIFETIME );
		};

		// Close the DNS-rebinding window. validate() already resolved and vetted
		// each host's address; pin the cURL handle to those addresses so the
		// connection goes there instead of resolving the name a second time. An
		// attacker serving a low-TTL record therefore cannot rebind the host to
		// an internal address (169.254.169.254, ECS credentials, …) in the gap
		// between the check and the request.
		//
		// http_api_curl passes the handle by reference, so CURLOPT_RESOLVE set
		// here reaches the real request. This covers the cURL transport, which
		// every mainstream install uses. Residual: cURL still resolves the host
		// of any cross-host redirect itself; those hops are not pinned.
		$pin = static function ( $handle ) use ( $pins ) {
			if ( empty( $pins ) || ! function_exists( 'curl_setopt' ) ) {
				return;
			}
			$resolve = array();
			foreach ( $pins as $host_port => $addresses ) {
				$resolve[] = $host_port . ':' . $addresses;
			}
			curl_setopt( $handle, CURLOPT_RESOLVE, $resolve );
		};

		add_filter( 'wp_feed_cache_transient_lifetime', $lifetime, 20 );
		add_action( 'http_api_curl', $pin, 10, 1 );
		$feed = fetch_feed( $urls );
		remove_action( 'http_api_curl', $pin, 10 );
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
