import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LIMITS } from '@/config/app.config';
import { ApiError } from '@/lib/api/errors';
import { buildAuthorizeUrl, oauthProvider, parseRedirect } from '@/lib/auth/oauthProvider';
import { codeChallengeS256 } from '@/lib/auth/pkce';
import { AuthError } from '@/lib/auth/types';
import type { Env } from '@/lib/env';

const testEnv: Env = {
  WXT_API_BASE_URL: 'https://api.test',
  WXT_OAUTH_AUTHORIZE_URL: 'https://idp.test/authorize?tenant=t1',
  WXT_OAUTH_TOKEN_URL: 'https://idp.test/token',
  WXT_OAUTH_CLIENT_ID: 'client-123',
  WXT_OAUTH_SCOPES: 'openid profile email offline_access',
};

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, getEnv: () => testEnv };
});

const REDIRECT_URI = 'https://ext-id.chromiumapp.org/oauth';
const fetchMock = vi.fn<typeof fetch>();
type LaunchFlow = (details: { url: string; interactive?: boolean }) => Promise<string | undefined>;
const launchWebAuthFlow = vi.fn<LaunchFlow>();
const getRedirectURL = vi.fn((path?: string) => `https://ext-id.chromiumapp.org/${path ?? ''}`);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** The IdP echoes the request's state back with a code, as a real redirect does. */
function approveWith(code: string) {
  launchWebAuthFlow.mockImplementation(({ url }) => {
    const state = new URL(url).searchParams.get('state') ?? '';
    return Promise.resolve(`${REDIRECT_URI}?code=${code}&state=${state}`);
  });
}

function sentForm(call = 0): URLSearchParams {
  const body = fetchMock.mock.calls[call]?.[1]?.body;
  if (!(body instanceof URLSearchParams)) throw new Error('token request body is not a form');
  return body;
}

async function caught(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => undefined,
    (e: unknown) => e,
  );
}

