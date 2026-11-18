import { expect, test } from 'vitest';
import { errorMessage, reasonText } from '@/lib/errorMessage';
import { cn } from '@/lib/utils';

test('cn merges conflicting tailwind classes', () => {
  expect(cn('px-2', 'px-4')).toBe('px-4');
  expect(cn('a', false, 'b')).toBe('a b');
});

test('errorMessage reads Error messages and stringifies the rest', () => {
  expect(errorMessage(new Error('boom'))).toBe('boom');
  expect(errorMessage('plain')).toBe('plain');
  expect(errorMessage(42)).toBe('42');
});

test('reasonText drops a trailing period so templates do not double it', () => {
  expect(reasonText(new Error('Page could not be loaded. '))).toBe('Page could not be loaded');
  expect(reasonText('no period')).toBe('no period');
});
