import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, Settings } from 'lucide-react';
import { lazy, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AppShell } from '@/components/AppShell';
import { APP_NAME } from '@/config/app.config';
import type { ScreenDef } from '@/features/registry';
import { refreshItem, sessionExpiredItem } from '@/lib/storage';
import { useUiStore } from '@/stores/ui';

vi.mock('@/lib/i18n', async () => {
  const { readFileSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const messages = parse(readFileSync('src/locales/en.yml', 'utf8')) as Record<string, unknown>;
  return {
    t: (key: string) =>
      key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages),
  };
});

const homeDef: ScreenDef = {
  id: 'home',
  labelKey: 'nav.home',
  icon: Home,
  component: lazy(() => Promise.resolve({ default: () => <p>home body</p> })),
  requiresAuth: false,
};
const settingsDef: ScreenDef = {
  id: 'settings',
  labelKey: 'common.retry',
  icon: Settings,
  component: lazy(() => Promise.resolve({ default: () => <p>settings body</p> })),
  requiresAuth: false,
};

function renderWithQuery(ui: ReactElement) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  afterEach(cleanup);

  beforeEach(() => {
    act(() => {
      useUiStore.setState({ activeScreen: 'home' });
    });
  });

  test('renders tabs from registry', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AppShell />
      </QueryClientProvider>,
    );
    const tab = screen.getByRole('tab', { name: 'Home' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByRole('heading', { name: APP_NAME })).toBeTruthy();
  });

  test('tabs are keyboard navigable', async () => {
    const user = userEvent.setup();
    render(<AppShell screens={[homeDef, settingsDef]} />);
    screen.getByRole('tab', { name: 'Home' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Retry' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Home' }).getAttribute('aria-selected')).toBe('false');
  });

  test('renders no nav for an empty registry', () => {
    render(<AppShell screens={[]} />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  test('shows session expired banner', async () => {
    const user = userEvent.setup();
    await sessionExpiredItem.setValue(true);
    render(<AppShell screens={[homeDef]} />);
    expect(await screen.findByText('Your session expired. Sign in again.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(screen.queryByText('Your session expired. Sign in again.')).toBeNull();
    });
    expect(await sessionExpiredItem.getValue()).toBe(false);
  });

  test('gates a requiresAuth screen when signed out', async () => {
    await refreshItem.setValue(null);
    renderWithQuery(<AppShell screens={[{ ...homeDef, requiresAuth: true }]} />);
    expect(await screen.findByText('Sign in to use this.')).toBeTruthy();
    expect(screen.queryByText('home body')).toBeNull();
  });

  test('renders a requiresAuth screen when signed in', async () => {
    await refreshItem.setValue({ refreshToken: 'r', provider: 'password' });
    renderWithQuery(<AppShell screens={[{ ...homeDef, requiresAuth: true }]} />);
    expect(await screen.findByText('home body')).toBeTruthy();
    await refreshItem.setValue(null);
  });
});
