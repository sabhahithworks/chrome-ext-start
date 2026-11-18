import { SYNC_ALARM, ensureSyncAlarm, runAlarmJobs } from '@/background/alarms';
import { getAppInfo } from '@/background/handlers';
import { handleCommand } from '@/background/commands';
import { handleMenuClick, setupContextMenu } from '@/background/contextMenu';
import { onMessage } from '@/lib/messaging';
import { createLogger } from '@/lib/logger';

const log = createLogger('background');

export default defineBackground(() => {
  onMessage('getAppInfo', () => getAppInfo());

  browser.contextMenus.onClicked.addListener(handleMenuClick);
  browser.commands.onCommand.addListener(handleCommand);
  setupContextMenu();

  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === SYNC_ALARM) void runAlarmJobs();
  });
  ensureSyncAlarm().catch((error: unknown) => {
    log.error('ensureSyncAlarm failed', { error });
  });

  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e: unknown) => {
    log.error('setPanelBehavior failed', { error: e });
  });
});
