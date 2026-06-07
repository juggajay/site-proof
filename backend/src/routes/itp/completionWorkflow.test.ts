import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  buildItpCompletionTransform,
  buildItpCompletionWitnessData,
  buildItpSubbieCompletionNotifications,
  deriveItpCompletionStatus,
  isItpCompletionFinished,
  parseProjectRequiresSubcontractorVerification,
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
  it('is true only on the first transition into failed', () => {
    expect(shouldCreateFailedItpNcr('failed', 'pending')).toBe(true);
    expect(shouldCreateFailedItpNcr('failed', null)).toBe(true);
    expect(shouldCreateFailedItpNcr('failed', undefined)).toBe(true);
  });

  it('is false when already failed or when the new status is not failed', () => {
    expect(shouldCreateFailedItpNcr('failed', 'failed')).toBe(false);
    expect(shouldCreateFailedItpNcr('completed', 'pending')).toBe(false);
    expect(shouldCreateFailedItpNcr('pending', 'failed')).toBe(false);
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
          'Acme Civil has completed ITP item "Compaction check" on lot L-001. Verification required.',
        linkUrl: '/projects/project-1/lots/lot-1?tab=itp&highlight=item-1',
      },
      {
        userId: 'pm-2',
        projectId: 'project-1',
        type: 'itp_subbie_completion',
        title: 'Subcontractor ITP Item Completed',
        message:
          'Acme Civil has completed ITP item "Compaction check" on lot L-001. Verification required.',
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
});
