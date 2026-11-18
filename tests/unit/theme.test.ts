import { describe, expect, test } from 'vitest';
import { resolveTheme } from '@/lib/theme';

describe('resolveTheme', () => {
  test('resolves system to dark when preferred', () => {
    expect(resolveTheme('system', true)).toBe('dark');
  });

  test('explicit light ignores preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });
});
