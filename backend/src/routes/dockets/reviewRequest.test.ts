import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseDocketReviewRequest, requireNonBlankReviewText } from './reviewRequest.js';

describe('docket review request helpers', () => {
  const schema = z.object({
    reason: z.string().min(1, 'Reason is required'),
  });

  it('returns parsed review body data', () => {
    expect(parseDocketReviewRequest(schema, { reason: 'Needs photos' }, 'Invalid body')).toEqual({
      reason: 'Needs photos',
    });
  });

  it('uses the schema validation message when parsing fails', () => {
    expect(() => parseDocketReviewRequest(schema, { reason: '' }, 'Invalid body')).toThrow(
      'Reason is required',
    );
  });

  it('falls back when a schema issue has no message', () => {
    const fallbackSchema = z.string().superRefine((_, ctx) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '' });
    });

    expect(() => parseDocketReviewRequest(fallbackSchema, 'invalid', 'Invalid body')).toThrow(
      'Invalid body',
    );
  });

  it('rejects blank review text with the caller message', () => {
    expect(() => requireNonBlankReviewText('  ', 'Response is required')).toThrow(
      'Response is required',
    );
    expect(() => requireNonBlankReviewText('Looks good', 'Response is required')).not.toThrow();
  });
});
