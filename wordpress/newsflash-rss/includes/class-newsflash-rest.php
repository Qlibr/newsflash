<?php
/**
 * Optional signed feed proxy.
 *
 * Only needed when the feed has to refresh in the browser (`refresh="…"`) or
 * load on scroll (`lazy`). The default shortcode mode renders items into the
 * page server-side and never touches this route.
 *
 * The route is public — feeds render for logged-out visitors — so it must not
 * become an open proxy. Every URL it accepts is signed by the shortcode with
 * a site-secret HMAC, so visitors can only request feeds an editor put on a
 * page.
 *
 * @package Newsflash
 */

defined( 'ABSPATH' ) || exit;

class Newsflash_REST {

	const NAMESPACE = 'newsflash/v1';
	const ROUTE     = '/feed';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * A site that only ever renders feeds server-side can drop the endpoint
	 * altogether:
	 *
	 *     add_filter( 'newsflash_enable_rest', '__return_false' );
	 *
	 * The filter is applied lazily, not at plugin load, so an ordinary theme
	 * or plugin can still reach it.
	 *
	 * @return bool
	 */
	public static function is_enabled() {
		return (bool) apply_filters( 'newsflash_enable_rest', true );
	}

	public static function register_routes() {
		if ( ! self::is_enabled() ) {
			return;
		}

		register_rest_route(
			self::NAMESPACE,
			self::ROUTE,
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_feed' ),
				// Public on purpose. The signature below is what restricts
				// access, not authentication.
				'permission_callback' => '__return_true',
				'args'                => array(
					'url'   => array(
						'required'    => true,
						'type'        => 'string',
						'description' => __( 'One or more feed URLs, comma separated.', 'newsflash-rss' ),
					),
					'key'   => array(
						'required'    => true,
						'type'        => 'string',
						'description' => __( 'HMAC signature produced by the shortcode.', 'newsflash-rss' ),
					),
					'limit' => array(
						'type'              => 'integer',
						'default'           => 10,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * Sign a feed URL string. Shared by the shortcode (to sign) and this
	 * handler (to verify).
	 *
	 * @param string $url Raw feed URL string, exactly as it will be sent.
	 * @return string Hex HMAC.
	 */
	public static function sign( $url ) {
		return hash_hmac( 'sha256', $url, wp_salt( 'nonce' ) . '|newsflash-feed' );
	}

	/**
	 * Build the signed endpoint URL for a feed.
	 *
	 * @param string $feed
	 * @param int    $limit
	 * @return string
	 */
	public static function endpoint_for( $feed, $limit ) {
		return add_query_arg(
			array(
				'url'   => rawurlencode( $feed ),
				'limit' => (int) $limit,
				'key'   => self::sign( $feed ),
			),
			rest_url( self::NAMESPACE . self::ROUTE )
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_feed( WP_REST_Request $request ) {
		$url   = (string) $request->get_param( 'url' );
		$key   = (string) $request->get_param( 'key' );
		$limit = (int) $request->get_param( 'limit' );

		if ( ! hash_equals( self::sign( $url ), $key ) ) {
			return new WP_Error(
				'newsflash_invalid_signature',
				__( 'This feed URL is not signed by this site.', 'newsflash-rss' ),
				array( 'status' => 403 )
			);
		}

		$data = Newsflash_Feed::get( $url, $limit );

		if ( is_wp_error( $data ) ) {
			$status = 'newsflash_invalid_url' === $data->get_error_code() ? 400 : 502;
			return new WP_Error( $data->get_error_code(), $data->get_error_message(), array( 'status' => $status ) );
		}

		$response = rest_ensure_response( $data );
		$max_age  = (int) apply_filters( 'newsflash_cache_lifetime', Newsflash_Feed::CACHE_LIFETIME );
		$response->header( 'Cache-Control', 'public, max-age=' . $max_age );

		return $response;
	}
}
