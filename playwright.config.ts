import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'docs/reports/evidence/stage3/e2e-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'node scripts/serve.mjs',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node scripts/serve.mjs',
      url: 'http://127.0.0.1:4176/tests/performance/stage3.html',
      env: { FLOWCANVAS_STATIC_DIR: 'dist-benchmark', FLOWCANVAS_PORT: '4176' },
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
