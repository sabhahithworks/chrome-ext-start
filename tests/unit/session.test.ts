// @vitest-environment node
// The background worker has no `window`; the node environment models it. Panel tests stub `window`.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import {
  getAccessToken,
  isBackgroundContext,
  refresh,
  refreshIfExpiringBeforeNextAlarm,
  refreshInBackground,
  registerProvider,
  resetSessionForTest,
  saveTokens,
  signOut,
} from '@/lib/auth/session';
import { AuthError, type AuthProvider, type Tokens } from '@/lib/auth/types';
import { sendMessage } from '@/lib/messaging';
import { readAccess, readRefresh, refreshItem, sessionExpiredItem } from '@/lib/storage';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

const SEC = 1000;
const MIN = 60 * SEC;

const refreshMock = vi.fn<(refreshToken: string) => Promise<Tokens>>();
const signOutMock = vi.fn<(refreshToken: string) => Promise<void>>();

function makeProvider(): AuthProvider {
  return {
    id: 'password',
    labelKey: 'auth.expired',
    signIn: vi.fn<() => Promise<Tokens>>(),
    refresh: refreshMock,
    signOut: signOutMock,
  };
}

async function seed(accessExpiresInMs: number): Promise<void> {
  await saveTokens('password', {
    accessToken: 'access-old',
    refreshToken: 'refresh-old',
    expiresAt: Date.now() + accessExpiresInMs,
  });
}

function nextTokens(): Tokens {
  return {
    accessToken: 'access-new',
    refreshToken: 'refresh-new',
    expiresAt: Date.now() + 60 * MIN,
  };
}

describe('auth session', () => {
  beforeEach(() => {
    resetSessionForTest();
    refreshMock.mockReset();
    signOutMock.mockReset();
    registerProvider(makeProvider());
    vi.mocked(sendMessage).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('runs as background without window', () => {
    expect(isBackgroundContext()).toBe(true);
  });

  test('single-flight refresh', async () => {
    await seed(10 * SEC);
    let release: (t: Tokens) => void = () => undefined;
    refreshMock.mockImplementation(
      () =>
        new Promise<Tokens>((resolve) => {
          release = resolve;
        }),
    );
    const calls = [refreshInBackground(), refreshInBackground(), refreshInBackground()];
    await vi.waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    release(nextTokens());
    expect(await Promise.all(calls)).toEqual([true, true, true]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledWith('refresh-old');
    expect(await readRefresh()).toEqual({ refreshToken: 'refresh-new', provider: 'password' });

    // The in-flight promise is cleared, so a later call refreshes again.
    refreshMock.mockResolvedValue(nextTokens());
    expect(await refreshInBackground()).toBe(true);
    expect(refreshMock).toHaveBeenCalledTimes(2);
    expect(refreshMock).toHaveBeenLastCalledWith('refresh-new');
  });

  test('refreshes within skew window', async () => {
    refreshMock.mockResolvedValue(nextTokens());
    await seed(30 * SEC);
    expect(await getAccessToken()).toBe('access-new');
    expect(refreshMock).toHaveBeenCalledTimes(1);

    refreshMock.mockClear();
    await seed(10 * MIN);
    expect(await getAccessToken()).toBe('access-old');
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test('refreshes when access missing after restart', async () => {
    await refreshItem.setValue({ refreshToken: 'refresh-old', provider: 'password' });
    expect(await readAccess()).toBeNull();
    refreshMock.mockResolvedValue(nextTokens());
    expect(await getAccessToken()).toBe('access-new');
    expect(refreshMock).toHaveBeenCalledWith('refresh-old');
    expect((await readAccess())?.accessToken).toBe('access-new');
  });

  test('alarm job refreshes within alarm period', async () => {
    refreshMock.mockResolvedValue(nextTokens());
    await seed(10 * MIN);
    await refreshIfExpiringBeforeNextAlarm();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect((await readAccess())?.accessToken).toBe('access-new');

    refreshMock.mockClear();
    await seed(30 * MIN);
    await refreshIfExpiringBeforeNextAlarm();
    expect(refreshMock).not.toHaveBeenCalled();
    expect((await readAccess())?.accessToken).toBe('access-old');
  });

  test('failed refresh clears tokens and flags expiry', async () => {
    await seed(10 * SEC);
    refreshMock.mockRejectedValue(new AuthError('INVALID_GRANT'));
    expect(await refreshInBackground()).toBe(false);
    expect(await readAccess()).toBeNull();
    expect(await readRefresh()).toBeNull();
    expect(await sessionExpiredItem.getValue()).toBe(true);
  });

  test('keeps tokens on transient refresh failure', async () => {
    await seed(10 * SEC);
    const before = { access: await readAccess(), refresh: await readRefresh() };
    refreshMock.mockRejectedValue(new ApiError('NETWORK', '/auth/refresh'));
    expect(await refreshInBackground()).toBe(false);
    expect(await readAccess()).toEqual(before.access);
    expect(await readRefresh()).toEqual({ refreshToken: 'refresh-old', provider: 'password' });
    expect(await sessionExpiredItem.getValue()).toBe(false);
    // The access token has not expired yet, so it is still handed out.
    expect(await getAccessToken()).toBe('access-old');
  });

  test('clears both tokens when save fails', async () => {
    vi.spyOn(refreshItem, 'setValue').mockRejectedValueOnce(new Error('quota exceeded'));
    const error: unknown = await seed(60 * MIN).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).code).toBe('FAILED');
    expect(await readAccess()).toBeNull();
    expect(await readRefresh()).toBeNull();
  });

  test('panel refresh goes through refreshSession', async () => {
    vi.stubGlobal('window', {});
    expect(isBackgroundContext()).toBe(false);
    await refreshItem.setValue({ refreshToken: 'refresh-old', provider: 'password' });
    vi.mocked(sendMessage).mockResolvedValue(true);
    expect(await refresh()).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith('refreshSession');
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test('panel refresh returns false when messaging fails', async () => {
    vi.stubGlobal('window', {});
    vi.mocked(sendMessage).mockRejectedValue(new Error('no receiver'));
    expect(await refresh()).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test('signed out returns null token', async () => {
    expect(await getAccessToken()).toBeNull();
    expect(await refreshInBackground()).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test('signOut clears local tokens even when the provider fails', async () => {
    await seed(60 * MIN);
    signOutMock.mockRejectedValue(new ApiError('NETWORK', '/auth/logout'));
    await signOut();
    expect(signOutMock).toHaveBeenCalledWith('refresh-old');
    expect(await readAccess()).toBeNull();
    expect(await readRefresh()).toBeNull();
  });
});
