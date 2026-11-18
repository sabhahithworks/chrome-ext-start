import { QueryCache, QueryClient } from '@tanstack/react-query';
import { LIMITS } from '../config/app.config';
import { isTransient } from './api/errors';
import { createLogger } from './logger';

const log = createLogger('query');

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      log.error('query failed', { queryKey: query.queryKey, error });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (count, err) => isTransient(err) && count < LIMITS.API_QUERY_RETRIES,
    },
    mutations: { retry: false },
  },
});
