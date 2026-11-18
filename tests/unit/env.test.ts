import { describe, expect, test } from 'vitest';
import { parseEnv } from '@/lib/env';

const valid = {
  WXT_API_BASE_URL: 'https://api.example.com',
  WXT_OAUTH_AUTHORIZE_URL: 'https://auth.example.com/authorize',
  WXT_OAUTH_TOKEN_URL: 'https://auth.example.com/oauth/token',
  WXT_OAUTH_CLIENT_ID: 'client-1',
};

describe('parseEnv', () => {
  test('parses valid env', () => {
    const env = parseEnv(valid);
    expect(env.WXT_API_BASE_URL).toBe('https://api.example.com');
    expect(env.WXT_OAUTH_SCOPES).toBe('openid profile email offline_access');
  });

  test('names the missing var', () => {
    expect(() => parseEnv({})).toThrow(/WXT_API_BASE_URL/);
  });

  test('empty env lists every required var', () => {
    let message = '';
    try {
      parseEnv({});
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    for (const key of [
      'WXT_API_BASE_URL',
      'WXT_OAUTH_AUTHORIZE_URL',
      'WXT_OAUTH_TOKEN_URL',
      'WXT_OAUTH_CLIENT_ID',
    ]) {
      expect(message).toContain(key);
    }
  });

  test('requires oauth vars when oauth enabled', () => {
    expect(() => parseEnv({ ...valid, WXT_OAUTH_CLIENT_ID: undefined })).toThrow(
      /WXT_OAUTH_CLIENT_ID/,
    );
  });

  test('rejects non-url base', () => {
    expect(() => parseEnv({ ...valid, WXT_API_BASE_URL: 'not a url' })).toThrow(/WXT_API_BASE_URL/);
  });
});
