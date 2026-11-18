import { beforeEach, describe, expect, test } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, readSettings, writeSettings } from '@/lib/storage';

describe('settings storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  test('returns defaults when empty', async () => {
    expect(await readSettings()).toEqual({ theme: 'system' });
  });

  test('falls back on invalid settings', async () => {
    await fakeBrowser.storage.local.set({ settings: { theme: 'neon' } });
    expect(await readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('writeSettings merges patch', async () => {
    const next = await writeSettings({ theme: 'dark' });
    expect(next.theme).toBe('dark');
    expect((await readSettings()).theme).toBe('dark');
  });
});
