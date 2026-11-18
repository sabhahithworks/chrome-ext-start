import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LIMITS } from '@/config/app.config';
import { builtinProvider, resetBuiltinSessions } from '@/lib/ai/builtinProvider';
import { AiError } from '@/lib/ai/types';

function streamOf(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

async function collect(iter: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of iter) out.push(chunk);
  return out;
}

describe('builtinProvider', () => {
  beforeEach(() => {
    resetBuiltinSessions();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('returns unavailable without global', async () => {
    vi.stubGlobal('LanguageModel', undefined);
    expect(await builtinProvider.availability()).toBe('unavailable');
  });

  test('passes through availability', async () => {
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create: vi.fn(),
    });
    expect(await builtinProvider.availability()).toBe('downloadable');
  });

  test('reports download progress', async () => {
    const create = vi.fn((opts?: AiCreateOptions) => {
      const target = new EventTarget();
      opts?.monitor?.(target as AiDownloadMonitor);
      for (const loaded of [0.5, 1]) {
        target.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded }));
      }
      return Promise.resolve({ promptStreaming: vi.fn(), prompt: vi.fn(), destroy: vi.fn() });
    });
    vi.stubGlobal('LanguageModel', { availability: vi.fn(), create });
    const onProgress = vi.fn<(fraction: number) => void>();
    await builtinProvider.prepare(onProgress);
    expect(onProgress.mock.calls.map((c) => c[0])).toEqual([0.5, 1]);
  });

  test('streams prompt chunks', async () => {
    const promptStreaming = vi.fn(() => streamOf(['Hel', 'lo']));
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn(),
      create: vi.fn().mockResolvedValue({ promptStreaming, prompt: vi.fn(), destroy: vi.fn() }),
    });
    expect(await collect(builtinProvider.prompt('hi'))).toEqual(['Hel', 'lo']);
    expect(promptStreaming).toHaveBeenCalledWith('hi', undefined);
  });

  test('prompt works without prepare', async () => {
    const create = vi.fn().mockResolvedValue({
      promptStreaming: vi.fn(() => streamOf(['a'])),
      prompt: vi.fn(),
      destroy: vi.fn(),
    });
    vi.stubGlobal('LanguageModel', { availability: vi.fn(), create });
    await collect(builtinProvider.prompt('one'));
    await collect(builtinProvider.prompt('two'));
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('aborting a prompt does not tie the cached session to its signal', async () => {
    const create = vi.fn().mockResolvedValue({
      promptStreaming: vi.fn(() => streamOf(['a', 'b'])),
      prompt: vi.fn(),
      destroy: vi.fn(),
    });
    vi.stubGlobal('LanguageModel', { availability: vi.fn(), create });
    const controller = new AbortController();
    const first = builtinProvider.prompt('one', controller.signal)[Symbol.asyncIterator]();
    await first.next();
    controller.abort();
    await first.return?.();
    expect(await collect(builtinProvider.prompt('two'))).toEqual(['a', 'b']);
    expect(create).toHaveBeenCalledTimes(1);
    const options = (create.mock.calls[0] as unknown as [{ signal?: AbortSignal }])[0];
    expect(options.signal).toBeUndefined();
  });

  test('wraps create failure', async () => {
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn(),
      create: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const error = await builtinProvider.prepare(vi.fn()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe('FAILED');
    expect((error as AiError).message).toBe('boom');
  });

  test('summarize truncates long input', async () => {
    const summarizeStreaming = vi.fn(() => streamOf(['ok']));
    vi.stubGlobal('Summarizer', {
      availability: vi.fn(),
      create: vi
        .fn()
        .mockResolvedValue({ summarizeStreaming, summarize: vi.fn(), destroy: vi.fn() }),
    });
    expect(
      await collect(builtinProvider.summarize('x'.repeat(LIMITS.TEXT_MAX_CHARS + 10_000))),
    ).toEqual(['ok']);
    const arg = (summarizeStreaming.mock.calls[0] as unknown as [string])[0];
    expect(arg).toBe('x'.repeat(LIMITS.TEXT_MAX_CHARS));
  });
});
