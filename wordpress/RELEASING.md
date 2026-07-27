# Releasing to the WordPress plugin directory

This directory holds two separate things:

| Path | Goes where |
|---|---|
| `newsflash-rss/` | SVN `trunk/`, and a copy under `tags/<version>/` |
| `assets/` | SVN `assets/` — **not** part of the plugin zip |

`assets/src/*.svg` are the sources for the icon and banner; the PNGs beside
them are generated with `rsvg-convert` and are what WordPress.org serves.

## First submission

1. Build and package:

   ```sh
   npm run build        # writes assets/newsflash-feed.standalone.js
   npm run build:wp-zip # writes dist-wp/newsflash-rss-<version>.zip
   ```

   `build:wp-zip` refuses to package if the readme's `Stable tag`, the plugin
   header `Version`, `NEWSFLASH_VERSION` and `package.json` disagree, or if the
   bundle is older than `dist/`.

2. Submit the zip at <https://wordpress.org/plugins/developers/add/>. Review is
   done by a human and takes weeks; expect at least one round of questions.
   The slug is taken from the plugin's `Plugin Name`, not from this directory.

3. On approval you get an SVN repository. Populate it once:

   ```sh
   svn co https://plugins.svn.wordpress.org/newsflash-rss svn-newsflash
   cp -r wordpress/newsflash-rss/* svn-newsflash/trunk/
   cp    wordpress/assets/*.png    svn-newsflash/assets/
   cd svn-newsflash
   svn add --force trunk assets
   svn ci -m "Initial release 0.1.3"
   svn cp trunk tags/0.1.3
   svn ci -m "Tag 0.1.3"
   ```

## Subsequent releases

Bump the version in **four** places — `package.json`, the `Version:` header,
`NEWSFLASH_VERSION`, and the readme's `Stable tag` — add a `== Changelog ==`
entry, then copy `trunk/` to a new tag and commit. The directory serves
whatever `Stable tag` points at, so the tag must exist before the readme
claims it.

## Before every submission

Run the official checker against a live WordPress rather than trusting a diff:

```sh
npx wp-env start
docker exec -u 0 $(docker ps --filter name=cli-1 --format '{{.Names}}' | head -1) \
  wp plugin check newsflash-rss --allow-root --severity=1
```

`.wp-env.json` already installs the `plugin-check` plugin alongside this one.
