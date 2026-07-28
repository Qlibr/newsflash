<?php
/**
 * Bootstrap for the WordPress-integration suite.
 *
 * Loads the WordPress test framework and the plugin. Requires a WP test-lib
 * install; WP_TESTS_DIR points at it (wp-env sets this up for you). See
 * README.md — this suite is not run by the default `composer test`.
 *
 * @package Newsflash
 */

$_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( ! $_tests_dir ) {
	$_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

$_functions = $_tests_dir . '/includes/functions.php';
if ( ! file_exists( $_functions ) ) {
	fwrite(
		STDERR,
		"WordPress test framework not found at {$_tests_dir}.\n" .
		"Set WP_TESTS_DIR or run through wp-env — see tests-integration/README.md.\n"
	);
	exit( 1 );
}

require_once $_functions;

/** Load the plugin into the test WordPress before it boots. */
function newsflash_load_plugin() {
	require dirname( __DIR__ ) . '/newsflash-rss/newsflash-rss.php';
}
tests_add_filter( 'muplugins_loaded', 'newsflash_load_plugin' );

require $_tests_dir . '/includes/bootstrap.php';
