<?php
/**
 * Plugin Name:       Newsflash RSS
 * Plugin URI:        https://github.com/Qlibr/newsflash
 * Description:       Renders RSS/Atom feeds in several themable layouts using the &lt;newsflash-feed&gt; web component. Adds the [newsflash] shortcode and a signed, caching REST proxy.
 * Version:           0.1.3
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Qlibr BV
 * Author URI:        https://github.com/Qlibr
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       newsflash-rss
 *
 * @package Newsflash
 */

defined( 'ABSPATH' ) || exit;

define( 'NEWSFLASH_VERSION', '0.1.3' );
define( 'NEWSFLASH_FILE', __FILE__ );
define( 'NEWSFLASH_PATH', plugin_dir_path( __FILE__ ) );
define( 'NEWSFLASH_URL', plugin_dir_url( __FILE__ ) );

/** Script handle for the compiled web component bundle. */
define( 'NEWSFLASH_HANDLE', 'newsflash-feed' );

require_once NEWSFLASH_PATH . 'includes/class-newsflash-feed.php';
require_once NEWSFLASH_PATH . 'includes/class-newsflash-rest.php';
require_once NEWSFLASH_PATH . 'includes/class-newsflash-shortcode.php';

Newsflash_REST::init();
Newsflash_Shortcode::init();

/**
 * Register the component bundle. It is only *enqueued* when a shortcode on the
 * page actually needs it, so feed-less pages ship no extra JavaScript.
 */
function newsflash_register_assets() {
	$relative = 'assets/newsflash-feed.standalone.js';
	$path     = NEWSFLASH_PATH . $relative;

	wp_register_script(
		NEWSFLASH_HANDLE,
		NEWSFLASH_URL . $relative,
		array(),
		file_exists( $path ) ? (string) filemtime( $path ) : NEWSFLASH_VERSION,
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);
}
add_action( 'wp_enqueue_scripts', 'newsflash_register_assets' );
add_action( 'admin_enqueue_scripts', 'newsflash_register_assets' );

/**
 * The bundle is built from the Node project (`npm run build`), so a fresh
 * checkout can be missing it. Say so instead of failing silently.
 */
function newsflash_missing_build_notice() {
	if ( file_exists( NEWSFLASH_PATH . 'assets/newsflash-feed.standalone.js' ) ) {
		return;
	}
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}
	printf(
		'<div class="notice notice-error"><p><strong>%s</strong> %s <code>npm run build</code></p></div>',
		esc_html__( 'Newsflash RSS:', 'newsflash-rss' ),
		esc_html__( 'the component bundle is missing. Build it from the project root with', 'newsflash-rss' )
	);
}
add_action( 'admin_notices', 'newsflash_missing_build_notice' );
