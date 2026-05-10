import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo, logWarn } from './serverLogger.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('serverLogger', () => {
  it('redacts sensitive strings and error messages before writing to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError(
      'Failed callback token=reset_secret Authorization=Bearer should-hide',
      new Error('Provider returned access_token=oauth_secret and ApiKey service_secret'),
    );

    const loggedText = JSON.stringify(consoleSpy.mock.calls);
    expect(loggedText).toContain('token=[REDACTED]');
    expect(loggedText).toContain('access_token=[REDACTED]');
    expect(loggedText).toContain('ApiKey [REDACTED]');
    expect(loggedText).not.toContain('reset_secret');
    expect(loggedText).not.toContain('oauth_secret');
    expect(loggedText).not.toContain('service_secret');
  });

  it('sanitizes nested object values and only includes stacks outside production', () => {
    process.env.NODE_ENV = 'production';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logWarn(
      'Webhook failed',
      {
        headers: {
          authorization: 'Bearer nested_secret',
        },
        url: '/callback?signature=signed-value&status=failed',
      },
      new Error('token=error_secret'),
    );

    const loggedText = JSON.stringify(warnSpy.mock.calls);
    expect(loggedText).toContain('[REDACTED]');
    expect(loggedText).not.toContain('nested_secret');
    expect(loggedText).not.toContain('signed-value');
    expect(loggedText).not.toContain('error_secret');
    expect(loggedText).not.toContain('stack');
  });

  it('passes safe informational messages through the info channel', () => {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logInfo('Worker started', { queue: 'email', pending: 2 });

    expect(infoSpy).toHaveBeenCalledWith('Worker started', { queue: 'email', pending: 2 });
  });
});
