import { expect, openPanel, test } from './fixtures';

test('panel renders app name', async ({ page, extensionId }) => {
  await openPanel(page, extensionId);
  expect(page.viewportSize()).toEqual({ width: 320, height: 720 });
  await expect(page.getByRole('heading', { name: 'Side Panel Starter' })).toBeVisible();
});
