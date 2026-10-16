import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import os from 'node:os';

const evidence = resolve(
  process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage2/foundation',
);
await mkdir(evidence, { recursive: true });
const url = 'http://127.0.0.1:4175/tests/performance/index.html';
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, FLOWCANVAS_STATIC_DIR: 'dist-benchmark', FLOWCANVAS_PORT: '4175' },
  stdio: 'pipe',
  windowsHide: true,
});
let serverError = '';
server.stderr.on('data', (chunk) => {
  serverError += String(chunk);
});
server.on('error', (error) => {
  serverError = error.name;
});
const digest = (value) => createHash('sha256').update(value).digest('hex');
const stats = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    median: (sorted[14] + sorted[15]) / 2,
    p95: sorted[Math.ceil(0.95 * sorted.length) - 1],
    max: sorted.at(-1),
  };
};
const coldStats = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: (sorted[4] + sorted[5]) / 2, p95: sorted[9], max: sorted[9] };
};
const launched = new Set();
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (serverError) throw new Error('Benchmark server failed');
    try {
      const response = await fetch(url);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Server startup has a bounded deadline. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Benchmark server startup timed out');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  launched.add(browser);
  const version = browser.version();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(url);
  await page.waitForFunction(() => typeof window.flowcanvasBenchmark === 'function');
  const measured = await page.evaluate(() => window.flowcanvasBenchmark());
  const fixtures = [];
  for (const fixture of measured.fixtures) {
    const file = `fixture-${fixture.count}.json`;
    await writeFile(resolve(evidence, file), fixture.canonical);
    const bytes = Buffer.from(fixture.canonical);
    const shaStart = performance.now();
    digest(bytes);
    const sha256Ms = performance.now() - shaStart;
    fixtures.push({
      count: fixture.count,
      file,
      sha256: digest(bytes),
      canonicalBytes: bytes.length,
      sha256MsNode: sha256Ms,
      sha256Browser: { ...fixture.sha256, ...stats(fixture.sha256.samples) },
      validation: {
        ...fixture.validation,
        ...stats(fixture.validation.samples),
        targetP95: { 20: 10, 100: 25, 300: 75 }[fixture.count],
      },
      serialization: {
        ...fixture.serialization,
        ...stats(fixture.serialization.samples),
        targetP95: { 20: 10, 100: 30, 300: 100 }[fixture.count],
      },
    });
  }
  await browser.close();
  launched.delete(browser);
  const cold = [];
  for (let i = 0; i < 10; i++) {
    const instance = await chromium.launch({ channel: 'chrome', headless: true });
    launched.add(instance);
    const coldPage = await instance.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const cdp = await coldPage.context().newCDPSession(coldPage);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 100,
      downloadThroughput: 10_000_000 / 8,
      uploadThroughput: 1_000_000 / 8,
    });
    await coldPage.addInitScript(() => {
      window.__baseline = { lcp: 0, longTasks: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__baseline.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__baseline.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    });
    await coldPage.goto(url);
    await coldPage.waitForFunction(
      () => performance.getEntriesByName('flowcanvas-shell-ready').length > 0,
    );
    await coldPage.getByRole('heading', { name: 'FlowCanvas', exact: true }).waitFor();
    // LCP observer delivery can lag the shell-ready mark; zero is missing evidence.
    await coldPage.waitForFunction(() => window.__baseline.lcp > 0);
    await coldPage.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        }),
    );
    const result = await coldPage.evaluate(() => ({
      ready: performance.getEntriesByName('flowcanvas-shell-ready')[0].startTime,
      ...window.__baseline,
      resources: performance
        .getEntriesByType('resource')
        .map((entry) => ({ name: new URL(entry.name).pathname, transferSize: entry.transferSize })),
    }));
    cold.push(result);
    await instance.close();
    launched.delete(instance);
  }
  if (cold.some((sample) => sample.lcp <= 0 || sample.ready <= 0))
    throw new Error('Incomplete cold-load timing evidence');
  const assets = [];
  for (const file of await readdir('dist/assets')) {
    const contents = await readFile(resolve('dist/assets', file));
    assets.push({
      file,
      bytes: contents.length,
      gzipBytes: gzipSync(contents).length,
      sha256: digest(contents),
    });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    seed: 42615,
    mode: 'production/headless branded Chrome/local static server/CSP/no CPU throttle',
    environment: {
      os: os.release(),
      cpu: os.cpus()[0]?.model,
      logicalCores: os.cpus().length,
      ramBytes: os.totalmem(),
      node: process.version,
      browser: version,
      viewport: '1440x900',
      scale: 1,
    },
    fixtures,
    cold: {
      samples: cold,
      ready: coldStats(cold.map((sample) => sample.ready)),
      lcp: coldStats(cold.map((sample) => sample.lcp)),
      readyTargetP95: 3000,
      lcpTargetP95: 2500,
      profile: '10 fresh browser processes/profiles; cache disabled; 10Mbps/1Mbps/100ms RTT',
    },
    assets,
    limitations: [
      'Branded Chrome is headless; ambient OS/background activity is not controlled.',
      'SHA-256 timing is a separate Node sample, not a browser benchmark.',
      'Later-stage editor/worker/storage/stress/cleanup measurements are out of Stage 1 scope.',
    ],
  };
  await writeFile(resolve(evidence, 'baselines.json'), JSON.stringify(report, null, 2) + '\n');
  const failed =
    fixtures.some(
      (fixture) =>
        fixture.validation.p95 > fixture.validation.targetP95 ||
        fixture.serialization.p95 > fixture.serialization.targetP95 ||
        fixture.validation.errors > 0 ||
        fixture.serialization.errors > 0,
    ) ||
    report.cold.ready.p95 > report.cold.readyTargetP95 ||
    report.cold.lcp.p95 > report.cold.lcpTargetP95;
  console.log(
    JSON.stringify({
      domain: fixtures.map((fixture) => ({
        nodes: fixture.count,
        validationP95: fixture.validation.p95,
        serializationP95: fixture.serialization.p95,
      })),
      coldReadyP95: report.cold.ready.p95,
      coldLcpP95: report.cold.lcp.p95,
      failed,
    }),
  );
  if (failed) process.exitCode = 1;
} finally {
  for (const browser of launched) await browser.close();
  server.kill('SIGTERM');
}
