import { createLogger } from './logger';
import { getActiveTab, isRestrictedUrl } from './page';
import { errorMessage } from '@/lib/errorMessage';

const log = createLogger('screenshot');

export type CaptureResult =
  | { ok: true; dataUrl: string }
  | { ok: false; code: 'NO_ACCESS' | 'RESTRICTED' | 'NO_TAB' | 'FAILED'; reason?: string };

export async function captureActiveTab(): Promise<CaptureResult> {
  try {
    const tab = await getActiveTab();
    if (tab?.id === undefined) return { ok: false, code: 'NO_TAB' };
    if (tab.url === undefined) return { ok: false, code: 'NO_ACCESS' };
    if (isRestrictedUrl(tab.url)) return { ok: false, code: 'RESTRICTED' };
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return { ok: true, dataUrl };
  } catch (error) {
    const reason = errorMessage(error);
    log.warn('capture failed', { error: reason });
    if (/permission/i.test(reason)) return { ok: false, code: 'NO_ACCESS', reason };
    return { ok: false, code: 'FAILED', reason };
  }
}
