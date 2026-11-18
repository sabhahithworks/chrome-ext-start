import { AI_PROVIDERS } from '@/config/app.config';
import { builtinProvider } from './builtinProvider';
import type { AiProvider } from './types';

export function enabledAiProviders(
  config: Record<AiProvider['id'], boolean> = AI_PROVIDERS,
): AiProvider[] {
  const all: AiProvider[] = [builtinProvider];
  return all.filter((p) => config[p.id]);
}
