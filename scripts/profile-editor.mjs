import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, FLOWCANVAS_STATIC_DIR: 'dist-benchmark', FLOWCANVAS_PORT: '4175' },
  stdio: 'pipe',
  windowsHide: true,
});
let browser;
const full = process.argv.includes('--all');
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4175/tests/performance/stage2.html')).ok) break;
    } catch {
      /* Bounded server startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4175/tests/performance/stage2.html');
  await page.waitForFunction(() => !!window.stage2Profile);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const frames = full
    ? await page.evaluate(() => window.stage2Benchmark())
    : await page.evaluate(() => window.stage2Profile());
  const { profile } = await cdp.send('Profiler.stop');
  await writeFile(
    `docs/reports/evidence/stage2/${full ? 'cpu-full-profile' : 'cpu-profile'}.json`,
    JSON.stringify(profile),
  );
  const statistics = Object.fromEntries(
    Object.entries(full ? {} : frames).map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [name, { p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1) }];
    }),
  );
  console.log(
    JSON.stringify({
      statistics,
      hotspots: [...profile.nodes]
        .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
        .slice(0, 14)
        .map((n) => ({
          name: n.callFrame.functionName,
          line: n.callFrame.lineNumber,
          column: n.callFrame.columnNumber,
          url: n.callFrame.url,
          hits: n.hitCount,
        })),
    }),
  );
} finally {
  await browser?.close();
  server.kill();
}
