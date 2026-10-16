import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { exampleDocument, EXAMPLE_TITLES } from '../../src/application/examples';
import { representativeGraph } from '../fixtures/graphs';
import { canonicalDocument } from '../../src/domain/json/canonical';

const evidence =
  process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage3/final-browser';
async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  const dialog = page.getByRole('dialog', { name: 'Workflows', exact: true });
  if (await dialog.isVisible())
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
}
async function button(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
}
async function expand(page: Page) {
  if (await page.getByRole('button', { name: 'Expand execution', exact: true }).isVisible())
    await button(page, 'Expand execution');
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await button(page, name);
  const file = await pending;
  const path = await file.path();
  if (!path) throw new Error('Download unavailable');
  return { text: await readFile(path, 'utf8'), file };
}
async function exported(page: Page) {
  return (await download(page, 'Export JSON')).text;
}
async function importGraph(page: Page, text: string) {
  await button(page, 'Workflows');
  await page.getByText('Import from JSON text', { exact: true }).click();
  await page.getByLabel('Workflow JSON', { exact: true }).fill(text);
  await button(page, 'Import as new');
}
async function run(page: Page) {
  await button(page, 'Run');
  await expect(page.getByTestId('run-status')).toHaveText('completed');
}
async function capture(page: Page, info: TestInfo, name: string, data?: unknown) {
  await page.screenshot({ caret: 'initial', path: `${evidence}/${name}.png`, fullPage: true });
  if (data !== undefined) {
    await writeFile(`${evidence}/${name}.json`, JSON.stringify(data, null, 2));
    await info.attach(`${name}.json`, {
      body: JSON.stringify(data, null, 2),
      contentType: 'application/json',
    });
  }
}

for (const width of [1440, 1024, 1023, 768, 320])
  test(`T01 responsive optional canvas at ${width}px retains nodes, edges, selection and navigation`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await start(page);
    if (width < 1024)
      await expect(page.getByRole('heading', { name: 'Graph list', exact: true })).toBeVisible();
    await button(page, 'Canvas');
    await button(page, 'Fit view');
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    await expect(page.locator('.react-flow__edge').first()).toBeVisible();
    const geometry = await page.locator('.canvas-frame').boundingBox();
    expect(geometry?.height).toBeGreaterThan(100);
    expect((await page.locator('.react-flow__renderer').boundingBox())?.height).toBeGreaterThan(
      100,
    );
    await button(page, 'Graph list');
    await button(page, 'Inspect Manual Trigger');
    await button(page, 'Canvas');
    await button(page, 'Center selected');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
    const oldTransform = await page.locator('.react-flow__viewport').getAttribute('style');
    await button(page, 'Pan left');
    await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute(
      'style',
      oldTransform ?? '',
    );
    await button(page, 'Zoom in');
    await button(page, 'Widen properties panel');
    await button(page, 'Narrow properties panel');
    await expand(page);
    await button(page, 'Taller execution panel');
    await expect(page.locator('.execution-detail')).toHaveCSS('height', '320px');
    await button(page, 'Collapse execution');
    await button(page, 'Fit view');
    expect((await page.locator('.react-flow__renderer').boundingBox())?.height).toBeGreaterThan(
      100,
    );
    const visibleNode = await page.locator('.react-flow__node').first().boundingBox();
    const canvas = await page.locator('.canvas-frame').boundingBox();
    if (!visibleNode || !canvas) throw new Error('Canvas or node missing');
    expect(
      Math.min(visibleNode.y + visibleNode.height, canvas.y + canvas.height) -
        Math.max(visibleNode.y, canvas.y),
    ).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await capture(page, info, `T01-${width}`, {
      width,
      geometry,
      visibleNodes: await page.locator('.react-flow__node').count(),
    });
  });

