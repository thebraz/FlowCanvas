import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import os from 'node:os';
const destination = resolve(process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage3');
await mkdir(destination, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, FLOWCANVAS_STATIC_DIR: 'dist-benchmark', FLOWCANVAS_PORT: '4175' },
  stdio: 'pipe',
  windowsHide: true,
});
let serverError = '';
server.stderr.on('data', (chunk) => (serverError += String(chunk)));
server.on('error', () => (serverError = 'spawn'));
const url = 'http://127.0.0.1:4175/tests/performance/stage3.html';
const stats = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples,
    median:
      sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    p95: sorted[Math.ceil(0.95 * sorted.length) - 1],
    max: sorted.at(-1),
  };
};
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (serverError) throw new Error('Server failed');
    try {
      if ((await fetch(url)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Bounded startup retry. */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error('Server startup timeout');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.context().tracing.start({ screenshots: false, snapshots: false, sources: false });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.name));
  await page.goto(url);
  await page.waitForFunction(() => typeof window.flowcanvasRuntime === 'object');
  await page.getByRole('button', { name: 'Expand execution', exact: true }).click();
  const longTasks = [];
  await page.exposeFunction('recordRuntimeLongTask', (entry) => longTasks.push(entry));
  await page.evaluate(() => {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        void window.recordRuntimeLongTask({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: false });
  });
  const fixtures = [];
  for (const count of [20, 100, 300]) {
    const result = await page.evaluate((count) => window.flowcanvasRuntime.measure(count), count);
    const filename = `fixture-${count}.json`;
    await writeFile(resolve(destination, filename), result.canonical);
    fixtures.push({
      count,
      file: filename,
      sha256: createHash('sha256').update(result.canonical).digest('hex'),
      canonicalBytes: Buffer.byteLength(result.canonical),
      compile: stats(result.compileSamples),
      compileInWorker: stats(result.compileWorker),
      workerStartup: stats(result.startupSamples),
      execution: stats(result.runs),
      eventProcessing: stats(result.overhead),
      timelineToPaint: stats(result.render),
      targetP95: { 20: 100, 100: 300, 300: 1000 }[count],
      workersCreated: result.workersCreated,
      workersTerminated: result.workersTerminated,
    });
  }
  const cancellations = [];
  for (const mode of ['hang', 'blocked']) {
    const samples = [],
      frames = [];
    for (let i = 0; i < 35; i++) {
      await page.evaluate((mode) => window.flowcanvasRuntime.startFixture(mode), mode);
      await page.waitForFunction(() => window.flowcanvasRuntime.summary().operations === 1);
      if (i === 5)
        frames.push(
          ...(await page.evaluate(
            () =>
              new Promise((resolve) => {
                const frames = [];
                let start = performance.now(),
                  previous = start;
                const frame = (now) => {
                  frames.push(now - previous);
                  previous = now;
                  if (now - start < 400) requestAnimationFrame(frame);
                  else resolve(frames);
                };
                requestAnimationFrame(frame);
              }),
          )),
        );
      if (mode === 'blocked') await page.evaluate(() => window.flowcanvasRuntime.floodControls());
      const result = await page.evaluate(() => window.flowcanvasRuntime.stop());
      if (result.status !== 'cancelled' || result.workersCreated !== result.workersTerminated)
        throw new Error('Cancellation/cleanup failed');
      if (i >= 5) samples.push(result.elapsedMs);
    }
    cancellations.push({
      mode,
      saturatedControls: mode === 'blocked',
      ...stats(samples),
      targetP95: 200,
      mainThreadFrames: stats(frames),
    });
  }
  const large = await page.evaluate(() => window.flowcanvasRuntime.large());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const result = await cdp.send('Performance.getMetrics');
    return result.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? null;
  };
  await page.evaluate(() => window.flowcanvasRuntime.cycles(5));
  const baseline = await heap();
  const cleanup = await page.evaluate(() => window.flowcanvasRuntime.cycles(45));
  const final = await heap();
  const memory = {
    baselineAfter5Cycles: baseline,
    after50Cycles: final,
    growth: baseline === null || final === null ? null : final - baseline,
    target: 10 * 1024 * 1024,
    cleanup,
  };
  const assets = {};
  for (const name of await readdir('dist/assets'))
    assets[name] = createHash('sha256')
      .update(await readFile(resolve('dist/assets', name)))
      .digest('hex');
  const passed =
    fixtures.every((f) => f.execution.p95 <= f.targetP95) &&
    cancellations.every((c) => c.max <= 200) &&
    memory.growth !== null &&
    memory.growth <= memory.target &&
    errors.length === 0;
  const report = {
    date: new Date().toISOString(),
    environment: {
      platform: os.platform(),
      release: os.release(),
      cpu: os.cpus()[0]?.model,
      logicalCores: os.cpus().length,
      totalMemory: os.totalmem(),
      browser: browser.version(),
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      node: process.version,
      headless: true,
    },
    method:
      'Production optimized test-only harness of actual application/compiler/worker; 5 warmups + 30 samples, no outlier removal. Compile is separately instrumented; run includes host validation/transport through terminal. Browser DevTools closed; CDP GC only for cleanup measurement.',
    limitations: [
      'Headless Chrome only; ambient OS activity/power mode not certified.',
      'The isolated harness proves worker/host cleanup and heap growth; it does not replace manual screen-reader evaluation or branded Firefox/Safari measurements.',
    ],
    assets,
    fixtures,
    cancellations,
    large,
    memory,
    longTasks,
    errors,
    status: passed ? 'PASS' : 'FAIL',
  };
  await page.context().tracing.stop({ path: resolve(destination, 'runtime-trace.zip') });
  await writeFile(
    resolve(destination, 'runtime-performance.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        status: report.status,
        executionP95: fixtures.map((f) => ({
          count: f.count,
          p95: f.execution.p95,
          target: f.targetP95,
        })),
        cancelMax: cancellations.map((c) => ({ mode: c.mode, max: c.max })),
        heapGrowth: memory.growth,
        longTasks: longTasks.length,
        errors: errors.length,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
