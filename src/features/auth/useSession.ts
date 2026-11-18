import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_PATHS } from '@/config/app.config';
import { getApi } from '@/lib/api/client';
import { isSignedIn } from '@/lib/auth/session';
import { MeSchema } from '@/lib/auth/types';
import { createLogger } from '@/lib/logger';
import { refreshItem, sessionExpiredItem } from '@/lib/storage';

const log = createLogger('useSession');

type SessionStatus = 'loading' | 'signedIn' | 'signedOut';

export function useSession(): {
  status: SessionStatus;
  expired: boolean;
  dismissExpired: () => void;
} {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let active = true;
    const readStatus = () => {
      isSignedIn()
        .then((signedIn) => {
          if (active) setStatus(signedIn ? 'signedIn' : 'signedOut');
        })
        .catch((error: unknown) => {
          log.error('read session failed', { error });
          if (active) setStatus('signedOut');
        });
    };
    const readExpired = () => {
      sessionExpiredItem
        .getValue()
        .then((value) => {
          if (active) setExpired(value);
        })
        .catch((error: unknown) => {
          log.error('read expired flag failed', { error });
        });
    };
    readStatus();
    readExpired();
    const unwatchRefresh = refreshItem.watch(readStatus);
    const unwatchExpired = sessionExpiredItem.watch(readExpired);
    return () => {
      active = false;
      unwatchRefresh();
      unwatchExpired();
    };
  }, []);

  const dismissExpired = () => {
    sessionExpiredItem.setValue(false).catch((error: unknown) => {
      log.error('dismiss expired failed', { error });
    });
  };

  return { status, expired, dismissExpired };
}

export function useMe() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['me'],
    queryFn: () => getApi().request(API_PATHS.me, { schema: MeSchema, auth: true }),
    enabled: status === 'signedIn',
  });
}