test('T02 all demonstration outputs match configuration and drafts block execution', async ({
  page,
}, info) => {
  await start(page);
  for (const name of EXAMPLE_TITLES) {
    await button(page, 'Workflows');
    await page.getByText('Executable examples', { exact: true }).click();
    await button(page, name);
    if (name === 'Invalid workflow validation') {
      await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled();
      await button(page, 'Validate');
      await expect(page.getByTestId('run-status')).toHaveText('failed');
      await expect(page.getByRole('alert').filter({ hasText: 'CONFIG_INVALID' })).toBeVisible();
      continue;
    }
    await run(page);
    await expand(page);
    await page.getByText(/^Gold customers · Output #1/).click();
    const first = await download(page, 'Download Final output 1');
    expect(JSON.parse(first.text)).toEqual({ customer: { tier: 'gold' }, reviewed: true });
    if (name === 'Multiple processing branches') {
      await page.getByText(/^Branch result · Output #2/).click();
      expect(JSON.parse((await download(page, 'Download Final output 2')).text)).toEqual({
        customer: { tier: 'gold' },
        reviewed: false,
      });
    }
  }
  await capture(page, info, 'T02-invalid-readiness');
});

test('T03 real lifecycle rejects invalid controls and clears cancelled-run state', async ({
  page,
}, info) => {
  await start(page);
  for (const name of ['Pause', 'Resume', 'Stop', 'Reset'])
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await button(page, 'Step');
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await button(page, 'Graph list');
  await expect(page.locator('.graph-list .runtime-completed')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled();
  await button(page, 'Step');
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await expect(page.locator('.graph-list .runtime-completed')).toHaveCount(2);
  await button(page, 'Resume');
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  await button(page, 'Step');
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await button(page, 'Stop');
  await expect(page.getByTestId('run-status')).toHaveText('cancelled');
  const cancelled = await page.locator('.run-identity').textContent();
  await run(page);
  expect(await page.locator('.run-identity').textContent()).not.toBe(cancelled);
  await button(page, 'Reset');
  await expect(page.getByTestId('run-status')).toHaveText('idle');
  await expect(page.locator('.runtime-badge')).toHaveCount(0);
  await capture(page, info, 'T03-reset');
});

test('T04 and T05 actual node/path diagnostics agree with values and semantic invalidation', async ({
  page,
}, info) => {
  await start(page);
  await run(page);
  await button(page, 'Fit view');
  await expect(page.locator('[data-path-status="Inactive branch"]')).toHaveCount(1);
  await expect(page.locator('[data-path-status="Executed path"]')).toHaveCount(4);
  await button(page, 'Graph list');
  await expect(page.locator('.runtime-skipped')).toContainText('branch-not-selected');
  await expect(page.locator('.runtime-completed').first()).toContainText('ms');
  await expand(page);
  await expect(page.locator('.execution-timeline')).toContainText('node-complete');
  await expect(page.locator('.execution-timeline')).toContainText('true');
  await page
    .getByLabel('Inspect execution node', { exact: true })
    .selectOption({ label: 'Set Field · completed' });
  await expect(page.getByLabel('Node input', { exact: true })).toContainText('"reviewed":false');
  await expect(page.getByLabel('Node output out', { exact: true })).toContainText(
    '"reviewed":true',
  );
  const identity = await page.locator('.run-identity').textContent();
  const position = page
    .getByRole('complementary', { name: 'Node properties' })
    .locator('input[type="number"]')
    .first();
  await position.fill(String(Number(await position.inputValue()) + 16));
  await button(page, 'Apply');
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  expect(await page.locator('.run-identity').textContent()).toBe(identity);
  await button(page, 'Step');
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await expect(page.getByLabel('Node configuration', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add Set Field', exact: true })).toBeDisabled();
  await button(page, 'Stop');
  await expect(page.getByTestId('run-status')).toHaveText('cancelled');
  await button(page, 'Inspect Set Field');
  await page
    .getByLabel('Node configuration', { exact: true })
    .fill('{"path":["reviewed","nested"],"value":1}');
  await button(page, 'Apply');
  await expect(page.getByTestId('run-status')).toHaveText('idle');
  await button(page, 'Run');
  await expect(page.getByTestId('run-status')).toHaveText('failed');
  await expect(page.getByRole('alert').filter({ hasText: 'PATH_TYPE' })).toBeVisible();
  await expect(page.locator('.graph-list .runtime-failed')).toBeVisible();
  await capture(page, info, 'T04-T05-failure-invalidation');
});

test('T03 production Pause acknowledges a boundary or preserves completion when exhaustion wins', async ({
  page,
}, info) => {
  await start(page);
  await importGraph(page, canonicalDocument(representativeGraph(300)));
  await button(page, 'Run');
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(page.getByTestId('run-status')).toHaveText(/^(running|completed)$/);
  if (await pause.isEnabled()) {
    await pause.focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('run-status')).toHaveText(/^(paused|completed)$/);
  const boundary = await page.getByTestId('run-status').textContent();
  await button(page, 'Graph list');
  if (boundary === 'paused') {
    const completedBefore = await page.locator('.graph-list .runtime-completed').count();
    await page.waitForTimeout(100);
    expect(await page.locator('.graph-list .runtime-completed').count()).toBe(completedBefore);
    await button(page, 'Resume');
  }
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  await expect(pause).toBeDisabled();
  await expect(
    page.locator('.graph-list .runtime-pending,.graph-list .runtime-running'),
  ).toHaveCount(0);
  expect(
    await page.locator('.graph-list .runtime-completed,.graph-list .runtime-skipped').count(),
  ).toBe(270);
  await capture(page, info, 'T03-production-pause', { boundary, allExecutableNodesTerminal: true });
});

test('T03 actual delayed worker must pause at a boundary and Resume preserves execution', async ({
  page,
}, info) => {
  await page.goto('http://127.0.0.1:4176/tests/performance/stage3.html');
  await page.evaluate(() => window.flowcanvasRuntime.startFixture('delay'));
  await expect
    .poll(() => page.evaluate(() => window.flowcanvasRuntime.summary().operations))
    .toBeGreaterThan(0);
  await button(page, 'Pause');
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  const before = await page.evaluate(() => window.flowcanvasRuntime.summary().operations);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.flowcanvasRuntime.summary().operations)).toBe(before);
  await button(page, 'Resume');
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  await capture(page, info, 'T03-worker-pause', {
    fixture: 'test-only delay around actual node operation',
    before,
    preservedDuringPause: true,
  });
});

test('T07 automated accessibility and keyboard focus supplement unavailable assistive evaluation', async ({
  page,
}, info) => {
  await start(page);
  await button(page, 'Graph list');
  await button(page, 'Step');
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await expand(page);
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    const analysis = await new AxeBuilder({ page }).analyze();
    expect(analysis.violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Step', exact: true }).focus();
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => ({
    name: document.activeElement?.textContent,
    outline: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : '',
  }));
  expect(focus.outline).not.toBe('none');
  await expect(page.getByRole('status').filter({ hasText: /Execution paused/ })).toBeVisible();
  await capture(page, info, 'T07-automated-focus', { focus, realScreenReader: 'NOT TESTED' });
});

test('T08 both themes and browser-emulated forced colors keep focus, state text and connections', async ({
  page,
}, info) => {
  await start(page);
  await run(page);
  await button(page, 'Fit view');
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.emulateMedia({ forcedColors: 'active' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await page.getByRole('button', { name: 'Fit view', exact: true }).focus();
    const edge = await page
      .locator('.react-flow__edge-path')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element),
          box = element.getBoundingClientRect();
        return {
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          display: style.display,
          visibility: style.visibility,
          width: box.width,
          height: box.height,
        };
      });
    // A horizontal SVG stroke has zero geometric height despite being visibly painted.
    expect(edge.width + edge.height).toBeGreaterThan(0);
    expect(edge.display).not.toBe('none');
    expect(edge.visibility).toBe('visible');
    expect(edge.stroke).not.toBe('none');
    expect(Number.parseFloat(edge.strokeWidth)).toBeGreaterThanOrEqual(2);
    await capture(page, info, `T08-${theme}-forced`, {
      edge,
      nativeWindowsContrastTheme: 'NOT TESTED',
    });
    await page.emulateMedia({ forcedColors: 'none' });
  }
});

test('T09 real storage retains workflows/preferences and clears all runtime after reload/reopen', async ({
  page,
}, info) => {
  await start(page);
  await button(page, 'Save');
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  const before = await exported(page);
  await run(page);
  await expand(page);
  await button(page, 'Taller execution panel');
  await expect(page.locator('.execution-detail')).toHaveCSS('height', '320px');
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const r = indexedDB.open('flowcanvas', 1);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(new Error('Fixture database failed'));
        });
        try {
          return await new Promise<unknown>((resolve, reject) => {
            const r = db.transaction('settings').objectStore('settings').get('preferences');
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(new Error('Fixture settings failed'));
          });
        } finally {
          db.close();
        }
      }),
    )
    .toMatchObject({ executionHeight: 320, executionExpanded: true });
  expect(await exported(page)).toBe(before);
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  await expect(page.getByTestId('run-status')).toHaveText('idle');
  await expect(page.locator('.execution-detail')).toHaveCSS('height', '320px');
  expect(await exported(page)).toBe(before);
  await button(page, 'Workflows');
  await page.getByRole('button', { name: 'Open Customer review', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('idle');
  expect(await exported(page)).toBe(before);
  await capture(page, info, 'T09-reopened');
});

