import { test, expect, type Page } from '@playwright/test';
import { createSample, sampleId } from '../../src/application/sample';
import { makeEnvelope } from '../../src/adapters/persistence/indexeddb';

async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  await page
    .getByRole('dialog', { name: 'Workflows', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
}
async function rename(page: Page, title: string) {
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Workflow name', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Apply name', exact: true }).click();
}
async function records(page: Page, id: string) {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('flowcanvas', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Synthetic database open failed'));
    });
    try {
      return await new Promise<{ document: unknown; backup: unknown }>((resolve, reject) => {
        const tx = db.transaction(['documents', 'backups'], 'readonly');
        const document = tx.objectStore('documents').get(key),
          backup = tx.objectStore('backups').get(key);
        tx.oncomplete = () => {
          const documentValue: unknown = document.result,
            backupValue: unknown = backup.result;
          resolve({ document: documentValue, backup: backupValue });
        };
        tx.onabort = () => reject(new Error('Synthetic database read failed'));
      });
    } finally {
      db.close();
    }
  }, id);
}

test('audit: a miskeyed checksummed record cannot overwrite the corrupt original or verified backup in real storage', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  await rename(page, 'Before corruption');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  const sample = createSample(),
    before = await records(page, sample.id);
  const misplaced = await makeEnvelope({ ...sample, id: sampleId(9999) }, 2);
  if (!misplaced.ok) throw new Error('Synthetic envelope failed');
  const misplacedValue: unknown = misplaced.value;
  await page.evaluate(
    async ({ key, value }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('flowcanvas', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Synthetic database open failed'));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('documents', 'readwrite');
          tx.objectStore('documents').put(value, key);
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(new Error('Synthetic corruption setup failed'));
        });
      } finally {
        db.close();
      }
    },
    { key: sample.id, value: misplacedValue },
  );
  await rename(page, 'Unsaved recovery');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Error · not saved');
  await expect(page.locator('.workflow-title')).toContainText('Unsaved recovery');
  expect(await records(page, sample.id)).toEqual({
    document: misplaced.value,
    backup: before.backup,
  });
});

test('audit accessibility: rejected connection focuses the linked error without changing graph', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Connect nodes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create connection', exact: true });
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeFocused();
  await expect(dialog.getByLabel('Target node')).toHaveAttribute(
    'aria-describedby',
    'connection-error',
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(5);
});
