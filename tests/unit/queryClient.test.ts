import { describe, expect, test } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { queryClient } from '@/lib/queryClient';

type RetryFn = (count: number, err: unknown) => boolean;

function queryRetry(): RetryFn {
  const retry = queryClient.getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') throw new Error('retry is not a function');
  return retry as RetryFn;
}

describe('queryClient defaults', () => {
  test('retries query once on 5xx', () => {
    const err = new ApiError('HTTP', '/a', 503);
    expect(queryRetry()(0, err)).toBe(true);
    expect(queryRetry()(1, err)).toBe(false);
  });

  test('does not retry mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });

  test('does not retry 4xx', () => {
    expect(queryRetry()(0, new ApiError('HTTP', '/a', 404))).toBe(false);
  });
});