test('T10 nested, unusual and large JSON stays inert with bounded preview and complete download', async ({
  page,
}, info) => {
  const payload = {
    nested: { array: [1, null, { emoji: '🧪', newline: 'first\nsecond' }] },
    text: '<script>globalThis.flowcanvasProbe=1</script><img src=x onerror="globalThis.flowcanvasProbe=1">',
    a: 'a'.repeat(60000),
    b: 'b'.repeat(60000),
    c: 'c'.repeat(60000),
  };
  const base = exampleDocument('Data transformation');
  const trigger = base.nodes.find((node) => node.type === 'manualTrigger');
  const output = base.nodes.find((node) => node.type === 'output');
  if (!trigger || !output) throw new Error('Fixture missing endpoints');
  const document = {
    ...base,
    nodes: [{ ...trigger, config: { payload } }, output],
    edges: [
      {
        id: base.edges[0]?.id,
        source: { nodeId: trigger.id, port: 'out' },
        target: { nodeId: output.id, port: 'in' },
      },
    ],
  };
  await start(page);
  await importGraph(page, JSON.stringify(document));
  await run(page);
  await expand(page);
  await page.getByText(/^Gold customers · Output #1/).click();
  await expect(
    page.getByText('Preview truncated at 64 KiB. Download contains the full payload.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.getByLabel('Final output 1', { exact: true }).textContent()).toHaveLength(
    65536,
  );
  expect(await page.locator('.payload-view script,.payload-view img').count()).toBe(0);
  expect(await page.evaluate(() => Object.hasOwn(globalThis, 'flowcanvasProbe'))).toBe(false);
  const result = await download(page, 'Download Final output 1');
  expect(JSON.parse(result.text)).toEqual(payload);
  await result.file.saveAs(`${evidence}/T10-complete-result.json`);
  await capture(page, info, 'T10-bounded-preview', {
    downloadBytes: Buffer.byteLength(result.text),
    rootKeys: Object.keys(payload),
    completeDownload: true,
  });
});

for (const count of [100, 300] as const)
  test(`T11 representative ${count}-node workflow supports real editing and canvas gestures`, async ({
    page,
  }, info) => {
    test.setTimeout(60000);
    await start(page);
    const openedAt = Date.now();
    await importGraph(page, canonicalDocument(representativeGraph(count)));
    await button(page, 'Fit view');
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    const openedMs = Date.now() - openedAt;
    await button(page, 'Graph list');
    await button(page, 'Inspect Manual Trigger');
    const position = page
      .getByRole('complementary', { name: 'Node properties' })
      .locator('input[type="number"]')
      .first();
    await position.fill('16');
    await button(page, 'Apply');
    await button(page, 'Canvas');
    await button(page, 'Center selected');
    const selected = page.locator('.react-flow__node.selected');
    await expect(selected).toHaveCount(1);
    const box = await selected.boundingBox();
    if (!box) throw new Error('Selected node missing');
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 32, box.y + 36, { steps: 5 });
    await page.mouse.up();
    const afterDrag = JSON.parse(await exported(page)) as unknown;
    expect(afterDrag).toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({
          type: 'manualTrigger',
          position: expect.not.objectContaining({ x: 16, y: 0 }),
        }),
      ]),
    });
    const frame = await page.locator('.canvas-frame').boundingBox();
    if (!frame) throw new Error('Canvas missing');
    const old = await page.locator('.react-flow__viewport').getAttribute('style');
    await page.mouse.move(frame.x + frame.width - 40, frame.y + 60);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(frame.x + frame.width - 100, frame.y + 90, { steps: 5 });
    await page.mouse.up({ button: 'middle' });
    await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute('style', old ?? '');
    await button(page, 'Zoom in');
    await button(page, 'Fit view');
    await button(page, 'Graph list');
    await page.getByLabel('Select Manual Trigger', { exact: true }).uncheck();
    await expect(page.getByLabel('Select Manual Trigger', { exact: true })).not.toBeChecked();
    await button(page, 'Inspect Manual Trigger');
    await page
      .getByLabel('Node configuration', { exact: true })
      .fill('{"payload":{"customer":{"tier":"silver"},"reviewed":false,"padding":"synthetic"}}');
    await button(page, 'Apply');
    await run(page);
    await capture(page, info, `T11-${count}`, {
      openedMs,
      journeyMs: Date.now() - openedAt,
      mandatoryBenchmarks: 'Unchanged; this is one functional usability journey',
    });
  });

