<?php
/**
 * [newsflash] shortcode.
 *
 * Two modes:
 *
 *   inline (default) — PHP fetches the feed while rendering the page and
 *                      embeds the items as JSON. One round-trip, no public
 *                      endpoint, content present in the HTML.
 *   ajax             — emits a signed REST URL and lets the browser fetch.
 *                      Needed only for `refresh` or `lazy`.
 *
 * @package Newsflash
 */

defined( 'ABSPATH' ) || exit;

class Newsflash_Shortcode {

	const TAG = 'newsflash';

	/** Layouts the component knows how to render. */
	const LAYOUTS = array( 'list', 'grid', 'cards', 'magazine', 'ticker' );

	public static function init() {
		add_shortcode( self::TAG, array( __CLASS__, 'render' ) );
	}

	/**
	 * @param array  $atts    Shortcode attributes.
	 * @param string $content Ignored.
	 * @return string
	 */
	public static function render( $atts, $content = '' ) {
		$defaults = apply_filters(
			'newsflash_shortcode_defaults',
			array(
				'feed'       => '',
				'mode'       => 'inline',
				'layout'     => 'grid',
				'theme'      => 'auto',
				'limit'      => 9,
				'columns'    => 3,
				'heading'    => '',
				'images'     => 'true',
				'excerpt'    => 'true',
				'dates'      => 'true',
				'sources'    => 'false',
				'date-style' => 'relative',
				'target'     => '_blank',
				'refresh'    => 0,
				'lazy'       => 'false',
				'class'      => '',
			)
		);

		$atts = shortcode_atts( $defaults, $atts, self::TAG );

		$feed = trim( (string) $atts['feed'] );
		if ( '' === $feed ) {
			return self::notice( __( 'The [newsflash] shortcode needs a feed="…" attribute.', 'newsflash-rss' ) );
		}

		$limit   = max( 1, min( 50, (int) $atts['limit'] ) );
		$refresh = max( 0, (int) $atts['refresh'] );
		$lazy    = self::is_true( $atts['lazy'] );

		// Browser-side fetching needs the REST route; without it, `ajax` mode
		// has nowhere to point, so fall back to rendering server-side.
		$can_ajax = Newsflash_REST::is_enabled();
		$inline   = ! ( 'ajax' === $atts['mode'] && $can_ajax );

		// Inline data is present at first paint, so there is nothing to defer.
		if ( $inline ) {
			$lazy = false;
		}

		$attributes = array(
			'layout'     => in_array( $atts['layout'], self::LAYOUTS, true ) ? $atts['layout'] : 'grid',
			'theme'      => in_array( $atts['theme'], array( 'auto', 'light', 'dark' ), true ) ? $atts['theme'] : 'auto',
			'limit'      => (string) $limit,
			'columns'    => (string) max( 1, min( 6, (int) $atts['columns'] ) ),
			'heading'    => (string) $atts['heading'],
			'images'     => self::bool( $atts['images'] ),
			'excerpt'    => self::bool( $atts['excerpt'] ),
			'dates'      => self::bool( $atts['dates'] ),
			'sources'    => self::bool( $atts['sources'] ),
			'date-style' => 'absolute' === $atts['date-style'] ? 'absolute' : 'relative',
			'target'     => '_self' === $atts['target'] ? '_self' : '_blank',
			'refresh'    => (string) $refresh,
			'lazy'       => $lazy ? 'true' : 'false',
			'class'      => (string) $atts['class'],
		);

		$payload   = '';
		$needs_src = ! $inline;

		if ( $inline ) {
			$data = Newsflash_Feed::get( $feed, $limit );

			if ( is_wp_error( $data ) ) {
				// Let the browser try instead, if it can; otherwise there is
				// nothing to show and only an editor needs to know why.
				if ( ! $can_ajax ) {
					return self::notice( $data->get_error_message() );
				}
				$needs_src = true;
			} else {
				$payload = self::inline_payload( $data );
				// Polling still needs somewhere to poll.
				$needs_src = $refresh > 0 && $can_ajax;
			}
		}

		if ( $needs_src ) {
			$attributes['src'] = Newsflash_REST::endpoint_for( $feed, $limit );
		} elseif ( $refresh > 0 ) {
			// No endpoint to refresh from — don't claim otherwise.
			$attributes['refresh'] = '0';
		}

		$rendered = '';
		foreach ( $attributes as $name => $value ) {
			// Skip empties and the two attributes whose default is "off", so
			// the emitted tag stays readable in page source.
			if ( '' === $value || ( 'lazy' === $name && 'false' === $value ) || ( 'refresh' === $name && '0' === $value ) ) {
				continue;
			}
			$rendered .= sprintf( ' %s="%s"', esc_attr( $name ), esc_attr( $value ) );
		}

		wp_enqueue_script( NEWSFLASH_HANDLE );

		return sprintf( '<newsflash-feed%s>%s</newsflash-feed>', $rendered, $payload );
	}

	/**
	 * Embed the feed as a JSON island the component reads instead of
	 * fetching.
	 *
	 * JSON_HEX_TAG is what keeps a feed containing `</script>` from breaking
	 * out of the block; JSON.parse decodes the escapes transparently.
	 *
	 * @param array $data
	 * @return string
	 */
	private static function inline_payload( array $data ) {
		$json = wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );

		if ( false === $json ) {
			return '';
		}

		return sprintf( '<script type="application/json" slot="data">%s</script>', $json );
	}

	/**
	 * Normalize a shortcode truthy value to the 'true'/'false' strings the
	 * component's attribute converter understands.
	 *
	 * @param mixed $value
	 * @return string
	 */
	private static function bool( $value ) {
		return self::is_true( $value ) ? 'true' : 'false';
	}

	/**
	 * @param mixed $value
	 * @return bool
	 */
	private static function is_true( $value ) {
		$falsey = array( 'false', '0', 'no', 'off', '' );
		return ! in_array( strtolower( trim( (string) $value ) ), $falsey, true );
	}

	/**
	 * Misconfiguration message — only shown to users who can fix it.
	 *
	 * @param string $message
	 * @return string
	 */
	private static function notice( $message ) {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return '';
		}
		return sprintf(
			'<p class="newsflash-notice"><strong>%s</strong> %s</p>',
			esc_html__( 'Newsflash:', 'newsflash-rss' ),
			esc_html( $message )
		);
	}
}
