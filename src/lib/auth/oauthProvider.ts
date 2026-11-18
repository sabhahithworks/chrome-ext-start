import { z } from 'zod';
import { LIMITS } from '@/config/app.config';
import { ApiError } from '@/lib/api/errors';
import { getEnv, type Env } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import { codeChallengeS256, randomUrlSafe } from './pkce';
import { AuthError, type AuthProvider, type Tokens } from './types';
import { errorMessage } from '@/lib/errorMessage';

const log = createLogger('auth.oauth');

/** Path under `https://<extension-id>.chromiumapp.org/` that the owner registers with the IdP. */
const REDIRECT_PATH = 'oauth';

// Some IdPs send `expires_in` as a numeric string.
const ExpiresIn = z
  .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().positive());

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: ExpiresIn.optional(),
});

type TokenResponse = z.infer<typeof TokenResponse>;

const OAuthErrorBody = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

type OAuthErrorBody = z.infer<typeof OAuthErrorBody>;

interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  scopes: string;
}

function oauthConfig(env: Env): OAuthConfig {
  const authorizeUrl = env.WXT_OAUTH_AUTHORIZE_URL;
  const tokenUrl = env.WXT_OAUTH_TOKEN_URL;
  const clientId = env.WXT_OAUTH_CLIENT_ID;
  if (!authorizeUrl || !tokenUrl || !clientId) {
    throw new AuthError('FAILED', 'OAuth is not configured');
  }
  return { authorizeUrl, tokenUrl, clientId, scopes: env.WXT_OAUTH_SCOPES };
}

export function buildAuthorizeUrl(
  env: Env,
  { state, challenge, redirectUri }: { state: string; challenge: string; redirectUri: string },
): string {
  const cfg = oauthConfig(env);
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', cfg.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/** The state is checked first: an error or code on a redirect we did not start is not trusted. */
export function parseRedirect(url: string, expectedState: string): { code: string } {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch (error) {
    throw new AuthError('INVALID_RESPONSE', 'redirect URL is malformed', { cause: error });
  }
  if (params.get('state') !== expectedState) {
    throw new AuthError('INVALID_RESPONSE', 'state mismatch');
  }
  const error = params.get('error');
  if (error) throw new AuthError('FAILED', params.get('error_description') ?? error);
  const code = params.get('code');
  if (!code) throw new AuthError('INVALID_RESPONSE', 'redirect has no code');
  return { code };
}

async function readOAuthError(res: Response): Promise<OAuthErrorBody | undefined> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    log.warn('token error body is not JSON', { status: res.status });
    return undefined;
  }
  const parsed = OAuthErrorBody.safeParse(body);
  return parsed.success ? parsed.data : undefined;
}

/**
 * POSTs a form to the token endpoint. Throws `ApiError` (NETWORK, TIMEOUT, HTTP,
 * INVALID_RESPONSE) so the session's D16 rejection split applies, and
 * `AuthError('INVALID_GRANT')` for an HTTP 400 `invalid_grant` body.
 */
async function postToken(tokenUrl: string, form: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(LIMITS.API_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new ApiError('TIMEOUT', tokenUrl, undefined, { cause: error });
    }
    if (error instanceof TypeError) {
      throw new ApiError('NETWORK', tokenUrl, undefined, { cause: error });
    }
    throw error;
  }

  if (!res.ok) {
    const body = await readOAuthError(res);
    log.warn('token endpoint error', { status: res.status, error: body?.error });
    if (res.status === 400 && body?.error === 'invalid_grant') {
      throw new AuthError('INVALID_GRANT', body.error_description ?? body.error);
    }
    throw new ApiError('HTTP', tokenUrl, res.status);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (error) {
    log.error('token response is not JSON', { status: res.status });
    throw new ApiError('INVALID_RESPONSE', tokenUrl, res.status, { cause: error });
  }
  const parsed = TokenResponse.safeParse(data);
  if (!parsed.success) {
    // Log only the failing paths: the values may be tokens.
    log.error('token response failed schema', {
      paths: parsed.error.issues.map((i) => i.path.join('.')),
    });
    throw new ApiError('INVALID_RESPONSE', tokenUrl, res.status);
  }
  return parsed.data;
}

function toTokens(res: TokenResponse, currentRefreshToken?: string): Tokens {
  const refreshToken = res.refresh_token ?? currentRefreshToken;
  if (!refreshToken) {
    throw new AuthError('FAILED', 'no refresh token: add the offline_access scope');
  }
  const expiresIn = res.expires_in ?? LIMITS.DEFAULT_TOKEN_TTL_SEC;
  return { accessToken: res.access_token, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
}

function toSignInError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    if (error.code !== 'INVALID_GRANT') return error;
    return new AuthError('FAILED', error.message, { cause: error });
  }
  if (error instanceof ApiError && error.code === 'INVALID_RESPONSE') {
    return new AuthError('INVALID_RESPONSE', undefined, { cause: error });
  }
  const message = errorMessage(error);
  return new AuthError('FAILED', message, { cause: error });
}

const USER_CANCELLED = /did not approve|cancel/i;

async function launchFlow(url: string): Promise<string> {
  let redirect: string | undefined;
  try {
    redirect = await browser.identity.launchWebAuthFlow({ url, interactive: true });
  } catch (error) {
    const message = errorMessage(error);
    // Chromium rejects with "The user did not approve access." when the window is closed.
    if (USER_CANCELLED.test(message)) {
      log.info('auth flow cancelled by the user');
      throw new AuthError('CANCELLED', undefined, { cause: error });
    }
    log.warn('auth flow failed', { error: message });
    throw new AuthError('FAILED', message, { cause: error });
  }
  if (!redirect) throw new AuthError('CANCELLED');
  return redirect;
}

export const oauthProvider: AuthProvider = {
  id: 'oauth',
  labelKey: 'auth.providerOauth',

  async signIn() {
    const env = getEnv();
    const cfg = oauthConfig(env);
    const verifier = randomUrlSafe();
    const state = randomUrlSafe();
    const challenge = await codeChallengeS256(verifier);
    const redirectUri = browser.identity.getRedirectURL(REDIRECT_PATH);

    const redirect = await launchFlow(buildAuthorizeUrl(env, { state, challenge, redirectUri }));
    const { code } = parseRedirect(redirect, state);

    try {
      const res = await postToken(cfg.tokenUrl, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: cfg.clientId,
        code_verifier: verifier,
      });
      return toTokens(res);
    } catch (error) {
      throw toSignInError(error);
    }
  },

  async refresh(refreshToken) {
    const cfg = oauthConfig(getEnv());
    const res = await postToken(cfg.tokenUrl, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: cfg.clientId,
    });
    return toTokens(res, refreshToken);
  },
};
