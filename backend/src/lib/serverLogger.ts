import { sanitizeLogText, sanitizeLogValue } from './logSanitization.js';

type LogMethod = 'log' | 'warn' | 'error';

function formatLogArg(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogText(value.message),
      ...(process.env.NODE_ENV === 'development' && value.stack
        ? { stack: sanitizeLogText(value.stack) }
        : {}),
    };
  }

  if (typeof value === 'string') {
    return sanitizeLogText(value);
  }

  return sanitizeLogValue(value);
}

function writeLog(method: LogMethod, message: string, ...args: unknown[]): void {
  console[method](sanitizeLogText(message), ...args.map(formatLogArg));
}

export function logInfo(message: string, ...args: unknown[]): void {
  writeLog('log', message, ...args);
}

export function logWarn(message: string, ...args: unknown[]): void {
  writeLog('warn', message, ...args);
}

export function logError(message: string, ...args: unknown[]): void {
  writeLog('error', message, ...args);
}
