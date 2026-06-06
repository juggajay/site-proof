import { AppError } from '../../lib/AppError.js';

const COMMENT_CONTENT_MAX_LENGTH = 5000;
const COMMENT_ROUTE_PARAM_MAX_LENGTH = 120;

export function getSingleString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseCommentRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > COMMENT_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

export function requireContent(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest('content is required');
  }

  const content = value.trim();
  if (content.length > COMMENT_CONTENT_MAX_LENGTH) {
    throw AppError.badRequest(`content must be ${COMMENT_CONTENT_MAX_LENGTH} characters or less`);
  }

  return content;
}
