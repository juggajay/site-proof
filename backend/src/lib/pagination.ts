import { z } from 'zod';
import { AppError } from './AppError.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Zod schema for pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Generate pagination metadata for response
 */
export function getPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

/**
 * Convert page/limit to Prisma skip/take
 */
export function getPrismaSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Parse pagination from request query with defaults
 */
export function parsePagination(query: unknown): PaginationParams {
  const queryRecord = getQueryRecord(query);
  const page = parsePositiveIntegerQuery(queryRecord.page, 'page', DEFAULT_PAGE);
  const limit = parsePositiveIntegerQuery(queryRecord.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT);
  const sortBy = parseOptionalStringQuery(queryRecord.sortBy, 'sortBy');
  const sortOrder = parseSortOrder(queryRecord.sortOrder);

  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw AppError.badRequest('page is too large');
  }

  return {
    page,
    limit,
    ...(sortBy ? { sortBy } : {}),
    sortOrder,
  };
}

function getQueryRecord(query: unknown): Record<string, unknown> {
  if (query === undefined || query === null) {
    return {};
  }

  if (typeof query !== 'object' || Array.isArray(query)) {
    throw AppError.badRequest('pagination query must be an object');
  }

  return query as Record<string, unknown>;
}

function parsePositiveIntegerQuery(
  value: unknown,
  fieldName: string,
  defaultValue: number,
  maxValue?: number,
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (Array.isArray(value)) {
    throw AppError.badRequest(`${fieldName} must be a single positive integer`);
  }

  const rawValue =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';

  if (!/^\d+$/.test(rawValue)) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  if (maxValue !== undefined && parsed > maxValue) {
    throw AppError.badRequest(`${fieldName} must be no greater than ${maxValue}`);
  }

  return parsed;
}

function parseOptionalStringQuery(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseSortOrder(value: unknown): 'asc' | 'desc' {
  if (value === undefined || value === null || value === '') {
    return 'desc';
  }

  if (Array.isArray(value) || typeof value !== 'string') {
    throw AppError.badRequest('sortOrder must be asc or desc');
  }

  if (value !== 'asc' && value !== 'desc') {
    throw AppError.badRequest('sortOrder must be asc or desc');
  }

  return value;
}
