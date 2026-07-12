import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  assertExpectedPreviousItpCompletion,
  assertPendingVerificationNotDowngraded,
  assertWitnessDecisionForCompletion,
  buildItpCompletionTransform,
  buildItpCompletionWitnessData,
  buildItpSubbieCompletionNotifications,
  deriveItpCompletionStatus,
  deriveItpVerificationFlags,
  isItpCompletionFinished,
  parseProjectRequiresSubcontractorVerification,
  resolveItpRecompletionVerificationFields,
  resolveSubcontractorVerificationStatus,
  shouldCreateFailedItpNcr,
} from './completionWorkflow.js';

describe('deriveItpCompletionStatus', () => {
  it('returns the explicit status when one is supplied', () => {
    expect(deriveItpCompletionStatus({ directStatus: 'pending', isCompleted: true })).toBe(
      'pending',
    );
    expect(deriveItpCompletionStatus({ directStatus: 'completed' })).toBe('completed');
  });

  it('falls back to the isCompleted flag when no explicit status is supplied', () => {
    expect(deriveItpCompletionStatus({ isCompleted: true })).toBe('completed');
    expect(deriveItpCompletionStatus({ isCompleted: false })).toBe('pending');
    expect(deriveItpCompletionStatus({})).toBe('pending');
  });

  it('accepts not_applicable when a non-blank reason note is supplied', () => {
    expect(
      deriveItpCompletionStatus({ directStatus: 'not_applicable', notes: 'covered elsewhere' }),
    ).toBe('not_applicable');
  });

  it('rejects not_applicable without a reason and stores no domain code override', () => {
    expect(() => deriveItpCompletionStatus({ directStatus: 'not_applicable' })).toThrow(
      'A reason is required when marking an item as N/A',
    );
    expect(() =>
      deriveItpCompletionStatus({ directStatus: 'not_applicable', notes: '   ' }),
    ).toThrow('A reason is required when marking an item as N/A');

    try {
      deriveItpCompletionStatus({ directStatus: 'not_applicable', notes: null });
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(400);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
    }
  });

  it('accepts failed when a non-blank NCR description is supplied', () => {
    expect(
      deriveItpCompletionStatus({ directStatus: 'failed', ncrDescription: 'out of spec' }),
    ).toBe('failed');
  });

  it('rejects failed without an NCR description', () => {
    expect(() => deriveItpCompletionStatus({ directStatus: 'failed' })).toThrow(
      'NCR description is required when marking an item as Failed',
    );
    expect(() =>
      deriveItpCompletionStatus({ directStatus: 'failed', ncrDescription: '  ' }),
    ).toThrow('NCR description is required when marking an item as Failed');
  });
});

describe('isItpCompletionFinished', () => {
  it('is true for completed, not_applicable, and failed', () => {
    expect(isItpCompletionFinished('completed')).toBe(true);
    expect(isItpCompletionFinished('not_applicable')).toBe(true);
    expect(isItpCompletionFinished('failed')).toBe(true);
  });

  it('is false for pending and unknown statuses', () => {
    expect(isItpCompletionFinished('pending')).toBe(false);
    expect(isItpCompletionFinished('in_progress')).toBe(false);
  });
});

