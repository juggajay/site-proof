import { describe, expect, it } from 'vitest';
import { getSingleString, parseCommentRouteParam, requireContent } from './validation.js';

describe('comment route validation helpers', () => {
  it('normalizes single string inputs', () => {
    expect(getSingleString(' lot-1 ')).toBe('lot-1');
    expect(getSingleString('')).toBeNull();
    expect(getSingleString(['lot-1'])).toBeNull();
  });

  it('parses route params with the existing error messages', () => {
    expect(parseCommentRouteParam(' comment-1 ', 'id')).toBe('comment-1');
    expect(() => parseCommentRouteParam(undefined, 'id')).toThrow('id must be a single value');
    expect(() => parseCommentRouteParam(' ', 'id')).toThrow('id is required');
    expect(() => parseCommentRouteParam('x'.repeat(121), 'id')).toThrow('id is too long');
  });

  it('requires trimmed comment content within the existing limit', () => {
    expect(requireContent(' Looks good ')).toBe('Looks good');
    expect(() => requireContent(' ')).toThrow('content is required');
    expect(() => requireContent('x'.repeat(5001))).toThrow(
      'content must be 5000 characters or less',
    );
  });
});
