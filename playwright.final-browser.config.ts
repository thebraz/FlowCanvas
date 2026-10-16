import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'final-browser.spec.ts',
  outputDir: 'test-results/final-browser',
  reporter: [
    ['list'],
    ['json', { outputFile: 'docs/reports/evidence/stage3/final-browser/results.json' }],
  ],
  use: { ...base.use, trace: 'on' },
});
