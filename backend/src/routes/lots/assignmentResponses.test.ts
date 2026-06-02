import { describe, expect, it } from 'vitest';
import {
  buildLotAssignmentDeletedResponse,
  buildLotAssignmentResponse,
  buildLotAssignmentsResponse,
  buildLegacyLotAssignmentResponse,
} from './assignmentResponses.js';

describe('assignmentResponses', () => {
  it('builds list and single assignment responses', () => {
    const assignment = { id: 'assignment-1', lotId: 'lot-1' };
    const assignments = [assignment];

    expect(buildLotAssignmentsResponse(assignments)).toBe(assignments);
    expect(buildLotAssignmentResponse(assignment)).toBe(assignment);
  });

  it('builds the legacy assignment response', () => {
    expect(buildLegacyLotAssignmentResponse('lot-1', 'project-1', 'subbie-1')).toEqual({
      id: 'legacy-lot-1-subbie-1',
      lotId: 'lot-1',
      projectId: 'project-1',
      subcontractorCompanyId: 'subbie-1',
      canCompleteITP: false,
      itpRequiresVerification: true,
      status: 'active',
    });
  });

  it('builds the assignment removed response', () => {
    expect(buildLotAssignmentDeletedResponse()).toEqual({
      message: 'Assignment removed successfully',
    });
  });
});
