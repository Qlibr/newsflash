<?php
/**
 * Integration test: a feed that redirects to an internal address is refused.
 *
 * The unit suite (../tests) proves the decision helpers and simulates the hook
 * chain, but it cannot prove that WordPress actually fires pre_http_request per
 * redirect hop — that is the one assumption the redirect gating rests on. This
 * test exercises the real WP_Http redirect machinery under a full WordPress,
 * so it needs the WordPress test framework (wp-env or a WP test-lib install).
 * See README.md in this directory. It is NOT part of `composer test`.
 *
 * @package Newsflash
 */

class RedirectSsrfTest extends WP_UnitTestCase {

	/**
	 * A public feed 302s to the cloud-metadata endpoint. WordPress follows the
	 * redirect in PHP, which re-enters pre_http_request — where the plugin's
	 * gate re-validates the new host and refuses it. Newsflash_Feed::get() must
	 * therefore return a WP_Error rather than the metadata body.
	 */
	public function test_redirect_to_link_local_metadata_is_refused() {
		// Stand in for the upstream server: answer the initial (public, real,
		// resolvable) host with a 302 to the metadata IP, and let every other
		// URL — i.e. the redirect hop — fall through to the plugin's own gate.
		$upstream = static function ( $pre, $args, $url ) {
			if ( false !== strpos( $url, 'example.com' ) ) {
				return array(
					'headers'  => array( 'location' => 'http://169.254.169.254/latest/meta-data/' ),
					'body'     => '',
					'response' => array( 'code' => 302, 'message' => 'Found' ),
					'cookies'  => array(),
					'filename' => null,
				);
			}
			return $pre;
		};
		add_filter( 'pre_http_request', $upstream, 1, 3 );

		$result = Newsflash_Feed::get( 'https://example.com/feed.xml' );

		remove_filter( 'pre_http_request', $upstream, 1 );

		$this->assertInstanceOf( WP_Error::class, $result );
	}

	/**
	 * The complementary happy path: a redirect to another *public* host is
	 * followed, not blocked — the gate only refuses private/reserved targets.
	 */
	public function test_redirect_to_a_public_host_is_followed() {
		$rss = '<?xml version="1.0"?><rss version="2.0"><channel><title>Ok</title>'
			. '<item><title>Hello</title><link>https://example.net/1</link></item>'
			. '</channel></rss>';

		$upstream = static function ( $pre, $args, $url ) use ( $rss ) {
			if ( false !== strpos( $url, 'example.com' ) ) {
				return array(
					'headers'  => array( 'location' => 'https://example.net/feed.xml' ),
					'body'     => '',
					'response' => array( 'code' => 302, 'message' => 'Found' ),
					'cookies'  => array(),
					'filename' => null,
				);
			}
			return array(
				'headers'  => array( 'content-type' => 'application/rss+xml' ),
				'body'     => $rss,
				'response' => array( 'code' => 200, 'message' => 'OK' ),
				'cookies'  => array(),
				'filename' => null,
			);
		};
		add_filter( 'pre_http_request', $upstream, 1, 3 );

		$result = Newsflash_Feed::get( 'https://example.com/feed.xml' );

		remove_filter( 'pre_http_request', $upstream, 1 );

		$this->assertIsArray( $result );
		$this->assertNotEmpty( $result['items'] );
		$this->assertSame( 'Hello', $result['items'][0]['title'] );
	}
}
