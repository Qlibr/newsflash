import { defineConfig } from 'vite';

/**
 * Two builds from one entry:
 *
 *   default      — ESM with `lit` left external. What npm consumers get, so
 *                  their bundler dedupes Lit instead of loading a second copy
 *                  alongside their own.
 *   standalone   — UMD with Lit bundled in. What a <script> tag and the
 *                  WordPress plugin load, where there is no bundler to help.
 *
 * `npm run build` runs both; the second pass must not wipe the first.
 */
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  // Replit sets REPL_ID; its preview is proxied over HTTPS on 443, so the HMR
  // client has to be told that rather than inferring the dev server's port.
  const onReplit = Boolean(process.env.REPL_ID);

  return {
    server: {
      host: true,
      // Vite blocks unknown Host headers by default. Replit serves the
      // preview from a generated subdomain, so allow its two domains.
      allowedHosts: ['.replit.dev', '.repl.co'],
      ...(onReplit ? { hmr: { protocol: 'wss', clientPort: 443 } } : {}),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: !standalone,
      // public/ holds demo fixtures for `npm run dev`; they must not end up
      // in dist/ and from there into the published tarball.
      copyPublicDir: false,
      sourcemap: true,
      target: 'es2020',
      lib: {
        entry: 'src/newsflash-feed.js',
        formats: [standalone ? 'umd' : 'es'],
        name: 'NewsflashFeed',
        fileName: () =>
          standalone ? 'newsflash-feed.standalone.js' : 'newsflash-feed.js',
      },
      rollupOptions: {
        external: standalone ? [] : ['lit', /^lit\/.*/],
        output: { exports: 'named' },
      },
    },
  };
});
