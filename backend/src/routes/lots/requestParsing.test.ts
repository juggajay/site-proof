import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { AppError } from '../../lib/AppError.js';
import {
  getRequiredQueryString,
  getOptionalQueryString,
  getOptionalBoundedQueryString,
  parseLotRouteParam,
  getOptionalLotPortalModule,
  parsePositiveIntQuery,
  parseLotStatusFilter,
  getUniqueLotIds,
  assertAllRequestedLotsFound,
} from './requestParsing.js';

// These helpers are pure request/query parsers — no Prisma, no I/O — so they
// are characterized here without a database. `requestParsing.ts` imports
// `Prisma` as a type only, so this suite never pulls the Prisma runtime in.

const query = (obj: Record<string, string | string[] | undefined>): Request['query'] =>
  obj as unknown as Request['query'];

// Capture an AppError thrown by fn (and assert it really threw one).
const caught = (fn: () => unknown): AppError => {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('Expected the call to throw an AppError');
};

describe('lots request parsing helpers (pure, DB-free)', () => {
  describe('getRequiredQueryString', () => {
    it('returns the trimmed value when present', () => {
      expect(getRequiredQueryString(query({ projectId: '  abc  ' }), 'projectId')).toBe('abc');
    });

    it('rejects a missing value', () => {
      const err = caught(() => getRequiredQueryString(query({}), 'projectId'));
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('projectId query parameter is required');
    });

    it('rejects a non-string (array) value', () => {
      const err = caught(() =>
        getRequiredQueryString(query({ projectId: ['a', 'b'] }), 'projectId'),
      );
      expect(err.message).toBe('projectId query parameter must be a single value');
    });

    it('rejects a blank value', () => {
      const err = caught(() => getRequiredQueryString(query({ projectId: '   ' }), 'projectId'));
      expect(err.message).toBe('projectId query parameter is required');
    });

    it('rejects a value over maxLength', () => {
      const err = caught(() =>
        getRequiredQueryString(query({ projectId: 'abcdef' }), 'projectId', 5),
      );
      expect(err.message).toBe('projectId query parameter is too long');
    });
  });

  describe('getOptionalQueryString', () => {
    it('returns undefined when the key is absent', () => {
      expect(getOptionalQueryString(query({}), 'status')).toBeUndefined();
    });

    it('rejects a non-string (array) value', () => {
      const err = caught(() => getOptionalQueryString(query({ status: ['a', 'b'] }), 'status'));
      expect(err.message).toBe('status query parameter must be a single value');
    });

    it('rejects a blank value', () => {
      const err = caught(() => getOptionalQueryString(query({ status: '   ' }), 'status'));
      expect(err.message).toBe('status query parameter must not be empty');
    });
  });

  describe('getOptionalBoundedQueryString', () => {
    it('returns the value within the bound', () => {
      expect(getOptionalBoundedQueryString(query({ search: 'road' }), 'search', 10)).toBe('road');
    });

    it('returns undefined when absent', () => {
      expect(getOptionalBoundedQueryString(query({}), 'search', 10)).toBeUndefined();
    });

    it('rejects a value over maxLength', () => {
      const err = caught(() =>
        getOptionalBoundedQueryString(query({ search: 'abcdef' }), 'search', 5),
      );
      expect(err.message).toBe('search query parameter must be 5 characters or less');
    });
  });

  describe('parseLotRouteParam', () => {
    it('returns the trimmed param', () => {
      expect(parseLotRouteParam('  lot-1  ', 'id')).toBe('lot-1');
    });

    it('rejects a non-string value', () => {
      const err = caught(() => parseLotRouteParam(['a'], 'id'));
      expect(err.message).toBe('id must be a single value');
    });

    it('rejects a blank value', () => {
      const err = caught(() => parseLotRouteParam('   ', 'id'));
      expect(err.message).toBe('id is required');
    });

    it('rejects a value over MAX_ID_LENGTH', () => {
      const err = caught(() => parseLotRouteParam('a'.repeat(121), 'id'));
      expect(err.message).toBe('id is too long');
    });
  });

  describe('getOptionalLotPortalModule', () => {
    it('accepts lots', () => {
      expect(getOptionalLotPortalModule(query({ portalModule: 'lots' }))).toBe('lots');
    });

    it('accepts itps', () => {
      expect(getOptionalLotPortalModule(query({ portalModule: 'itps' }))).toBe('itps');
    });

    it('returns undefined when absent', () => {
      expect(getOptionalLotPortalModule(query({}))).toBeUndefined();
    });

    it('rejects any other value', () => {
      const err = caught(() => getOptionalLotPortalModule(query({ portalModule: 'documents' })));
      expect(err.message).toBe('portalModule must be one of: lots, itps');
    });
  });

  describe('parsePositiveIntQuery', () => {
    it('returns the default when absent', () => {
      expect(parsePositiveIntQuery(query({}), 'page', 1)).toBe(1);
    });

    it('parses a valid positive integer', () => {
      expect(parsePositiveIntQuery(query({ page: '5' }), 'page', 1)).toBe(5);
    });

    it('rejects a non-integer value', () => {
      const err = caught(() => parsePositiveIntQuery(query({ page: '1.5' }), 'page', 1));
      expect(err.message).toBe('page must be a positive integer');
    });

    it('rejects zero', () => {
      const err = caught(() => parsePositiveIntQuery(query({ page: '0' }), 'page', 1));
      expect(err.message).toBe('page must be a positive integer');
    });

    it('rejects a value over max', () => {
      const err = caught(() => parsePositiveIntQuery(query({ limit: '101' }), 'limit', 20, 100));
      expect(err.message).toBe('limit must be less than or equal to 100');
    });
  });

  describe('parseLotStatusFilter', () => {
    it('returns a single status as a string', () => {
      expect(parseLotStatusFilter('completed')).toBe('completed');
    });

    it('returns multiple statuses as an `in` filter', () => {
      expect(parseLotStatusFilter('completed,conformed')).toEqual({
        in: ['completed', 'conformed'],
      });
    });

    it('de-dupes duplicate statuses', () => {
      expect(parseLotStatusFilter('completed,completed')).toBe('completed');
    });

    it('rejects an invalid status', () => {
      const err = caught(() => parseLotStatusFilter('bogus'));
      expect(err.message).toMatch(/^status must be one of: /);
    });

    it('rejects an empty status list', () => {
      const err = caught(() => parseLotStatusFilter(' , '));
      expect(err.message).toBe('status query parameter must not be empty');
    });
  });

  describe('getUniqueLotIds', () => {
    it('removes duplicate ids preserving order', () => {
      expect(getUniqueLotIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('assertAllRequestedLotsFound', () => {
    it('does not throw when every requested lot is found', () => {
      expect(() =>
        assertAllRequestedLotsFound(['a', 'b'], [{ id: 'a' }, { id: 'b' }]),
      ).not.toThrow();
    });

    it('throws with the missing ids under error.details (not error.code)', () => {
      const err = caught(() => assertAllRequestedLotsFound(['a', 'b', 'c'], [{ id: 'a' }]));
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('One or more selected lots were not found');
      // Lesson: AppError.badRequest stores domain markers under .details, and
      // leaves .code as the default VALIDATION_ERROR.
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual({ missingLotIds: ['b', 'c'] });
    });
  });
});
