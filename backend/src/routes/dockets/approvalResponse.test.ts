import { describe, expect, it } from 'vitest';
import {
  buildDocketApprovalEntryUpdates,
  buildDocketApprovedResponse,
  resolveDocketApprovedTotals,
} from './approvalResponse.js';

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

  it('clamps an approved class to 0 when it has no entries (M37: no phantom hours)', () => {
    expect(
      resolveDocketApprovedTotals({
        adjustedLabourHours: 6,
        adjustedPlantHours: 4,
        submittedLabourHours: 6,
        submittedPlantHours: 4,
        labourEntryCount: 0,
        plantEntryCount: 2,
      }),
    ).toEqual({
      labourApproved: 0,
      plantApproved: 4,
    });
  });

  it('clamps the submitted fallback to 0 when a class has no entries', () => {
    expect(
      resolveDocketApprovedTotals({
        submittedLabourHours: 10,
        submittedPlantHours: 5,
        labourEntryCount: 3,
        plantEntryCount: 0,
      }),
    ).toEqual({
      labourApproved: 10,
      plantApproved: 0,
    });
  });
});

describe('buildDocketApprovalEntryUpdates', () => {
  it('copies submitted entry hours and costs when approval totals are unchanged', () => {
    expect(
      buildDocketApprovalEntryUpdates({
        labourEntries: [
          { id: 'labour-1', submittedHours: 8, hourlyRate: 45.5, submittedCost: 364 },
        ],
        plantEntries: [{ id: 'plant-1', hoursOperated: 3, hourlyRate: 150, submittedCost: 450 }],
        labourApprovedHours: 8,
        plantApprovedHours: 3,
        adjustmentReason: null,
      }),
    ).toEqual({
      labour: [
        {
          id: 'labour-1',
          approvedHours: 8,
          approvedCost: 364,
          adjustmentReason: null,
        },
      ],
      plant: [
        {
          id: 'plant-1',
          approvedCost: 450,
          adjustmentReason: null,
        },
      ],
    });
  });

  it('pro-rates approved entry costs from adjusted total hours', () => {
    expect(
      buildDocketApprovalEntryUpdates({
        labourEntries: [
          { id: 'labour-1', submittedHours: 8, hourlyRate: 45.5, submittedCost: 364 },
        ],
        plantEntries: [{ id: 'plant-1', hoursOperated: 3, hourlyRate: 150, submittedCost: 450 }],
        labourApprovedHours: 7,
        plantApprovedHours: 2.5,
        adjustmentReason: 'Approved less time after review',
      }),
    ).toEqual({
      labour: [
        {
          id: 'labour-1',
          approvedHours: 7,
          approvedCost: 318.5,
          adjustmentReason: 'Approved less time after review',
        },
      ],
      plant: [
        {
          id: 'plant-1',
          approvedCost: 375,
          adjustmentReason: 'Approved less time after review',
        },
      ],
    });
  });

  it('rounds approved entry costs to cents with the docket money helper', () => {
    expect(
      buildDocketApprovalEntryUpdates({
        labourEntries: [
          { id: 'labour-1', submittedHours: 1, hourlyRate: 1.005, submittedCost: 1.005 },
        ],
        plantEntries: [{ id: 'plant-1', hoursOperated: 1, hourlyRate: 1.005, submittedCost: 0 }],
        labourApprovedHours: 1,
        plantApprovedHours: 1,
        adjustmentReason: null,
      }),
    ).toEqual({
      labour: [
        {
          id: 'labour-1',
          approvedHours: 1,
          approvedCost: 1.01,
          adjustmentReason: null,
        },
      ],
      plant: [
        {
          id: 'plant-1',
          approvedCost: 1.01,
          adjustmentReason: null,
        },
      ],
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
