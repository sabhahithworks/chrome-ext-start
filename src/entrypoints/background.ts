import { SYNC_ALARM, ensureSyncAlarm, registerAlarmJob, runAlarmJobs } from '@/background/alarms';
import { getAppInfo } from '@/background/handlers';
import { handleCommand } from '@/background/commands';
import { handleMenuClick, setupContextMenu } from '@/background/contextMenu';
import { registerEnabledProviders } from '@/lib/auth/providers';
import { refreshIfExpiringBeforeNextAlarm, refreshInBackground } from '@/lib/auth/session';
import { onMessage } from '@/lib/messaging';
import { createLogger } from '@/lib/logger';

const log = createLogger('background');

registerEnabledProviders();

export default defineBackground(() => {
  onMessage('getAppInfo', () => getAppInfo());
  onMessage('refreshSession', () => refreshInBackground());
  registerAlarmJob('auth-refresh', refreshIfExpiringBeforeNextAlarm);

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
