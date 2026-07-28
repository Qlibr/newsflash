<?php
/**
 * SSRF guard — Newsflash_Feed::is_fetchable().
 *
 * The plugin's own comments flag that wp_http_validate_url() permits
 * 169.254.0.0/16, where cloud instance metadata (169.254.169.254) and ECS task
 * credentials (169.254.170.2) live. is_fetchable() closes that with an
 * FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE check on every resolved
 * address. These tests pin that boundary.
 *
 * IP-literal hosts are used throughout so resolve() short-circuits and no live
 * DNS lookup happens.
 *
 * @package Newsflash
 */

use PHPUnit\Framework\TestCase;

final class FeedSsrfTest extends TestCase {

	protected function setUp(): void {
		// Assume WordPress's own validator allowed the URL, so these tests
		// exercise the plugin's added address check rather than WP's.
		$GLOBALS['newsflash_wp_validate_url'] = true;
	}

	/** @return string[]|false */
	private function validate( string $url ) {
		$method = new ReflectionMethod( Newsflash_Feed::class, 'validate' );
		$method->setAccessible( true );
		return $method->invoke( null, $url );
	}

	private function pins_for( string $url, array $addresses ): array {
		$method = new ReflectionMethod( Newsflash_Feed::class, 'pins_for' );
		$method->setAccessible( true );
		return $method->invoke( null, $url, $addresses );
	}

	public function test_allows_a_public_address_and_returns_it(): void {
		// A public IP-literal host resolves to itself and is approved, so the
		// address is available to pin the fetch to.
		$this->assertSame( array( '8.8.8.8' ), $this->validate( 'http://8.8.8.8/feed.xml' ) );
		$this->assertSame( array( '93.184.216.34' ), $this->validate( 'https://93.184.216.34/rss' ) );
	}

	/**
	 * The headline case: the cloud metadata endpoint and ECS credential
	 * endpoint that wp_http_validate_url() alone would let through.
	 */
	public function test_rejects_link_local_metadata_endpoints(): void {
		$this->assertFalse( $this->validate( 'http://169.254.169.254/latest/meta-data/' ) );
		$this->assertFalse( $this->validate( 'http://169.254.170.2/v2/credentials' ) );
	}

	public function test_rejects_loopback(): void {
		$this->assertFalse( $this->validate( 'http://127.0.0.1/feed' ) );
		$this->assertFalse( $this->validate( 'http://[::1]/feed' ) );
	}

	public function test_rejects_rfc1918_private_ranges(): void {
		$this->assertFalse( $this->validate( 'http://10.0.0.1/feed' ) );
		$this->assertFalse( $this->validate( 'http://172.16.0.1/feed' ) );
		$this->assertFalse( $this->validate( 'http://192.168.1.1/feed' ) );
	}

	public function test_rejects_when_wp_validator_refuses(): void {
		// Even a public address is refused if wp_http_validate_url() said no
		// (non-http scheme, etc.).
		$GLOBALS['newsflash_wp_validate_url'] = false;
		$this->assertFalse( $this->validate( 'http://8.8.8.8/feed.xml' ) );
	}

	public function test_resolve_returns_ip_literals_unchanged(): void {
		$method = new ReflectionMethod( Newsflash_Feed::class, 'resolve' );
		$method->setAccessible( true );
		$this->assertSame( array( '93.184.216.34' ), $method->invoke( null, '93.184.216.34' ) );
	}

	/**
	 * The pin passed to CURLOPT_RESOLVE must key on host:port and point at the
	 * vetted address, so cURL connects there rather than re-resolving the name.
	 */
	public function test_pins_host_and_port_to_the_vetted_address(): void {
		$this->assertSame(
			array( 'example.com:443' => '203.0.113.7' ),
			$this->pins_for( 'https://example.com/feed.xml', array( '203.0.113.7' ) )
		);
		$this->assertSame(
			array( 'example.com:80' => '203.0.113.7,203.0.113.8' ),
			$this->pins_for( 'http://example.com/feed.xml', array( '203.0.113.7', '203.0.113.8' ) )
		);
		// An explicit port is preserved.
		$this->assertSame(
			array( 'example.com:8443' => '203.0.113.7' ),
			$this->pins_for( 'https://example.com:8443/feed.xml', array( '203.0.113.7' ) )
		);
	}

	/**
	 * An IP-literal host has no name to rebind, so it produces no pin (which
	 * also avoids a malformed CURLOPT_RESOLVE key for IPv6 literals).
	 */
	public function test_ip_literal_hosts_are_not_pinned(): void {
		$this->assertSame( array(), $this->pins_for( 'https://8.8.8.8/feed.xml', array( '8.8.8.8' ) ) );
		$this->assertSame(
			array(),
			$this->pins_for( 'http://[2001:db8::1]/feed.xml', array( '2001:db8::1' ) )
		);
	}
}
