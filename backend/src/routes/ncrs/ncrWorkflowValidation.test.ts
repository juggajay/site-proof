import { describe, expect, it } from 'vitest';
import {
  closeNcrSchema,
  notifyClientSchema,
  rejectRectificationSchema,
  requireMajorConcessionClientApproval,
  respondNcrSchema,
} from './ncrWorkflowValidation.js';

describe('ncrWorkflowValidation', () => {
  it('trims required response fields', () => {
    const result = respondNcrSchema.parse({
      rootCauseCategory: '  workmanship  ',
      rootCauseDescription: '  Incorrect method  ',
      proposedCorrectiveAction: '  Rework affected section  ',
    });

    expect(result).toEqual({
      rootCauseCategory: 'workmanship',
      rootCauseDescription: 'Incorrect method',
      proposedCorrectiveAction: 'Rework affected section',
    });
  });

  it('requires root cause and corrective action before an NCR response can progress', () => {
    const result = respondNcrSchema.safeParse({
      rootCauseCategory: '  ',
      rootCauseDescription: '  ',
      proposedCorrectiveAction: '  ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual([
        'Root cause category is required',
        'Root cause description is required',
        'Proposed corrective action is required',
      ]);
    }
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

  it('requires concession justification and risk assessment when closing with concession', () => {
    const result = closeNcrSchema.safeParse({
      withConcession: true,
      concessionJustification: '  ',
      concessionRiskAssessment: 'Accepted after engineering review',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Concession justification is required when closing with concession',
      );
    }

    const missingRisk = closeNcrSchema.safeParse({
      withConcession: true,
      concessionJustification: 'Approved by superintendent',
      concessionRiskAssessment: '  ',
    });

    expect(missingRisk.success).toBe(false);
    if (!missingRisk.success) {
      expect(missingRisk.error.issues[0]?.message).toBe(
        'Concession risk assessment is required when closing with concession',
      );
    }
  });

  it('accepts and trims a client approval reference on close (H9)', () => {
    const result = closeNcrSchema.parse({
      withConcession: true,
      concessionJustification: 'Approved by superintendent',
      concessionRiskAssessment: 'Low residual risk',
      clientApprovalReference: '  Email ref RFI-204  ',
    });

    expect(result.clientApprovalReference).toBe('Email ref RFI-204');
  });

  it('requires a client approval reference to close a MAJOR NCR with concession (H9)', () => {
    expect(() =>
      requireMajorConcessionClientApproval({
        severity: 'major',
        withConcession: true,
        clientApprovalReference: undefined,
      }),
    ).toThrow('Closing a major NCR with concession requires a client approval reference');

    // Minor concession does not require it.
    expect(() =>
      requireMajorConcessionClientApproval({
        severity: 'minor',
        withConcession: true,
        clientApprovalReference: undefined,
      }),
    ).not.toThrow();

    // Major non-concession close (rectified) does not require it.
    expect(() =>
      requireMajorConcessionClientApproval({
        severity: 'major',
        withConcession: false,
        clientApprovalReference: undefined,
      }),
    ).not.toThrow();

    // Major concession WITH a reference is allowed.
    expect(() =>
      requireMajorConcessionClientApproval({
        severity: 'major',
        withConcession: true,
        clientApprovalReference: 'Letter 2026-44',
      }),
    ).not.toThrow();
  });

  it('requires a reason when overriding the client-notification close gate (M27)', () => {
    const missingReason = closeNcrSchema.safeParse({ overrideClientNotification: true });
    expect(missingReason.success).toBe(false);
    if (!missingReason.success) {
      expect(missingReason.error.issues[0]?.message).toBe(
        'A reason is required to override the client notification requirement',
      );
    }

    const withReason = closeNcrSchema.safeParse({
      overrideClientNotification: true,
      clientNotificationOverrideReason: 'Client notified verbally on site; email to follow',
    });
    expect(withReason.success).toBe(true);
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
