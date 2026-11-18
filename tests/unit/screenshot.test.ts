import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { captureActiveTab } from '@/lib/screenshot';

const fb = fakeBrowser as unknown as {
  tabs: { query: (...a: unknown[]) => unknown; captureVisibleTab?: (...a: unknown[]) => unknown };
};

function stubCapture(impl: () => Promise<string>) {
  vi.spyOn(fb.tabs, 'query').mockResolvedValue([
    { id: 1, windowId: 7, url: 'https://example.com/' },
  ] as never);
  fb.tabs.captureVisibleTab = vi.fn(impl);
}

describe('captureActiveTab', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
  });

  test('maps permission error to NO_ACCESS', async () => {
    stubCapture(() => Promise.reject(new Error("Either the '<all_urls>' permission is required")));
    const result = await captureActiveTab();
    expect(result).toEqual({
      ok: false,
      code: 'NO_ACCESS',
      reason: "Either the '<all_urls>' permission is required",
    });
  });

  test('maps other error to FAILED with reason', async () => {
    stubCapture(() => Promise.reject(new Error('boom')));
    expect(await captureActiveTab()).toEqual({ ok: false, code: 'FAILED', reason: 'boom' });
  });

  test('returns data url on success', async () => {
    stubCapture(() => Promise.resolve('data:image/png;base64,AAAA'));
    expect(await captureActiveTab()).toEqual({ ok: true, dataUrl: 'data:image/png;base64,AAAA' });
    expect(fb.tabs.captureVisibleTab).toHaveBeenCalledWith(7, { format: 'png' });
  });
});
