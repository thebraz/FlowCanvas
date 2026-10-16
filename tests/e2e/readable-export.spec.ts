import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { createSample } from '../../src/application/sample';
import { canonicalDocument } from '../../src/domain/json/canonical';
import { decodeDocument } from '../../src/validation/codec';

async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  await page
    .getByRole('dialog', { name: 'Workflows', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
}
async function download(page: Page, label: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const file = await pending,
    path = await file.path();
  expect(file.suggestedFilename()).toMatch(/\.json$/u);
  if (!path) throw new Error('Download missing');
  return readFile(path, 'utf8');
}
function documentFrom(text: string) {
  const decoded = decodeDocument(text);
  if (!decoded.ok) throw new Error('Downloaded workflow rejected');
  return decoded.value;
}
test('given readable export, then actual downloads preserve canonical compatibility and import all graph content', async ({
  page,
}) => {
  await start(page);
  const source = createSample(),
    compact = await download(page, 'Export JSON'),
    readable = await download(page, 'Export readable JSON');
  expect(compact).toBe(canonicalDocument(source));
  expect(compact).not.toContain('\n');
  expect(readable).toContain('{\n  "edges": [\n    {');
  expect(canonicalDocument(documentFrom(readable))).toBe(compact);
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Sample · not saved');
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByLabel('Import workflow JSON', { exact: true }).setInputFiles({
    name: 'readable.json',
    mimeType: 'application/json',
    buffer: Buffer.from(readable),
  });
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  const imported = documentFrom(await download(page, 'Export JSON'));
  expect(imported.id).not.toBe(source.id);
  const originals = [...source.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    copies = [...imported.nodes].sort((a, b) => a.id.localeCompare(b.id));
  expect(copies.map((node, index) => ({ ...node, id: originals[index]?.id }))).toEqual(originals);
  const mapping = new Map(originals.map((node, index) => [node.id, copies[index]?.id]));
  expect(copies.every((node) => !source.nodes.some((old) => old.id === node.id))).toBe(true);
  expect(imported.edges.every((edge) => !source.edges.some((old) => old.id === edge.id))).toBe(
    true,
  );
  expect(
    imported.edges
      .map((edge) => JSON.stringify({ source: edge.source, target: edge.target }))
      .sort(),
  ).toEqual(
    source.edges
      .map((edge) =>
        JSON.stringify({
          source: { ...edge.source, nodeId: mapping.get(edge.source.nodeId) },
          target: { ...edge.target, nodeId: mapping.get(edge.target.nodeId) },
        }),
      )
      .sort(),
  );
  expect(imported.viewport).toEqual(source.viewport);
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  expect(await download(page, 'Export JSON')).toBe(canonicalDocument(imported));
});
test('beta Unicode: valid scalars preserve canonical bytes and lone surrogates never replace saved data', async ({
  page,
}) => {
  await start(page);
  const source = createSample();
  const note = source.nodes.find((node) => node.type === 'note');
  if (!note) throw new Error('Synthetic Note missing');
  const unicode = {
    ...source,
    nodes: source.nodes.map((node) =>
      node.id === note.id ? { ...note, config: { text: 'ASCII café 東京 😀 \uE000' } } : node,
    ),
  };
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByLabel('Import workflow JSON', { exact: true }).setInputFiles({
    name: 'unicode.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(unicode)),
  });
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  const compact = await download(page, 'Export JSON');
  expect(compact).toContain('ASCII café 東京 😀 \uE000');
  expect(canonicalDocument(documentFrom(await download(page, 'Export readable JSON')))).toBe(
    compact,
  );
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  const hostile = {
    ...unicode,
    nodes: unicode.nodes.map((node) =>
      node.id === note.id ? { ...note, config: { text: '\ud800' } } : node,
    ),
  };
  await page.getByLabel('Import workflow JSON', { exact: true }).setInputFiles({
    name: 'invalid-unicode.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(hostile)),
  });
  await expect(
    page.getByRole('dialog', { name: 'Workflows', exact: true }).getByRole('alert'),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Workflows', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  expect(await download(page, 'Export JSON')).toBe(compact);
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  expect(await download(page, 'Export JSON')).toBe(compact);
});

test('given a saved workflow, then both manager export options retain the stored IDs and checksum through reload', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  const compact = await download(page, 'Export JSON'),
    title = documentFrom(compact).metadata.title;
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  expect(await download(page, `Export ${title}`)).toBe(compact);
  const readable = await download(page, `Export readable JSON: ${title}`);
  expect(readable).toContain('\n  "edges":');
  expect(canonicalDocument(documentFrom(readable))).toBe(compact);
  await expect(page.getByRole('dialog', { name: 'Workflows', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
  await expect(page.getByLabel('Save status', { exact: true })).toHaveText('Saved');
  expect(await download(page, 'Export JSON')).toBe(compact);
});
test('given pending inspector edits, then readable export resolves the draft before downloading', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Set Field', exact: true }).click();
  await page.getByLabel('Node label', { exact: true }).fill('Uncommitted label');
  await page.getByRole('button', { name: 'Export readable JSON', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Unsaved inspector edits', exact: true });
  await expect(dialog).toBeVisible();
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Discard draft and continue', exact: true }).click();
  const path = await (await pending).path();
  if (!path) throw new Error('Download missing');
  expect(canonicalDocument(documentFrom(await readFile(path, 'utf8')))).toBe(
    canonicalDocument(createSample()),
  );
});
for (const width of [320, 1440])
  for (const theme of ['dark', 'light']) {
    test(`given ${width}px ${theme} editor, then readable export controls reflow and remain accessible`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await start(page);
      await page.getByLabel('Theme', { exact: true }).selectOption(theme);
      await expect(
        page.getByRole('button', { name: 'Export readable JSON', exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect(
        (await new AxeBuilder({ page }).include('.save-controls').analyze()).violations,
      ).toEqual([]);
    });
  }
