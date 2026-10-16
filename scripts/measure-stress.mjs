import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';

const destination = process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage4/stress';
await mkdir(destination, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, FLOWCANVAS_STATIC_DIR: 'dist-benchmark', FLOWCANVAS_PORT: '4175' },
  stdio: 'pipe',
  windowsHide: true,
});
let browser,
  serverFailed = false;
server.on('error', () => {
  serverFailed = true;
});
const stats = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted.length !== 30) throw new Error('Incomplete stress sampling');
  return { samples, median: (sorted[14] + sorted[15]) / 2, p95: sorted[28], max: sorted[29] };
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverFailed) throw new Error('Stress server failed');
    try {
      if ((await fetch('http://127.0.0.1:4175/tests/performance/stage4.html')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Bounded loopback startup wait. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Stress server deadline');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const longTasks = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  await page.exposeFunction('recordStressTask', (entry) => longTasks.push(entry));
  await page.addInitScript(() =>
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        void window.recordStressTask({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true }),
  );
  await page.goto('http://127.0.0.1:4175/tests/performance/stage4.html');
  await page.waitForFunction(() => typeof window.flowcanvasStress === 'function');
  const measured = await page.evaluate(() => window.flowcanvasStress());
  const operations = ['import', 'export'].map((operation) => {
    const samples = measured.samples.filter(
      (sample) => sample.measured && sample.operation === operation,
    );
    const tasks = longTasks.filter((task) =>
      samples.some(
        (sample) => task.start < sample.end && task.start + task.duration > sample.start,
      ),
    );
    const observed = stats(samples.map((sample) => sample.duration));
    const maximumLongTask = Math.max(0, ...tasks.map((task) => task.duration));
    const targetP95 = operation === 'import' ? 1000 : 500;
    return {
      operation,
      ...observed,
      targetP95,
      maximumLongTask,
      longTaskTarget: 100,
      status: observed.p95 <= targetP95 && maximumLongTask <= 100 ? 'PASS' : 'FAIL',
    };
  });
  await writeFile(`${destination}/fixture-max.json`, measured.canonical);
  const memory = [];
  for (const count of [20, 100, 300]) {
    const memoryPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const cdp = await memoryPage.context().newCDPSession(memoryPage);
    await cdp.send('Performance.enable');
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      const value = (await cdp.send('Performance.getMetrics')).metrics.find(
        (metric) => metric.name === 'JSHeapUsedSize',
      )?.value;
      if (value === undefined) throw new Error('Heap metric unavailable');
      return value;
    };
    const empty = await heap();
    await memoryPage.goto('http://127.0.0.1:4175/tests/performance/stage3.html');
    await memoryPage.waitForFunction(() => typeof window.flowcanvasRuntime === 'object');
    const activity = await memoryPage.evaluate(
      (count) => window.flowcanvasRuntime.prepareMemory(count),
      count,
    );
    const retained = await heap(),
      chunks = [];
    cdp.on('HeapProfiler.addHeapSnapshotChunk', ({ chunk }) => chunks.push(chunk));
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
    await writeFile(`${destination}/heap-${count}.heapsnapshot`, chunks.join(''));
    const targetBytes = { 20: 80, 100: 120, 300: 200 }[count] * 1024 * 1024;
    memory.push({
      count,
      emptyBytes: empty,
      retainedBytes: retained,
      aboveEmptyBytes: retained - empty,
      targetBytes,
      activity,
      status:
        retained - empty <= targetBytes && activity.workersCreated === activity.workersTerminated
          ? 'PASS'
          : 'FAIL',
    });
    await cdp.detach();
    await memoryPage.close();
  }
  const report = {
    measuredAt: new Date().toISOString(),
    environment: {
      browser: browser.version(),
      node: process.version,
      os: os.release(),
      cpu: os.cpus()[0]?.model,
      ramBytes: os.totalmem(),
      viewport: { width: 1440, height: 900 },
      headless: true,
    },
    method:
      'Exact 5 MiB valid synthetic document, 22 independent triggers/outputs, 5 warmups + 30 samples per import/export. Real synchronous production codec; no outlier removal. Memory is post-GC Chrome heap above a fresh empty page after 100 committed commands and 10 actual production-worker runs per fixture; heap snapshots retained.',
    limitations: [
      'Headless Chrome; AC and ambient load not certified. Codec measurements exclude file picker/read and download overhead. Other branded-browser stress/memory is NOT TESTED.',
    ],
    fixture: {
      bytes: Buffer.byteLength(measured.canonical),
      sha256: createHash('sha256').update(measured.canonical).digest('hex'),
      nodes: measured.nodes,
      edges: measured.edges,
    },
    operations,
    memory,
    longTasks,
    errors,
  };
  report.status =
    operations.every((row) => row.status === 'PASS') &&
    memory.every((row) => row.status === 'PASS') &&
    errors.length === 0
      ? 'PASS'
      : 'FAIL';
  await writeFile(`${destination}/stress-performance.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        status: report.status,
        operations: operations.map(({ operation, p95, maximumLongTask, status }) => ({
          operation,
          p95,
          maximumLongTask,
          status,
        })),
        memory,
      },
      null,
      2,
    ),
  );
  if (report.status !== 'PASS') process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
