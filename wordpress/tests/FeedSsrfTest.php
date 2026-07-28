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

	private function is_fetchable( string $url ): bool {
		$method = new ReflectionMethod( Newsflash_Feed::class, 'is_fetchable' );
		$method->setAccessible( true );
		return (bool) $method->invoke( null, $url );
	}

	public function test_allows_a_public_address(): void {
		$this->assertTrue( $this->is_fetchable( 'http://8.8.8.8/feed.xml' ) );
		$this->assertTrue( $this->is_fetchable( 'https://93.184.216.34/rss' ) );
	}

	/**
	 * The headline case: the cloud metadata endpoint and ECS credential
	 * endpoint that wp_http_validate_url() alone would let through.
	 */
	public function test_rejects_link_local_metadata_endpoints(): void {
		$this->assertFalse( $this->is_fetchable( 'http://169.254.169.254/latest/meta-data/' ) );
		$this->assertFalse( $this->is_fetchable( 'http://169.254.170.2/v2/credentials' ) );
	}

	public function test_rejects_loopback(): void {
		$this->assertFalse( $this->is_fetchable( 'http://127.0.0.1/feed' ) );
		$this->assertFalse( $this->is_fetchable( 'http://[::1]/feed' ) );
	}

	public function test_rejects_rfc1918_private_ranges(): void {
		$this->assertFalse( $this->is_fetchable( 'http://10.0.0.1/feed' ) );
		$this->assertFalse( $this->is_fetchable( 'http://172.16.0.1/feed' ) );
		$this->assertFalse( $this->is_fetchable( 'http://192.168.1.1/feed' ) );
	}

	public function test_rejects_when_wp_validator_refuses(): void {
		// Even a public address is refused if wp_http_validate_url() said no
		// (non-http scheme, etc.).
		$GLOBALS['newsflash_wp_validate_url'] = false;
		$this->assertFalse( $this->is_fetchable( 'http://8.8.8.8/feed.xml' ) );
	}

	public function test_resolve_returns_ip_literals_unchanged(): void {
		$method = new ReflectionMethod( Newsflash_Feed::class, 'resolve' );
		$method->setAccessible( true );
		$this->assertSame( array( '93.184.216.34' ), $method->invoke( null, '93.184.216.34' ) );
	}
}
