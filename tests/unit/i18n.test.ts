import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const D35_KEYS = [
  'page.noAccess',
  'page.restricted',
  'page.noSelection',
  'text.truncated',
  'common.retry',
  'common.loading',
  'home.connected',
  'home.bgDown',
  'errors.screen',
  'errors.reload',
  'api.network',
  'api.timeout',
  'api.server',
  'api.invalid',
  'auth.expired',
  'auth.required',
  'auth.badCredentials',
  'auth.cancelled',
  'auth.failed',
  'ai.unavailable',
  'ai.download',
  'ai.downloading',
  'ai.failed',
  'shot.failed',
  'shot.download',
  'menu.sendSelection',
];

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node !== null && typeof node === 'object') {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
}

const en: unknown = parse(readFileSync('src/locales/en.yml', 'utf8'));

describe('en.yml', () => {
  test('every D35 key exists', () => {
    expect(D35_KEYS).toHaveLength(26);
    for (const key of D35_KEYS) {
      const value = lookup(en, key);
      expect(typeof value, key).toBe('string');
      expect((value as string).length, key).toBeGreaterThan(0);
    }
  });

  test('page.noAccess text is exact', () => {
    expect(lookup(en, 'page.noAccess')).toBe(
      "Can't access this page yet. Click the extension icon or press Alt+Shift+S, then Retry. Browser pages like settings or the extension store can't be read.",
    );
  });
});
