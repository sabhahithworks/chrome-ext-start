import { describe, expect, test } from 'vitest';
import { codeChallengeS256, PKCE_VERIFIER_BYTES, randomUrlSafe } from '@/lib/auth/pkce';

describe('pkce', () => {
  test('matches RFC 7636 vector', async () => {
    await expect(codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  test('verifier is url-safe 43 chars', () => {
    expect(PKCE_VERIFIER_BYTES).toBe(32);
    const a = randomUrlSafe();
    const b = randomUrlSafe();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});
