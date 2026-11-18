import { z } from 'zod';
import { createLogger } from './logger';

const log = createLogger('storage');

export const SettingsSchema = z.object({ theme: z.enum(['system', 'light', 'dark']) });

export type Settings = z.infer<typeof SettingsSchema>;

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
