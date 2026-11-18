import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { t } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';
import { DEFAULT_SETTINGS, readSettings, SettingsSchema, writeSettings } from '@/lib/storage';
import type { Settings } from '@/lib/storage';

const log = createLogger('settings');

const THEME_OPTIONS = [
  { value: 'system', labelKey: 'settings.themeSystem' },
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
] as const;

export default function SettingsScreen() {
  const [theme, setTheme] = useState<Settings['theme']>(DEFAULT_SETTINGS.theme);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readSettings()
      .then((s) => {
        if (!cancelled) setTheme(s.theme);
      })
      .catch((error: unknown) => {
        log.error('read settings failed', { error });
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onChange(value: string) {
    const parsed = SettingsSchema.shape.theme.safeParse(value);
    if (!parsed.success) return;
    const next = parsed.data;
    const previous = theme;
    setTheme(next);
    setFailed(false);
    writeSettings({ theme: next }).catch(async (error: unknown) => {
      log.error('write settings failed', { error });
      setFailed(true);
      try {
        setTheme((await readSettings()).theme);
      } catch (readError: unknown) {
        log.error('read settings failed', { error: readError });
        setTheme(previous);
      }
    });
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t('nav.settings')}</h1>
      {failed && <Alert variant="destructive">{t('errors.screen')}</Alert>}
      <div role="group" aria-labelledby="theme-label" className="space-y-2">
        <p id="theme-label" className="text-sm font-medium">
          {t('settings.theme')}
        </p>
        <RadioGroup value={theme} onValueChange={onChange} aria-labelledby="theme-label">
          {THEME_OPTIONS.map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem value={o.value} id={`theme-${o.value}`} />
              <Label htmlFor={`theme-${o.value}`}>{t(o.labelKey)}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
