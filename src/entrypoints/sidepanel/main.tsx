import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_NAME } from '@/config/app.config';
import '@/assets/globals.css';
import { setApiAuth } from '@/lib/api/client';
import { registerEnabledProviders } from '@/lib/auth/providers';
import { authHooks } from '@/lib/auth/session';
import { createLogger } from '@/lib/logger';
import { DEFAULT_SETTINGS, readSettings, settingsItem } from '@/lib/storage';
import { applyTheme } from '@/lib/theme';
import App from './App';

const log = createLogger('sidepanel');

registerEnabledProviders();
setApiAuth(authHooks);

document.title = APP_NAME;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root missing');
}

let initial = DEFAULT_SETTINGS;
try {
  initial = await readSettings();
} catch (error: unknown) {
  log.error('read settings failed', { error });
}
let stopTheme = applyTheme(initial.theme);
settingsItem.watch(() => {
  readSettings()
    .then((s) => {
      stopTheme();
      stopTheme = applyTheme(s.theme);
    })
    .catch((error: unknown) => {
      log.error('re-apply theme failed', { error });
    });
});

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
