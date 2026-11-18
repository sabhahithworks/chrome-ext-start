import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AccountMenu } from '@/components/AccountMenu';
import { useMe, useSession } from '@/features/auth/useSession';
import { LoginForm } from '@/features/auth/LoginForm';
import { enabledProviders } from '@/lib/auth/providers';
import { ApiError } from '@/lib/api/errors';
import { AuthError } from '@/lib/auth/types';
import type { AuthProvider } from '@/lib/auth/types';

vi.mock('@/lib/i18n', async () => {
  const { readFileSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const messages = parse(readFileSync('src/locales/en.yml', 'utf8')) as Record<string, unknown>;
  return {
    t: (key: string, args?: unknown[]) => {
      const msg = key
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages) as string;
      return (args ?? []).reduce<string>(
        (m, a, i) => m.replace(`$${String(i + 1)}`, String(a)),
        msg,
      );
    },
  };
});
vi.mock('@/lib/auth/session', () => ({
  saveTokens: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/features/auth/useSession', () => ({ useSession: vi.fn(), useMe: vi.fn() }));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() }),
}));
vi.mock('@/lib/auth/providers', () => ({ enabledProviders: vi.fn() }));

const tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: 1 };

function makeProviders(signIn: AuthProvider['signIn'], oauth = true): AuthProvider[] {
  const list: AuthProvider[] = [
    { id: 'password', labelKey: 'auth.providerPassword', signIn, refresh: vi.fn() },
  ];
  if (oauth) list.push({ id: 'oauth', labelKey: 'auth.providerOauth', signIn, refresh: vi.fn() });
  return list;
}

function renderForm() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'a@b.co');
  await user.type(screen.getByLabelText('Password'), 'pw');
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(enabledProviders).mockReset();
  });
  afterEach(cleanup);

  test('sends one login on double click', async () => {
    const signIn = vi.fn<AuthProvider['signIn']>(() => new Promise(() => undefined));
    vi.mocked(enabledProviders).mockReturnValue(makeProviders(signIn));
    renderForm();
    const user = userEvent.setup();
    await fill(user);
    await user.dblClick(screen.getByRole('button', { name: 'Sign in' }));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' });
  });

  test('shows bad credentials message', async () => {
    const signIn = vi.fn<AuthProvider['signIn']>(() =>
      Promise.reject(new AuthError('BAD_CREDENTIALS')),
    );
    vi.mocked(enabledProviders).mockReturnValue(makeProviders(signIn));
    renderForm();
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });

  test('shows cancelled message', async () => {
    const signIn = vi.fn<AuthProvider['signIn']>(() => Promise.reject(new AuthError('CANCELLED')));
    vi.mocked(enabledProviders).mockReturnValue(makeProviders(signIn));
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Continue with SSO' }));
    expect(await screen.findByText('Sign-in was cancelled.')).toBeTruthy();
  });

  test('shows the reason for other failures', async () => {
    const signIn = vi.fn<AuthProvider['signIn']>(() =>
      Promise.reject(new AuthError('FAILED', 'boom')),
    );
    vi.mocked(enabledProviders).mockReturnValue(makeProviders(signIn));
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Continue with SSO' }));
    expect(await screen.findByText("Couldn't sign in: boom. Try again.")).toBeTruthy();
  });

  test('shows network copy for ApiError', async () => {
    const signIn = vi.fn<AuthProvider['signIn']>(() =>
      Promise.reject(new ApiError('NETWORK', '/token')),
    );
    vi.mocked(enabledProviders).mockReturnValue(makeProviders(signIn));
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Continue with SSO' }));
    expect(
      await screen.findByText("Couldn't reach the server. Check your connection, then Retry."),
    ).toBeTruthy();
  });

  test('shows network copy when the provider wraps the ApiError', async () => {
    const cause = new ApiError('NETWORK', '/auth/login');
    const signIn = vi.fn<AuthProvider['signIn']>(() =>
      Promise.reject(new AuthError('FAILED', cause.message, { cause })),
    );
    vi.mocked(enabledProviders).mockReturnValue(makeProviders(signIn));
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Continue with SSO' }));
    expect(
      await screen.findByText("Couldn't reach the server. Check your connection, then Retry."),
    ).toBeTruthy();
  });

  test('does not double the period after a reason', async () => {
    const signIn = vi.fn<AuthProvider['signIn']>(() =>
      Promise.reject(new AuthError('FAILED', 'Authorization page could not be loaded.')),
    );
    vi.mocked(enabledProviders).mockReturnValue(makeProviders(signIn));
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Continue with SSO' }));
    expect(
      await screen.findByText(
        "Couldn't sign in: Authorization page could not be loaded. Try again.",
      ),
    ).toBeTruthy();
  });

  test('renders nothing and warns with no providers', () => {
    vi.mocked(enabledProviders).mockReturnValue([]);
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LoginForm />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
    expect(warn).toHaveBeenCalledWith('no auth providers enabled');
  });

  test('shows only enabled providers', () => {
    vi.mocked(enabledProviders).mockReturnValue(
      makeProviders(
        vi.fn(() => Promise.resolve(tokens)),
        false,
      ),
    );
    renderForm();
    expect(screen.queryByRole('button', { name: 'Continue with SSO' })).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  test('submit disabled when empty', async () => {
    vi.mocked(enabledProviders).mockReturnValue(
      makeProviders(vi.fn(() => Promise.resolve(tokens))),
    );
    renderForm();
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Sign in' });
    expect(submit.disabled).toBe(true);
    await fill(userEvent.setup());
    await waitFor(() => {
      expect(submit.disabled).toBe(false);
    });
  });
});

describe('AccountMenu', () => {
  afterEach(cleanup);

  test('sheet stays closed on sign-out after a sign-in', async () => {
    vi.mocked(enabledProviders).mockReturnValue(
      makeProviders(vi.fn(() => Promise.resolve(tokens))),
    );
    vi.mocked(useMe).mockReturnValue({
      data: { email: 'a@b.co' },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useMe>);
    const setStatus = (status: 'signedIn' | 'signedOut') =>
      vi.mocked(useSession).mockReturnValue({ status, expired: false, dismissExpired: vi.fn() });
    const client = new QueryClient();
    const ui = () => (
      <QueryClientProvider client={client}>
        <AccountMenu />
      </QueryClientProvider>
    );
    setStatus('signedOut');
    const { rerender } = render(ui());
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    setStatus('signedIn');
    rerender(ui());
    expect(screen.getByText('a@b.co')).toBeTruthy();
    setStatus('signedOut');
    rerender(ui());
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
