import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, readdir } from 'node:fs/promises';
import { exampleJson } from '../../src/application/examples';
async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
  if (await manager.isVisible())
    await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
}
async function expand(page: Page) {
  const button = page.getByRole('button', { name: 'Expand execution', exact: true });
  if (await button.isVisible()) await button.click();
}
async function exportJson(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const path = await (await pending).path();
  if (!path) throw new Error('Download missing');
  return readFile(path, 'utf8');
}
async function importGraph(page: Page, text: string) {
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByText('Import from JSON text', { exact: true }).click();
  await page.getByLabel('Workflow JSON', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Import as new', exact: true }).click();
}
test('given the production module worker, then real routes, results and safe inspection preserve persisted graph data', async ({
  page,
}) => {
  const errors: string[] = [],
    network: string[] = [];
  const workerPolicies: string[] = [];
  page.context().on('response', (response) => {
    if (/\/assets\/entry-[A-Za-z0-9_-]+\.js$/u.test(response.url()))
      workerPolicies.push(response.headers()['content-security-policy'] ?? '');
  });
  page.on('pageerror', (e) => errors.push(e.name));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await start(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  const before = await exportJson(page);
  page.on('request', (request) => network.push(request.url()));
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  expect(workerPolicies.length).toBeGreaterThan(0);
  expect(
    workerPolicies.every(
      (policy) =>
        policy.includes("connect-src 'none'") &&
        policy.includes("worker-src 'self'") &&
        !policy.includes('unsafe-eval'),
    ),
  ).toBe(true);
  await expand(page);
  await page
    .getByLabel('Inspect execution node', { exact: true })
    .selectOption({ label: 'Set Field · completed' });
  await expect(page.getByLabel('Node input', { exact: true })).toContainText('"reviewed":false');
  await expect(page.getByLabel('Node output out', { exact: true })).toContainText(
    '"reviewed":true',
  );
  await page.getByText(/^Gold customers · Output #1/).click();
  await expect(page.getByLabel('Final output 1', { exact: true })).toHaveText(
    '{"customer":{"tier":"gold"},"reviewed":true}',
  );
  expect(await exportJson(page)).toBe(before);
  await page.getByRole('button', { name: 'Collapse execution', exact: true }).click();
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await expect(page.locator('[data-path-status="Inactive branch"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await expect(page.locator('.graph-list .runtime-skipped')).toContainText('branch-not-selected');
  await expand(page);
  await page.getByRole('button', { name: 'Taller execution panel', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('flowcanvas', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error('Fixture database unavailable'));
        });
        try {
          return await new Promise<unknown>((resolve, reject) => {
            const request = db
              .transaction('settings', 'readonly')
              .objectStore('settings')
              .get('preferences');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('Fixture preferences unavailable'));
          });
        } finally {
          db.close();
        }
      }),
    )
    .toMatchObject({ executionExpanded: true, executionHeight: 320 });
  await page.reload();
  await expect(page.getByTestId('run-status')).toHaveText('idle');
  await expect(page.getByRole('button', { name: 'Collapse execution', exact: true })).toBeVisible();
  await expect(page.locator('.execution-detail')).toHaveCSS('height', '320px');
  const allowed = new Set([
    'http://127.0.0.1:4173/',
    'http://127.0.0.1:4173/favicon.svg',
    ...(await readdir('dist/assets')).map((name) => `http://127.0.0.1:4173/assets/${name}`),
  ]);
  expect(errors).toEqual([]);
  expect(network.filter((url) => !allowed.has(url))).toEqual([]);
  // Capture after console assertions: WebKit's screenshot tool injects an inline stylesheet.
  await page.screenshot({
    caret: 'initial',
    path:
      (process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage3') +
      '/runtime-reopened-1440.png',
  });
});
test('given keyboard Step from idle, then pause, resume, stop and reset control actual operations', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Step', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await expect(page.locator('.graph-list .runtime-completed')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Add Set Field', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.locator('.graph-list .runtime-completed')).toHaveCount(2);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('cancelled');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('idle');
  await expect(page.locator('.runtime-badge')).toHaveCount(0);
});
test('given an editor-built graph, then configure, connect, validate, execute, edit and execute again through the same engine', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByLabel('Workflow title', { exact: true }).fill('Execution journey');
  await page.getByRole('button', { name: 'Create workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('button', { name: 'Add Manual Trigger', exact: true }).click();
  await page.getByLabel('Node configuration', { exact: true }).fill('{"payload":{"ticket":7}}');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Add Output', exact: true }).click();
  await page.getByRole('button', { name: 'Connect nodes', exact: true }).click();
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('ready');
  await expect(page.locator('.graph-list .runtime-completed')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  await expand(page);
  await page.getByText(/^Result · Output #1/).click();
  await expect(page.getByLabel('Final output 1', { exact: true })).toHaveText('{"ticket":7}');
  await page.getByRole('button', { name: 'Inspect Manual Trigger', exact: true }).click();
  await page.getByLabel('Node configuration', { exact: true }).fill('{"payload":{"ticket":8}}');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('idle');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  await page.getByText(/^Result · Output #1/).click();
  await expect(page.getByLabel('Final output 1', { exact: true })).toHaveText('{"ticket":8}');
});
test('given invalid readiness and a mid-run path error, then diagnostics and partial outputs identify the failure', async ({
  page,
}) => {
  await start(page);
  await importGraph(page, exampleJson('Invalid workflow validation'));
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('failed');
  await expect(page.getByRole('alert').filter({ hasText: 'CONFIG_INVALID' })).toBeVisible();
  await importGraph(page, exampleJson('Multiple processing branches'));
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Second branch', exact: true }).click();
  await page
    .getByLabel('Node configuration', { exact: true })
    .fill('{"path":["reviewed","nested"],"value":1}');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('failed');
  await expect(page.getByRole('alert').filter({ hasText: 'PATH_TYPE' })).toBeVisible();
  await expect(page.locator('.runtime-failed').first()).toBeVisible();
  await expand(page);
  await expect(page.getByText(/Partial results · failed/)).toBeVisible();
  await expect(page.getByText(/^Gold customers · Output #1/)).toBeVisible();
});
test('given all bundled valid examples, then each executes through the production registry with new identities', async ({
  page,
}) => {
  await start(page);
  const ids: string[] = [];
  for (const name of [
    'Data transformation',
    'Conditional routing',
    'Multiple processing branches',
  ]) {
    await page.getByRole('button', { name: 'Workflows', exact: true }).click();
    await page.getByText('Executable examples', { exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByTestId('run-status')).toHaveText('completed');
    ids.push(await exportJson(page));
  }
  expect(new Set(ids).size).toBe(3);
});
test('given script-like payloads, then inspection is literal, downloadable and never executes or navigates', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Manual Trigger', exact: true }).click();
  await page.getByLabel('Node configuration', { exact: true }).fill(
    JSON.stringify({
      payload: {
        customer: { tier: 'gold' },
        text: '<img src=x onerror="globalThis.flowcanvasCanary=1">',
      },
    }),
  );
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  // Pick Fields must retain the canary as ordinary data for Output inspection.
  await page.getByRole('button', { name: 'Inspect Pick Fields', exact: true }).click();
  await page
    .getByLabel('Node configuration', { exact: true })
    .fill('{"paths":[["customer"],["text"]],"missing":"error"}');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  await expand(page);
  await page.getByText(/^Gold customers · Output #1/).click();
  await expect(page.getByLabel('Final output 1', { exact: true })).toContainText('<img');
  expect(await page.locator('.payload-view img').count()).toBe(0);
  expect(await page.evaluate(() => Object.hasOwn(globalThis, 'flowcanvasCanary'))).toBe(false);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Final output 1', exact: true }).click();
  const path = await (await download).path();
  if (!path) throw new Error('Missing output download');
  expect(await readFile(path, 'utf8')).toContain('<img');
});
test('given paused debugging in both themes and narrow view, then keyboard controls and inspection pass automated accessibility', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  await expand(page);
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    await page.getByRole('button', { name: 'Graph list', exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.screenshot({
      caret: 'initial',
      path: `${process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage3'}/runtime-${theme}-320.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('cancelled');
});
