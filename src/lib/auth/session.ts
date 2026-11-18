import { LIMITS } from '@/config/app.config';
import type { AuthHooks } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { createLogger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import {
  accessItem,
  readAccess,
  readRefresh,
  refreshItem,
  sessionExpiredItem,
} from '@/lib/storage';
import {
  AuthError,
  TokensSchema,
  type AuthProvider,
  type AuthProviderId,
  type Tokens,
} from './types';

// No DOM use here: this module runs in both the background worker and the panel.

const log = createLogger('auth');

const SKEW_MS = LIMITS.TOKEN_REFRESH_SKEW_SEC * 1000;
const ALARM_WINDOW_MS = (LIMITS.SYNC_ALARM_PERIOD_MIN * 60 + LIMITS.TOKEN_REFRESH_SKEW_SEC) * 1000;
const DEFINITE_REJECTION_STATUSES: readonly number[] = [400, 401];

const providers = new Map<AuthProviderId, AuthProvider>();
let inFlight: Promise<boolean> | null = null;

export function registerProvider(p: AuthProvider): void {
  if (providers.has(p.id)) throw new Error('duplicate auth provider: ' + p.id);
  providers.set(p.id, p);
}

/** The MV3 service worker has no `window`; the side panel does. */
export function isBackgroundContext(): boolean {
  return typeof window === 'undefined';
}

export async function clearTokens(): Promise<void> {
  await Promise.all([accessItem.removeValue(), refreshItem.removeValue()]);
}

export async function saveTokens(provider: AuthProviderId, tokens: Tokens): Promise<void> {
  const parsed = TokensSchema.safeParse(tokens);
  if (!parsed.success) {
    log.error('provider returned invalid tokens', { provider, issues: parsed.error.issues });
    throw new AuthError('INVALID_RESPONSE', 'provider returned invalid tokens');
  }
  const { accessToken, refreshToken, expiresAt } = parsed.data;
  try {
    // Sequential so a failed write never races the cleanup below.
    await accessItem.setValue({ accessToken, expiresAt });
    await refreshItem.setValue({ refreshToken, provider });
  } catch (error) {
    log.error('saving tokens failed, clearing both', { provider, error });
    try {
      await clearTokens();
    } catch (clearError) {
      log.error('clearing tokens after a failed save also failed', { error: clearError });
    }
    throw new AuthError('FAILED', 'saving tokens failed', { cause: error });
  }
  try {
    await sessionExpiredItem.setValue(false);
  } catch (error) {
    log.warn('resetting the session-expired flag failed', { error });
  }
}

export async function isSignedIn(): Promise<boolean> {
  return (await readRefresh()) !== null;
}

export async function getAccessToken(): Promise<string | null> {
  if ((await readRefresh()) === null) return null;
  const access = await readAccess();
  if (access !== null && access.expiresAt - Date.now() >= SKEW_MS) return access.accessToken;
  if (await refresh()) return (await readAccess())?.accessToken ?? null;
  // Refresh failed: a token that has not expired yet is still usable for its last seconds.
  return access !== null && access.expiresAt > Date.now() ? access.accessToken : null;
}

export async function refresh(): Promise<boolean> {
  if (isBackgroundContext()) return refreshInBackground();
  try {
    return await sendMessage('refreshSession');
  } catch (error) {
    log.error('refreshSession message failed', { error });
    return false;
  }
}

/** Single-flight: concurrent callers share one provider call, so a rotating refresh token is used once. */
export function refreshInBackground(): Promise<boolean> {
  inFlight ??= runRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function isDefiniteRejection(error: unknown): boolean {
  if (error instanceof AuthError)
    return error.code === 'INVALID_GRANT' || error.code === 'BAD_CREDENTIALS';
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHORIZED') return true;
    return (
      error.code === 'HTTP' &&
      error.status !== undefined &&
      DEFINITE_REJECTION_STATUSES.includes(error.status)
    );
  }
  return false;
}

async function markExpired(): Promise<void> {
  try {
    await sessionExpiredItem.setValue(true);
  } catch (error) {
    log.error('setting the session-expired flag failed', { error });
  }
}

async function runRefresh(): Promise<boolean> {
  const stored = await readRefresh();
  if (stored === null) return false;
  const provider = providers.get(stored.provider);
  if (!provider) {
    log.error('no auth provider registered for stored session', { provider: stored.provider });
    return false;
  }
  let tokens: Tokens;
  try {
    tokens = await provider.refresh(stored.refreshToken);
  } catch (error) {
    if (isDefiniteRejection(error)) {
      log.warn('refresh rejected, signing out', { provider: stored.provider, error });
      await clearTokens();
      await markExpired();
      return false;
    }
    log.warn('refresh failed, keeping tokens', { provider: stored.provider, error });
    return false;
  }
  try {
    await saveTokens(stored.provider, tokens);
  } catch (error) {
    // saveTokens already logged and cleared; the old refresh token may be spent, so the session is gone.
    log.warn('refreshed tokens could not be stored, signing out', {
      provider: stored.provider,
      error,
    });
    await markExpired();
    return false;
  }
  return true;
}

export async function refreshIfExpiringBeforeNextAlarm(): Promise<void> {
  if ((await readRefresh()) === null) return;
  const access = await readAccess();
  if (access !== null && access.expiresAt - Date.now() >= ALARM_WINDOW_MS) return;
  await refreshInBackground();
}

export async function signOut(): Promise<void> {
  const stored = await readRefresh();
  const provider = stored ? providers.get(stored.provider) : undefined;
  if (stored && provider?.signOut) {
    try {
      await provider.signOut(stored.refreshToken);
    } catch (error) {
      log.warn('provider sign-out failed, clearing local tokens anyway', {
        provider: stored.provider,
        error,
      });
    }
  }
  await clearTokens();
}

export const authHooks: AuthHooks = {
  getAccessToken,
  refresh,
  onSessionExpired() {
    void markExpired();
  },
};

export function resetSessionForTest(): void {
  providers.clear();
  inFlight = null;
}
