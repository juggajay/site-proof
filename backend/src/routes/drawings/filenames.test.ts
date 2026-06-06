import crypto from 'crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildStoredFilename, sanitizeUploadFilename } from './filenames.js';

describe('drawing upload filename helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes paths and unsafe filename characters', () => {
    expect(sanitizeUploadFilename('C:\\temp\\bad<name>?.pdf')).toBe('bad_name__.pdf');
  });

  it('falls back when the filename has no usable characters', () => {
    expect(sanitizeUploadFilename('...')).toBe('upload');
  });

  it('builds a unique stored filename with the sanitized original filename', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');

    expect(buildStoredFilename('unsafe/name?.pdf')).toBe(
      '123456-11111111-1111-4111-8111-111111111111-name_.pdf',
    );
  });
});
