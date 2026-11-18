import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { usePendingSelectionRedirect } from '@/features/page/usePendingSelectionRedirect';
import { pendingSelectionItem } from '@/lib/storage';
import { useUiStore } from '@/stores/ui';

function seed(createdAt: number) {
  return pendingSelectionItem.setValue({
    text: 'x',
    shown: 1,
    total: 1,
    truncated: false,
    createdAt,
  });
}

describe('usePendingSelectionRedirect', () => {
  beforeEach(() => {
    act(() => {
      useUiStore.setState({ activeScreen: 'home' });
    });
  });

  test('redirects on fresh selection', async () => {
    await seed(Date.now());
    renderHook(() => {
      usePendingSelectionRedirect();
    });
    await waitFor(() => {
      expect(useUiStore.getState().activeScreen).toBe('page');
    });
  });

  test('ignores stale selection', async () => {
    await seed(Date.now() - 60_000);
    renderHook(() => {
      usePendingSelectionRedirect();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(useUiStore.getState().activeScreen).toBe('home');
  });
});
