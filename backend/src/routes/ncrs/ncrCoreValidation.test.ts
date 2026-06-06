import { describe, expect, it } from 'vitest';
import {
  createNcrSchema,
  getNextNcrNumber,
  getOptionalQueryString,
  isUniqueConstraintOn,
  parseNcrSortBy,
  parseOptionalNcrDueDate,
  updateNcrSchema,
} from './ncrCoreValidation.js';

describe('ncrCoreValidation', () => {
  it('trims create NCR fields and drops blank optional strings', () => {
    const result = createNcrSchema.parse({
      projectId: '  project-1  ',
      description: '  Nonconforming compaction result  ',
      specificationReference: '   ',
      category: '  major  ',
      responsibleUserId: '  user-1  ',
      dueDate: '  2026-06-15  ',
      lotIds: ['  lot-1  ', 'lot-2'],
    });

    expect(result).toEqual({
      projectId: 'project-1',
      description: 'Nonconforming compaction result',
      specificationReference: undefined,
      category: 'major',
      responsibleUserId: 'user-1',
      dueDate: '2026-06-15',
      lotIds: ['lot-1', 'lot-2'],
    });
  });

  it('normalizes blank nullable update fields to null', () => {
    const result = updateNcrSchema.parse({
      responsibleUserId: '   ',
      comments: '  Reviewed by QM  ',
    });

    expect(result).toEqual({
      responsibleUserId: null,
      comments: 'Reviewed by QM',
    });
  });

  it('builds the next NCR number from valid existing sequence values only', () => {
    expect(
      getNextNcrNumber([
        { ncrNumber: 'NCR-0007' },
        { ncrNumber: 'legacy' },
        { ncrNumber: 'NCR-0012' },
      ]),
    ).toBe('NCR-0013');
  });

  it('detects Prisma unique constraints by normalized target fields', () => {
    const error = { code: 'P2002', meta: { target: ['project_id', 'ncr_number'] } };

    expect(isUniqueConstraintOn(error, ['projectId', 'ncrNumber'])).toBe(true);
    expect(isUniqueConstraintOn(error, ['companyId'])).toBe(false);
  });

  it('parses optional query strings with existing single-value and length errors', () => {
    expect(getOptionalQueryString({ projectId: '  project-1  ' }, 'projectId')).toBe('project-1');
    expect(getOptionalQueryString({}, 'projectId')).toBeUndefined();
    expect(() => getOptionalQueryString({ projectId: ['project-1'] }, 'projectId')).toThrow(
      'projectId query parameter must be a single value',
    );
    expect(() => getOptionalQueryString({ search: '   ' }, 'search')).toThrow(
      'search query parameter must not be empty',
    );
  });

  it('parses and rejects due dates using existing calendar validation', () => {
    expect(parseOptionalNcrDueDate(undefined)).toBeUndefined();
    expect(parseOptionalNcrDueDate(' 2026-06-15 ')?.toISOString()).toBe(
      new Date('2026-06-15').toISOString(),
    );
    expect(() => parseOptionalNcrDueDate('2026-02-31')).toThrow('dueDate must be a valid date');
  });

  it('parses sort fields using the existing allow-list', () => {
    expect(parseNcrSortBy(undefined)).toBeUndefined();
    expect(parseNcrSortBy('dueDate')).toBe('dueDate');
    expect(() => parseNcrSortBy('projectId')).toThrow(
      'sortBy must be one of: createdAt, updatedAt, raisedAt, dueDate, ncrNumber, status, severity, category',
    );
  });
});
