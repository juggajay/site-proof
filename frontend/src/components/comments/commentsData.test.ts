import { describe, expect, it } from 'vitest';
import {
  buildCommentsPath,
  extractResponseError,
  getErrorMessage,
  normalizeCommentsResponse,
  type Comment,
  type CommentsPagination,
} from './commentsData';
import { queryKeys } from '@/lib/queryKeys';

const baseComment: Comment = {
  id: 'comment-1',
  content: 'Hello',
  authorId: 'user-1',
  author: { id: 'user-1', email: 'a@example.com', fullName: 'Ada', avatarUrl: null },
  parentId: null,
  isEdited: false,
  editedAt: null,
  createdAt: '2026-06-03T01:00:00.000Z',
};

const basePagination: CommentsPagination = {
  total: 1,
  page: 1,
  limit: 25,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

describe('buildCommentsPath', () => {
  it('builds the comments endpoint with entity, page, and the fixed page limit', () => {
    expect(buildCommentsPath('lot', 'lot-1', 2)).toBe(
      '/api/comments?entityType=lot&entityId=lot-1&page=2&limit=25',
    );
  });

  it('url-encodes entity values', () => {
    expect(buildCommentsPath('daily diary', 'id/with space', 1)).toBe(
      '/api/comments?entityType=daily+diary&entityId=id%2Fwith+space&page=1&limit=25',
    );
  });
});

describe('extractResponseError', () => {
  it('returns the fallback for an empty body', () => {
    expect(extractResponseError('', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for a non-JSON body', () => {
    expect(extractResponseError('<html>500</html>', 'fallback')).toBe('fallback');
  });

  it('reads a string error field', () => {
    expect(extractResponseError(JSON.stringify({ error: 'Boom' }), 'fallback')).toBe('Boom');
  });

  it('reads a nested error.message field', () => {
    expect(extractResponseError(JSON.stringify({ error: { message: 'Nested' } }), 'fallback')).toBe(
      'Nested',
    );
  });

  it('reads a top-level message field', () => {
    expect(extractResponseError(JSON.stringify({ message: 'Top' }), 'fallback')).toBe('Top');
  });

  it('falls back when present fields are blank', () => {
    expect(extractResponseError(JSON.stringify({ error: '   ', message: '' }), 'fallback')).toBe(
      'fallback',
    );
  });

  it('falls back when the JSON object has no recognised fields', () => {
    expect(extractResponseError(JSON.stringify({ other: 'x' }), 'fallback')).toBe('fallback');
  });
});

describe('getErrorMessage', () => {
  it('uses an Error instance message', () => {
    expect(getErrorMessage(new Error('Real message'), 'fallback')).toBe('Real message');
  });

  it('falls back for a message-less Error', () => {
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });

  it('falls back for non-Error values', () => {
    expect(getErrorMessage('a string', 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('normalizeCommentsResponse', () => {
  it('defaults a missing comments array to empty and missing pagination to null', () => {
    expect(normalizeCommentsResponse({ comments: undefined as unknown as Comment[] })).toEqual({
      comments: [],
      pagination: null,
    });
  });

  it('passes through provided comments and pagination', () => {
    expect(
      normalizeCommentsResponse({ comments: [baseComment], pagination: basePagination }),
    ).toEqual({ comments: [baseComment], pagination: basePagination });
  });

  it('coerces a null pagination to null', () => {
    expect(normalizeCommentsResponse({ comments: [baseComment], pagination: null })).toEqual({
      comments: [baseComment],
      pagination: null,
    });
  });
});

describe('queryKeys.comments', () => {
  it('produces a stable, page-scoped key', () => {
    expect(queryKeys.comments('lot', 'lot-1', 3)).toEqual(['comments', 'lot', 'lot-1', 3]);
  });
});
