import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ALL_SITES_ORIGINS } from '@/config/app.config';
import { hasAllSitesAccess, requestAllSitesAccess, watchSiteAccess } from '@/lib/siteAccess';

function stubPermissions(granted: boolean) {
  const added = new Set<() => void>();
  const permissions = {
    contains: vi.fn(() => Promise.resolve(granted)),
    request: vi.fn(() => Promise.resolve(granted)),
    onAdded: {
      addListener: (cb: () => void) => added.add(cb),
      removeListener: (cb: () => void) => added.delete(cb),
    },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  };
  Object.assign(fakeBrowser, { permissions });
  return { permissions, added };
}

describe('site access', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('checks and requests all-sites access by origin', async () => {
    const { permissions } = stubPermissions(true);
    expect(await hasAllSitesAccess()).toBe(true);
    expect(await requestAllSitesAccess()).toBe(true);
    expect(permissions.contains).toHaveBeenCalledWith({ origins: [...ALL_SITES_ORIGINS] });
    expect(permissions.request).toHaveBeenCalledWith({ origins: [...ALL_SITES_ORIGINS] });
  });

  test('reports a declined request as false', async () => {
    stubPermissions(false);
    expect(await requestAllSitesAccess()).toBe(false);
    expect(await hasAllSitesAccess()).toBe(false);
  });

  test('watch notifies on a grant and unsubscribes', () => {
    const { added } = stubPermissions(true);
    const cb = vi.fn();
    const stop = watchSiteAccess(cb);
    added.forEach((l) => {
      l();
    });
    expect(cb).toHaveBeenCalledTimes(1);
    stop();
    expect(added.size).toBe(0);
  });
});
