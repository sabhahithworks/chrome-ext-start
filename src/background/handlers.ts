import { APP_NAME } from '@/config/app.config';

export function getAppInfo(): { name: string; version: string } {
  return { name: APP_NAME, version: browser.runtime.getManifest().version };
}
