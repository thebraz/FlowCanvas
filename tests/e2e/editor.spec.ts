import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSample } from '../../src/application/sample';
import { canonicalDocument } from '../../src/domain/json/canonical';
import { LIMITS } from '../../src/contracts/limits';
import { sampleId } from '../../src/application/sample';
import { makeEnvelope } from '../../src/adapters/persistence/indexeddb';
import { readFile } from 'node:fs/promises';
import { decodeDocument } from '../../src/validation/codec';
async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  const dialog = page.getByRole('dialog', { name: 'Workflows', exact: true });
  if (await dialog.isVisible())
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
}
async function rename(page: Page, title: string) {
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Workflow name', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Apply name', exact: true }).click();
}
async function saved(page: Page) {
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
}
async function records(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('flowcanvas', 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction(['documents', 'backups'], 'readonly'),
            d = tx.objectStore('documents').getAll(),
            b = tx.objectStore('backups').getAll();
          tx.oncomplete = () => {
            const docs: unknown = d.result,
              backups: unknown = b.result;
            db.close();
            resolve([docs, backups]);
          };
          tx.onabort = () => reject(new Error('Read failed'));
        };
        open.onerror = () => reject(new Error('Open failed'));
      }),
  );
}
test('given a complete editing journey, then inspector, connection management and reload preserve committed content', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByLabel('Workflow title', { exact: true }).fill('Editing journey');
  await page.getByRole('button', { name: 'Create workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('button', { name: 'Add Manual Trigger', exact: true }).click();
  await page.getByLabel('Node configuration', { exact: true }).fill('{"payload":{"ticket":7}}');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Add Output', exact: true }).click();
  await page.getByRole('button', { name: 'Connect nodes', exact: true }).click();
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const before = await records(page);
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  await saved(page);
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Inspect Manual Trigger', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Inspect Manual Trigger', exact: true }).click();
  await expect(page.getByLabel('Node configuration', { exact: true })).toContainText('ticket');
  expect(await records(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page.getByText('Connections for Manual Trigger', { exact: true }).click();
  await page
    .getByRole('button', { name: /Edit connection/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Apply connection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page
    .getByRole('button', { name: /Delete connection/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
});
test('given two tabs at one base revision, then a stale save conflicts and save-as-new preserves both versions', async ({
  page,
  context,
}) => {
  await start(page);
  await rename(page, 'Shared original');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const second = await context.newPage();
  await start(second);
  await saved(second);
  await rename(page, 'Tab A accepted');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await rename(second, 'Tab B unsaved');
  await second.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(second.getByLabel('Save status', { exact: true })).toHaveText(
    'Conflict · not saved',
  );
  const before = await records(page);
  expect(JSON.stringify(before)).toContain('Tab A accepted');
  expect(JSON.stringify(before)).not.toContain('Tab B unsaved');
  await second.getByRole('button', { name: 'Save as new', exact: true }).click();
  await saved(second);
  expect(JSON.stringify(await records(page))).toContain('Tab B unsaved copy');
});
test('given a deleted workflow in another tab, then stale autosave cannot resurrect it', async ({
  page,
  context,
}) => {
  await start(page);
  await rename(page, 'Delete race');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const second = await context.newPage();
  await start(second);
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Delete race', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Delete Delete race?', exact: true })
      .getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await rename(second, 'Do not resurrect');
  await second.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(second.getByLabel('Save status', { exact: true })).toHaveText(
    'Conflict · not saved',
  );
  expect(JSON.stringify(await records(second))).not.toContain('Do not resurrect');
});
test('given edits during slow serialization, then final persisted revision contains the newest edit', async ({
  page,
}) => {
  await start(page);
  await rename(page, 'Before slow save');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (algorithm, data) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return original(algorithm, data);
    };
  });
  await rename(page, 'Earlier captured');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await rename(page, 'Newest edit');
  await saved(page);
  expect(JSON.stringify(await records(page))).toContain('Newest edit');
  await page.reload();
  await expect(page.locator('.workflow-title strong')).toHaveText('Newest edit');
});
test('given a real transaction abort, then old document and backup remain unchanged and latest edits remain exportable', async ({
  page,
}) => {
  await start(page);
  await rename(page, 'Committed one');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await rename(page, 'Committed two');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const before = await records(page);
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
      ?.value as IDBObjectStore['put'];
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      const request =
        key === undefined ? original.call(this, value) : original.call(this, value, key);
      if (this.name === 'documents') this.transaction.abort();
      return request;
    };
  });
  await rename(page, 'Unsaved after abort');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Error · not saved');
  expect(await records(page)).toEqual(before);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export unsaved copy', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('Unsaved_after_abort');
});
test('given quota failure, then memory-only mode keeps editable data and never claims Saved', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
      ?.value as IDBObjectStore['put'];
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === 'documents')
        throw new DOMException('Synthetic quota', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await rename(page, 'Quota preserved');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Storage is full');
  await page.getByRole('button', { name: 'Continue in memory only', exact: true }).click();
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText(
    'Memory only · export to keep',
  );
  await expect(page.locator('.workflow-title strong')).toHaveText('Quota preserved');
});
test('given denied IndexedDB, then explicit memory-only editing and export remain available', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      value: {
        open() {
          throw new DOMException('Denied', 'SecurityError');
        },
      },
      configurable: true,
    });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable');
  await page.getByRole('button', { name: 'Continue in memory only', exact: true }).click();
  await page.getByRole('button', { name: 'Add Note', exact: true }).click();
  await expect(page.getByLabel('Node configuration', { exact: true })).toContainText('text');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
});
test('given malformed, unknown, hostile or oversized imports, then active workflow and storage remain unchanged', async ({
  page,
}) => {
  await start(page);
  await rename(page, 'Import protected');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const before = await records(page);
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  for (const content of [
    '{broken',
    '{"__proto__":{}}',
    '{"schemaVersion":2}',
    JSON.stringify({ ...createSample(), unknown: true }),
    ' '.repeat(LIMITS.MAX_DOCUMENT_BYTES + 1),
  ]) {
    await page.getByLabel('Import workflow JSON', { exact: true }).setInputFiles({
      name: 'hostile.json',
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });
    await expect(
      page.getByRole('dialog', { name: 'Workflows', exact: true }).getByRole('alert'),
    ).toBeVisible();
    expect(await records(page)).toEqual(before);
    await expect(page.locator('.workflow-title strong')).toHaveText('Import protected');
  }
});
test('given valid JSON import/export round trip, then fresh identities preserve content and no runtime state serializes', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByLabel('Import workflow JSON', { exact: true }).setInputFiles({
    name: 'workflow.json',
    mimeType: 'application/json',
    buffer: Buffer.from(canonicalDocument(createSample())),
  });
  await saved(page);
  await expect(page.locator('.workflow-title strong')).toContainText('imported');
  const docs = JSON.stringify(await records(page));
  expect(docs).not.toContain('documentRevision');
  expect(docs).not.toContain('runId');
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await wait;
  expect(download.suggestedFilename()).toMatch(/\.json$/u);
  await download.saveAs(
    (process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage2') +
      '/export-roundtrip.json',
  );
  const decoded = decodeDocument(
    await readFile(
      (process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage2') +
        '/export-roundtrip.json',
    ),
  );
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) throw new Error('Export failed validation');
  const source = createSample();
  expect(
    decoded.value.nodes.map((n) => ({
      type: n.type,
      label: n.label,
      config: n.config,
      position: n.position,
    })),
  ).toEqual(
    source.nodes.map((n) => ({
      type: n.type,
      label: n.label,
      config: n.config,
      position: n.position,
    })),
  );
  expect(decoded.value.nodes.every((n) => !source.nodes.some((old) => old.id === n.id))).toBe(true);
  expect(decoded.value.edges).toHaveLength(source.edges.length);
});
test('given the 100-document cap, then duplicate creation is rejected atomically without eviction', async ({
  page,
}) => {
  await start(page);
  await rename(page, 'Cap protected');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const entries = [];
  for (let i = 0; i < 99; i++) {
    const envelope = await makeEnvelope({ ...createSample(), id: sampleId(5000 + i) }, 1);
    if (!envelope.ok) throw new Error('Fixture failed');
    entries.push(envelope.value);
  }
  await page.evaluate(
    (text) =>
      new Promise<void>((resolve, reject) => {
        const parsed: unknown = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Fixture invalid');
        const open = indexedDB.open('flowcanvas', 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction('documents', 'readwrite');
          parsed.forEach((envelope: unknown) => {
            if (
              !envelope ||
              typeof envelope !== 'object' ||
              !('document' in envelope) ||
              !envelope.document ||
              typeof envelope.document !== 'object' ||
              !('id' in envelope.document) ||
              typeof envelope.document.id !== 'string'
            )
              throw new Error('Fixture invalid');
            tx.objectStore('documents').put(envelope, envelope.document.id);
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(new Error('Fixture failed'));
        };
      }),
    JSON.stringify(entries),
  );
  const before = await records(page);
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate Cap protected', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Workflows', exact: true }).getByRole('alert'),
  ).toContainText('MAX_STORED_DOCUMENTS');
  expect(await records(page)).toEqual(before);
});
test('given versionchange during a blocked upgrade, then connections close and retry preserves the existing database', async ({
  page,
}) => {
  await start(page);
  await rename(page, 'Upgrade protected');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const before = await records(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const request = indexedDB.open('flowcanvas', 2);
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = (event) => {
          event.preventDefault();
          resolve();
        };
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      }),
  );
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Error · not saved');
  expect(await records(page)).toEqual(before);
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await saved(page);
  expect(await records(page)).toEqual(before);
});
test('given switching while a save is slow, then A completes before B opens and reopening A retains its newest content', async ({
  page,
}) => {
  await start(page);
  await rename(page, 'Document A');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (algorithm, data) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return original(algorithm, data);
    };
  });
  await rename(page, 'Document A latest');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByLabel('Workflow title', { exact: true }).fill('Document B');
  await page.getByRole('button', { name: 'Create workflow', exact: true }).click();
  await expect(page.locator('.workflow-title strong')).toHaveText('Document B');
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByRole('button', { name: 'Open Document A latest', exact: true }).click();
  await expect(page.locator('.workflow-title strong')).toHaveText('Document A latest');
});
test('given clipboard denial and context shortcuts, then manual text paste retains internal links with fresh identities', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await start(page);
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Manual Trigger', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select Set Field', exact: true }).check();
  await page.getByRole('heading', { name: 'Graph list', exact: true }).focus();
  await page.keyboard.press('Control+c');
  const text = await page.getByLabel('Selection JSON', { exact: true }).inputValue();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+v');
  await page.getByLabel('Selection JSON', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Paste nodes', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(9);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(7);
  await page.getByRole('heading', { name: 'Graph list', exact: true }).focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('dialog', { name: 'Context actions', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('F6');
  await expect(page.getByRole('heading', { name: 'Properties', exact: true })).toBeFocused();
});
test('given Shift-click multi-selection, then group movement commits once and undo restores both positions', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  const trigger = page.locator('[data-node-type="manualTrigger"]'),
    set = page.locator('[data-node-type="setField"]');
  await trigger.click();
  await set.click({ modifiers: ['Shift'] });
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  const before = await page
    .locator('.react-flow__node.selected')
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ id: n.getAttribute('data-id'), style: n.getAttribute('style') })),
    );
  const box = await trigger.boundingBox();
  if (!box) throw new Error('Missing node');
  await page.mouse.move(box.x + 80, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 50, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(
    await page
      .locator('.react-flow__node.selected')
      .evaluateAll((nodes) =>
        nodes.map((n) => ({ id: n.getAttribute('data-id'), style: n.getAttribute('style') })),
      ),
  ).toEqual(before);
});
test('given a corrupt checksum, then hydration preserves original and explicit verified-backup recovery creates a new workflow', async ({
  page,
}) => {
  await start(page);
  await rename(page, 'Backup first');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await rename(page, 'Before corruption');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('flowcanvas', 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction('documents', 'readwrite'),
            request = tx.objectStore('documents').openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              const raw: unknown = cursor.value;
              if (raw && typeof raw === 'object') cursor.update({ ...raw, sha256: '0'.repeat(64) });
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(new Error('Fixture failed'));
        };
      }),
  );
  const before = await records(page);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Workflows', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recover verified backup as new', exact: true }).click();
  await expect(page.locator('.workflow-title strong')).toHaveText('Backup first copy');
  const after = await records(page);
  expect(JSON.stringify(after)).toContain('0'.repeat(64));
  expect(JSON.stringify(before)).toContain('Before corruption');
});
test('given keyboard movement and input focus, then one held gesture is one undo and text shortcuts remain native', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  const move = page.getByRole('button', {
    name: 'Move About this sample with arrows',
    exact: true,
  });
  await move.click();
  const x = await page.getByLabel('Position X', { exact: true }).inputValue();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('ArrowRight');
  await expect(page.getByLabel('Position X', { exact: true })).toHaveValue(String(Number(x) + 2));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Position X', { exact: true })).toHaveValue(x);
  await page.getByLabel('Node configuration', { exact: true }).focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('invalid draft');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
});
test('given pointer dragging at zoom/pan, then final position is atomic and Escape cancels movement', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  const node = page.locator('[data-node-type="manualTrigger"]');
  await node.click();
  const x = await page.getByLabel('Position X', { exact: true }).inputValue();
  const box = await node.boundingBox();
  if (!box) throw new Error('Node missing');
  await page.mouse.move(box.x + 80, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel('Position X', { exact: true })).not.toHaveValue(x);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Position X', { exact: true })).toHaveValue(x);
  const next = await node.boundingBox();
  if (!next) throw new Error('Node missing');
  await page.mouse.move(next.x + 80, next.y + 20);
  await page.mouse.down();
  await page.mouse.move(next.x + 160, next.y + 40, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Manual Trigger', exact: true }).click();
  await expect(page.getByLabel('Position X', { exact: true })).toHaveValue(x);
});
test('given command and connection dialogs, then focus containment, Escape restoration and axe editor checks pass', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Commands', exact: true }).click();
  await expect(page.getByLabel('Search commands', { exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page
      .getByRole('dialog', { name: 'Command palette' })
      .getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Commands', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Connect nodes', exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test('given legacy theme preference, then migration commits IndexedDB settings before removing the old key', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('flowcanvas.theme.v1', 'light'));
  await start(page);
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('light');
  expect(await page.evaluate(() => localStorage.getItem('flowcanvas.theme.v1'))).toBeNull();
});
test('given native handle dragging, then connect, reconnect and edge deletion share one reversible graph transaction', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByLabel('Workflow title', { exact: true }).fill('Pointer links');
  await page.getByRole('button', { name: 'Create workflow', exact: true }).click();
  for (const [type, x, y] of [
    ['Manual Trigger', 0, 0],
    ['Output', 400, 0],
    ['Manual Trigger', 0, 192],
  ] as const) {
    await page.getByRole('button', { name: `Add ${type}`, exact: true }).click();
    await page.getByLabel('Position X', { exact: true }).fill(String(x));
    await page.getByLabel('Position Y', { exact: true }).fill(String(y));
    const apply = page.getByRole('button', { name: 'Apply', exact: true });
    if (await apply.isEnabled()) await apply.click();
  }
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
      ),
  );
  const sources = page.getByRole('img', { name: 'Manual Trigger output out', exact: true }),
    target = page.getByRole('img', { name: 'Output input in', exact: true });
  const from = await sources.first().boundingBox(),
    to = await target.boundingBox();
  if (!from || !to) throw new Error('Ports unavailable');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  const updater = page.locator('.react-flow__edgeupdater-source');
  await page.mouse.move(
    (from.x + from.width / 2 + to.x + to.width / 2) / 2,
    from.y + from.height / 2,
  );
  const endpoint = await updater.boundingBox(),
    newSource = await sources.nth(1).boundingBox();
  if (!endpoint || !newSource) throw new Error('Reconnect unavailable');
  await page.mouse.move(endpoint.x + endpoint.width * 0.8, endpoint.y + endpoint.height / 2);
  await page.mouse.down();
  await page.mouse.move(newSource.x + newSource.width / 2, newSource.y + newSource.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.mouse.click(
    (from.x + from.width / 2 + to.x + to.width / 2) / 2,
    from.y + from.height / 2,
  );
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});
test('given palette drag-and-drop at a panned and zoomed viewport, then creation converts coordinates and obeys grid snapping', async ({
  page,
}) => {
  await start(page);
  await page.getByLabel('Numeric zoom', { exact: true }).fill('50');
  await expect(page.getByLabel('Canvas zoom', { exact: true })).toHaveText('50%');
  await page.getByRole('button', { name: 'Pan right', exact: true }).click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
      ),
  );
  const transform = await page
    .locator('.react-flow__viewport')
    .evaluate((element) => element.getAttribute('style') ?? '');
  const values = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/u.exec(transform);
  if (!values) throw new Error('Viewport transform missing');
  const expected = {
    x: Math.round((100 - Number(values[1])) / Number(values[3]) / 16) * 16,
    y: Math.round((100 - Number(values[2])) / Number(values[3]) / 16) * 16,
  };
  await page
    .getByRole('button', { name: 'Add Note', exact: true })
    .dragTo(page.locator('.canvas-frame'), { targetPosition: { x: 100, y: 100 } });
  await expect(page.getByLabel('Position X', { exact: true })).toHaveValue(String(expected.x));
  await expect(page.getByLabel('Position Y', { exact: true })).toHaveValue(String(expected.y));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-node-type="note"]')).toHaveCount(1);
});
