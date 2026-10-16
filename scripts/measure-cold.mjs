import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const destination = 'docs/reports/evidence/stage4/cold';
await mkdir(destination, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, FLOWCANVAS_PORT: '4175', FLOWCANVAS_STATIC_DIR: 'dist' },
  stdio: 'pipe',
  windowsHide: true,
});
const instances = new Set();
let failed = false;
server.on('error', () => {
  failed = true;
});
const samples = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (failed) throw new Error('Cold server failed');
    try {
      if ((await fetch('http://127.0.0.1:4175/')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Bounded loopback readiness wait. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Cold server deadline');
  let version;
  for (let index = 0; index < 10; index++) {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    instances.add(browser);
    version = browser.version();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.name));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 100,
      downloadThroughput: 10_000_000 / 8,
      uploadThroughput: 1_000_000 / 8,
    });
    await page.addInitScript(() => {
      window.coldAudit = { lcp: 0, ready: 0, longTasks: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.coldAudit.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.coldAudit.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
      const observer = new MutationObserver(() => {
        if (document.querySelector('.app-shell[data-storage-ready="true"]')) {
          observer.disconnect();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              window.coldAudit.ready = performance.now();
            }),
          );
        }
      });
      observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-storage-ready'],
      });
    });
    await page.goto('http://127.0.0.1:4175/');
    await page.waitForFunction(() => window.coldAudit.ready > 0 && window.coldAudit.lcp > 0);
    const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
    if (
      !(await manager.isVisible()) ||
      !(await manager.getByRole('button', { name: 'Cancel', exact: true }).isEnabled())
    )
      throw new Error('First-run manager unavailable');
    const sample = await page.evaluate(() => ({
      ...window.coldAudit,
      resources: performance
        .getEntriesByType('resource')
        .map((entry) => ({ path: new URL(entry.name).pathname, transferSize: entry.transferSize })),
    }));
    if (errors.length) throw new Error('Production cold-load console error');
    samples.push({ ...sample, errors });
    await browser.close();
    instances.delete(browser);
  }
  const stats = (key) => {
    const values = samples.map((sample) => sample[key]).sort((a, b) => a - b);
    if (values.length !== 10 || values.some((value) => value <= 0))
      throw new Error('Incomplete cold sample');
    return { median: (values[4] + values[5]) / 2, p95: values[9], max: values[9] };
  };
  const assets = [];
  for (const name of await readdir('dist/assets')) {
    const bytes = await readFile(`dist/assets/${name}`);
    assets.push({
      name,
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  const report = {
    measuredAt: new Date().toISOString(),
    browser: version,
    method:
      'Actual production dist/main application, 10 fresh Chrome profiles, disabled cache, 10 Mbps down/1 Mbps up/100ms latency, no CPU throttle, 1440x900 scale 1. Ready is two frames after storage-ready and verified enabled first-run manager. No outlier removal.',
    limitations:
      'Headless; power/background load not certified; local server sends uncompressed responses. No Firefox/Safari timing.',
    samples,
    ready: stats('ready'),
    lcp: stats('lcp'),
    assets,
  };
  report.status = report.ready.p95 <= 3000 && report.lcp.p95 <= 2500 ? 'PASS' : 'FAIL';
  await writeFile(`${destination}/cold-performance.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, ready: report.ready, lcp: report.lcp }));
  if (report.status !== 'PASS') process.exitCode = 1;
} finally {
  await Promise.all([...instances].map((browser) => browser.close()));
  server.kill();
}
