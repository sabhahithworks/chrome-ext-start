import { AUTH_PROVIDERS } from '@/config/app.config';
import { passwordProvider } from './passwordProvider';
import { registerProvider } from './session';
import type { AuthProvider, AuthProviderId } from './types';

export function enabledProviders(
  config: Record<AuthProviderId, boolean> = AUTH_PROVIDERS,
): AuthProvider[] {
  const all: AuthProvider[] = [passwordProvider];
  return all.filter((p) => config[p.id]);
}

export function registerEnabledProviders(): void {
  for (const provider of enabledProviders()) registerProvider(provider);
}
