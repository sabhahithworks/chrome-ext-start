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

test('account menu offers sign in', async ({ page, extensionId }) => {
  await openPanel(page, extensionId);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('ai tab renders a status', async ({ page, extensionId }) => {
  await openPanel(page, extensionId);
  await page.getByRole('tab', { name: 'AI' }).click();
  await expect(
    page.getByText("On-device AI isn't supported in this browser or on this device."),
  ).toBeVisible();
});
