# WordPress-integration tests

These tests run against a **real WordPress** so they can exercise the actual
`WP_Http` redirect machinery — the one thing the unit suite in [`../tests`](../tests)
can only simulate. They verify that a feed which `302`s to an internal address
(`169.254.169.254`) is refused, and that a redirect to a public host is still
followed.

They require Docker and are **not** part of `composer test` (which is unit-only
and needs no WordPress). CI does not run them.

> ⚠️ This suite is a scaffold: it was authored but not executed in the
> environment it was written in (no Docker there). Run it once locally to
> confirm before relying on it in CI.

## Run with `@wordpress/env` (recommended)

`.wp-env.json` already exists at the repo root. From `wordpress/`:

```sh
# Start WordPress + a MySQL container (first run downloads images)
npx wp-env start

# Install the PHPUnit deps inside the container's mapped plugin dir, then run
# the integration suite against the container's WordPress test library.
npx wp-env run tests-cli --env-cwd=wp-content/plugins/newsflash-rss \
  bash -c "cd \$(dirname \$(dirname \$PWD)) && \
           WP_TESTS_DIR=/wordpress-phpunit \
           php phpunit-integration.xml.dist"
```

The exact `WP_TESTS_DIR` path and CLI depend on your wp-env version; see
`npx wp-env run tests-cli env` to discover the test-library path it mounts.

## Run against a manual WP test-lib install

If you use the classic `bin/install-wp-tests.sh` setup instead of wp-env:

```sh
export WP_TESTS_DIR=/tmp/wordpress-tests-lib   # where install-wp-tests put it
cd wordpress
php vendor/phpunit/phpunit/phpunit -c phpunit-integration.xml.dist
```

## Notes

- The initial feed host is a real, resolvable public domain (`example.com`) so
  the plugin's up-front `validate()` passes; its HTTP response is mocked via
  `pre_http_request` to issue the redirect. No real request leaves the machine.
- SimplePie caches parsed feeds in a transient. If you iterate on these tests,
  clear transients (`wp transient delete --all`) or vary the feed URL.
