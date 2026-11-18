import { createLogger } from '@/lib/logger';

const log = createLogger('commands');

export const CMD_OPEN_PANEL = 'open-side-panel';

export function handleCommand(command: string, tab?: Browser.tabs.Tab): void {
  if (command !== CMD_OPEN_PANEL) return;
  if (tab === undefined) {
    log.warn('command without a tab', { command });
    return;
  }
  browser.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => {
    log.error('sidePanel.open failed', { error });
  });
}
