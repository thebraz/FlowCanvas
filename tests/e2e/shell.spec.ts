import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('given unavailable required capabilities, then startup explains the limitation without opening a document', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', { value: undefined, configurable: true });
  });
  await page.goto('/');
  if (await page.locator('.app-shell').count()) {
    await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
    const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
    if (await manager.isVisible())
      await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await expect(page.getByRole('alert')).toContainText('missing required capabilities');
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
});
test('given a loaded production shell, then canvas interactions make no external or workflow network requests', async ({
  page,
}) => {
  await page.goto('/');
  if (await page.locator('.app-shell').count()) {
    await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
    const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
    if (await manager.isVisible())
      await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await expect(page.locator('.react-flow__node')).toHaveCount(7);
  const requests: string[] = [];
  page.on('request', (request) => {
    requests.push(request.url());
  });
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await page.getByRole('button', { name: 'Graph list', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Condition', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  expect(requests).toEqual([]);
});
test('given the real canvas, then automated accessibility finds no violations', async ({
  page,
}) => {
  await page.goto('/');
  if (await page.locator('.app-shell').count()) {
    await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
    const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
    if (await manager.isVisible())
      await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await expect(page.locator('.react-flow__node')).toHaveCount(7);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
test('given production artifacts, then canonical nodes/edges and real canvas navigation work without errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.name);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push('console-error');
  });
  const response = await page.goto('/');
  if (await page.locator('.app-shell').count()) {
    await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
    const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
    if (await manager.isVisible())
      await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'none'");
  await expect(page.getByRole('heading', { name: 'FlowCanvas' })).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(7);
  await expect(page.locator('.react-flow__edge')).toHaveCount(5);
  for (const type of ['manualTrigger', 'setField', 'pickFields', 'condition', 'output', 'note'])
    await expect(page.locator(`[data-node-type="${type}"]`).first()).toBeVisible();
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  const zoom = page.getByLabel('Canvas zoom');
  const before = await zoom.textContent();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(zoom).not.toHaveText(before ?? '');
  const transform = await page.locator('.react-flow__viewport').getAttribute('style');
  await page.getByRole('button', { name: 'Pan right', exact: true }).click();
  await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute('style', transform ?? '');
  const paneBox = await page.locator('.react-flow__pane').boundingBox();
  const beforeDrag = await page.locator('.react-flow__viewport').getAttribute('style');
  if (!paneBox) throw new Error('Canvas pane is unavailable');
  // Space starts a canvas gesture, not native activation of the last focused pan button.
  await page.getByRole('heading', { name: 'Canvas', exact: true }).focus();
  await page.mouse.move(paneBox.x + 12, paneBox.y + 12);
  await page.keyboard.down('Space');
  await expect(page.locator('.react-flow__pane')).toHaveClass(/\bdraggable\b/u);
  await page.mouse.down();
  await page.mouse.move(paneBox.x + 84, paneBox.y + 32, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect(page.locator('.react-flow__pane')).not.toHaveClass(/\bdraggable\b/u);
  // React Flow switches wheel routing from Space-pan back to zoom in a rendering effect.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute(
    'style',
    beforeDrag ?? '',
  );
  const beforeWheel = await zoom.textContent();
  await page.locator('.react-flow__pane').hover({ position: { x: 50, y: 50 } });
  await page.mouse.wheel(0, -120);
  await expect(zoom).not.toHaveText(beforeWheel ?? '');
  await page.getByRole('button', { name: 'Grid on', exact: true }).click();
  await expect(page.locator('.react-flow__background')).toHaveCount(0);
  await page.getByRole('button', { name: 'Grid off', exact: true }).click();
  await expect(page.locator('.react-flow__background')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await page.locator('[data-node-type="condition"]').click();
  await expect(page.getByLabel('Node configuration')).toContainText('gold');
  expect(errors).toEqual([]);
  // WebKit screenshot preparation injects a stylesheet blocked by the production CSP.
  await page.screenshot({
    caret: 'initial',
    path:
      (process.env.FLOWCANVAS_EVIDENCE_DIR ?? 'docs/reports/evidence/stage2') +
      '/shell-dark-1440.png',
    fullPage: true,
  });
});
test('given keyboard-only navigation, then graph-list inspection and focus remain accessible', async ({
  page,
}) => {
  await page.goto('/');
  if (await page.locator('.app-shell').count()) {
    await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
    const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
    if (await manager.isVisible())
      await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await page.keyboard.press('Tab');
  // Closing the first-run manager restores editor focus; traverse back to the skip link.
  for (let step = 0; step < 100; step++) {
    if (
      await page
        .getByRole('link', { name: 'Skip to editor' })
        .evaluate((el) => el === document.activeElement)
    )
      break;
    await page.keyboard.press('Shift+Tab');
  }
  await expect(page.getByRole('link', { name: 'Skip to editor' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Graph list', exact: true })).toBeVisible();
  const inspect = page.getByRole('button', { name: 'Inspect Condition', exact: true });
  await inspect.focus();
  await page.keyboard.press('Enter');
  await expect(inspect).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Node configuration')).toContainText('gold');
  const focus = await inspect.evaluate((element) => ({
    style: getComputedStyle(element).outlineStyle,
    width: getComputedStyle(element).outlineWidth,
  }));
  expect(focus.style).toBe('solid');
  expect(focus.width).toBe('3px');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
});
test('given theme changes and reload, then saved/System preferences apply and reduced motion is honored', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  if (await page.locator('.app-shell').count()) {
    await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
    const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
    if (await manager.isVisible())
      await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark');
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Theme', { exact: true }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page
      .getByRole('button', { name: 'Graph list', exact: true })
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s');
});
for (const theme of ['dark', 'light'] as const) {
  test(`given 200% text in ${theme} theme, then shell controls and list reflow`, async ({
    page,
  }) => {
    await page.goto('/');
    if (await page.locator('.app-shell').count()) {
      await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
      const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
      if (await manager.isVisible())
        await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    await page.getByRole('button', { name: 'Graph list', exact: true }).click();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Inspect Condition', exact: true }).click();
    await expect(page.getByLabel('Node configuration')).toContainText('gold');
    await page.screenshot({
      caret: 'initial',
      path: `docs/reports/evidence/stage2/text-200-${theme}.png`,
      fullPage: true,
    });
  });
  test(`given ${theme} theme, then shell/list passes automated accessibility checks`, async ({
    page,
  }) => {
    await page.goto('/');
    if (await page.locator('.app-shell').count()) {
      await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
      const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
      if (await manager.isVisible())
        await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    await page.getByRole('button', { name: 'Graph list', exact: true }).click();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      caret: 'initial',
      path: `docs/reports/evidence/stage2/list-${theme}-1440.png`,
      fullPage: true,
    });
  });
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [320, 900],
  ] as const) {
    test(`given ${width}x${height} ${theme} shell, then regions reflow without page overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      if (await page.locator('.app-shell').count()) {
        await expect(page.locator('.app-shell')).toHaveAttribute('data-storage-ready', 'true');
        const manager = page.getByRole('dialog', { name: 'Workflows', exact: true });
        if (await manager.isVisible())
          await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      await page.getByLabel('Theme', { exact: true }).selectOption(theme);
      if (width >= 1024) await page.getByRole('button', { name: 'Fit view', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Properties', exact: true })).toBeVisible();
      if (width < 1024)
        await expect(page.getByRole('heading', { name: 'Graph list', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        caret: 'initial',
        path: `docs/reports/evidence/stage2/shell-${theme}-${width}.png`,
        fullPage: true,
      });
    });
  }
}
