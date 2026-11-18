import { AUTH_PROVIDERS } from '@/config/app.config';
import { oauthProvider } from './oauthProvider';
import { passwordProvider } from './passwordProvider';
import { registerProvider } from './session';
import type { AuthProvider, AuthProviderId } from './types';

export function enabledProviders(
  config: Record<AuthProviderId, boolean> = AUTH_PROVIDERS,
): AuthProvider[] {
  const all: AuthProvider[] = [passwordProvider, oauthProvider];
  return all.filter((p) => config[p.id]);
}

export function registerEnabledProviders(): void {
  for (const provider of enabledProviders()) registerProvider(provider);
}
