import type { z } from 'zod';

import { AppError } from './AppError.js';

/**
 * Parse a request body or query with a Zod schema, turning a failure into a
 * 400 rather than an unhandled `ZodError`.
 *
 * Pair it with `.strict()` on the schema: together they make an unknown key a
 * refusal instead of a silent no-op, which is the shape Wave C5's evidence
 * routes depend on (`[C5S-B10]`) — the inverse of an exemption list, which
 * widens quietly the moment a field is added.
 */
export function parseOrBadRequest<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppError.fromZodError(result.error);
  }
  return result.data;
}
