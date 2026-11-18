import { t } from '../i18n';

export type ApiErrorCode = 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'INVALID_RESPONSE' | 'UNAUTHORIZED';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly path: string;

  constructor(code: ApiErrorCode, path: string, status?: number, options?: ErrorOptions) {
    super(`${code} ${path}${status === undefined ? '' : ` ${String(status)}`}`, options);
    this.name = 'ApiError';
    this.code = code;
    this.path = path;
    if (status !== undefined) this.status = status;
  }
}

export function isTransient(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.code === 'NETWORK' || e.code === 'TIMEOUT') return true;
  return e.code === 'HTTP' && e.status !== undefined && e.status >= 500;
}

export function apiErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return t('api.network');
  switch (e.code) {
    case 'NETWORK':
      return t('api.network');
    case 'TIMEOUT':
      return t('api.timeout');
    case 'HTTP':
      return t('api.server', [e.status ?? 0]);
    case 'INVALID_RESPONSE':
      return t('api.invalid');
    case 'UNAUTHORIZED':
      return t('auth.expired');
  }
}
