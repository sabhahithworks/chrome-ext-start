import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient, type AuthHooks } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

const schema = z.object({ id: z.number() });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

async function caught(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected rejection');
}

function hooks(
  refresh: boolean,
  onSessionExpired = vi.fn<() => void>(),
  signedIn = true,
): AuthHooks {
  return {
    getAccessToken: () => Promise.resolve('tok'),
    refresh: () => Promise.resolve(refresh),
    isSignedIn: () => Promise.resolve(signedIn),
    onSessionExpired,
  };
}

describe('api client', () => {
  test('maps abort to TIMEOUT', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('t', 'TimeoutError'));
    const api = createApiClient({ baseUrl: 'https://x.test', fetchImpl });
    const e = await caught(api.request('/a', { schema }));
    expect(e.code).toBe('TIMEOUT');
    expect(e.path).toBe('/a');
  });

  test('maps schema failure to INVALID_RESPONSE', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: 'nope' }));
    const api = createApiClient({ baseUrl: 'https://x.test', fetchImpl });
    const e = await caught(api.request('/a', { schema }));
    expect(e.code).toBe('INVALID_RESPONSE');
  });

  test('retries once after refresh', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ id: 7 }));
    const api = createApiClient({ baseUrl: 'https://x.test', fetchImpl, auth: hooks(true) });
    expect(await api.request('/a', { schema, auth: true })).toEqual({ id: 7 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('second 401 expires session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 401));
    const onSessionExpired = vi.fn<() => void>();
    const auth = hooks(true, onSessionExpired);
    const api = createApiClient({ baseUrl: 'https://x.test', fetchImpl, auth });
    const e = await caught(api.request('/a', { schema, auth: true }));
    expect(e.code).toBe('UNAUTHORIZED');
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('transient refresh failure keeps the session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 401));
    const onSessionExpired = vi.fn<() => void>();
    const api = createApiClient({
      baseUrl: 'https://x.test',
      fetchImpl,
      auth: hooks(false, onSessionExpired, true),
    });
    const e = await caught(api.request('/a', { schema, auth: true }));
    expect(e.code).toBe('NETWORK');
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('rejected refresh reports UNAUTHORIZED once', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 401));
    const onSessionExpired = vi.fn<() => void>();
    const api = createApiClient({
      baseUrl: 'https://x.test',
      fetchImpl,
      auth: hooks(false, onSessionExpired, false),
    });
    const e = await caught(api.request('/a', { schema, auth: true }));
    expect(e.code).toBe('UNAUTHORIZED');
    // The background already signed out and flagged expiry when it saw the rejection.
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  test('maps 503 to HTTP with status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 503));
    const api = createApiClient({ baseUrl: 'https://x.test', fetchImpl });
    const e = await caught(api.request('/a', { schema }));
    expect(e.code).toBe('HTTP');
    expect(e.status).toBe(503);
  });
});
