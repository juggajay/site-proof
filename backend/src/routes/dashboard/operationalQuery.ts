import { type Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';

const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
const DASHBOARD_ROUTE_PARAM_MAX_LENGTH = 120;
const DASHBOARD_QUERY_VALUE_MAX_LENGTH = 120;
export const LOT_STATUS_KEYS = [
  'not_started',
  'in_progress',
  'awaiting_test',
  'hold_point',
  'ncr_raised',
  'completed',
  'conformed',
  'claimed',
] as const;

export type LotStatusKey = (typeof LOT_STATUS_KEYS)[number];
export type LotStatusCounts = Record<LotStatusKey, number>;

type DashboardDateRange = {
  start?: Date;
  endInclusive?: Date;
  endExclusive?: Date;
};

export function createEmptyLotStatusCounts(): LotStatusCounts {
  return Object.fromEntries(LOT_STATUS_KEYS.map((status) => [status, 0])) as LotStatusCounts;
}

export function parseDashboardRouteParam(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > DASHBOARD_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

export function parseOptionalDashboardDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a string`);
  }

  const normalized = value.trim();
  const dateComponentMatch = DATE_COMPONENT_QUERY_PATTERN.exec(normalized);
  if (dateComponentMatch) {
    const [, year, month, day] = dateComponentMatch;
    const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      dateComponent.getUTCFullYear() !== Number(year) ||
      dateComponent.getUTCMonth() !== Number(month) - 1 ||
      dateComponent.getUTCDate() !== Number(day)
    ) {
      throw AppError.badRequest(`Invalid ${field} date`);
    }
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest(`Invalid ${field} date`);
  }

  return date;
}

export function parseOptionalDashboardString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} must not be empty`);
  }

  if (normalized.length > DASHBOARD_QUERY_VALUE_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

export function parseDashboardDays(value: unknown): number {
  if (value === undefined) return 30;
  if (typeof value !== 'string') {
    throw AppError.badRequest('days must be a string');
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw AppError.badRequest('days must be between 1 and 365');
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw AppError.badRequest('days must be between 1 and 365');
  }

  return parsed;
}

function isDateOnlyDashboardValue(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function parseDashboardDateRange(
  startDateValue: unknown,
  endDateValue: unknown,
): DashboardDateRange {
  const start = parseOptionalDashboardDate(startDateValue, 'startDate');
  const parsedEnd = parseOptionalDashboardDate(endDateValue, 'endDate');
  let endInclusive: Date | undefined;
  let endExclusive: Date | undefined;

  if (parsedEnd) {
    if (isDateOnlyDashboardValue(endDateValue)) {
      endExclusive = new Date(parsedEnd);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    } else {
      endInclusive = parsedEnd;
    }
  }

  if (start && endExclusive && start >= endExclusive) {
    throw AppError.badRequest('startDate must be on or before endDate');
  }

  if (start && endInclusive && start > endInclusive) {
    throw AppError.badRequest('startDate must be on or before endDate');
  }

  return { start, endInclusive, endExclusive };
}

export function buildDashboardDateFilter(
  range: DashboardDateRange,
): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {};

  if (range.start) {
    filter.gte = range.start;
  }
  if (range.endExclusive) {
    filter.lt = range.endExclusive;
  } else if (range.endInclusive) {
    filter.lte = range.endInclusive;
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}