describe('assertWitnessDecisionForCompletion (F-08)', () => {
  it('is a no-op for non-witness items regardless of status', () => {
    expect(() =>
      assertWitnessDecisionForCompletion({ isWitnessItem: false, newStatus: 'completed' }),
    ).not.toThrow();
  });

  it('is a no-op for a witness item that is not being completed (N/A, failed, pending)', () => {
    for (const newStatus of ['not_applicable', 'failed', 'pending']) {
      expect(() =>
        assertWitnessDecisionForCompletion({ isWitnessItem: true, newStatus }),
      ).not.toThrow();
    }
  });

  it('rejects a completed witness item with no witness decision', () => {
    expect(() =>
      assertWitnessDecisionForCompletion({ isWitnessItem: true, newStatus: 'completed' }),
    ).toThrow(AppError);
    try {
      assertWitnessDecisionForCompletion({ isWitnessItem: true, newStatus: 'completed' });
    } catch (err) {
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain('witness point');
    }
  });

  it('rejects a present witness completion without a name', () => {
    expect(() =>
      assertWitnessDecisionForCompletion({
        isWitnessItem: true,
        newStatus: 'completed',
        requestWitnessPresent: true,
      }),
    ).toThrow('Witness name is required');
  });

  it('accepts a present witness completion with a name', () => {
    expect(() =>
      assertWitnessDecisionForCompletion({
        isWitnessItem: true,
        newStatus: 'completed',
        requestWitnessPresent: true,
        requestWitnessName: 'Jane Inspector',
      }),
    ).not.toThrow();
  });

  it('accepts a waived witness completion (present === false, no name needed)', () => {
    expect(() =>
      assertWitnessDecisionForCompletion({
        isWitnessItem: true,
        newStatus: 'completed',
        requestWitnessPresent: false,
      }),
    ).not.toThrow();
  });

  it('falls back to the persisted decision when the request omits witness fields', () => {
    // A notes-edit re-complete: request has no witness fields, but the row does.
    expect(() =>
      assertWitnessDecisionForCompletion({
        isWitnessItem: true,
        newStatus: 'completed',
        existingWitnessPresent: true,
        existingWitnessName: 'Jane Inspector',
      }),
    ).not.toThrow();
  });

  it('still rejects when neither request nor existing row records a present name', () => {
    expect(() =>
      assertWitnessDecisionForCompletion({
        isWitnessItem: true,
        newStatus: 'completed',
        existingWitnessPresent: true,
        existingWitnessName: null,
      }),
    ).toThrow('Witness name is required');
  });
});

describe('parseProjectRequiresSubcontractorVerification', () => {
  it('defaults to false when settings are missing', () => {
    expect(parseProjectRequiresSubcontractorVerification(null)).toBe(false);
    expect(parseProjectRequiresSubcontractorVerification(undefined)).toBe(false);
    expect(parseProjectRequiresSubcontractorVerification('')).toBe(false);
  });

  it('reads the flag from a JSON string', () => {
    expect(
      parseProjectRequiresSubcontractorVerification(
        JSON.stringify({ requireSubcontractorVerification: true }),
      ),
    ).toBe(true);
    expect(
      parseProjectRequiresSubcontractorVerification(
        JSON.stringify({ requireSubcontractorVerification: false }),
      ),
    ).toBe(false);
  });

  it('reads the flag from an already parsed object', () => {
    expect(
      parseProjectRequiresSubcontractorVerification({ requireSubcontractorVerification: true }),
    ).toBe(true);
  });

  it('only treats strict boolean true as requiring verification', () => {
    expect(
      parseProjectRequiresSubcontractorVerification({
        requireSubcontractorVerification: 'true',
      }),
    ).toBe(false);
    expect(parseProjectRequiresSubcontractorVerification({})).toBe(false);
  });

  it('falls back to false on invalid JSON', () => {
    expect(parseProjectRequiresSubcontractorVerification('{not valid json')).toBe(false);
  });
});

describe('resolveSubcontractorVerificationStatus', () => {
  it('auto-verifies when the project does not require verification', () => {
    expect(
      resolveSubcontractorVerificationStatus({
        projectRequiresVerification: false,
        itpRequiresVerification: true,
      }),
    ).toBe('verified');
  });

  it('requires verification when the project requires it and the lot assignment requires it', () => {
    expect(
      resolveSubcontractorVerificationStatus({
        projectRequiresVerification: true,
        itpRequiresVerification: true,
      }),
    ).toBe('pending_verification');
  });

  it('auto-verifies when the project requires it but the lot assignment overrides to off', () => {
    expect(
      resolveSubcontractorVerificationStatus({
        projectRequiresVerification: true,
        itpRequiresVerification: false,
      }),
    ).toBe('verified');
  });
});

