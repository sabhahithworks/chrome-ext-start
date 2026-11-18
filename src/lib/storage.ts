import { z } from 'zod';
import { AuthProviderIdSchema } from './auth/types';
import { createLogger } from './logger';

const log = createLogger('storage');

export const SettingsSchema = z.object({ theme: z.enum(['system', 'light', 'dark']) });

export type Settings = z.infer<typeof SettingsSchema>;

export const PendingSelectionSchema = z.object({
  text: z.string(),
  shown: z.number(),
  total: z.number(),
  truncated: z.boolean(),
  sourceUrl: z.string().optional(),
  createdAt: z.number(),
});

export type PendingSelection = z.infer<typeof PendingSelectionSchema>;

export const DEFAULT_SETTINGS: Settings = { theme: 'system' };

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export async function readSettings(): Promise<Settings> {
  const raw = await settingsItem.getValue();
  const result = SettingsSchema.safeParse(raw);
  if (!result.success) {
    log.warn('invalid settings, using defaults', { issues: result.error.issues });
    return DEFAULT_SETTINGS;
  }
  return result.data;
}

export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await readSettings()), ...patch };
  const parsed = SettingsSchema.parse(next);
  await settingsItem.setValue(parsed);
  return parsed;
}

export const pendingSelectionItem = storage.defineItem<PendingSelection | null>(
  'session:pendingSelection',
  { fallback: null, version: 1 },
);

/**
 * When the shortcut last granted activeTab. The panel only watches it as a "re-read the page"
 * signal and never reads the value, so it needs no schema.
 */
export const accessGrantItem = storage.defineItem<number | null>('session:accessGrant', {
  fallback: null,
  version: 1,
});

export async function readPendingSelection(): Promise<PendingSelection | null> {
  const raw = await pendingSelectionItem.getValue();
  const result = PendingSelectionSchema.nullable().safeParse(raw);
  if (!result.success) {
    log.warn('invalid pending selection, ignoring', { issues: result.error.issues });
    return null;
  }
  return result.data;
}

export const AccessRecordSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.number(),
});

export type AccessRecord = z.infer<typeof AccessRecordSchema>;

export const RefreshRecordSchema = z.object({
  refreshToken: z.string().min(1),
  provider: AuthProviderIdSchema,
});

export type RefreshRecord = z.infer<typeof RefreshRecordSchema>;

export const accessItem = storage.defineItem<AccessRecord | null>('session:auth.access', {
  fallback: null,
  version: 1,
});

export const refreshItem = storage.defineItem<RefreshRecord | null>('local:auth.refresh', {
  fallback: null,
  version: 1,
});

export const sessionExpiredItem = storage.defineItem<boolean>('session:auth.expired', {
  fallback: false,
  version: 1,
});

export async function readAccess(): Promise<AccessRecord | null> {
  const raw = await accessItem.getValue();
  const result = AccessRecordSchema.nullable().safeParse(raw);
  if (!result.success) {
    log.warn('invalid access record, ignoring', { issues: result.error.issues });
    return null;
  }
  return result.data;
}

export async function readRefresh(): Promise<RefreshRecord | null> {
  const raw = await refreshItem.getValue();
  const result = RefreshRecordSchema.nullable().safeParse(raw);
  if (!result.success) {
    log.warn('invalid refresh record, ignoring', { issues: result.error.issues });
    return null;
  }
  return result.data;
}
