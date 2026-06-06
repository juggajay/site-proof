import { describe, expect, it } from 'vitest';
import {
  closeNcrSchema,
  notifyClientSchema,
  rejectRectificationSchema,
  respondNcrSchema,
} from './ncrWorkflowValidation.js';

describe('ncrWorkflowValidation', () => {
  it('trims optional response fields and drops blank values', () => {
    const result = respondNcrSchema.parse({
      rootCauseCategory: '  workmanship  ',
      rootCauseDescription: '   ',
      proposedCorrectiveAction: '  Rework affected section  ',
    });

    expect(result).toEqual({
      rootCauseCategory: 'workmanship',
      rootCauseDescription: undefined,
      proposedCorrectiveAction: 'Rework affected section',
    });
  });

  it('requires rejection feedback after trimming whitespace', () => {
    const result = rejectRectificationSchema.safeParse({ feedback: '   ' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Feedback is required when rejecting rectification',
      );
    }
  });

  it('rejects workflow text over the maximum length', () => {
    const result = closeNcrSchema.safeParse({
      verificationNotes: 'x'.repeat(5001),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Verification notes must be 5000 characters or less',
      );
    }
  });

  it('accepts blank recipient email as omitted', () => {
    const result = notifyClientSchema.parse({
      recipientEmail: '   ',
      additionalMessage: '  Please review attached evidence  ',
    });

    expect(result).toEqual({
      recipientEmail: undefined,
      additionalMessage: 'Please review attached evidence',
    });
  });

  it('rejects malformed recipient email values', () => {
    const result = notifyClientSchema.safeParse({
      recipientEmail: 'not-an-email',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Invalid email');
    }
  });
});
