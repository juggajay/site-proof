import { describe, expect, it } from 'vitest';
import { parsePagination } from './pagination.js';

describe('parsePagination', () => {
  it('should apply defaults when pagination parameters are omitted', () => {
    expect(parsePagination({})).toEqual({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });
  });

  it('should parse valid pagination and sort parameters', () => {
    expect(
      parsePagination({
        page: '2',
        limit: '50',
        sortBy: 'createdAt',
        sortOrder: 'asc',
      }),
    ).toEqual({
      page: 2,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
  });

  it('should reject malformed pagination parameters', () => {
    expect(() => parsePagination({ page: '0' })).toThrow('page must be a positive integer');
    expect(() => parsePagination({ page: '-1' })).toThrow('page must be a positive integer');
    expect(() => parsePagination({ page: '1.5' })).toThrow('page must be a positive integer');
    expect(() => parsePagination({ page: ['1', '2'] })).toThrow(
      'page must be a single positive integer',
    );
    expect(() => parsePagination({ limit: '101' })).toThrow('limit must be no greater than 100');
    expect(() => parsePagination({ limit: 'abc' })).toThrow('limit must be a positive integer');
    expect(() => parsePagination({ limit: ['10', '20'] })).toThrow(
      'limit must be a single positive integer',
    );
  });

  it('should reject malformed sort parameters', () => {
    expect(() => parsePagination({ sortBy: ['createdAt', 'updatedAt'] })).toThrow(
      'sortBy must be a string',
    );
    expect(() => parsePagination({ sortOrder: 'newest' })).toThrow('sortOrder must be asc or desc');
    expect(() => parsePagination({ sortOrder: ['asc', 'desc'] })).toThrow(
      'sortOrder must be asc or desc',
    );
  });

  it('should reject pagination that would overflow skip calculation', () => {
    expect(() =>
      parsePagination({
        page: String(Number.MAX_SAFE_INTEGER),
        limit: '100',
      }),
    ).toThrow('page is too large');
  });
});
