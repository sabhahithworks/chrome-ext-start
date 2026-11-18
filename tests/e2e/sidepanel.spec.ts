import { expect, openPanel, test } from './fixtures';

test('panel renders app name', async ({ page, extensionId }) => {
  await openPanel(page, extensionId);
  expect(page.viewportSize()).toEqual({ width: 320, height: 720 });
  await expect(page.getByRole('heading', { name: 'Side Panel Starter' })).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`shows background status (${colorScheme})`, async ({ page, extensionId }) => {
    await page.emulateMedia({ colorScheme });
    await openPanel(page, extensionId);
    expect(page.viewportSize()).toEqual({ width: 320, height: 720 });
    await expect(page.getByText('Connected to background · v0.1.0')).toBeVisible();
  });
}

test('dark theme persists across reload', async ({ page, extensionId }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openPanel(page, extensionId);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
