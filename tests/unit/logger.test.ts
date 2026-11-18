import { afterEach, describe, expect, test, vi } from 'vitest';
import { addLogSink, createLogger, redact, setMinLevel, type LogEntry } from '@/lib/logger';

afterEach(() => {
  setMinLevel(undefined);
  vi.restoreAllMocks();
});

describe('logger', () => {
  test('redacts secret keys', () => {
    expect(redact({ accessToken: 'x', nested: { password: 'p' }, ok: 1 })).toEqual({
      accessToken: '[redacted]',
      nested: { password: '[redacted]' },
      ok: 1,
    });
  });

  test('stops at depth limit', () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(redact(deep)).toEqual({ a: { b: { c: { d: { e: '[depth-limit]' } } } } });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(redact(circular)).toEqual({
      self: { self: { self: { self: { self: '[depth-limit]' } } } },
    });
  });

  test('filters below min level', () => {
    setMinLevel('warn');
    const entries: LogEntry[] = [];
    const remove = addLogSink({ write: (e) => entries.push(e) });
    const log = createLogger('t');
    log.debug('d');
    log.error('e', { password: 'p' });
    remove();
    expect(entries.map((e) => e.level)).toEqual(['error']);
    expect(entries[0]).toMatchObject({ context: { password: '[redacted]' } });
  });

  test('omits context when empty and survives a throwing sink', () => {
    setMinLevel('debug');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const entries: LogEntry[] = [];
    const removeBad = addLogSink({
      write: () => {
        throw new Error('boom');
      },
    });
    const removeGood = addLogSink({ write: (e) => entries.push(e) });
    createLogger('t').info('hi', {});
    removeBad();
    removeGood();
    expect(entries).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[logger] sink failed'));
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('boom');
    expect(entries[0]).not.toHaveProperty('context');
  });

  test('serializes errors', () => {
    expect(redact(new Error('x'))).toMatchObject({ name: 'Error', message: 'x' });
  });
});
