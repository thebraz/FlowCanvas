import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';
import { mkdirSync } from 'node:fs';

const browser = process.env.FLOWCANVAS_BROWSER ?? 'chromium';
if (!['chromium', 'firefox', 'webkit', 'chrome', 'msedge'].includes(browser))
  throw new Error('Unsupported audit browser');
process.env.FLOWCANVAS_EVIDENCE_DIR ??= `docs/reports/evidence/stage4/${browser}`;
mkdirSync(process.env.FLOWCANVAS_EVIDENCE_DIR, { recursive: true });

export default defineConfig({
  ...base,
  timeout: 60_000,
  workers: 1,
  outputDir: `${process.env.FLOWCANVAS_AUDIT_OUTPUT_DIR ?? 'test-results/stage4'}/${browser}`,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: `${process.env.FLOWCANVAS_AUDIT_REPORT_DIR ?? 'docs/reports/evidence/stage4'}/e2e-${browser}.json`,
      },
    ],
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 1440, height: 900 },
      },
    },
  ].filter((project) => project.name === browser),
});
