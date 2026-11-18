import { z } from 'zod';
import type { MessageKey } from '@/lib/i18n';

export const AuthProviderIdSchema = z.enum(['password', 'oauth']);

export type AuthProviderId = z.infer<typeof AuthProviderIdSchema>;

export const TokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
});

export type Tokens = z.infer<typeof TokensSchema>;

export interface AuthProvider {
  id: AuthProviderId;
  labelKey: MessageKey;
  signIn(input?: { email: string; password: string }): Promise<Tokens>;
  refresh(refreshToken: string): Promise<Tokens>;
  signOut?(refreshToken: string): Promise<void>;
}

export type AuthErrorCode =
  'BAD_CREDENTIALS' | 'CANCELLED' | 'INVALID_RESPONSE' | 'INVALID_GRANT' | 'FAILED';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string, options?: ErrorOptions) {
    super(message ?? code, options);
    this.name = 'AuthError';
    this.code = code;
  }
}
