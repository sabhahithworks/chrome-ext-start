import type { MessageKey } from '@/lib/i18n';

export type AiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export type AiErrorCode = 'UNAVAILABLE' | 'FAILED';

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message?: string, options?: ErrorOptions) {
    super(message ?? code, options);
    this.name = 'AiError';
    this.code = code;
  }
}

export interface AiProvider {
  id: 'builtin';
  labelKey: MessageKey;
  availability(): Promise<AiAvailability>;
  prepare(onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void>;
  prompt(input: string, signal?: AbortSignal): AsyncIterable<string>;
  summarize(text: string, signal?: AbortSignal): AsyncIterable<string>;
  summarizerAvailability(): Promise<AiAvailability>;
  prepareSummarizer(onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void>;
}
