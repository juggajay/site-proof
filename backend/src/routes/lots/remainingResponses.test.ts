import { describe, expect, it } from 'vitest';

import {
  buildLegacyLotAssignmentMutationResponse,
  buildLotReadinessResponse,
  buildLotRoleResponse,
  buildLotUpdatedResponse,
} from './remainingResponses.js';

describe('lot remaining response helpers', () => {
  it('wraps updated lots and masks budget when the caller cannot view it', () => {
    const updatedLot = {
      id: 'lot-1',
      lotNumber: 'EW-001',
      budgetAmount: 125000,
      status: 'in_progress',
    };

    expect(buildLotUpdatedResponse(updatedLot, true)).toEqual({
      lot: updatedLot,
    });
    expect(buildLotUpdatedResponse(updatedLot, false)).toEqual({
      lot: {
        ...updatedLot,
        budgetAmount: null,
      },
    });
  });

  it('preserves legacy assignment messages and notification flags', () => {
    const updatedLot = {
      id: 'lot-1',
      assignedSubcontractor: { companyName: 'Demo Civil' },
    };

    expect(buildLegacyLotAssignmentMutationResponse('sub-1', updatedLot)).toEqual({
      message: 'Lot assigned to Demo Civil',
      lot: updatedLot,
      notificationsSent: true,
    });
    expect(
      buildLegacyLotAssignmentMutationResponse('sub-1', {
        id: 'lot-1',
        assignedSubcontractor: null,
      }),
    ).toEqual({
      message: 'Lot assigned to subcontractor',
      lot: {
        id: 'lot-1',
        assignedSubcontractor: null,
      },
      notificationsSent: true,
    });
    expect(buildLegacyLotAssignmentMutationResponse(null, updatedLot)).toEqual({
      message: 'Lot unassigned from subcontractor',
      lot: updatedLot,
      notificationsSent: false,
    });
  });

  it('builds role-check and readiness envelopes without changing keys', () => {
    expect(buildLotRoleResponse('quality_manager', true, true, true, true, true)).toEqual({
      role: 'quality_manager',
      isQualityManager: true,
      canConformLots: true,
      canVerifyTestResults: true,
      canCloseNCRs: true,
      canManageITPTemplates: true,
    });

    const readiness = { blockers: [{ id: 'itp', label: 'Assign ITP' }] };
    expect(buildLotReadinessResponse(readiness)).toEqual({ readiness });
  });
});
