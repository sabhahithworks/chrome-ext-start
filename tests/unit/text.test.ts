import { describe, expect, test } from 'vitest';
import { truncateText } from '@/lib/text';

describe('truncateText', () => {
  test('keeps text at limit', () => {
    const r = truncateText('a'.repeat(20000));
    expect(r.truncated).toBe(false);
    expect(r.shown).toBe(20000);
  });

  test('truncates over limit', () => {
    const r = truncateText('a'.repeat(85312));
    expect(r.shown).toBe(20000);
    expect(r.total).toBe(85312);
    expect(r.truncated).toBe(true);
  });

  test('does not split surrogate pair', () => {
    const r = truncateText('a😀b', 2);
    expect(r).toEqual({ text: 'a', shown: 1, total: 4, truncated: true });
  });

  test('empty input', () => {
    expect(truncateText('')).toEqual({ text: '', shown: 0, total: 0, truncated: false });
  });
});
