import { describe, expect, test } from 'vitest';
import { enabledProviders } from '@/lib/auth/providers';

describe('enabledProviders', () => {
  test('excludes disabled provider', () => {
    expect(enabledProviders({ password: false, oauth: false })).toEqual([]);
    expect(enabledProviders({ password: true, oauth: false }).map((p) => p.id)).toEqual([
      'password',
    ]);
  });
});
