import { APP_NAME } from '@/config/app.config';
import { t } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';
import { pendingSelectionItem } from '@/lib/storage';
import { truncateText } from '@/lib/text';

const log = createLogger('contextMenu');

export const MENU_SEND_SELECTION = 'send-selection';

export function setupContextMenu(): void {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create(
      {
        id: MENU_SEND_SELECTION,
        title: t('menu.sendSelection', [APP_NAME]),
        contexts: ['selection'],
      },
      () => {
        const err = browser.runtime.lastError;
        if (err) log.error('contextMenus.create failed', { error: err.message });
      },
    );
  });
}

export function handleMenuClick(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab,
): void {
  if (tab?.id === undefined) {
    log.warn('menu click without a tab');
    return;
  }
  browser.sidePanel.open({ tabId: tab.id }).catch((error: unknown) => {
    log.error('sidePanel.open failed', { error });
  });
  void pendingSelectionItem
    .setValue({
      ...truncateText(info.selectionText ?? ''),
      sourceUrl: tab.url,
      createdAt: Date.now(),
    })
    .catch((error: unknown) => {
      log.error('pendingSelection write failed', { error });
    });
}
