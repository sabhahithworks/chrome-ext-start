import { z } from 'zod';
import { API_PATHS } from '@/config/app.config';
import { getApi } from '@/lib/api/client';
import { ApiError, isRejection } from '@/lib/api/errors';
import { AuthError, type AuthProvider, type Tokens } from './types';
import { errorMessage } from '@/lib/errorMessage';

const LoginResponse = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().positive(),
});

type LoginResponse = z.infer<typeof LoginResponse>;

function toTokens(res: LoginResponse): Tokens {
  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    expiresAt: Date.now() + res.expiresIn * 1000,
  };
}

export const passwordProvider: AuthProvider = {
  id: 'password',
  labelKey: 'auth.providerPassword',

  async signIn(input) {
    const email = (input?.email ?? '').trim();
    const password = input?.password ?? '';
    try {
      const res = await getApi().request(API_PATHS.login, {
        method: 'POST',
        body: { email, password },
        schema: LoginResponse,
        auth: false,
      });
      return toTokens(res);
    } catch (error) {
      if (isRejection(error)) throw new AuthError('BAD_CREDENTIALS', undefined, { cause: error });
      if (error instanceof ApiError && error.code === 'INVALID_RESPONSE') {
        throw new AuthError('INVALID_RESPONSE', undefined, { cause: error });
      }
      const message = errorMessage(error);
      throw new AuthError('FAILED', message, { cause: error });
    }
  },

  async refresh(refreshToken) {
    try {
      const res = await getApi().request(API_PATHS.refresh, {
        method: 'POST',
        body: { refreshToken },
        schema: LoginResponse,
        auth: false,
      });
      return toTokens(res);
    } catch (error) {
      if (isRejection(error)) throw new AuthError('INVALID_GRANT', undefined, { cause: error });
      throw error;
    }
  },

  async signOut(refreshToken) {
    await getApi().request(API_PATHS.logout, {
      method: 'POST',
      body: { refreshToken },
      schema: z.undefined(),
    });
  },
};
