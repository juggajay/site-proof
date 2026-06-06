import type { z } from 'zod';

import { AppError } from '../../lib/AppError.js';

export function parseDocketReviewRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  body: unknown,
  fallbackMessage: string,
): z.infer<TSchema> {
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw AppError.badRequest(parseResult.error.errors[0]?.message || fallbackMessage);
  }

  return parseResult.data;
}

export function requireNonBlankReviewText(value: string, message: string): void {
  if (value.trim() === '') {
    throw AppError.badRequest(message);
  }
}