describe('buildItpCompletionWitnessData', () => {
  it('omits fields that were not supplied', () => {
    expect(buildItpCompletionWitnessData({})).toEqual({});
    expect(buildItpCompletionWitnessData({ witnessPresent: true })).toEqual({
      witnessPresent: true,
    });
  });

  it('coerces empty strings to null but keeps supplied values', () => {
    expect(
      buildItpCompletionWitnessData({
        witnessPresent: false,
        witnessName: 'Jane Inspector',
        witnessCompany: '',
      }),
    ).toEqual({
      witnessPresent: false,
      witnessName: 'Jane Inspector',
      witnessCompany: null,
    });
  });

  it('keeps explicit null witness values as null', () => {
    expect(buildItpCompletionWitnessData({ witnessName: null, witnessCompany: null })).toEqual({
      witnessName: null,
      witnessCompany: null,
    });
  });
});

describe('shouldCreateFailedItpNcr', () => {
  it('is true for a failed item that has no linked NCR yet (first failure or orphan repair)', () => {
    expect(shouldCreateFailedItpNcr('failed', false)).toBe(true);
  });

  it('is false when the failed item already has a linked NCR (dedup)', () => {
    expect(shouldCreateFailedItpNcr('failed', true)).toBe(false);
  });

  it('is false when the new status is not failed, regardless of existing NCR', () => {
    expect(shouldCreateFailedItpNcr('completed', false)).toBe(false);
    expect(shouldCreateFailedItpNcr('pending', false)).toBe(false);
    expect(shouldCreateFailedItpNcr('not_applicable', true)).toBe(false);
  });
});