describe('oauthProvider', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    launchWebAuthFlow.mockReset();
    getRedirectURL.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    Object.assign(fakeBrowser, { identity: { launchWebAuthFlow, getRedirectURL } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('builds authorize url with S256', () => {
    const url = new URL(
      buildAuthorizeUrl(testEnv, { state: 's1', challenge: 'ch1', redirectUri: REDIRECT_URI }),
    );
    expect(url.origin + url.pathname).toBe('https://idp.test/authorize');
    expect(url.searchParams.get('tenant')).toBe('t1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('scope')).toBe('openid profile email offline_access');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('code_challenge')).toBe('ch1');
  });

  test('rejects state mismatch', async () => {
    const err = (() => {
      try {
        return parseRedirect(`${REDIRECT_URI}?code=c1&state=evil`, 'good');
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('INVALID_RESPONSE');

    launchWebAuthFlow.mockResolvedValue(`${REDIRECT_URI}?code=c1&state=evil`);
    const signInErr = await caught(oauthProvider.signIn());
    expect((signInErr as AuthError).code).toBe('INVALID_RESPONSE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('parses code, missing code and IdP error', () => {
    expect(parseRedirect(`${REDIRECT_URI}?code=c1&state=s1`, 's1')).toEqual({ code: 'c1' });
    expect(() => parseRedirect(`${REDIRECT_URI}?state=s1`, 's1')).toThrow(
      expect.objectContaining({ code: 'INVALID_RESPONSE' }),
    );
    expect(() =>
      parseRedirect(
        `${REDIRECT_URI}?error=access_denied&error_description=User+said+no&state=s1`,
        's1',
      ),
    ).toThrow(expect.objectContaining({ code: 'FAILED', message: 'User said no' }));
  });

  test('maps closed window to cancelled', async () => {
    launchWebAuthFlow.mockRejectedValue(new Error('The user did not approve access.'));
    const err = await caught(oauthProvider.signIn());
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('CANCELLED');

    launchWebAuthFlow.mockResolvedValue(undefined);
    expect(((await caught(oauthProvider.signIn())) as AuthError).code).toBe('CANCELLED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('exchanges code for tokens', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(t0);
    approveWith('code-1');
    fetchMock.mockResolvedValue(
      json({ access_token: 'at', refresh_token: 'rt', expires_in: 1800, token_type: 'Bearer' }),
    );

    const tokens = await oauthProvider.signIn();

    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAt: t0 + 1_800_000 });
    expect(getRedirectURL).toHaveBeenCalledWith('oauth');
    expect(launchWebAuthFlow.mock.calls[0]?.[0].interactive).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://idp.test/token');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );
    const form = sentForm();
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('code-1');
    expect(form.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(form.get('client_id')).toBe('client-123');
    const authorize = new URL(launchWebAuthFlow.mock.calls[0]?.[0].url ?? '');
    expect(await codeChallengeS256(form.get('code_verifier') ?? '')).toBe(
      authorize.searchParams.get('code_challenge'),
    );
  });

  test('uses default ttl when expires_in is missing', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(t0);
    approveWith('code-1');
    fetchMock.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt' }));
    const tokens = await oauthProvider.signIn();
    expect(tokens.expiresAt).toBe(t0 + LIMITS.DEFAULT_TOKEN_TTL_SEC * 1000);
  });

  test('requires a refresh token on first sign-in', async () => {
    approveWith('code-1');
    fetchMock.mockResolvedValue(json({ access_token: 'at', expires_in: 60 }));
    const err = (await caught(oauthProvider.signIn())) as AuthError;
    expect(err.code).toBe('FAILED');
    expect(err.message).toBe('no refresh token: add the offline_access scope');
  });

  test('maps bad token body to INVALID_RESPONSE and 4xx to FAILED', async () => {
    approveWith('code-1');
    fetchMock.mockResolvedValueOnce(json({ token: 'x' }));
    expect(((await caught(oauthProvider.signIn())) as AuthError).code).toBe('INVALID_RESPONSE');

    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));
    const err = (await caught(oauthProvider.signIn())) as AuthError;
    expect(err.code).toBe('FAILED');
    expect(err.message).toBe('invalid_grant');

    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_client' }, 401));
    const err401 = (await caught(oauthProvider.signIn())) as AuthError;
    expect(err401.code).toBe('FAILED');
    expect(err401.message).toBe('HTTP https://idp.test/token 401');
  });

  test('keeps old refresh token when omitted', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(t0);
    fetchMock.mockResolvedValue(json({ access_token: 'at2', expires_in: 600 }));

    const tokens = await oauthProvider.refresh('rt-old');

    expect(tokens).toEqual({ accessToken: 'at2', refreshToken: 'rt-old', expiresAt: t0 + 600_000 });
    const form = sentForm();
    expect(form.get('grant_type')).toBe('refresh_token');
    expect(form.get('refresh_token')).toBe('rt-old');
    expect(form.get('client_id')).toBe('client-123');
  });

  test('uses rotated refresh token when returned', async () => {
    fetchMock.mockResolvedValue(
      json({ access_token: 'at2', refresh_token: 'rt-new', expires_in: 600 }),
    );
    expect((await oauthProvider.refresh('rt-old')).refreshToken).toBe('rt-new');
  });

  test('maps invalid_grant to INVALID_GRANT', async () => {
    fetchMock.mockResolvedValue(
      json({ error: 'invalid_grant', error_description: 'refresh token revoked' }, 400),
    );
    const err = (await caught(oauthProvider.refresh('rt-old'))) as AuthError;
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe('INVALID_GRANT');
    expect(err.message).toBe('refresh token revoked');
  });

  test('rethrows other refresh errors unchanged', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'server_error' }, 503));
    const http = (await caught(oauthProvider.refresh('rt-old'))) as ApiError;
    expect(http).toBeInstanceOf(ApiError);
    expect(http.code).toBe('HTTP');
    expect(http.status).toBe(503);

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const net = (await caught(oauthProvider.refresh('rt-old'))) as ApiError;
    expect(net).toBeInstanceOf(ApiError);
    expect(net.code).toBe('NETWORK');

    fetchMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));
    expect(((await caught(oauthProvider.refresh('rt-old'))) as ApiError).code).toBe('TIMEOUT');
  });
});
