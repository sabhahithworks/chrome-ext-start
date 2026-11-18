import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createLogger } from './logger';

const log = createLogger('query');

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      log.error('query failed', { queryKey: query.queryKey, error });
    },
  }),
});
