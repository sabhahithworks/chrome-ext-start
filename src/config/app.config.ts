export const APP_NAME = 'Side Panel Starter';

export const AUTH_PROVIDERS = { password: true, oauth: true } as const;

export const AI_PROVIDERS = { builtin: true } as const;

export const LIMITS = {
  TEXT_MAX_CHARS: 20_000,
  API_TIMEOUT_MS: 15_000,
  API_QUERY_RETRIES: 1,
  SYNC_ALARM_PERIOD_MIN: 15,
  TOKEN_REFRESH_SKEW_SEC: 60,
  PENDING_SELECTION_REDIRECT_MS: 10_000,
  DEFAULT_TOKEN_TTL_SEC: 3600,
} as const;

export const RESTRICTED_URL_PREFIXES: readonly string[] = [
  'chrome://',
  'edge://',
  'about:',
  'chrome-extension://',
  'devtools://',
  'view-source:',
  'https://chromewebstore.google.com/',
  'https://chrome.google.com/webstore',
  'https://microsoftedge.microsoft.com/addons',
];

export const API_PATHS = {
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/me',
} as const;
