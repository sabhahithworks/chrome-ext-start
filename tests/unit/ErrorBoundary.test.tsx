import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { t } from '@/lib/i18n';
import { addLogSink } from '@/lib/logger';
import type { LogEntry } from '@/lib/logger';

vi.mock('@/lib/i18n', async () => {
  const { readFileSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const messages = parse(readFileSync('src/locales/en.yml', 'utf8')) as Record<string, unknown>;
  return {
    t: (key: string) =>
      key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages),
  };
});

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('shows reload on crash and logs it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const entries: LogEntry[] = [];
    const remove = addLogSink({
      write: (e) => {
        entries.push(e);
      },
    });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(t('errors.screen'))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload panel' })).toBeTruthy();
    remove();
    const crash = entries.filter(
      (e) => e.scope === 'error-boundary' && e.message === 'screen crashed',
    );
    expect(crash).toHaveLength(1);
    expect(crash[0]?.level).toBe('error');
    expect(typeof crash[0]?.context?.componentStack).toBe('string');
  });
});
