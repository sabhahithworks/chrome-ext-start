import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AiScreen from '@/features/ai/AiScreen';

const provider = vi.hoisted(() => ({
  labelKey: 'ai.providerBuiltin',
  availability: vi.fn<() => Promise<string>>(),
  prepare: vi.fn<(onProgress: (f: number) => void) => Promise<void>>(),
  prompt: vi.fn<(input: string) => AsyncIterable<string>>(),
  summarize: vi.fn<(text: string) => AsyncIterable<string>>(),
  summarizerAvailability: vi.fn<() => Promise<string>>(),
  prepareSummarizer: vi.fn<(onProgress: (f: number) => void) => Promise<void>>(),
}));
vi.mock('@/lib/ai/builtinProvider', () => ({ builtinProvider: provider }));
vi.mock('@/lib/page', () => ({ getPageInfo: vi.fn() }));

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

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AiScreen />
    </QueryClientProvider>,
  );
}

async function* chunks(...parts: string[]) {
  await Promise.resolve();
  for (const part of parts) yield part;
}

describe('AiScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  test('disables send for blank prompt', async () => {
    provider.availability.mockResolvedValue('available');
    renderScreen();
    const box = await screen.findByPlaceholderText('Ask the on-device model');
    fireEvent.change(box, { target: { value: '   ' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'hi' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(false);
  });

  test('renders download progress', async () => {
    provider.availability.mockResolvedValue('downloadable');
    provider.prepare.mockImplementation((onProgress) => {
      onProgress(0.42);
      return new Promise<void>(() => undefined);
    });
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Download on-device model' }));
    expect(await screen.findByText('Downloading model… 42%')).toBeTruthy();
  });

  test('shows unavailable copy', async () => {
    provider.availability.mockResolvedValue('unavailable');
    renderScreen();
    expect(
      await screen.findByText("On-device AI isn't supported in this browser or on this device."),
    ).toBeTruthy();
    const link = screen.getByRole('link', { name: 'See requirements' });
    expect(link.getAttribute('href')).toBe('https://developer.chrome.com/docs/ai/get-started');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  test('shows ai failure and keeps input', async () => {
    provider.availability.mockResolvedValue('available');
    // eslint-disable-next-line require-yield
    provider.prompt.mockImplementation(async function* () {
      await Promise.resolve();
      throw new Error('boom');
    });
    renderScreen();
    const box = await screen.findByPlaceholderText('Ask the on-device model');
    fireEvent.change(box, { target: { value: 'hello there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('On-device AI failed: boom. Try again.')).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe('hello there');
  });

  test('streams output', async () => {
    provider.availability.mockResolvedValue('available');
    provider.prompt.mockImplementation(() => chunks('Hel', 'lo'));
    const { container } = renderScreen();
    const box = await screen.findByPlaceholderText('Ask the on-device model');
    fireEvent.change(box, { target: { value: 'say hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Hello');
    });
    expect(provider.prompt.mock.calls[0]?.[0]).toBe('say hello');
  });

  test('shows failure and retry when availability rejects', async () => {
    provider.availability.mockRejectedValue(new Error('boom'));
    renderScreen();
    expect(await screen.findByText('On-device AI failed: boom. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText(/isn't supported/)).toBeNull();
  });

  test('downloading state starts download and shows progress', async () => {
    provider.availability.mockResolvedValue('downloading');
    provider.prepare.mockImplementation((onProgress) => {
      onProgress(0.5);
      return new Promise<void>(() => undefined);
    });
    renderScreen();
    expect(await screen.findByText('Downloading model… 50%')).toBeTruthy();
    expect(provider.prepare).toHaveBeenCalledTimes(1);
  });
});
