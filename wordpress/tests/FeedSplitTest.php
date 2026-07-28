<?php
/**
 * URL list parsing — Newsflash_Feed::split().
 *
 * The `feed` attribute accepts a comma-separated list; split() has to trim each
 * entry and drop empties so a stray comma never becomes an empty fetch.
 *
 * @package Newsflash
 */

use PHPUnit\Framework\TestCase;

final class FeedSplitTest extends TestCase {

	public function test_splits_and_trims_a_comma_separated_string(): void {
		$this->assertSame(
			array( 'https://a.example/feed', 'https://b.example/rss' ),
			Newsflash_Feed::split( 'https://a.example/feed , https://b.example/rss' )
		);
	}

	public function test_drops_empty_entries(): void {
		$this->assertSame(
			array( 'https://a.example/feed' ),
			Newsflash_Feed::split( 'https://a.example/feed,, ' )
		);
	}

	public function test_accepts_an_array_and_trims_it(): void {
		$this->assertSame(
			array( 'a', 'b' ),
			Newsflash_Feed::split( array( ' a ', '', 'b' ) )
		);
	}

	public function test_empty_input_yields_an_empty_list(): void {
		$this->assertSame( array(), Newsflash_Feed::split( '' ) );
		$this->assertSame( array(), Newsflash_Feed::split( '   ' ) );
	}
}
