import { test, expect } from '@playwright/test';
import { LIMITS } from '../../src/contracts/limits';
const harness = 'http://127.0.0.1:4176/tests/performance/stage3.html';
test('given delayed real worker operations, then Pause acknowledges a boundary and Resume preserves execution', async ({
  page,
}) => {
  await page.goto(harness);
  await page.evaluate(() => window.flowcanvasRuntime.startFixture('delay'));
  await expect
    .poll(() => page.evaluate(() => window.flowcanvasRuntime.summary().operations))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('paused');
  const before = await page.evaluate(() => window.flowcanvasRuntime.summary().operations);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.flowcanvasRuntime.summary().operations)).toBe(before);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('completed');
});
for (const mode of ['hang', 'blocked'] as const)
  test(`given a test-only ${mode} worker, then foreground cancellation terminates it within target`, async ({
    page,
  }) => {
    await page.goto(harness);
    await page.evaluate((mode) => window.flowcanvasRuntime.startFixture(mode), mode);
    await expect
      .poll(() => page.evaluate(() => window.flowcanvasRuntime.summary().operations))
      .toBe(1);
    if (mode === 'blocked') await page.evaluate(() => window.flowcanvasRuntime.floodControls());
    const result = await page.evaluate(() => window.flowcanvasRuntime.stop());
    expect(result.status).toBe('cancelled');
    expect(result.elapsedMs).toBeLessThanOrEqual(LIMITS.CANCEL_COMPLETION_MS);
    expect(result.workersTerminated).toBe(result.workersCreated);
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => window.flowcanvasRuntime.summary().status)).toBe('cancelled');
  });
test('given an indefinitely blocked operation, then the independent host watchdog terminates the real worker', async ({
  page,
}) => {
  await page.goto(harness);
  await page.evaluate(() => window.flowcanvasRuntime.startFixture('blocked'));
  const result = await page.evaluate(() => window.flowcanvasRuntime.terminal());
  expect(result.status).toBe('failed');
  expect(result.error?.code).toBe('OPERATION_TIMEOUT');
  const summary = await page.evaluate(() => window.flowcanvasRuntime.summary());
  expect(summary.workersCreated).toBe(summary.workersTerminated);
});
test('given a real worker crash, then failure preserves the editor and supports a fresh production run', async ({
  page,
}) => {
  await page.goto(harness);
  await page.evaluate(() => window.flowcanvasRuntime.startFixture('crash'));
  const result = await page.evaluate(() => window.flowcanvasRuntime.terminal());
  expect(result.status).toBe('failed');
  expect(result.error?.code).toBe('WORKER_FAILED');
  await page.evaluate(() => window.flowcanvasRuntime.startFixture('production'));
  await expect(page.getByTestId('run-status')).toHaveText('completed');
});
test('given 50 real open/run/reset cycles, then no inactive workers or payload registries remain', async ({
  page,
}) => {
  await page.goto(harness);
  const result = await page.evaluate(() => window.flowcanvasRuntime.cycles(50));
  expect(result.status).toBe('idle');
  expect(result.payloads).toBe(0);
  expect(result.events).toBe(0);
  expect(result.workersCreated).toBe(result.workersTerminated);
});
