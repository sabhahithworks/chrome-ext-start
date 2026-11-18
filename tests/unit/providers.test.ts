import { describe, expect, test } from 'vitest';
import { enabledProviders } from '@/lib/auth/providers';

describe('enabledProviders', () => {
  test('excludes disabled provider', () => {
    expect(enabledProviders({ password: false, oauth: false })).toEqual([]);
    expect(enabledProviders({ password: true, oauth: false }).map((p) => p.id)).toEqual([
      'password',
    ]);
    expect(enabledProviders({ password: false, oauth: true }).map((p) => p.id)).toEqual(['oauth']);
  });

  test('lists password before oauth', () => {
    expect(enabledProviders({ password: true, oauth: true }).map((p) => p.id)).toEqual([
      'password',
      'oauth',
    ]);
  });
});
