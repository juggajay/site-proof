import { describe, expect, it } from 'vitest';
import { buildDocketApprovedResponse, resolveDocketApprovedTotals } from './approvalResponse.js';

describe('resolveDocketApprovedTotals', () => {
  it('uses adjusted totals when they are provided, including zero', () => {
    expect(
      resolveDocketApprovedTotals({
        adjustedLabourHours: 0,
        adjustedPlantHours: 4.5,
        submittedLabourHours: 12,
        submittedPlantHours: 8,
      }),
    ).toEqual({
      labourApproved: 0,
      plantApproved: 4.5,
    });
  });

  it('falls back to submitted hours when adjusted totals are omitted', () => {
    const labourSubmitted = { toString: () => '12.5' };
    const plantSubmitted = null;

    expect(
      resolveDocketApprovedTotals({
        submittedLabourHours: labourSubmitted,
        submittedPlantHours: plantSubmitted,
      }),
    ).toEqual({
      labourApproved: labourSubmitted,
      plantApproved: plantSubmitted,
    });
  });
});

describe('buildDocketApprovedResponse', () => {
  it('preserves the approved docket response shape', () => {
    const approvedAt = new Date('2026-05-21T10:30:00.000Z');

    expect(
      buildDocketApprovedResponse({
        updatedDocket: {
          id: 'abc123def456',
          status: 'approved',
          approvedAt,
          subcontractorCompany: {
            companyName: 'QA Civil Pty Ltd',
          },
        },
        subcontractorUsers: [
          { email: 'subbie@example.com', fullName: 'Subbie User' },
          { email: 'empty-name@example.com', fullName: null },
        ],
      }),
    ).toEqual({
      message: 'Docket approved successfully',
      docket: {
        id: 'abc123def456',
        docketNumber: 'DKT-ABC123',
        subcontractor: 'QA Civil Pty Ltd',
        status: 'approved',
        approvedAt,
      },
      notifiedUsers: [
        { email: 'subbie@example.com', fullName: 'Subbie User' },
        { email: 'empty-name@example.com', fullName: null },
      ],
    });
  });

  it('includes a diary sync warning when approval cannot populate the diary', () => {
    const approvedAt = new Date('2026-05-21T10:30:00.000Z');

    const response = buildDocketApprovedResponse({
      updatedDocket: {
        id: 'abc123def456',
        status: 'approved',
        approvedAt,
        subcontractorCompany: {
          companyName: 'QA Civil Pty Ltd',
        },
      },
      subcontractorUsers: [],
      diarySync: {
        status: 'skipped',
        code: 'DIARY_LOCKED',
        message:
          'Docket approved, but diary auto-population was skipped because the daily diary is locked.',
      },
    });

    expect(response.diarySync).toEqual({
      status: 'skipped',
      code: 'DIARY_LOCKED',
      message:
        'Docket approved, but diary auto-population was skipped because the daily diary is locked.',
    });
  });
});
