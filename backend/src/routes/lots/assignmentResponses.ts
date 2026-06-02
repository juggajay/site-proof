export function buildLotAssignmentsResponse<T>(assignments: T[]): T[] {
  return assignments;
}

export function buildLotAssignmentResponse<T>(assignment: T): T {
  return assignment;
}

export function buildLegacyLotAssignmentResponse(
  lotId: string,
  projectId: string,
  subcontractorCompanyId: string,
) {
  return {
    id: `legacy-${lotId}-${subcontractorCompanyId}`,
    lotId,
    projectId,
    subcontractorCompanyId,
    canCompleteITP: false,
    itpRequiresVerification: true,
    status: 'active',
  };
}

export function buildLotAssignmentDeletedResponse() {
  return { message: 'Assignment removed successfully' };
}
