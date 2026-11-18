import { createLogger } from '@/lib/logger';
import { truncateText } from '@/lib/text';
import { AiError, type AiAvailability, type AiProvider } from './types';

const log = createLogger('ai');

let modelSession: Promise<LanguageModelSession> | undefined;
let summarizerSession: Promise<SummarizerSession> | undefined;

function fail(action: string, error: unknown): AiError {
  if (error instanceof AiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  log.error(`${action} failed`, { message });
  return new AiError('FAILED', message, { cause: error });
}

function monitorFor(onProgress: (fraction: number) => void): AiCreateOptions['monitor'] {
  return (m) => {
    m.addEventListener('downloadprogress', (e) => {
      onProgress(e.loaded);
    });
  };
}

function getSession(
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<LanguageModelSession> {
  if (typeof LanguageModel === 'undefined') {
    return Promise.reject(new AiError('UNAVAILABLE'));
  }
  if (!modelSession) {
    const created = LanguageModel.create({
      ...(onProgress ? { monitor: monitorFor(onProgress) } : {}),
      ...(signal ? { signal } : {}),
    });
    modelSession = created;
    signal?.addEventListener(
      'abort',
      () => {
        if (modelSession === created) modelSession = undefined;
      },
      { once: true },
    );
    created.catch(() => {
      if (modelSession === created) modelSession = undefined;
    });
  }
  return modelSession;
}

function getSummarizer(
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<SummarizerSession> {
  if (typeof Summarizer === 'undefined') {
    return Promise.reject(new AiError('UNAVAILABLE'));
  }
  if (!summarizerSession) {
    const created = Summarizer.create({
      ...(onProgress ? { monitor: monitorFor(onProgress) } : {}),
      ...(signal ? { signal } : {}),
    });
    summarizerSession = created;
    signal?.addEventListener(
      'abort',
      () => {
        if (summarizerSession === created) summarizerSession = undefined;
      },
      { once: true },
    );
    created.catch(() => {
      if (summarizerSession === created) summarizerSession = undefined;
    });
  }
  return summarizerSession;
}

async function* readStream(stream: ReadableStream<string>): AsyncGenerator<string> {
  const reader = stream.getReader();
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        return;
      }
      yield value;
    }
  } finally {
    if (!finished)
      await reader.cancel().catch((error: unknown) => {
        log.warn('stream cancel failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    reader.releaseLock();
  }
}

export const builtinProvider: AiProvider = {
  id: 'builtin',
  labelKey: 'ai.providerBuiltin',

  async availability(): Promise<AiAvailability> {
    if (typeof LanguageModel === 'undefined') return 'unavailable';
    try {
      return await LanguageModel.availability();
    } catch (error) {
      throw fail('availability', error);
    }
  },

  async prepare(onProgress, signal) {
    try {
      await getSession(onProgress, signal);
    } catch (error) {
      throw fail('prepare', error);
    }
  },

  async *prompt(input, signal) {
    try {
      const session = await getSession();
      yield* readStream(session.promptStreaming(input, signal ? { signal } : undefined));
    } catch (error) {
      throw fail('prompt', error);
    }
  },

  async summarizerAvailability(): Promise<AiAvailability> {
    if (typeof Summarizer === 'undefined') return 'unavailable';
    try {
      return await Summarizer.availability();
    } catch (error) {
      throw fail('summarizer availability', error);
    }
  },

  async prepareSummarizer(onProgress, signal) {
    try {
      await getSummarizer(onProgress, signal);
    } catch (error) {
      throw fail('prepare summarizer', error);
    }
  },

  async *summarize(text, signal) {
    try {
      const session = await getSummarizer();
      yield* readStream(
        session.summarizeStreaming(truncateText(text).text, signal ? { signal } : undefined),
      );
    } catch (error) {
      throw fail('summarize', error);
    }
  },
};

export function resetBuiltinSessions(): void {
  modelSession = undefined;
  summarizerSession = undefined;
}
