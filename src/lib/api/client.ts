import type { z } from 'zod';
import { LIMITS } from '../../config/app.config';
import { getEnv } from '../env';
import { createLogger } from '../logger';
import { ApiError } from './errors';

const log = createLogger('api');

export interface AuthHooks {
  getAccessToken(): Promise<string | null>;
  refresh(): Promise<boolean>;
  onSessionExpired(): void;
}

export interface RequestInitOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema: z.ZodType<T>;
  auth?: boolean;
}

export interface ApiClient {
  request<T>(path: string, init: RequestInitOptions<T>): Promise<T>;
}

export interface ApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  auth?: AuthHooks;
  fetchImpl?: typeof fetch;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const timeoutMs = opts.timeoutMs ?? LIMITS.API_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const auth = opts.auth;

  async function send<T>(path: string, init: RequestInitOptions<T>): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.auth && auth) {
      const token = await auth.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    try {
      return await doFetch(opts.baseUrl.replace(/\/+$/, '') + path, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? null : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ApiError('TIMEOUT', path, undefined, { cause: error });
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('TIMEOUT', path, undefined, { cause: error });
      }
      if (error instanceof TypeError) {
        throw new ApiError('NETWORK', path, undefined, { cause: error });
      }
      throw error;
    }
  }

  async function parse<T>(path: string, res: Response, schema: z.ZodType<T>): Promise<T> {
    let data: unknown;
    if (res.status !== 204) {
      try {
        data = await res.json();
      } catch (error) {
        log.error('response is not JSON', { path });
        throw new ApiError('INVALID_RESPONSE', path, res.status, { cause: error });
      }
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      log.error('response failed schema', { path, issues: result.error.issues });
      throw new ApiError('INVALID_RESPONSE', path, res.status);
    }
    return result.data;
  }

  return {
    async request<T>(path: string, init: RequestInitOptions<T>): Promise<T> {
      let res = await send(path, init);
      if (res.status === 401 && init.auth && auth) {
        const refreshed = await auth.refresh();
        if (refreshed) res = await send(path, init);
        if (!refreshed || res.status === 401) {
          auth.onSessionExpired();
          throw new ApiError('UNAUTHORIZED', path, 401);
        }
      }
      if (!res.ok) {
        log.warn('http error', { path, status: res.status });
        throw new ApiError('HTTP', path, res.status);
      }
      return parse(path, res, init.schema);
    },
  };
}

let instance: ApiClient | undefined;
let authHooks: AuthHooks | undefined;

export function setApiAuth(hooks: AuthHooks): void {
  authHooks = hooks;
  instance = undefined;
}

export function getApi(): ApiClient {
  instance ??= createApiClient({
    baseUrl: getEnv().WXT_API_BASE_URL,
    timeoutMs: LIMITS.API_TIMEOUT_MS,
    ...(authHooks ? { auth: authHooks } : {}),
  });
  return instance;
}
