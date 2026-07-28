<?php
/**
 * HMAC signature guard — Newsflash_REST.
 *
 * The public REST route is gated entirely by an HMAC over the feed URL, so a
 * visitor can only request feeds an editor signed into a page. These tests pin
 * that the signature is stable, URL-specific, and that get_feed() refuses a
 * mismatch with a 403.
 *
 * @package Newsflash
 */

use PHPUnit\Framework\TestCase;

final class RestSignatureTest extends TestCase {

	public function test_sign_is_deterministic_and_url_specific(): void {
		$a = Newsflash_REST::sign( 'https://example.com/feed.xml' );
		$b = Newsflash_REST::sign( 'https://example.com/feed.xml' );
		$c = Newsflash_REST::sign( 'https://example.com/other.xml' );

		$this->assertSame( $a, $b, 'Same URL must sign identically.' );
		$this->assertNotSame( $a, $c, 'A different URL must sign differently.' );
		$this->assertMatchesRegularExpression( '/^[0-9a-f]{64}$/', $a, 'Expected a SHA-256 hex digest.' );
	}

	public function test_a_tampered_url_fails_verification(): void {
		$signed  = 'https://example.com/feed.xml';
		$key     = Newsflash_REST::sign( $signed );
		$tampered = 'https://example.com/feed.xml?next=http://169.254.169.254/';

		// This is exactly the comparison get_feed() performs.
		$this->assertFalse( hash_equals( Newsflash_REST::sign( $tampered ), $key ) );
	}

	public function test_endpoint_for_carries_url_limit_and_key(): void {
		$feed = 'https://example.com/feed.xml';
		$url  = Newsflash_REST::endpoint_for( $feed, 7 );

		parse_str( (string) parse_url( $url, PHP_URL_QUERY ), $params );

		$this->assertSame( '7', $params['limit'] );
		$this->assertSame( Newsflash_REST::sign( $feed ), $params['key'] );
		// The param round-trips back to the original feed URL once decoded.
		$this->assertSame( $feed, rawurldecode( $params['url'] ) );
	}

	public function test_get_feed_rejects_a_bad_signature_with_403(): void {
		$request = new WP_REST_Request(
			array(
				'url'   => 'https://example.com/feed.xml',
				'key'   => 'not-the-real-signature',
				'limit' => 5,
			)
		);

		$result = Newsflash_REST::get_feed( $request );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'newsflash_invalid_signature', $result->get_error_code() );
		$this->assertSame( array( 'status' => 403 ), $result->get_error_data() );
	}
}
