import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';

export const NCR_WORKFLOW_SHORT_TEXT_MAX_LENGTH = 160;
export const NCR_WORKFLOW_TEXT_MAX_LENGTH = 5000;
export const NCR_WORKFLOW_MESSAGE_MAX_LENGTH = 3000;
export const NCR_WORKFLOW_EMAIL_MAX_LENGTH = 254;

function optionalTrimmedWorkflowString(fieldName: string, maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
      .optional(),
  );
}

function requiredTrimmedWorkflowString(
  fieldName: string,
  maxLength: number,
  requiredMessage: string,
) {
  return z
    .string({
      required_error: requiredMessage,
      invalid_type_error: requiredMessage,
    })
    .trim()
    .min(1, requiredMessage)
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`);
}

export const respondNcrSchema = z.object({
  rootCauseCategory: optionalTrimmedWorkflowString(
    'Root cause category',
    NCR_WORKFLOW_SHORT_TEXT_MAX_LENGTH,
  ),
  rootCauseDescription: optionalTrimmedWorkflowString(
    'Root cause description',
    NCR_WORKFLOW_TEXT_MAX_LENGTH,
  ),
  proposedCorrectiveAction: optionalTrimmedWorkflowString(
    'Proposed corrective action',
    NCR_WORKFLOW_TEXT_MAX_LENGTH,
  ),
});

export const qmReviewSchema = z.object({
  action: z.enum(['accept', 'request_revision']),
  comments: optionalTrimmedWorkflowString('Comments', NCR_WORKFLOW_TEXT_MAX_LENGTH),
});

export const rectifyNcrSchema = z.object({
  rectificationNotes: optionalTrimmedWorkflowString(
    'Rectification notes',
    NCR_WORKFLOW_TEXT_MAX_LENGTH,
  ),
});

export const rejectRectificationSchema = z.object({
  feedback: requiredTrimmedWorkflowString(
    'Feedback',
    NCR_WORKFLOW_MESSAGE_MAX_LENGTH,
    'Feedback is required when rejecting rectification',
  ),
});

export const closeNcrSchema = z
  .object({
    verificationNotes: optionalTrimmedWorkflowString(
      'Verification notes',
      NCR_WORKFLOW_TEXT_MAX_LENGTH,
    ),
    lessonsLearned: optionalTrimmedWorkflowString('Lessons learned', NCR_WORKFLOW_TEXT_MAX_LENGTH),
    withConcession: z.boolean().optional(),
    concessionJustification: optionalTrimmedWorkflowString(
      'Concession justification',
      NCR_WORKFLOW_TEXT_MAX_LENGTH,
    ),
    concessionRiskAssessment: optionalTrimmedWorkflowString(
      'Concession risk assessment',
      NCR_WORKFLOW_TEXT_MAX_LENGTH,
    ),
    // M27: a major NCR that requires client notification can only be closed once
    // clientNotifiedAt is set, OR with an explicit, reasoned override.
    overrideClientNotification: z.boolean().optional(),
    clientNotificationOverrideReason: optionalTrimmedWorkflowString(
      'Client notification override reason',
      NCR_WORKFLOW_TEXT_MAX_LENGTH,
    ),
    // H9: the client's approval reference for a major-NCR concession (e.g. an
    // email/letter/document id). Persisted + required server-side for major
    // concessions; previously collected by the UI and silently dropped.
    clientApprovalReference: optionalTrimmedWorkflowString(
      'Client approval reference',
      NCR_WORKFLOW_SHORT_TEXT_MAX_LENGTH,
    ),
  })
  .superRefine((data, ctx) => {
    if (data.overrideClientNotification && !data.clientNotificationOverrideReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientNotificationOverrideReason'],
        message: 'A reason is required to override the client notification requirement',
      });
    }

    if (!data.withConcession) {
      return;
    }

    if (!data.concessionJustification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['concessionJustification'],
        message: 'Concession justification is required when closing with concession',
      });
    }

    if (!data.concessionRiskAssessment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['concessionRiskAssessment'],
        message: 'Concession risk assessment is required when closing with concession',
      });
    }
  });

/**
 * H9: a major NCR closed by concession must record the client's approval
 * reference. Severity lives on the persisted NCR (not the request body), so
 * this is enforced in the close handler rather than the close schema.
 */
export function requireMajorConcessionClientApproval(params: {
  severity: string;
  withConcession: boolean | undefined;
  clientApprovalReference: string | undefined;
}): void {
  if (params.withConcession && params.severity === 'major' && !params.clientApprovalReference) {
    throw AppError.badRequest(
      'Closing a major NCR with concession requires a client approval reference.',
    );
  }
}

export const notifyClientSchema = z.object({
  recipientEmail: optionalTrimmedWorkflowString(
    'Recipient email',
    NCR_WORKFLOW_EMAIL_MAX_LENGTH,
  ).pipe(z.string().email().optional()),
  additionalMessage: optionalTrimmedWorkflowString(
    'Additional message',
    NCR_WORKFLOW_MESSAGE_MAX_LENGTH,
  ),
});

export const reopenNcrSchema = z.object({
  reason: optionalTrimmedWorkflowString('Reason', NCR_WORKFLOW_MESSAGE_MAX_LENGTH),
});

export const submitForVerificationSchema = z.object({
  rectificationNotes: optionalTrimmedWorkflowString(
    'Rectification notes',
    NCR_WORKFLOW_TEXT_MAX_LENGTH,
  ),
});
