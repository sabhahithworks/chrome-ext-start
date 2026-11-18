import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { passwordProvider } from '@/lib/auth/passwordProvider';
import { AuthError } from '@/lib/auth/types';

const fetchImpl = vi.fn<typeof fetch>();

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    getApi: () => actual.createApiClient({ baseUrl: 'https://api.test', fetchImpl }),
  };
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const okBody = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 };

describe('passwordProvider', () => {
  beforeEach(() => {
    fetchImpl.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('maps 401 to BAD_CREDENTIALS', async () => {
    fetchImpl.mockResolvedValue(json({}, 401));
    const err = await passwordProvider
      .signIn({ email: 'a@b.co', password: 'x' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('BAD_CREDENTIALS');
  });

  test('computes expiresAt from expiresIn', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(t0);
    fetchImpl.mockResolvedValue(json(okBody));
    const tokens = await passwordProvider.signIn({ email: 'a@b.co', password: 'x' });
    expect(tokens).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: t0 + 3600000 });
  });

  test('trims email not password', async () => {
    fetchImpl.mockResolvedValue(json(okBody));
    await passwordProvider.signIn({ email: '  a@b.co ', password: ' p ' });
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'a@b.co', password: ' p ' });
  });

  test('maps invalid body to INVALID_RESPONSE', async () => {
    fetchImpl.mockResolvedValue(json({ accessToken: 'a' }));
    const err = await passwordProvider
      .signIn({ email: 'a@b.co', password: 'x' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('INVALID_RESPONSE');
  });

  test('maps refresh 401 to INVALID_GRANT', async () => {
    fetchImpl.mockResolvedValue(json({}, 401));
    const err = await passwordProvider.refresh('r').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('INVALID_GRANT');
  });
});
