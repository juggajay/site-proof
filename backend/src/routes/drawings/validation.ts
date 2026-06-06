import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../lib/AppError.js';

export const DRAWING_STATUSES = ['preliminary', 'for_construction', 'as_built'] as const;
const MAX_ID_LENGTH = 120;
const MAX_DRAWING_NUMBER_LENGTH = 120;
const MAX_TITLE_LENGTH = 240;
const MAX_REVISION_LENGTH = 40;
const MAX_DATE_LENGTH = 32;
export const MAX_FILENAME_LENGTH = 180;
export const MAX_SEARCH_LENGTH = 200;
export const MAX_CURRENT_SET_DOWNLOAD_DRAWINGS = 500;

const requiredFormStringSchema = (fieldName: string, maxLength = MAX_ID_LENGTH) =>
  z.string().trim().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`);

const nullableFormStringSchema = (fieldName: string, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return value;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(maxLength, `${fieldName} is too long`).nullish(),
  );

const optionalDrawingStatusSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.enum(DRAWING_STATUSES).optional());

export const createDrawingSchema = z.object({
  projectId: requiredFormStringSchema('projectId'),
  drawingNumber: requiredFormStringSchema('drawingNumber', MAX_DRAWING_NUMBER_LENGTH),
  title: nullableFormStringSchema('title', MAX_TITLE_LENGTH),
  revision: nullableFormStringSchema('revision', MAX_REVISION_LENGTH),
  issueDate: nullableFormStringSchema('issueDate', MAX_DATE_LENGTH),
  status: optionalDrawingStatusSchema,
});

export const updateDrawingSchema = z.object({
  title: nullableFormStringSchema('title', MAX_TITLE_LENGTH),
  revision: nullableFormStringSchema('revision', MAX_REVISION_LENGTH),
  issueDate: nullableFormStringSchema('issueDate', MAX_DATE_LENGTH),
  status: optionalDrawingStatusSchema,
  supersededById: nullableFormStringSchema('supersededById', MAX_ID_LENGTH),
});

export const supersedeDrawingSchema = z.object({
  title: nullableFormStringSchema('title', MAX_TITLE_LENGTH),
  revision: requiredFormStringSchema('revision', MAX_REVISION_LENGTH),
  issueDate: nullableFormStringSchema('issueDate', MAX_DATE_LENGTH),
  status: optionalDrawingStatusSchema,
});

export function getOptionalQueryString(
  query: Request['query'],
  fieldName: string,
  maxLength: number,
): string | undefined {
  const value = query[fieldName];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

export function parseDrawingRouteParam(value: unknown, fieldName: string): string {
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

export function requireValidDrawingRouteParam(fieldName: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    parseDrawingRouteParam(req.params[fieldName], fieldName);
    next();
  };
}

export function getOptionalStatusQuery(
  query: Request['query'],
): (typeof DRAWING_STATUSES)[number] | undefined {
  const status = getOptionalQueryString(query, 'status', MAX_REVISION_LENGTH);
  if (!status) {
    return undefined;
  }

  const parsed = z.enum(DRAWING_STATUSES).safeParse(status);
  if (!parsed.success) {
    throw AppError.badRequest('status must be a valid drawing status');
  }

  return parsed.data;
}

export function containsInsensitive(value: string) {
  return {
    contains: value,
    mode: 'insensitive' as const,
  };
}

export function parseDrawingDate(value: string | null | undefined, fieldName: string): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw AppError.badRequest(`${fieldName} must be a valid date`);
    }

    return date;
  }

  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  return date;
}

export function zodValidationMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  const fieldName = firstIssue?.path.join('.');
  return fieldName ? `${fieldName}: ${firstIssue.message}` : 'Validation failed';
}
