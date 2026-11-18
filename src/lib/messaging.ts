import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  getAppInfo(): { name: string; version: string };
  refreshSession(): boolean;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
