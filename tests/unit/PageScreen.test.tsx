import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import PageScreen from '@/features/page/PageScreen';
import { getPageInfo } from '@/lib/page';
import { pendingSelectionItem } from '@/lib/storage';
import { captureActiveTab } from '@/lib/screenshot';

vi.mock('@/lib/page');
const setValueMock = vi.hoisted(() => vi.fn<(v: unknown) => Promise<void>>());
vi.mock('@/lib/storage', () => {
  let value: unknown = null;
  const watchers = new Set<(v: unknown) => void>();
  setValueMock.mockImplementation((v: unknown) => {
    value = v;
    watchers.forEach((w) => {
      w(v);
    });
    return Promise.resolve();
  });
  return {
    pendingSelectionItem: {
      setValue: setValueMock,
      watch: (cb: (v: unknown) => void) => {
        watchers.add(cb);
        return () => watchers.delete(cb);
      },
    },
    readPendingSelection: () => Promise.resolve(value),
  };
});
vi.mock('@/lib/screenshot', () => ({ captureActiveTab: vi.fn() }));

vi.mock('@/lib/i18n', async () => {
  const { readFileSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const messages = parse(readFileSync('src/locales/en.yml', 'utf8')) as Record<string, unknown>;
  return {
    t: (key: string, subs?: (string | number)[]) => {
      const text = key
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages) as string;
      return text.replace('$1', String(subs?.[0] ?? '')).replace('$2', String(subs?.[1] ?? ''));
    },
    formatCount: (n: number) => n.toLocaleString('en-US'),
  };
});

const NO_ACCESS =
  "Can't access this page yet. Click the extension icon or press Alt+Shift+S, then Retry. Browser pages like settings or the extension store can't be read.";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PageScreen />
    </QueryClientProvider>,
  );
}

function okInfo(
  text: string,
  extra: Partial<{ shown: number; total: number; truncated: boolean }> = {},
) {
  return {
    ok: true as const,
    title: 'Example',
    url: 'https://example.com/',
    selection: {
      text,
      shown: text.length,
      total: text.length,
      truncated: false,
      ...extra,
    },
  };
}

describe('PageScreen', () => {
  beforeEach(() => {
    vi.mocked(getPageInfo).mockReset();
  });
  afterEach(cleanup);

  test('shows sent selection card', async () => {
    vi.mocked(getPageInfo).mockResolvedValue(okInfo(''));
    await pendingSelectionItem.setValue({
      text: 'sent words',
      shown: 10,
      total: 10,
      truncated: false,
      sourceUrl: 'https://src.example/p',
      createdAt: Date.now(),
    });
    renderPage();
    expect(await screen.findByText('sent words')).toBeTruthy();
    expect(screen.getByText('https://src.example/p')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(setValueMock).toHaveBeenLastCalledWith(null);
    await waitFor(() => {
      expect(screen.queryByText('sent words')).toBeNull();
    });
  });

  test('refetches page info when the active tab changes', async () => {
    vi.mocked(getPageInfo)
      .mockResolvedValueOnce(okInfo('first tab'))
      .mockResolvedValueOnce({ ...okInfo('second tab'), title: 'Second' });
    renderPage();
    expect(await screen.findByText('first tab')).toBeTruthy();
    await fakeBrowser.tabs.onActivated.trigger({ tabId: 2, windowId: 1 });
    expect(await screen.findByText('second tab')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.queryByText('first tab')).toBeNull();
  });

  test('shows no-selection note', async () => {
    vi.mocked(getPageInfo).mockResolvedValue(okInfo(''));
    renderPage();
    expect(await screen.findByText('No text selected on this page.')).toBeTruthy();
    expect(screen.getByText('https://example.com/')).toBeTruthy();
  });

  test('shows truncation note with counts', async () => {
    vi.mocked(getPageInfo).mockResolvedValue(
      okInfo('abc', { shown: 20000, total: 85312, truncated: true }),
    );
    renderPage();
    expect(await screen.findByText('Showing 20,000 of 85,312 characters.')).toBeTruthy();
  });

  test('shows access card with retry', async () => {
    vi.mocked(getPageInfo).mockResolvedValue({ ok: false, code: 'NO_ACCESS' });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    // Text outside AlertDescription lands in the Alert's 0px grid column.
    expect(screen.getByText(NO_ACCESS).closest('[data-slot="alert-description"]')).not.toBeNull();
  });

  test('restricted has no retry', async () => {
    vi.mocked(getPageInfo).mockResolvedValue({ ok: false, code: 'RESTRICTED' });
    renderPage();
    expect(
      await screen.findByText("Your browser doesn't allow extensions on this page."),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  test('access card mentions browser pages', async () => {
    vi.mocked(getPageInfo).mockResolvedValue({ ok: false, code: 'NO_TAB' });
    renderPage();
    expect(await screen.findByText(NO_ACCESS)).toBeTruthy();
  });

  test('renders html as text', async () => {
    vi.mocked(getPageInfo).mockResolvedValue(okInfo('<b>x</b>'));
    renderPage();
    expect(await screen.findByText('<b>x</b>')).toBeTruthy();
    expect(document.querySelector('b')).toBeNull();
  });

  test('shows failed capture message', async () => {
    vi.mocked(getPageInfo).mockResolvedValue(okInfo(''));
    vi.mocked(captureActiveTab).mockResolvedValue({ ok: false, code: 'FAILED', reason: 'boom' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Screenshot' }));
    expect(await screen.findByText("Couldn't capture this tab: boom. Try again.")).toBeTruthy();
  });

  test('shows restricted message for restricted capture', async () => {
    vi.mocked(getPageInfo).mockResolvedValue(okInfo(''));
    vi.mocked(captureActiveTab).mockResolvedValue({ ok: false, code: 'RESTRICTED' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Screenshot' }));
    expect(
      await screen.findByText("Your browser doesn't allow extensions on this page."),
    ).toBeTruthy();
  });

  test('shows preview and download link on success', async () => {
    vi.mocked(getPageInfo).mockResolvedValue(okInfo(''));
    vi.mocked(captureActiveTab).mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,AAAA',
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Screenshot' }));
    const link = await screen.findByText('Download PNG');
    expect(link.getAttribute('download')).toBe('screenshot.png');
    expect(link.getAttribute('href')).toBe('data:image/png;base64,AAAA');
    expect(document.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });
});
