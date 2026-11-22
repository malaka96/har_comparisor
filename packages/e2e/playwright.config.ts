import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['E2E_PORT'] ?? 9197);
const serverEntry = fileURLToPath(new URL('../server/dist/index.js', import.meta.url));
/** Set to test an already running app, for example the Docker container. */
const externalUrl = process.env['E2E_BASE_URL'];

/**
 * End-to-end tests run against the built app (`npm run build` first; `npm run test:e2e` does both),
 * or against `E2E_BASE_URL` when it is set.
 * By default they use the installed Google Chrome. Set PW_CHANNEL=chromium to use Playwright's
 * own Chromium instead (install it once with `npx playwright install chromium`).
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: externalUrl ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 1000 },
        channel: process.env['PW_CHANNEL'] ?? 'chrome',
      },
    },
  ],
  ...(externalUrl
    ? {}
    : {
        webServer: {
          command: `node "${serverEntry}"`,
          url: `http://127.0.0.1:${PORT}/api/health`,
          env: { PORT: String(PORT), HOST: '127.0.0.1' },
          reuseExistingServer: false,
          timeout: 30_000,
        },
      }),
});
