import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getPageInfo } from '@/lib/page';

const fb = fakeBrowser as unknown as {
  tabs: { query: (...a: unknown[]) => unknown };
  scripting: { executeScript: (...a: unknown[]) => unknown };
};

function stubTab(tab: { id?: number; url?: string }) {
  vi.spyOn(fb.tabs, 'query').mockResolvedValue([tab] as never);
}

describe('getPageInfo', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    (fb as { scripting?: unknown }).scripting ??= {
      executeScript: () => Promise.resolve([]),
    };
    vi.restoreAllMocks();
  });

  test('maps missing url to NO_ACCESS', async () => {
    stubTab({ id: 1 });
    expect(await getPageInfo()).toEqual({ ok: false, code: 'NO_ACCESS' });
  });

  test('detects restricted url case-insensitively', async () => {
    stubTab({ id: 1, url: 'CHROME://settings' });
    expect(await getPageInfo()).toEqual({ ok: false, code: 'RESTRICTED' });
  });

  test('maps inject failure to NO_ACCESS', async () => {
    stubTab({ id: 1, url: 'https://example.com/' });
    vi.spyOn(fb.scripting, 'executeScript').mockRejectedValue(new Error('denied'));
    expect(await getPageInfo()).toEqual({ ok: false, code: 'NO_ACCESS' });
  });

  test('maps empty inject result to NO_ACCESS', async () => {
    stubTab({ id: 1, url: 'https://example.com/' });
    vi.spyOn(fb.scripting, 'executeScript').mockResolvedValue([] as never);
    expect(await getPageInfo()).toEqual({ ok: false, code: 'NO_ACCESS' });
  });

  test('maps undefined inject result to NO_ACCESS', async () => {
    stubTab({ id: 1, url: 'https://example.com/' });
    vi.spyOn(fb.scripting, 'executeScript').mockResolvedValue([{ result: undefined }] as never);
    expect(await getPageInfo()).toEqual({ ok: false, code: 'NO_ACCESS' });
  });

  test('returns info with truncated selection', async () => {
    stubTab({ id: 1, url: 'https://example.com/' });
    vi.spyOn(fb.scripting, 'executeScript').mockResolvedValue([
      { result: { title: 'Example', url: 'https://example.com/', selection: 'x'.repeat(30000) } },
    ] as never);
    const r = await getPageInfo();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.title).toBe('Example');
      expect(r.url).toBe('https://example.com/');
      expect(r.selection.shown).toBe(20000);
      expect(r.selection.total).toBe(30000);
    }
  });
});
