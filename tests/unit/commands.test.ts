import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CMD_OPEN_PANEL, handleCommand } from '@/background/commands';
import { accessGrantItem } from '@/lib/storage';

const tab = { id: 7, windowId: 3, url: 'https://example.com/' } as Browser.tabs.Tab;

describe('handleCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('opens the panel before recording the access grant', async () => {
    const calls: string[] = [];
    const open = vi.fn(() => {
      calls.push('open');
      return Promise.resolve();
    });
    Object.assign(fakeBrowser, { sidePanel: { open } });
    vi.spyOn(accessGrantItem, 'setValue').mockImplementation((v) => {
      calls.push(`grant:${String(v)}`);
      return Promise.resolve();
    });
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    handleCommand(CMD_OPEN_PANEL, tab);
    await vi.waitFor(() => {
      expect(calls).toEqual(['open', 'grant:1234']);
    });
    expect(open).toHaveBeenCalledWith({ windowId: 3 });
  });

  test('ignores other commands', () => {
    const open = vi.fn(() => Promise.resolve());
    Object.assign(fakeBrowser, { sidePanel: { open } });
    const set = vi.spyOn(accessGrantItem, 'setValue');
    handleCommand('something-else', tab);
    expect(open).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
