import { describe, expect, it } from 'vitest';
import {
  buildDashboardDateFilter,
  createEmptyLotStatusCounts,
  parseDashboardDateRange,
  parseDashboardDays,
  parseDashboardRouteParam,
  parseOptionalDashboardString,
} from './operationalQuery.js';

describe('dashboard operational query helpers', () => {
  it('creates empty lot status counts for every dashboard status', () => {
    expect(createEmptyLotStatusCounts()).toEqual({
      not_started: 0,
      in_progress: 0,
      awaiting_test: 0,
      hold_point: 0,
      ncr_raised: 0,
      completed: 0,
      conformed: 0,
      claimed: 0,
    });
  });

  it('trims route params and rejects blank values', () => {
    expect(parseDashboardRouteParam('  project-1  ', 'projectId')).toBe('project-1');
    expect(() => parseDashboardRouteParam('   ', 'projectId')).toThrow('projectId is required');
  });

  it('parses the days query with the existing default and range guard', () => {
    expect(parseDashboardDays(undefined)).toBe(30);
    expect(parseDashboardDays('365')).toBe(365);
    expect(() => parseDashboardDays('0')).toThrow('days must be between 1 and 365');
    expect(() => parseDashboardDays('10.5')).toThrow('days must be between 1 and 365');
  });

  it('trims optional dashboard strings and rejects empty values', () => {
    expect(parseOptionalDashboardString(undefined, 'projectId')).toBeUndefined();
    expect(parseOptionalDashboardString('  subbie-1  ', 'subcontractorId')).toBe('subbie-1');
    expect(() => parseOptionalDashboardString('   ', 'projectId')).toThrow(
      'projectId must not be empty',
    );
  });

  it('treats date-only end dates as exclusive next-day filters', () => {
    const range = parseDashboardDateRange('2026-06-01', '2026-06-03');
    const filter = buildDashboardDateFilter(range);

    expect(filter?.gte).toEqual(new Date('2026-06-01'));
    expect(filter?.lt).toEqual(new Date('2026-06-04'));
    expect(filter).not.toHaveProperty('lte');
  });

  it('keeps timestamp end dates inclusive', () => {
    const end = '2026-06-03T12:30:00.000Z';
    const filter = buildDashboardDateFilter(parseDashboardDateRange(undefined, end));

    expect(filter?.lte).toEqual(new Date(end));
    expect(filter).not.toHaveProperty('lt');
  });

  it('rejects impossible dates and reversed ranges', () => {
    expect(() => parseDashboardDateRange('2026-02-31', undefined)).toThrow(
      'Invalid startDate date',
    );
    expect(() => parseDashboardDateRange('2026-06-05', '2026-06-03')).toThrow(
      'startDate must be on or before endDate',
    );
  });
});
