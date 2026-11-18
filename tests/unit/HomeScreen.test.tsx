import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HomeScreen from '@/features/home/HomeScreen';
import { sendMessage } from '@/lib/messaging';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

vi.mock('@/lib/i18n', async () => {
  const { readFileSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const messages = parse(readFileSync('src/locales/en.yml', 'utf8')) as Record<string, unknown>;
  return {
    t: (key: string, subs?: (string | number)[]) => {
      const text = key
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages) as string;
      return text.replace('$1', String(subs?.[0] ?? ''));
    },
  };
});

const BG_DOWN =
  "The background service isn't responding. Reload the extension from your browser's extensions page, then reopen this panel.";

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset();
  });
  afterEach(cleanup);

  test('shows connected with version', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ name: 'Side Panel Starter', version: '1.2.3' });
    renderHome();
    expect(await screen.findByText('Connected to background · v1.2.3')).toBeTruthy();
  });

  test('shows bgDown on message failure', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error('no receiver'));
    renderHome();
    expect(await screen.findByText(BG_DOWN)).toBeTruthy();
  });
});