describe('assertExpectedPreviousItpCompletion', () => {
  const currentCompletion = {
    id: 'completion-1',
    status: 'completed',
    notes: 'Server already passed this',
    completedAt: new Date('2026-06-12T00:00:00.000Z'),
  };

  it('allows a queued offline write when the server row still matches the expected base', () => {
    expect(() =>
      assertExpectedPreviousItpCompletion(currentCompletion, {
        exists: true,
        id: 'completion-1',
        status: 'completed',
        notes: 'Server already passed this',
        completedAt: '2026-06-12T00:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('rejects a queued offline write when another user changed the completion state', () => {
    expect(() =>
      assertExpectedPreviousItpCompletion(currentCompletion, {
        exists: true,
        id: 'completion-1',
        status: 'pending',
        notes: null,
        completedAt: null,
      }),
    ).toThrow('ITP completion changed while this offline update was queued');
  });

  it('rejects a queued offline write when the user started from no row but one now exists', () => {
    expect(() =>
      assertExpectedPreviousItpCompletion(currentCompletion, {
        exists: false,
      }),
    ).toThrow('ITP completion changed while this offline update was queued');
  });

  it('allows old clients and online writes that do not send an expected base', () => {
    expect(() => assertExpectedPreviousItpCompletion(currentCompletion, undefined)).not.toThrow();
  });

  it('compares only expected-base fields that were supplied', () => {
    expect(() =>
      assertExpectedPreviousItpCompletion(currentCompletion, {
        exists: true,
        id: 'completion-1',
      }),
    ).not.toThrow();
  });
});

describe('buildItpSubbieCompletionNotifications', () => {
  const ctx = {
    projectId: 'project-1',
    lotId: 'lot-1',
    lotNumber: 'L-001',
    checklistItemId: 'item-1',
    itemDescription: 'Compaction check',
    subbieName: 'Acme Civil',
  };

  it('returns null when there are no recipients', () => {
    expect(buildItpSubbieCompletionNotifications([], ctx)).toBeNull();
  });

  it('builds one notification row per recipient and a matching summary', () => {
    const result = buildItpSubbieCompletionNotifications(
      [{ userId: 'pm-1' }, { userId: 'pm-2' }],
      ctx,
    );

    expect(result).not.toBeNull();
    expect(result!.rows).toEqual([
      {
        userId: 'pm-1',
        projectId: 'project-1',
        type: 'itp_subbie_completion',
        title: 'Subcontractor ITP Item Completed',
        message:
          'Acme Civil has marked ITP item "Compaction check" as completed on lot L-001. Verification required.',
        linkUrl: '/projects/project-1/lots/lot-1?tab=itp&highlight=item-1',
      },
      {
        userId: 'pm-2',
        projectId: 'project-1',
        type: 'itp_subbie_completion',
        title: 'Subcontractor ITP Item Completed',
        message:
          'Acme Civil has marked ITP item "Compaction check" as completed on lot L-001. Verification required.',
        linkUrl: '/projects/project-1/lots/lot-1?tab=itp&highlight=item-1',
      },
    ]);
    expect(result!.summary).toEqual({
      notificationsSent: 2,
      subcontractorCompany: 'Acme Civil',
      lotNumber: 'L-001',
      itemDescription: 'Compaction check',
    });
  });
});

describe('buildItpCompletionTransform', () => {
  it('derives completion flags for a completed item and attaches the linked NCR', () => {
    const completion = {
      id: 'completion-1',
      status: 'completed',
      verificationStatus: 'verified',
      attachments: [{ id: 'attachment-1' }],
    };
    const ncr = { id: 'ncr-1' };

    expect(buildItpCompletionTransform(completion, ncr)).toEqual({
      id: 'completion-1',
      status: 'completed',
      verificationStatus: 'verified',
      attachments: [{ id: 'attachment-1' }],
      isCompleted: true,
      isNotApplicable: false,
      isFailed: false,
      isVerified: true,
      isPendingVerification: false,
      isRejected: false,
      linkedNcr: ncr,
    });
  });

  it('treats not_applicable as completed and defaults missing attachments to an empty array', () => {
    const completion = {
      id: 'completion-2',
      status: 'not_applicable',
      verificationStatus: 'pending_verification',
    };

    expect(buildItpCompletionTransform(completion, null)).toEqual({
      id: 'completion-2',
      status: 'not_applicable',
      verificationStatus: 'pending_verification',
      isCompleted: true,
      isNotApplicable: true,
      isFailed: false,
      isVerified: false,
      isPendingVerification: true,
      isRejected: false,
      attachments: [],
      linkedNcr: null,
    });
  });

  it('flags a failed completion correctly', () => {
    const completion = { id: 'completion-3', status: 'failed' };

    const transformed = buildItpCompletionTransform(completion, { id: 'ncr-9' });
    expect(transformed.isFailed).toBe(true);
    expect(transformed.isCompleted).toBe(false);
    expect(transformed.linkedNcr).toEqual({ id: 'ncr-9' });
  });

  it('flags a rejected completion so the field worker sees the rejection (M15)', () => {
    const completion = {
      id: 'completion-4',
      status: 'completed',
      verificationStatus: 'rejected',
      verificationNotes: 'Photo does not show the bedding layer',
    };

    const transformed = buildItpCompletionTransform(completion, null);
    expect(transformed.isRejected).toBe(true);
    expect(transformed.isVerified).toBe(false);
    expect(transformed.isPendingVerification).toBe(false);
    // The rejection reason rides along on the spread so the UI can display it.
    expect(transformed.verificationNotes).toBe('Photo does not show the bedding layer');
  });
});

describe('deriveItpVerificationFlags (M15)', () => {
  it('flags a verified completion', () => {
    expect(deriveItpVerificationFlags('verified')).toEqual({
      isVerified: true,
      isPendingVerification: false,
      isRejected: false,
    });
  });

  it('flags a pending_verification completion', () => {
    expect(deriveItpVerificationFlags('pending_verification')).toEqual({
      isVerified: false,
      isPendingVerification: true,
      isRejected: false,
    });
  });

  it('flags a rejected completion', () => {
    expect(deriveItpVerificationFlags('rejected')).toEqual({
      isVerified: false,
      isPendingVerification: false,
      isRejected: true,
    });
  });

  it('treats "none" / null / undefined as no verification state', () => {
    const expected = { isVerified: false, isPendingVerification: false, isRejected: false };
    expect(deriveItpVerificationFlags('none')).toEqual(expected);
    expect(deriveItpVerificationFlags(null)).toEqual(expected);
    expect(deriveItpVerificationFlags(undefined)).toEqual(expected);
  });
});

describe('resolveItpRecompletionVerificationFields (H6)', () => {
  it('re-queues a rejected item to pending_verification and clears the prior verifier attribution', () => {
    expect(
      resolveItpRecompletionVerificationFields({
        existingVerificationStatus: 'rejected',
        computedVerificationStatus: 'pending_verification',
      }),
    ).toEqual({
      verificationStatus: 'pending_verification',
      verifiedById: null,
      verifiedAt: null,
      verificationNotes: null,
    });
  });

  it('auto-verifies a rejected item on resubmit when no verification is required, still clearing verifier fields', () => {
    expect(
      resolveItpRecompletionVerificationFields({
        existingVerificationStatus: 'rejected',
        computedVerificationStatus: 'verified',
      }),
    ).toEqual({
      verificationStatus: 'verified',
      verifiedById: null,
      verifiedAt: null,
      verificationNotes: null,
    });
  });

  it('clears a rejected item back to "none" when the completer is not a subcontractor (no computed status)', () => {
    expect(
      resolveItpRecompletionVerificationFields({
        existingVerificationStatus: 'rejected',
        computedVerificationStatus: undefined,
      }),
    ).toEqual({
      verificationStatus: 'none',
      verifiedById: null,
      verifiedAt: null,
      verificationNotes: null,
    });
  });

  it('only sets the computed status (no verifier clearing) when the item was not rejected', () => {
    expect(
      resolveItpRecompletionVerificationFields({
        existingVerificationStatus: 'none',
        computedVerificationStatus: 'pending_verification',
      }),
    ).toEqual({ verificationStatus: 'pending_verification' });
  });

  it('leaves verification untouched when the item was not rejected and nothing was computed', () => {
    expect(
      resolveItpRecompletionVerificationFields({
        existingVerificationStatus: 'pending_verification',
        computedVerificationStatus: undefined,
      }),
    ).toEqual({});
  });
});

describe('assertPendingVerificationNotDowngraded (M-OFFLINE)', () => {
  it('blocks a downgrade of a pending_verification completion (offline re-toggle drops verificationStatus)', () => {
    expect(() =>
      assertPendingVerificationNotDowngraded({
        existingVerificationStatus: 'pending_verification',
        computedVerificationStatus: undefined,
      }),
    ).toThrow('awaiting verification cannot be changed');

    try {
      assertPendingVerificationNotDowngraded({
        existingVerificationStatus: 'pending_verification',
        computedVerificationStatus: undefined,
      });
      throw new Error('expected AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).details).toEqual({ verificationStatus: 'pending_verification' });
    }
  });

  it('blocks a downgrade to verified (would self-verify a pending submission)', () => {
    expect(() =>
      assertPendingVerificationNotDowngraded({
        existingVerificationStatus: 'pending_verification',
        computedVerificationStatus: 'verified',
      }),
    ).toThrow(AppError);
  });

  it('allows a subbie amend/resubmit that keeps the item pending_verification', () => {
    expect(() =>
      assertPendingVerificationNotDowngraded({
        existingVerificationStatus: 'pending_verification',
        computedVerificationStatus: 'pending_verification',
      }),
    ).not.toThrow();
  });

  it('does not fire for completions that are not pending_verification', () => {
    for (const existing of ['none', 'verified', 'rejected', null, undefined] as const) {
      expect(() =>
        assertPendingVerificationNotDowngraded({
          existingVerificationStatus: existing,
          computedVerificationStatus: undefined,
        }),
      ).not.toThrow();
    }
  });
});
