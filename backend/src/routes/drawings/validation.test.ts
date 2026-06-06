import { describe, expect, it } from 'vitest';
import {
  createDrawingSchema,
  getOptionalQueryString,
  getOptionalStatusQuery,
  parseDrawingDate,
  parseDrawingRouteParam,
  supersedeDrawingSchema,
  updateDrawingSchema,
  zodValidationMessage,
} from './validation.js';

describe('drawing validation helpers', () => {
  it('normalizes create drawing form payloads', () => {
    const parsed = createDrawingSchema.parse({
      projectId: ' project-1 ',
      drawingNumber: ' DRG-001 ',
      title: '  General Arrangement ',
      revision: '  A ',
      issueDate: ' 2026-06-06 ',
      status: ' for_construction ',
    });

    expect(parsed).toEqual({
      projectId: 'project-1',
      drawingNumber: 'DRG-001',
      title: 'General Arrangement',
      revision: 'A',
      issueDate: '2026-06-06',
      status: 'for_construction',
    });
  });

  it('preserves nullable update fields and required supersede revision validation', () => {
    expect(
      updateDrawingSchema.parse({
        title: '   ',
        revision: null,
        issueDate: undefined,
        supersededById: ' superseded-id ',
      }),
    ).toEqual({
      title: null,
      revision: null,
      issueDate: undefined,
      supersededById: 'superseded-id',
    });

    const supersedeResult = supersedeDrawingSchema.safeParse({ revision: '   ' });
    expect(supersedeResult.success).toBe(false);
    if (!supersedeResult.success) {
      expect(zodValidationMessage(supersedeResult.error)).toBe('revision: revision is required');
    }
  });

  it('parses query strings and status filters with existing messages', () => {
    expect(getOptionalQueryString({ search: '  concrete ' }, 'search', 200)).toBe('concrete');
    expect(getOptionalQueryString({ search: '   ' }, 'search', 200)).toBeUndefined();
    expect(getOptionalStatusQuery({ status: ' as_built ' })).toBe('as_built');
    expect(() => getOptionalQueryString({ search: ['a', 'b'] }, 'search', 200)).toThrow(
      'search must be a single value',
    );
    expect(() => getOptionalQueryString({ search: 'x'.repeat(201) }, 'search', 200)).toThrow(
      'search is too long',
    );
    expect(() => getOptionalStatusQuery({ status: 'issued' })).toThrow(
      'status must be a valid drawing status',
    );
  });

  it('parses drawing route params with existing messages', () => {
    expect(parseDrawingRouteParam(' drawing-1 ', 'drawingId')).toBe('drawing-1');
    expect(() => parseDrawingRouteParam(undefined, 'drawingId')).toThrow(
      'drawingId must be a single value',
    );
    expect(() => parseDrawingRouteParam('   ', 'drawingId')).toThrow('drawingId is required');
    expect(() => parseDrawingRouteParam('x'.repeat(121), 'drawingId')).toThrow(
      'drawingId is too long',
    );
  });

  it('parses date-only values at UTC midnight and rejects invalid dates', () => {
    const date = parseDrawingDate('2026-06-06', 'issueDate');

    expect(date?.toISOString()).toBe('2026-06-06T00:00:00.000Z');
    expect(parseDrawingDate(null, 'issueDate')).toBeNull();
    expect(() => parseDrawingDate('2026-02-31', 'issueDate')).toThrow(
      'issueDate must be a valid date',
    );
    expect(() => parseDrawingDate('not-a-date', 'issueDate')).toThrow(
      'issueDate must be a valid date',
    );
  });
});
