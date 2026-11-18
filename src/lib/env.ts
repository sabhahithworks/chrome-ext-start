import { z } from 'zod';
import { AUTH_PROVIDERS } from '../config/app.config';

function oauthEnabled(): boolean {
  return AUTH_PROVIDERS.oauth;
}

const OAUTH_ENABLED = oauthEnabled();

const oauthUrl = OAUTH_ENABLED ? z.string().url() : z.string().url().optional();
const oauthClientId = OAUTH_ENABLED ? z.string().min(1) : z.string().min(1).optional();

const EnvSchema = z.object({
  WXT_API_BASE_URL: z.string().url(),
  WXT_OAUTH_AUTHORIZE_URL: oauthUrl,
  WXT_OAUTH_TOKEN_URL: oauthUrl,
  WXT_OAUTH_CLIENT_ID: oauthClientId,
  WXT_OAUTH_SCOPES: z.string().min(1).default('openid profile email offline_access'),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v]),
  );
  const result = EnvSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(
      'Invalid env:\n' +
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv({ ...import.meta.env });
  return cached;
}

export function isProd(): boolean {
  return import.meta.env.PROD;
}
