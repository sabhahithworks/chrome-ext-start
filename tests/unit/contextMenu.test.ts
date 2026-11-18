import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { handleMenuClick } from '@/background/contextMenu';
import { pendingSelectionItem, readPendingSelection } from '@/lib/storage';

const tab = { id: 7, url: 'https://example.com/' } as Browser.tabs.Tab;
const click = (text: string) => ({ selectionText: text }) as Browser.contextMenus.OnClickData;

function stubOpen(calls: string[]) {
  const open = vi.fn(() => {
    calls.push('open');
    return Promise.resolve();
  });
  Object.assign(fakeBrowser, { sidePanel: { open } });
  return open;
}

describe('handleMenuClick', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('opens panel before writing selection', () => {
    const calls: string[] = [];
    const open = stubOpen(calls);
    vi.spyOn(pendingSelectionItem, 'setValue').mockImplementation(() => {
      calls.push('set');
      return Promise.resolve();
    });
    handleMenuClick(click('hi'), tab);
    expect(calls).toEqual(['open', 'set']);
    expect(open).toHaveBeenCalledWith({ tabId: 7 });
  });

  test('latest selection wins', async () => {
    stubOpen([]);
    handleMenuClick(click('first'), tab);
    await new Promise((r) => setTimeout(r, 10));
    handleMenuClick(click('second'), tab);
    await new Promise((r) => setTimeout(r, 10));
    const stored = await readPendingSelection();
    expect(stored?.text).toBe('second');
    expect(stored?.sourceUrl).toBe('https://example.com/');
  });

  test('truncates sent selection', async () => {
    stubOpen([]);
    handleMenuClick(click('a'.repeat(25_000)), tab);
    await new Promise((r) => setTimeout(r, 10));
    const stored = await readPendingSelection();
    expect(stored?.shown).toBe(20_000);
    expect(stored?.total).toBe(25_000);
    expect(stored?.truncated).toBe(true);
  });

  test('ignores click without tab', async () => {
    const calls: string[] = [];
    const open = stubOpen(calls);
    handleMenuClick(click('hi'), undefined);
    await new Promise((r) => setTimeout(r, 10));
    expect(open).not.toHaveBeenCalled();
    expect(await readPendingSelection()).toBeNull();
  });
});
