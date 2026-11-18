interface AiDownloadMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: Event & { loaded: number }) => void,
  ): void;
}

type AiApiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface AiCreateOptions {
  monitor?(monitor: AiDownloadMonitor): void;
  signal?: AbortSignal;
}

interface LanguageModelSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(input: string, options?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy(): void;
}

interface LanguageModelApi {
  availability(options?: object): Promise<AiApiAvailability>;
  create(options?: AiCreateOptions): Promise<LanguageModelSession>;
}

interface SummarizerSession {
  summarize(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  summarizeStreaming(text: string, options?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy(): void;
}

interface SummarizerApi {
  availability(options?: object): Promise<AiApiAvailability>;
  create(options?: AiCreateOptions): Promise<SummarizerSession>;
}

// eslint-disable-next-line no-var
declare var LanguageModel: LanguageModelApi | undefined;
// eslint-disable-next-line no-var
declare var Summarizer: SummarizerApi | undefined;
