import { isProd } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  context?: Record<string, unknown>;
  time: string;
}

export interface LogSink {
  write(entry: LogEntry): void;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const SECRET_KEY_PATTERN = /token|password|secret|authorization|apikey|api_key|code_verifier/i;
const MAX_REDACT_DEPTH = 5;
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function redact(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value !== 'object' || value === null) return value;
  if (depth >= MAX_REDACT_DEPTH) return '[depth-limit]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SECRET_KEY_PATTERN.test(key.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

const consoleSink: LogSink = {
  write(entry) {
    const line = `[${entry.scope}] ${entry.message}`;
    const args = entry.context ? [line, entry.context] : [line];
    console[entry.level](...args);
  },
};

const sinks: LogSink[] = [consoleSink];
let minLevel: LogLevel | undefined;

export function setMinLevel(level: LogLevel | undefined): void {
  minLevel = level;
}

function currentMinLevel(): LogLevel {
  return minLevel ?? (isProd() ? 'warn' : 'debug');
}

export function addLogSink(sink: LogSink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentMinLevel()]) return;
  const entry: LogEntry = { level, scope, message, time: new Date().toISOString() };
  if (context && Object.keys(context).length > 0) {
    entry.context = redact(context) as Record<string, unknown>;
  }
  for (const sink of [...sinks]) {
    try {
      sink.write(entry);
    } catch (sinkError) {
      console.error(`[logger] sink failed: ${String(sinkError)}`);
    }
  }
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, context) => {
      emit('debug', scope, message, context);
    },
    info: (message, context) => {
      emit('info', scope, message, context);
    },
    warn: (message, context) => {
      emit('warn', scope, message, context);
    },
    error: (message, context) => {
      emit('error', scope, message, context);
    },
  };
}
