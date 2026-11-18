import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'wxt';
import { APP_NAME } from './src/config/app.config';
import { parseEnv } from './src/lib/env';

export const env = parseEnv(loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'WXT_'));

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: APP_NAME,
    default_locale: 'en',
    description: 'A production-grade side panel extension starter.',
    minimum_chrome_version: '116',
    action: {},
  },
});
