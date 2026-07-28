import { playwrightLauncher } from '@web/test-runner-playwright';

// The runner drives a real browser, not jsdom: the component relies on
// DOMParser (including `application/xml` and `parsererror` detection), custom
// elements, shadow DOM and IntersectionObserver, all of which jsdom either
// lacks or parses differently from a browser.
//
// CI installs Playwright's own Chromium. In the sandboxed dev container the
// Playwright npm version and the pre-installed browser revision differ, so we
// point at the pre-installed binary when it exists instead of downloading a
// matching one. `--no-sandbox` is required to launch Chromium as root there.
import { existsSync } from 'node:fs';

const preinstalledChromium = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(preinstalledChromium)
  ? { executablePath: preinstalledChromium, args: ['--no-sandbox'] }
  : {};

export default {
  files: ['test/**/*.test.js'],
  nodeResolve: true,
  coverage: true,
  coverageConfig: {
    include: ['src/**/*.js'],
    report: true,
    reportDir: 'coverage',
  },
  browsers: [playwrightLauncher({ product: 'chromium', launchOptions })],
};
