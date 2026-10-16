import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
const evidence =
  process.env.FLOWCANVAS_EVIDENCE_DIR ??
  (process.argv[2] === 'stage3'
    ? 'docs/reports/evidence/stage3/editor-regression'
    : 'docs/reports/evidence/stage2');
await mkdir(evidence, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, FLOWCANVAS_STATIC_DIR: 'dist-benchmark', FLOWCANVAS_PORT: '4175' },
  stdio: 'pipe',
  windowsHide: true,
});
let error = '';
server.stderr.on('data', (chunk) => (error += String(chunk)));
const stats = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples,
    median:
      (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) /
      2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted.at(-1),
  };
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (error) throw new Error('Benchmark server failed');
    try {
      if ((await fetch('http://127.0.0.1:4175/tests/performance/stage2.html')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Local server startup has a bounded deadline. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Benchmark server startup timed out');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const longTasks = [];
  await page.addInitScript(() => {
    window.stage2LongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.stage2LongTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('http://127.0.0.1:4175/tests/performance/stage2.html');
  await page.waitForFunction(() => typeof window.stage2Benchmark === 'function');
  await page.context().tracing.start({ screenshots: false, snapshots: false });
  const fixtures = await page.evaluate(() => window.stage2Benchmark());
  longTasks.push(...(await page.evaluate(() => window.stage2LongTasks)));
  await page.context().tracing.stop({ path: `${evidence}/editor-trace.zip` });
  const measured = [];
  for (const f of fixtures) {
    await writeFile(`${evidence}/fixture-${f.count}.json`, f.canonical);
    const { canonical, ...rest } = f;
    const row = { ...rest, sha256: hash(canonical), canonicalBytes: Buffer.byteLength(canonical) };
    for (const key of [
      'open',
      'firstRender',
      'config',
      'select',
      'clear',
      'undo',
      'redo',
      'save',
      'autosave',
    ])
      row[key] = stats(f[key]);
    row.frames = Object.fromEntries(
      Object.entries(f.frames).map(([name, values]) => [name, stats(values)]),
    );
    const targets = {
      open: { 20: 250, 100: 500, 300: 1000 }[f.count],
      firstRender: { 20: 100, 100: 250, 300: 600 }[f.count],
      config: { 20: 20, 100: 35, 300: 50 }[f.count],
      select: { 20: 10, 100: 16, 300: 25 }[f.count],
      clear: { 20: 10, 100: 16, 300: 25 }[f.count],
      undo: { 20: 30, 100: 60, 300: 100 }[f.count],
      redo: { 20: 30, 100: 60, 300: 100 }[f.count],
      save: 500,
      autosave: 1000,
    };
    row.gates = Object.fromEntries(
      Object.entries(targets).map(([metric, target]) => [
        metric,
        { targetP95: target, status: row[metric].p95 <= target ? 'PASS' : 'FAIL' },
      ]),
    );
    for (const [metric, value] of Object.entries(row.frames))
      row.gates[metric] = {
        targetP95: { 20: 16.7, 100: 20, 300: 25 }[f.count],
        status: value.p95 <= { 20: 16.7, 100: 20, 300: 25 }[f.count] ? 'PASS' : 'FAIL',
      };
    row.gestureLongTasks = longTasks.filter((task) =>
      f.gestures.some((g) => task.start >= g.start && task.start < g.end),
    );
    measured.push(row);
  }
  const assets = [];
  for (const name of await readdir('dist/assets')) {
    const bytes = await readFile(`dist/assets/${name}`);
    assets.push({ name, bytes: bytes.length, sha256: hash(bytes) });
  }
  await writeFile(
    `${evidence}/editor-performance.json`,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        browser: browser.version(),
        os: os.release(),
        cpu: os.cpus()[0]?.model,
        ramBytes: os.totalmem(),
        viewport: { width: 1440, height: 900 },
        mode: 'headless branded Chrome, production test-only bundle; 5 warmups and 30 samples; paint method stated per metric',
        limitations:
          'Open/render use two rAF frames. Config, selection, undo and redo use the next rAF followed by a timer after the rendering opportunity, measured individually. Autosave uses the real subscribed coordinator, immutable edit, debounce, transaction acknowledgement and verified persisted content. Frame gestures use store overlays for five seconds each. React Profiler durations may be empty in production. Manual/Firefox/Safari evidence is separate. AC/power/background load were not independently certified.',
        fixtures: measured,
        longTasks,
        assets,
      },
      null,
      2,
    ),
  );
  console.log('Editor/save metrics retained for 20, 100 and 300 nodes.');
  const failures = measured.flatMap((row) =>
    Object.entries(row.gates)
      .filter(([, gate]) => gate.status === 'FAIL')
      .map(([metric, gate]) => `${row.count} nodes: ${metric} exceeds ${gate.targetP95}ms p95`),
  );
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  server.kill();
}
