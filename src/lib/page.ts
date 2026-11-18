import { RESTRICTED_URL_PREFIXES } from '@/config/app.config';
import { createLogger } from './logger';
import { readPageInfo } from './page-scripts';
import { truncateText, type Truncated } from './text';

const log = createLogger('page');

export type PageAccessError = 'NO_TAB' | 'NO_ACCESS' | 'RESTRICTED';

export type PageInfoResult =
  | { ok: true; title: string; url: string; selection: Truncated }
  | { ok: false; code: PageAccessError };

export function isRestrictedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return RESTRICTED_URL_PREFIXES.some((prefix) => lower.startsWith(prefix.toLowerCase()));
}

export async function getActiveTab(): Promise<Browser.tabs.Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

export async function getPageInfo(): Promise<PageInfoResult> {
  const tab = await getActiveTab();
  if (tab?.id === undefined) return { ok: false, code: 'NO_TAB' };
  if (tab.url === undefined) return { ok: false, code: 'NO_ACCESS' };
  if (isRestrictedUrl(tab.url)) return { ok: false, code: 'RESTRICTED' };

  let results;
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: readPageInfo,
    });
  } catch (error) {
    log.warn('inject failed', { error });
    return { ok: false, code: 'NO_ACCESS' };
  }
  const info = results[0]?.result;
  if (!info) {
    log.warn('inject returned no result', { results: results.length });
    return { ok: false, code: 'NO_ACCESS' };
  }
  return { ok: true, title: info.title, url: info.url, selection: truncateText(info.selection) };
}
