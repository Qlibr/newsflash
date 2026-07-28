<?php
/**
 * Lightweight test bootstrap for the plugin's security-critical units.
 *
 * These tests deliberately avoid a full WordPress install: the two things
 * worth pinning down — the SSRF address check and the HMAC signature guard —
 * depend only on a handful of WordPress functions, which are stubbed here.
 * The SSRF tests use IP-literal hosts so no live DNS lookup is involved and the
 * results are deterministic.
 *
 * @package Newsflash
 */

// The plugin files guard on ABSPATH; define it so requiring them is safe.
define( 'ABSPATH', __DIR__ . '/' );

// Lets a test force wp_http_validate_url()'s answer to isolate the plugin's
// own address check from WordPress's.
$GLOBALS['newsflash_wp_validate_url'] = true;

function wp_http_validate_url( $url ) {
	return $GLOBALS['newsflash_wp_validate_url'];
}

function wp_parse_url( $url, $component = -1 ) {
	return parse_url( $url, $component );
}

function wp_salt( $scheme = 'auth' ) {
	// A fixed, non-empty secret so signatures are reproducible across runs.
	return 'test-salt-' . $scheme;
}

function __( $text, $domain = 'default' ) {
	return $text;
}

function apply_filters( $tag, $value ) {
	foreach ( $GLOBALS['newsflash_hooks'][ $tag ] ?? array() as $callback ) {
		$value = $callback( $value );
	}
	return $value;
}

function rawurlencode_deep( $value ) {
	return rawurlencode( (string) $value );
}

function add_query_arg( $args, $url ) {
	$pairs = array();
	foreach ( $args as $key => $value ) {
		$pairs[] = rawurlencode( $key ) . '=' . rawurlencode( (string) $value );
	}
	$sep = str_contains( $url, '?' ) ? '&' : '?';
	return $url . $sep . implode( '&', $pairs );
}

function rest_url( $path = '' ) {
	return 'http://example.test/wp-json/' . ltrim( $path, '/' );
}

/** Minimal WP_Error stand-in exposing the accessors the plugin uses. */
class WP_Error {
	private $code;
	private $message;
	private $data;

	public function __construct( $code = '', $message = '', $data = array() ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}

	public function get_error_code() {
		return $this->code;
	}

	public function get_error_message() {
		return $this->message;
	}

	public function get_error_data() {
		return $this->data;
	}
}

/** Minimal WP_REST_Request stand-in: just parameter access. */
class WP_REST_Request {
	private $params;

	public function __construct( array $params = array() ) {
		$this->params = $params;
	}

	public function get_param( $key ) {
		return $this->params[ $key ] ?? null;
	}
}

// Only the invalid-signature path of get_feed() is exercised, and it returns
// before these are reached, but define them so the file is self-consistent.
function rest_ensure_response( $data ) {
	return $data;
}

// A minimal hook registry so fetch()'s add/remove of the redirect gate and the
// pin setter can be exercised. A test's fetch_feed stub pulls the registered
// callbacks back out to simulate a request/redirect chain.
$GLOBALS['newsflash_hooks'] = array();

function add_filter( $tag, $callback, $priority = 10, $args = 1 ) {
	$GLOBALS['newsflash_hooks'][ $tag ][] = $callback;
	return true;
}

function add_action( $tag, $callback, $priority = 10, $args = 1 ) {
	return add_filter( $tag, $callback, $priority, $args );
}

function remove_filter( $tag, $callback, $priority = 10 ) {
	foreach ( $GLOBALS['newsflash_hooks'][ $tag ] ?? array() as $i => $registered ) {
		if ( $registered === $callback ) {
			unset( $GLOBALS['newsflash_hooks'][ $tag ][ $i ] );
		}
	}
	return true;
}

function remove_action( $tag, $callback, $priority = 10 ) {
	return remove_filter( $tag, $callback, $priority );
}

// Delegates to a per-test closure so a test can drive the registered hooks.
function fetch_feed( $urls ) {
	if ( isset( $GLOBALS['newsflash_fetch_feed'] ) ) {
		return ( $GLOBALS['newsflash_fetch_feed'] )( $urls );
	}
	return null;
}

require_once __DIR__ . '/../newsflash-rss/includes/class-newsflash-feed.php';
require_once __DIR__ . '/../newsflash-rss/includes/class-newsflash-rest.php';
