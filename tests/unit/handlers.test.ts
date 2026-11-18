import { afterEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getAppInfo } from '@/background/handlers';

describe('handlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getAppInfo returns name and version', () => {
    vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
      manifest_version: 3,
      name: 'x',
      version: '1.2.3',
    });
    const info = getAppInfo();
    expect(info.name).toBe('Side Panel Starter');
    expect(info.version).toBe('1.2.3');
  });
});
