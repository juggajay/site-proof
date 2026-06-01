import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import type { SubcontractorPortalAccessKey } from '../../lib/projectAccess.js';
import { LOT_PORTAL_MODULES, MAX_ID_LENGTH, queryableStatuses } from './validation.js';

function getRequiredQueryString(query: Request['query'], key: string, maxLength?: number): string {
  const value = query[key];
  if (value === undefined) {
    throw AppError.badRequest(`${key} query parameter is required`);
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${key} query parameter must be a single value`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${key} query parameter is required`);
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw AppError.badRequest(`${key} query parameter is too long`);
  }
  return trimmed;
}

function getOptionalQueryString(query: Request['query'], key: string): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${key} query parameter must be a single value`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${key} query parameter must not be empty`);
  }
  return trimmed;
}

function getOptionalBoundedQueryString(
  query: Request['query'],
  key: string,
  maxLength: number,
): string | undefined {
  const value = getOptionalQueryString(query, key);
  if (value === undefined) {
    return undefined;
  }
  if (value.length > maxLength) {
    throw AppError.badRequest(`${key} query parameter must be ${maxLength} characters or less`);
  }
  return value;
}

function parseLotRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function getOptionalLotPortalModule(
  query: Request['query'],
): SubcontractorPortalAccessKey | undefined {
  const portalModule = getOptionalQueryString(query, 'portalModule');
  if (portalModule === undefined) {
    return undefined;
  }

  if (!LOT_PORTAL_MODULES.has(portalModule as SubcontractorPortalAccessKey)) {
    throw AppError.badRequest('portalModule must be one of: lots, itps');
  }

  return portalModule as SubcontractorPortalAccessKey;
}

function parsePositiveIntQuery(
  query: Request['query'],
  key: string,
  defaultValue: number,
  max?: number,
): number {
  const value = getOptionalQueryString(query, key);
  if (value === undefined) {
    return defaultValue;
  }
  if (!/^\d+$/.test(value)) {
    throw AppError.badRequest(`${key} must be a positive integer`);
  }
  const parsed = Number(value);
  if (parsed < 1 || !Number.isSafeInteger(parsed)) {
    throw AppError.badRequest(`${key} must be a positive integer`);
  }
  if (max !== undefined && parsed > max) {
    throw AppError.badRequest(`${key} must be less than or equal to ${max}`);
  }
  return parsed;
}

function parseLotStatusFilter(status: string): Prisma.StringFilter | string | undefined {
  const statuses = status
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (statuses.length === 0) {
    throw AppError.badRequest('status query parameter must not be empty');
  }

  const invalidStatuses = statuses.filter(
    (value) => !queryableStatuses.includes(value as (typeof queryableStatuses)[number]),
  );
  if (invalidStatuses.length > 0) {
    throw AppError.badRequest(`status must be one of: ${queryableStatuses.join(', ')}`);
  }

  const uniqueStatuses = [...new Set(statuses)];
  return uniqueStatuses.length === 1 ? uniqueStatuses[0] : { in: uniqueStatuses };
}

function getUniqueLotIds(lotIds: string[]): string[] {
  return [...new Set(lotIds)];
}

function assertAllRequestedLotsFound(requestedLotIds: string[], foundLots: Array<{ id: string }>) {
  const foundIds = new Set(foundLots.map((lot) => lot.id));
  const missingLotIds = requestedLotIds.filter((id) => !foundIds.has(id));
  if (missingLotIds.length > 0) {
    throw AppError.badRequest('One or more selected lots were not found', { missingLotIds });
  }
}

export {
  getRequiredQueryString,
  getOptionalQueryString,
  getOptionalBoundedQueryString,
  parseLotRouteParam,
  getOptionalLotPortalModule,
  parsePositiveIntQuery,
  parseLotStatusFilter,
  getUniqueLotIds,
  assertAllRequestedLotsFound,
};
