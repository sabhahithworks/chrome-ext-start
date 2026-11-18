import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { isSignedIn } from '@/lib/auth/session';

vi.mock('@/lib/i18n', async () => {
  const { readFileSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const messages = parse(readFileSync('src/locales/en.yml', 'utf8')) as Record<string, unknown>;
  return {
    t: (key: string) =>
      key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages),
  };
});
vi.mock('@/lib/auth/session', () => ({ isSignedIn: vi.fn<() => Promise<boolean>>() }));

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.mocked(isSignedIn).mockReset();
  });
  afterEach(cleanup);

  test('shows sign-in prompt when signed out', async () => {
    vi.mocked(isSignedIn).mockResolvedValue(false);
    render(
      <RequireAuth fallback={<p>login form</p>}>
        <p>secret body</p>
      </RequireAuth>,
    );
    expect(await screen.findByText('Sign in to use this.')).toBeTruthy();
    expect(screen.getByText('login form')).toBeTruthy();
    expect(screen.queryByText('secret body')).toBeNull();
  });

  test('renders children when signed in', async () => {
    vi.mocked(isSignedIn).mockResolvedValue(true);
    render(
      <RequireAuth>
        <p>secret body</p>
      </RequireAuth>,
    );
    expect(await screen.findByText('secret body')).toBeTruthy();
    expect(screen.queryByText('Sign in to use this.')).toBeNull();
  });

  test('treats a session read failure as signed out', async () => {
    vi.mocked(isSignedIn).mockRejectedValue(new Error('boom'));
    render(
      <RequireAuth>
        <p>secret body</p>
      </RequireAuth>,
    );
    expect(await screen.findByText('Sign in to use this.')).toBeTruthy();
  });
});
