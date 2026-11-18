import { useEffect } from 'react';
import { LIMITS } from '@/config/app.config';
import { createLogger } from '@/lib/logger';
import { pendingSelectionItem, readPendingSelection } from '@/lib/storage';
import { useUiStore } from '@/stores/ui';

const log = createLogger('pendingSelectionRedirect');

export function usePendingSelectionRedirect(): void {
  const setActiveScreen = useUiStore((s) => s.setActiveScreen);

  useEffect(() => {
    let active = true;
    readPendingSelection()
      .then((value) => {
        if (
          active &&
          value &&
          Date.now() - value.createdAt <= LIMITS.PENDING_SELECTION_REDIRECT_MS
        ) {
          setActiveScreen('page');
        }
      })
      .catch((error: unknown) => {
        log.error('read pending selection failed', { error });
      });
    const unwatch = pendingSelectionItem.watch(() => {
      readPendingSelection()
        .then((value) => {
          if (active && value) setActiveScreen('page');
        })
        .catch((error: unknown) => {
          log.error('read pending selection failed', { error });
        });
    });
    return () => {
      active = false;
      unwatch();
    };
  }, [setActiveScreen]);
}
