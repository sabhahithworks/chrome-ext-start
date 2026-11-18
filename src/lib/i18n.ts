import { createI18n } from '@wxt-dev/i18n';
import type { GeneratedI18nStructure } from '#i18n';
import { createLogger } from './logger';

export type MessageKey = keyof GeneratedI18nStructure;

export const i18n = createI18n();

const log = createLogger('i18n');

export function t(key: MessageKey, subs?: (string | number)[]): string {
  const text = subs && subs.length > 0 ? i18n.t(key, subs) : i18n.t(key);
  if (text === '') {
    log.warn('missing message', { key });
    return key;
  }
  return text;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}
