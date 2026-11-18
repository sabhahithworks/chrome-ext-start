import { createLogger } from '@/lib/logger';
import { accessGrantItem } from '@/lib/storage';

const log = createLogger('commands');

export const CMD_OPEN_PANEL = 'open-side-panel';

export function handleCommand(command: string, tab?: Browser.tabs.Tab): void {
  if (command !== CMD_OPEN_PANEL) return;
  if (tab === undefined) {
    log.warn('command without a tab', { command });
    return;
  }
  // Open first, with nothing awaited before it, so the user gesture is kept (D26).
  browser.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => {
    log.error('sidePanel.open failed', { error });
  });
  // The shortcut granted activeTab on this tab: tell an open Page screen to re-read it.
  accessGrantItem.setValue(Date.now()).catch((error: unknown) => {
    log.error('accessGrant write failed', { error });
  });
}
