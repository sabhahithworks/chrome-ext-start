import { getAppInfo } from '@/background/handlers';
import { onMessage } from '@/lib/messaging';
import { createLogger } from '@/lib/logger';

const log = createLogger('background');

export default defineBackground(() => {
  onMessage('getAppInfo', () => getAppInfo());

  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e: unknown) => {
    log.error('setPanelBehavior failed', { error: e });
  });
});
