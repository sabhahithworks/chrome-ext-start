import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { viewport: { width: 320, height: 720 } },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
});