test('T14 production CSP and actual requests expose no workflow network transmission', async ({
  page,
}, info) => {
  const requests: { url: string; method: string; resource: string }[] = [],
    errors: string[] = [],
    policies: string[] = [];
  page.on('request', (r) =>
    requests.push({ url: r.url(), method: r.method(), resource: r.resourceType() }),
  );
  page.on('pageerror', (error) => errors.push(error.name));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.context().on('response', (response) => {
    if (/\/assets\/entry-[^/]+\.js$/.test(response.url()))
      policies.push(response.headers()['content-security-policy'] ?? '');
  });
  await start(page);
  await run(page);
  await button(page, 'Reset');
  await run(page);
  const allowed = new Set([
    'http://127.0.0.1:4173/',
    'http://127.0.0.1:4173/favicon.svg',
    ...(await readdir('dist/assets')).map((name) => `http://127.0.0.1:4173/assets/${name}`),
  ]);
  expect(requests.every((request) => request.method === 'GET' && allowed.has(request.url))).toBe(
    true,
  );
  expect(policies.length).toBeGreaterThan(0);
  expect(
    policies.every(
      (policy) =>
        policy.includes("connect-src 'none'") &&
        policy.includes("worker-src 'self'") &&
        !policy.includes('unsafe-eval'),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  const normalRequests = [...requests];
  const fetchBlocked = await page.evaluate(async () => {
    try {
      await fetch('/favicon.svg');
      return false;
    } catch {
      return true;
    }
  });
  const inlineScriptBlocked = await page
    .addScriptTag({ content: 'globalThis.flowcanvasCspProbe = 1;' })
    .then(
      () => false,
      () => true,
    );
  expect(fetchBlocked).toBe(true);
  expect(inlineScriptBlocked).toBe(true);
  expect(await page.evaluate(() => Object.hasOwn(globalThis, 'flowcanvasCspProbe'))).toBe(false);
  await capture(page, info, 'T14-network', {
    normalRequests,
    policies,
    unexpectedConsoleErrors: [],
    fetchBlocked,
    inlineScriptBlocked,
    expectedCspDiagnostics: errors,
  });
});
