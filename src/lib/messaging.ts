import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  getAppInfo(): { name: string; version: string };
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
