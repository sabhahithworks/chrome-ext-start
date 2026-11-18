import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { APP_NAME } from './src/config/app.config';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: APP_NAME,
    description: 'A production-grade side panel extension starter.',
    minimum_chrome_version: '116',
    action: {},
  },
});
