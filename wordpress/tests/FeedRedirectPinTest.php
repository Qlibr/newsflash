<?php
/**
 * Per-hop redirect guard and DNS-rebinding pin — Newsflash_Feed::fetch().
 *
 * fetch() registers a pre_http_request gate and an http_api_curl pin around the
 * feed request. Because WordPress follows redirects in PHP (one request() per
 * hop), those hooks fire for every hop, so a public feed cannot 302 the server
 * into an internal address and a rebound host is pinned to the vetted address.
 *
 * WordPress is not loaded here; the bootstrap provides a tiny hook registry and
 * a fetch_feed() that defers to a per-test closure. That closure pulls the
 * registered gate and pin back out and drives them over a simulated hop chain,
 * which is exactly how WP_Http would invoke them.
 *
 * @package Newsflash
 */

use PHPUnit\Framework\TestCase;

final class FeedRedirectPinTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['newsflash_wp_validate_url'] = true;
		$GLOBALS['newsflash_hooks']           = array();
		unset( $GLOBALS['newsflash_fetch_feed'] );
	}

	/**
	 * Run fetch() with a fetch_feed that walks $chain through the gate/pin the
	 * way WP_Http would, and return one outcome per hop.
	 *
	 * @param string[] $chain URLs for the initial request then each redirect.
	 * @return string[] 'allowed' or 'blocked', in order.
	 */
	private function run_chain( array $chain ): array {
		$outcomes = array();

		$GLOBALS['newsflash_fetch_feed'] = static function () use ( $chain, &$outcomes ) {
			$gate   = end( $GLOBALS['newsflash_hooks']['pre_http_request'] );
			$pin    = end( $GLOBALS['newsflash_hooks']['http_api_curl'] );
			$handle = curl_init();

			foreach ( $chain as $url ) {
				$result = $gate( false, array(), $url );
				if ( $result instanceof WP_Error ) {
					$outcomes[] = 'blocked';
					break;
				}
				// Must not raise on a real handle; pins the vetted address.
				$pin( $handle, array(), $url );
				$outcomes[] = 'allowed';
			}

			return null;
		};

		$method = new ReflectionMethod( Newsflash_Feed::class, 'fetch' );
		$method->setAccessible( true );
		$method->invoke( null, $chain[0] );

		return $outcomes;
	}

	public function test_allows_and_pins_a_public_host(): void {
		$this->assertSame( array( 'allowed' ), $this->run_chain( array( 'https://8.8.8.8/feed.xml' ) ) );
	}

	/**
	 * The redirect the initial pin could not have covered: a public feed 302s
	 * to the cloud metadata endpoint. The gate must block that hop.
	 */
	public function test_blocks_a_redirect_to_a_metadata_endpoint(): void {
		$this->assertSame(
			array( 'allowed', 'blocked' ),
			$this->run_chain(
				array( 'https://8.8.8.8/feed.xml', 'http://169.254.169.254/latest/meta-data/' )
			)
		);
	}

	public function test_blocks_a_redirect_to_a_private_host(): void {
		$this->assertSame(
			array( 'allowed', 'blocked' ),
			$this->run_chain( array( 'https://8.8.8.8/feed.xml', 'http://10.0.0.1/internal' ) )
		);
	}

	public function test_removes_its_hooks_after_fetching(): void {
		$this->run_chain( array( 'https://8.8.8.8/feed.xml' ) );

		$this->assertEmpty( array_filter( $GLOBALS['newsflash_hooks']['pre_http_request'] ?? array() ) );
		$this->assertEmpty( array_filter( $GLOBALS['newsflash_hooks']['http_api_curl'] ?? array() ) );
	}
}
