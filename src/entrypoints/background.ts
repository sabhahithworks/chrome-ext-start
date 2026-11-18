import { createLogger } from '@/lib/logger';

const log = createLogger('background');

export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e: unknown) => {
    log.error('setPanelBehavior failed', { error: e });
  });
});
