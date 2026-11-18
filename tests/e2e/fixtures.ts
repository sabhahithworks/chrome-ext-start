import { existsSync } from 'node:fs';
import path from 'node:path';
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';

const extensionPath = path.resolve(import.meta.dirname, '../../.output/chrome-mv3');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({ viewport }, provide) => {
    if (!existsSync(extensionPath)) {
      throw new Error(`build missing: run wxt build (${extensionPath})`);
    }
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      viewport,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await provide(context);
    await context.close();
  },
  extensionId: async ({ context }, provide) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await provide(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

export async function openPanel(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
}
